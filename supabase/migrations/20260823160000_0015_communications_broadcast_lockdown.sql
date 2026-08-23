/*
# Lock down communications (company announcements) to admin-like roles

The UI already hides the "compose" form from plain employees
(CommunicationsPanel isEmployee=true), but the underlying RLS still let
ANY tenant member INSERT/UPDATE a communications row via a direct API
call — meaning a regular employee could broadcast a fake company-wide
"announcement" to every colleague, or edit/redirect an existing one,
entirely bypassing the UI restriction. Reading communications addressed
to you stays open to every tenant member; composing/broadcasting is
restricted to admin-like roles (and super admins), matching the actual
intent of the feature.
*/

DROP POLICY IF EXISTS "comms_insert" ON public.communications;
CREATE POLICY "comms_insert" ON public.communications FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "comms_update" ON public.communications;
CREATE POLICY "comms_update" ON public.communications FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));
