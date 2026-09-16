/*
# Fix: 20 SECURITY DEFINER functions had a mutable search_path

Found via Supabase's built-in security advisor. Every SECURITY DEFINER
function in this schema (the same helper functions every RLS policy in
this codebase relies on — is_super_admin, is_tenant_member,
owns_employee_row, etc.) was defined without an explicit `search_path`.

A SECURITY DEFINER function runs with the PRIVILEGES of the function's
owner, but by default still resolves unqualified object references using
the CALLER's current search_path. If a caller ever has permission to
create objects in a schema that appears earlier in the search_path than
`public` (e.g. via `CREATE SCHEMA` or a schema they already own), they
could shadow a table/function referenced inside the SECURITY DEFINER body
and have it execute with elevated privileges — a well-known Postgres
privilege-escalation vector. In this project no role currently has such
schema-creation rights, so this was not immediately exploitable, but it is
exactly the kind of latent gap that becomes dangerous the moment schema
privileges change (a new integration, a migration tool, etc.) — cheap and
correct to close now rather than rely on "nothing currently has the
permission to exploit it".

Fix: pin every one of these functions to `SET search_path = public`, so
they always resolve `public.*` objects regardless of the caller's own
search_path. This changes no logic and no return values — purely a
hardening measure. (protect_tenant_billing_fields, from migration 0022,
already had this set correctly and needs no change.)

Separately: is_protected_super_admin(email) and is_non_deletable_admin(email)
were callable directly via PostgREST RPC by anon and authenticated (and,
it turned out, PUBLIC — revoking from anon/authenticated alone was not
enough, since PUBLIC grants are separate and take precedence). Given an
arbitrary email, either lets a caller probe whether that address belongs
to a protected founder/admin account — a minor information disclosure,
not a privilege escalation, but with no legitimate reason for a client to
call them directly (confirmed: no reference anywhere in the frontend).
They are only ever needed from inside other SECURITY DEFINER trigger
functions (prevent_protected_admin_deletion, ensure_super_admin_role),
which still execute fine after this revoke since they run as the function
owner, not as the original calling role.

Applied directly to production via the Supabase MCP connector on
2026-09; recorded here for parity with the migration history.
*/

ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.is_tenant_member(tenant uuid) SET search_path = public;
ALTER FUNCTION public.tenant_role(tenant uuid) SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.is_protected_super_admin(p_email text) SET search_path = public;
ALTER FUNCTION public.is_non_deletable_admin(p_email text) SET search_path = public;
ALTER FUNCTION public.prevent_protected_admin_deletion() SET search_path = public;
ALTER FUNCTION public.ensure_super_admin_role() SET search_path = public;
ALTER FUNCTION public.tenant_role_in(tenant uuid, roles text[]) SET search_path = public;
ALTER FUNCTION public.my_employee_id(tenant uuid) SET search_path = public;
ALTER FUNCTION public.can_view_communication(p_tenant uuid, p_scope text, p_recipient_ids jsonb, p_sender uuid) SET search_path = public;
ALTER FUNCTION public.provision_leave_balance() SET search_path = public;
ALTER FUNCTION public.protect_employee_sensitive_fields() SET search_path = public;
ALTER FUNCTION public.is_admin_like_member(tenant uuid) SET search_path = public;
ALTER FUNCTION public.owns_employee_row(target_employee_id uuid) SET search_path = public;
ALTER FUNCTION public.is_tenant_payroll_admin(tenant uuid) SET search_path = public;
ALTER FUNCTION public.tenant_employee_limit(target_tenant uuid) SET search_path = public;
ALTER FUNCTION public.enforce_employee_limit() SET search_path = public;
ALTER FUNCTION public.tenant_is_active(target_tenant uuid) SET search_path = public;
ALTER FUNCTION public.block_writes_if_tenant_inactive() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_protected_super_admin(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_non_deletable_admin(text) FROM PUBLIC;
