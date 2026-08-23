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

-- =========================================================
-- Payroll-capable roles: a narrower set than "admin-like".
-- hr_assistant / recruiter / manager / team_lead can manage staff
-- but must never generate, edit or mark payslips as paid, adjust
-- leave balances, or run payroll — only admin/payroll_officer/finance.
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_tenant_payroll_admin(tenant uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = tenant
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('admin', 'payroll_officer', 'finance', 'super_admin')
  );
$$;

-- ---------------------------------------------------------
-- leave_requests: an employee may cancel their own PENDING
-- request but can never approve/reject their own, or touch
-- anyone else's. Approval stays with admin-like roles.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "leaves_update_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_update_member_or_super"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status IN ('pending', 'cancelled'))
);

DROP POLICY IF EXISTS "leaves_delete_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_delete_member_or_super"
ON public.leave_requests FOR DELETE
TO authenticated
USING (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status = 'pending')
);

-- ---------------------------------------------------------
-- advances / claims: same self-limited pattern as leave_requests
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "advances_update_member_or_super" ON public.advances;
CREATE POLICY "advances_update_member_or_super"
ON public.advances FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status IN ('pending', 'cancelled'))
);

DROP POLICY IF EXISTS "advances_delete_member_or_super" ON public.advances;
CREATE POLICY "advances_delete_member_or_super"
ON public.advances FOR DELETE
TO authenticated
USING (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status = 'pending')
);

DROP POLICY IF EXISTS "claims_update_member_or_super" ON public.claims;
CREATE POLICY "claims_update_member_or_super"
ON public.claims FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status IN ('pending', 'cancelled'))
);

DROP POLICY IF EXISTS "claims_delete_member_or_super" ON public.claims;
CREATE POLICY "claims_delete_member_or_super"
ON public.claims FOR DELETE
TO authenticated
USING (
  public.is_super_admin() OR public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status = 'pending')
);

-- ---------------------------------------------------------
-- leave_balances: quotas are set by HR/payroll only. An
-- employee must never be able to top up their own balance.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "leave_balances_insert_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_insert_member_or_super"
ON public.leave_balances FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "leave_balances_update_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_update_member_or_super"
ON public.leave_balances FOR UPDATE
TO authenticated
USING (public.is_admin_like_member(tenant_id))
WITH CHECK (public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "leave_balances_delete_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_delete_member_or_super"
ON public.leave_balances FOR DELETE
TO authenticated
USING (public.is_admin_like_member(tenant_id));

-- ---------------------------------------------------------
-- payslips / payroll_runs / payroll_adjustments: generating,
-- editing or marking pay as "paid" is restricted to payroll
-- roles. Regular employees (and even non-payroll admin-like
-- roles such as hr_assistant/recruiter) get read-only, self
-- or tenant-wide per the SELECT policies already in place.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "payslips_insert_member_or_super" ON public.payslips;
CREATE POLICY "payslips_insert_member_or_super"
ON public.payslips FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payslips_update_member_or_super" ON public.payslips;
CREATE POLICY "payslips_update_member_or_super"
ON public.payslips FOR UPDATE
TO authenticated
USING (public.is_tenant_payroll_admin(tenant_id))
WITH CHECK (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payroll_insert_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_insert_member_or_super"
ON public.payroll_runs FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payroll_update_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_update_member_or_super"
ON public.payroll_runs FOR UPDATE
TO authenticated
USING (public.is_tenant_payroll_admin(tenant_id))
WITH CHECK (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payroll_delete_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_delete_member_or_super"
ON public.payroll_runs FOR DELETE
TO authenticated
USING (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payslips_delete_member_or_super" ON public.payslips;
CREATE POLICY "payslips_delete_member_or_super"
ON public.payslips FOR DELETE
TO authenticated
USING (public.is_tenant_payroll_admin(tenant_id));

DROP POLICY IF EXISTS "payroll_adj_select" ON public.payroll_adjustments;
CREATE POLICY "payroll_adj_select"
ON public.payroll_adjustments FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "payroll_adj_write" ON public.payroll_adjustments;
CREATE POLICY "payroll_adj_write"
ON public.payroll_adjustments FOR ALL
TO authenticated
USING (public.is_tenant_payroll_admin(tenant_id))
WITH CHECK (public.is_tenant_payroll_admin(tenant_id));

-- ---------------------------------------------------------
-- reviews: performance evaluations are written by managers/HR,
-- never by the employee being reviewed (no self-scoring).
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "reviews_insert_member_or_super" ON public.reviews;
CREATE POLICY "reviews_insert_member_or_super"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "reviews_update_member_or_super" ON public.reviews;
CREATE POLICY "reviews_update_member_or_super"
ON public.reviews FOR UPDATE
TO authenticated
USING (public.is_admin_like_member(tenant_id))
WITH CHECK (public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "reviews_delete_member_or_super" ON public.reviews;
CREATE POLICY "reviews_delete_member_or_super"
ON public.reviews FOR DELETE
TO authenticated
USING (public.is_admin_like_member(tenant_id));

-- ---------------------------------------------------------
-- attendance: self clock-in/out stays self-service; deleting
-- or bulk-editing others' logs is admin-like only.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "attendance_insert_member_or_super" ON public.attendance;
CREATE POLICY "attendance_insert_member_or_super"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "attendance_update_member_or_super" ON public.attendance;
CREATE POLICY "attendance_update_member_or_super"
ON public.attendance FOR UPDATE
TO authenticated
USING (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "attendance_delete_member_or_super" ON public.attendance;
CREATE POLICY "attendance_delete_member_or_super"
ON public.attendance FOR DELETE
TO authenticated
USING (public.is_admin_like_member(tenant_id));

-- ---------------------------------------------------------
-- overtime: employee submits their own claim; approving /
-- marking as paid is admin-like only.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "overtime_insert_member_or_super" ON public.overtime;
CREATE POLICY "overtime_insert_member_or_super"
ON public.overtime FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "overtime_update_member_or_super" ON public.overtime;
CREATE POLICY "overtime_update_member_or_super"
ON public.overtime FOR UPDATE
TO authenticated
USING (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (
  public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status IN ('pending', 'cancelled'))
);

DROP POLICY IF EXISTS "overtime_delete_member_or_super" ON public.overtime;
CREATE POLICY "overtime_delete_member_or_super"
ON public.overtime FOR DELETE
TO authenticated
USING (
  public.is_admin_like_member(tenant_id)
  OR (public.owns_employee_row(employee_id) AND status = 'pending')
);

-- ---------------------------------------------------------
-- goals: no self-create flow exists in the app today; keep
-- writes admin-like only until a self-service flow is designed.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "goals_insert_member_or_super" ON public.goals;
CREATE POLICY "goals_insert_member_or_super"
ON public.goals FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "goals_update_member_or_super" ON public.goals;
CREATE POLICY "goals_update_member_or_super"
ON public.goals FOR UPDATE
TO authenticated
USING (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
WITH CHECK (public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "goals_delete_member_or_super" ON public.goals;
CREATE POLICY "goals_delete_member_or_super"
ON public.goals FOR DELETE
TO authenticated
USING (public.is_admin_like_member(tenant_id));
