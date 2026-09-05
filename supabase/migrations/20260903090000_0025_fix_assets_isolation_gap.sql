/*
# Fix: assets table never received the personal-data-isolation hardening

## The problem
Migrations 0012–0014 fixed employee-personal tables (employees, payslips,
advances, claims, leave_requests, attendance, overtime, reviews, goals,
documents, trainings) so a plain "employee" role member can only see/
manage rows tied to their own employee record, while admin-like roles
(admin, hr_manager, hr_assistant, recruiter, payroll_officer, finance,
manager, team_lead) keep tenant-wide visibility.

`assets` was missed. It still only checked `is_tenant_member(tenant_id)` —
true for ANY active member — on SELECT *and* on INSERT/UPDATE/DELETE. In
practice this meant a plain employee could, by calling the Supabase client
directly:
  - see every colleague's assigned equipment (assigned_to on public.assets)
  - create new asset rows for the company
  - reassign or edit anyone's equipment record
  - delete any asset record entirely

## The fix
Same is_admin_like_member() / owns_employee_row() pattern already used for
documents and trainings — with one addition verified against the actual
client code (EmployeeDashboard's StaffAssets screen intentionally lets
any employee browse *unassigned* ("available") inventory, e.g. to see what
equipment exists before requesting some; that legitimate feature is kept):
  - SELECT: super admin, OR admin-like tenant role, OR the asset is
    assigned to the caller's own employee record (assigned_to), OR the
    asset is unassigned ("available") — but never another named
    colleague's assigned equipment
  - INSERT / UPDATE / DELETE: super admin or admin-like tenant role only
    — a plain employee was never meant to create or delete equipment
    records
*/

DROP POLICY IF EXISTS "assets_select_member_or_super" ON public.assets;
CREATE POLICY "assets_select_member_or_super"
ON public.assets FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_admin_like_member(tenant_id)
  OR public.owns_employee_row(assigned_to)
  OR (status = 'available' AND public.is_tenant_member(tenant_id))
);

DROP POLICY IF EXISTS "assets_insert_member_or_super" ON public.assets;
CREATE POLICY "assets_insert_member_or_super"
ON public.assets FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "assets_update_member_or_super" ON public.assets;
CREATE POLICY "assets_update_member_or_super"
ON public.assets FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "assets_delete_member_or_super" ON public.assets;
CREATE POLICY "assets_delete_member_or_super"
ON public.assets FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));
