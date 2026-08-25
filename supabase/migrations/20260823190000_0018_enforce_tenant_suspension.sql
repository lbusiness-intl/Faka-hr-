/*
# Enforce tenant suspension / trial expiry at the database level

Found during the "is every plan/billing promise actually enforced?"
audit (same family as the module paywall and employee-limit bypasses
fixed earlier this session): when a tenant's trial expires or their
subscription is suspended (payment failure, cancellation via the
Stripe webhook), the ONLY thing that stops them from continuing to use
the platform is a React-level screen (`TrialBlocked` in
DashboardShell.tsx) that replaces the dashboard content. Nothing at
the database layer checks tenant status — a suspended tenant's admin
(or any automated script using their still-valid credentials) could
keep running payroll, adding employees, approving leave, etc. forever
by simply calling the Supabase API directly instead of using the web
app.

Fix: a reusable trigger that blocks INSERT/UPDATE/DELETE on the
tables that represent "actually operating the business" once a
tenant is suspended or its trial has expired. Reading data (SELECT)
is deliberately NOT blocked — people still need to see their own
data, and the billing/upgrade page itself needs to keep working so a
suspended tenant can actually pay and get reactivated. Super admins
are always exempt, consistent with every other policy in this schema.
*/

CREATE OR REPLACE FUNCTION public.tenant_is_active(target_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  t_status text;
  t_trial_end timestamptz;
BEGIN
  SELECT status, trial_ends_at INTO t_status, t_trial_end
  FROM public.tenants WHERE id = target_tenant;

  IF t_status IS NULL THEN
    RETURN false; -- tenant doesn't exist
  END IF;

  IF t_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF t_status = 'trial' AND t_trial_end IS NOT NULL AND t_trial_end < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_writes_if_tenant_inactive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_tenant uuid;
BEGIN
  target_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);

  IF public.is_super_admin() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.tenant_is_active(target_tenant) THEN
    RAISE EXCEPTION 'TENANT_INACTIVE: this workspace''s subscription is not active. Please renew or upgrade your plan to continue.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'employees', 'payroll_runs', 'payslips', 'payroll_adjustments',
    'leave_requests', 'advances', 'claims', 'attendance', 'overtime',
    'documents', 'goals', 'reviews', 'trainings', 'assets',
    'recruitment_postings', 'recruitment_candidates', 'communications',
    'custom_roles', 'events'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS block_writes_if_tenant_inactive ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER block_writes_if_tenant_inactive
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_writes_if_tenant_inactive()',
      t
    );
  END LOOP;
END $$;
