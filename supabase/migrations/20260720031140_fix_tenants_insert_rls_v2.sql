-- Fix: explicit INSERT policy on tenants (in addition to the create-tenant edge function)
DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Add owner_id column alias if missing (created_by serves as owner)
-- Ensure tenant_memberships SELECT also lets a user see their own memberships even before tenant exists
DROP POLICY IF EXISTS "memberships_select_member_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_select_member_or_super"
ON public.tenant_memberships FOR SELECT
TO authenticated
USING (public.is_super_admin() OR user_id = auth.uid() OR public.is_tenant_member(tenant_id));
