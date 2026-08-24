/*
# Enforce employee limits per plan (was display-only)

Found during the "is every module truly plan-gated?" audit: the
per-plan employee limit (Starter 15, Pro 50, Premium 150, Enterprise
unlimited) was only ever displayed as a label in the UI
("limite 15 employees") — nothing actually stopped a Starter tenant
from creating an unlimited number of employee records, whether through
the UI or a direct API call. The same class of gap as the module
paywall bypass fixed earlier this session (a promise shown in the
interface that isn't backed by real enforcement).

Fix: a BEFORE INSERT trigger on `employees` that looks up the tenant's
effective employee limit — checking `plan_overrides` first (so a super
admin's custom deal for a specific tenant is respected), then falling
back to the same default limits used in the app's plans.ts — and
rejects the insert once that limit is reached. Employees with status
'terminated' don't count against the limit; every other status
(active, pending_invite, ...) does, since they still occupy a seat.
*/

CREATE OR REPLACE FUNCTION public.tenant_employee_limit(target_tenant uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  tenant_plan text;
  override_limit int;
BEGIN
  SELECT plan INTO tenant_plan FROM public.tenants WHERE id = target_tenant;
  IF tenant_plan IS NULL THEN
    RETURN 15; -- unknown tenant/plan: fall back to the safest (lowest) limit
  END IF;

  -- A super admin may have set a custom limit for this specific plan
  -- via the Plan Editor (plan_overrides.employee_limit, NULL = unlimited
  -- override). If a row exists for this plan_id, it always wins.
  SELECT employee_limit INTO override_limit
  FROM public.plan_overrides
  WHERE plan_id = tenant_plan;
  IF FOUND THEN
    RETURN override_limit; -- may be NULL, meaning unlimited
  END IF;

  RETURN CASE tenant_plan
    WHEN 'starter' THEN 15
    WHEN 'pro' THEN 50
    WHEN 'premium' THEN 150
    WHEN 'enterprise' THEN NULL -- unlimited
    ELSE 15
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_employee_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  effective_limit int;
  current_count int;
BEGIN
  effective_limit := public.tenant_employee_limit(NEW.tenant_id);
  IF effective_limit IS NULL THEN
    RETURN NEW; -- unlimited plan
  END IF;

  SELECT count(*) INTO current_count
  FROM public.employees
  WHERE tenant_id = NEW.tenant_id
    AND status <> 'terminated';

  IF current_count >= effective_limit THEN
    RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED: this plan allows up to % employees. Upgrade your plan to add more.', effective_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_employee_limit ON public.employees;
CREATE TRIGGER enforce_employee_limit
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_limit();
