/*
# Security hardening: close super_admin privilege escalation

Problem found during audit:
  - `tenant_memberships_insert/update` RLS only checked that the ACTOR was
    already an admin of the target tenant — it never checked what ROLE VALUE
    was being written. Any tenant admin (or, via the invite-employee edge
    function, even an hr_assistant) could INSERT/UPDATE a tenant_memberships
    row — or an invitations row — with role = 'super_admin' for themselves,
    which the client app then trusted to unlock the Super Admin dashboard.
  - This is a full platform-wide privilege escalation: a single tenant's
    admin could grant themselves visibility/control over every tenant.

Fix, defense in depth across three layers:
  1. RLS: nobody may INSERT/UPDATE a row with role = 'super_admin' on
     tenant_memberships or invitations unless they are ALREADY a verified
     super admin (checked via the JWT app_metadata claim, which a client
     cannot forge — auth.jwt() is set by Supabase Auth server-side only).
  2. Trigger: same rule enforced again on tenant_memberships as a backstop,
     but only for requests carrying a real end-user JWT (auth.uid() IS NOT
     NULL). Requests made with the service-role key (auth.uid() IS NULL) —
     i.e. our trusted edge functions — are left alone, because those flows
     are validated at the application layer before they ever reach the DB.
  3. Remediation: demote any tenant_memberships/invitations rows that may
     already have been escalated this way, other than the 4 protected
     founder accounts.
*/

-- =========================================================
-- 1. Remediate any existing unauthorized super_admin grants
-- =========================================================
UPDATE public.tenant_memberships m
SET role = 'admin'
WHERE m.role = 'super_admin'
  AND NOT public.is_protected_super_admin(
    (SELECT email FROM auth.users WHERE id = m.user_id)
  );

UPDATE public.invitations
SET role = 'employee'
WHERE role = 'super_admin'
  AND status = 'pending'
  AND NOT public.is_protected_super_admin(email);

-- =========================================================
-- 2. tenant_memberships: role value itself must be checked
-- =========================================================
DROP POLICY IF EXISTS "memberships_insert_tenant_admin_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_insert_tenant_admin_or_super"
ON public.tenant_memberships FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    public.is_tenant_member(tenant_id)
    AND public.tenant_role(tenant_id) IN ('admin', 'super_admin')
    AND role <> 'super_admin'
  )
);

DROP POLICY IF EXISTS "memberships_update_tenant_admin_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_update_tenant_admin_or_super"
ON public.tenant_memberships FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin')))
WITH CHECK (
  public.is_super_admin()
  OR (
    public.is_tenant_member(tenant_id)
    AND public.tenant_role(tenant_id) IN ('admin', 'super_admin')
    AND role <> 'super_admin'
  )
);

-- =========================================================
-- 3. invitations: same rule — an invite can never smuggle in
--    the super_admin role unless issued by a real super admin
-- =========================================================
DROP POLICY IF EXISTS "invitations_insert_member_or_super" ON public.invitations;
CREATE POLICY "invitations_insert_member_or_super"
ON public.invitations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND public.is_tenant_member(tenant_id)
    AND public.tenant_role(tenant_id) IN ('admin', 'super_admin')
    AND role <> 'super_admin'
  )
);

-- =========================================================
-- 4. Trigger backstop on tenant_memberships (belt & suspenders)
--    Only guards requests carrying a real end-user JWT; trusted
--    service-role flows (our edge functions) are left alone since
--    they are validated before they ever reach the database.
-- =========================================================
CREATE OR REPLACE FUNCTION public.ensure_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Protected founder accounts always keep the super_admin role.
  IF public.is_protected_super_admin(
    (SELECT email FROM auth.users WHERE id = NEW.user_id)
  ) THEN
    NEW.role := 'super_admin';
    NEW.status := 'active';
    RETURN NEW;
  END IF;

  -- Block privilege escalation performed directly by an end user
  -- (i.e. NOT via our service-role edge functions, which validate
  -- this at the application layer before reaching the DB).
  IF NEW.role = 'super_admin' AND auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a verified super administrator can grant the super_admin role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_super_admin_role ON public.tenant_memberships;
CREATE TRIGGER ensure_super_admin_role
  BEFORE INSERT OR UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_super_admin_role();
