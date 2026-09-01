/*
# Fix: the super_admin invitation guard only covered INSERT, not UPDATE

## The problem
Migration 0011 correctly stopped a tenant admin from *creating*
(`INSERT`) an invitation with `role = 'super_admin'` unless they were
already a verified super admin. But `invitations_update_member_or_super`
(migration "overtime_documents_invitations", never touched since) still
allows any tenant admin to UPDATE an invitation belonging to their own
tenant with NO restriction on which columns change. That left a direct
bypass:

  1. A tenant admin creates an ordinary invitation for their own tenant
     (role = 'employee', allowed).
  2. They UPDATE that same row and set role = 'super_admin'.
  3. If accepted, invite-employee's accept/activate actions would then
     grant real platform-wide app_metadata.role = 'super_admin'.

## The fix
1. Tighten `invitations_update_member_or_super`'s WITH CHECK the same way
   migration 0011 tightened INSERT: a tenant-member update must keep
   role <> 'super_admin'. Only a verified super admin may write that role,
   on insert or update.
2. Defense in depth on the application side (see invite-employee edge
   function): the accept/activate actions now also require tenant_id IS
   NULL before granting app_metadata.role = 'super_admin', since a
   legitimate platform-staff invitation is never tied to a tenant. This
   migration alone already closes the hole at the database layer; the
   edge-function check is a second, independent guard.
*/

DROP POLICY IF EXISTS "invitations_update_member_or_super" ON public.invitations;
CREATE POLICY "invitations_update_member_or_super"
ON public.invitations FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
)
WITH CHECK (
  public.is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND public.is_tenant_member(tenant_id)
    AND role <> 'super_admin'
  )
);
