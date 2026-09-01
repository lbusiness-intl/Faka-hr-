/*
# Allow platform-level (tenant-less) audit log entries

Context: the new platform-staff management actions in the invite-employee
edge function (invite_staff / revoke_staff — granting or removing the
super_admin app_metadata role) are not scoped to any single tenant, so
they have no tenant_id to record the audit entry against. audit_logs.tenant_id
was NOT NULL, which would reject those inserts outright.

This migration only relaxes that one constraint. It does not change any
RLS policy:
  - SELECT/INSERT already read `public.is_super_admin() OR
    public.is_tenant_member(tenant_id)` — with tenant_id NULL,
    is_tenant_member() evaluates to false for everyone, so a platform-level
    audit row remains visible only to verified super admins, which is the
    correct, narrower audience for this kind of event.
  - The edge function itself writes these rows via the service-role key,
    which bypasses RLS entirely, same as every other audit_logs insert in
    that function.
*/

ALTER TABLE public.audit_logs ALTER COLUMN tenant_id DROP NOT NULL;
