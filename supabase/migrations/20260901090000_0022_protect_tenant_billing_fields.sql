/*
# Fix: tenant admins could self-escalate their own plan/limits

## The problem
`tenants_update_member_or_super` (migration 0001) allows UPDATE on a
tenant's own row to ANY tenant member (`public.is_tenant_member(id)`),
with no restriction on which columns can be changed. RLS in Postgres is
row-level, not column-level, so this silently also allowed a tenant's own
admin to call the Supabase client directly (bypassing the app's UI and
its billing/Stripe/PayUnit flow entirely) and do, e.g.:

  supabase.from('tenants')
    .update({ plan: 'enterprise', employee_limit: 999999, status: 'active' })
    .eq('id', myOwnTenantId)

...which would succeed. In the actual app, the only tenant-writable field
on `tenants` is `name` (see AdminDashboard.tsx Settings) — plan, status,
employee_limit, trial_ends_at, current_period_end and sales_code are only
ever meant to be written by a super admin (SuperAdminDashboard) or by the
billing edge functions (service role, which bypasses RLS regardless).

## The fix
A BEFORE UPDATE trigger that, for any actor who is not a verified super
admin, resets the billing/plan-sensitive columns back to their previous
value — silently ignoring any attempt to change them, while still letting
ordinary tenant-editable fields (name, industry, region, etc.) go through
exactly as before. This does not change any existing RLS policy or
behavior for legitimate super-admin or service-role writes.
*/

CREATE OR REPLACE FUNCTION public.protect_tenant_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    NEW.plan := OLD.plan;
    NEW.status := OLD.status;
    NEW.employee_limit := OLD.employee_limit;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.current_period_end := OLD.current_period_end;
    NEW.sales_code := OLD.sales_code;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_tenant_billing_fields ON public.tenants;
CREATE TRIGGER protect_tenant_billing_fields
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_billing_fields();
