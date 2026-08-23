/*
# Security hardening: personal data isolation within a tenant

Problem found during audit:
  Every policy on employee-personal tables (employees, payslips, advances,
  claims, leave_requests, attendance, overtime, reviews, goals) only checked
  `is_tenant_member(tenant_id)` — true for ANY active member of a company,
  regardless of role. In practice this meant a single regular employee could
  query the table directly (bypassing the UI, e.g. from the browser console)
  and read every colleague's salary, payslips, salary-advance amounts,
  expense claims, attendance/selfie logs, overtime pay and performance
  reviews for the entire company — not just their own.

Fix: introduce `is_admin_like_member(tenant)` — true only for tenant roles
that are meant to manage staff (admin, hr_manager, hr_assistant, recruiter,
payroll_officer, finance, manager, team_lead) or a real super admin. Rewrite
SELECT (and INSERT where relevant) so a plain "employee" role member can only
ever see/insert rows tied to their OWN employee record; admin-like roles keep
full tenant-wide visibility as before, which the admin dashboards need.
*/

CREATE OR REPLACE FUNCTION public.is_admin_like_member(tenant uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = tenant
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN (
        'admin', 'hr_manager', 'hr_assistant', 'recruiter',
        'payroll_officer', 'finance', 'manager', 'team_lead', 'super_admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_employee_row(target_employee_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = target_employee_id AND e.user_id = auth.uid()
  );
$$;

-- =========================================================
-- employees — salary, exit reason, etc. are not for peers
-- =========================================================
DROP POLICY IF EXISTS "employees_select_member_or_super" ON public.employees;
CREATE POLICY "employees_select_member_or_super"
ON public.employees FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR user_id = auth.uid());

-- =========================================================
-- leave_requests
-- =========================================================
DROP POLICY IF EXISTS "leaves_select_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_select_member_or_super"
ON public.leave_requests FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "leaves_insert_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_insert_member_or_super"
ON public.leave_requests FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- payroll_runs (company-wide aggregate; admin-like only)
-- =========================================================
DROP POLICY IF EXISTS "payroll_select_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_select_member_or_super"
ON public.payroll_runs FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- payslips — an employee may only ever see their own
-- =========================================================
DROP POLICY IF EXISTS "payslips_select_member_or_super" ON public.payslips;
CREATE POLICY "payslips_select_member_or_super"
ON public.payslips FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- advances
-- =========================================================
DROP POLICY IF EXISTS "advances_select_member_or_super" ON public.advances;
CREATE POLICY "advances_select_member_or_super"
ON public.advances FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "advances_insert_member_or_super" ON public.advances;
CREATE POLICY "advances_insert_member_or_super"
ON public.advances FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- claims
-- =========================================================
DROP POLICY IF EXISTS "claims_select_member_or_super" ON public.claims;
CREATE POLICY "claims_select_member_or_super"
ON public.claims FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "claims_insert_member_or_super" ON public.claims;
CREATE POLICY "claims_insert_member_or_super"
ON public.claims FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- attendance (includes selfie_url — biometric-adjacent, personal)
-- =========================================================
DROP POLICY IF EXISTS "attendance_select_member_or_super" ON public.attendance;
CREATE POLICY "attendance_select_member_or_super"
ON public.attendance FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- overtime
-- =========================================================
DROP POLICY IF EXISTS "overtime_select_member_or_super" ON public.overtime;
CREATE POLICY "overtime_select_member_or_super"
ON public.overtime FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- reviews (performance reviews — confidential)
-- =========================================================
DROP POLICY IF EXISTS "reviews_select_member_or_super" ON public.reviews;
CREATE POLICY "reviews_select_member_or_super"
ON public.reviews FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

-- =========================================================
-- goals (personal performance goals)
-- =========================================================
DROP POLICY IF EXISTS "goals_select_member_or_super" ON public.goals;
CREATE POLICY "goals_select_member_or_super"
ON public.goals FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));
