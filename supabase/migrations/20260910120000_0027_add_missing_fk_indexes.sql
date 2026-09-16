/*
# Performance: add covering indexes for every unindexed foreign key

Found via Supabase's built-in performance advisor (58 foreign keys with
no covering index — slows joins and FK constraint checks as tables grow).
Purely additive: no logic, RLS, or security change, just indexes.

Applied directly to production via the Supabase MCP connector on
2026-09; recorded here for parity with the migration history.
*/

CREATE INDEX IF NOT EXISTS idx_advances_employee_id ON public.advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_tenant_id ON public.advances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_id ON public.assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_manager_id ON public.branches(manager_id);
CREATE INDEX IF NOT EXISTS idx_claims_employee_id ON public.claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_claims_tenant_id ON public.claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_communications_sender_id ON public.communications(sender_id);
CREATE INDEX IF NOT EXISTS idx_departments_head_id ON public.departments(head_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_created_by ON public.document_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON public.document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON public.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flutterwave_transactions_created_by ON public.flutterwave_transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_flutterwave_transactions_tenant_id ON public.flutterwave_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goals_employee_id ON public.goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_tenant_id ON public.goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON public.invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON public.invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_used_by ON public.invitations(used_by);
CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant_id ON public.leave_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON public.notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_employee_id ON public.overtime(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_tenant_id ON public.overtime(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_changed_by ON public.payroll_adjustments(changed_by);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_payslip_id ON public.payroll_adjustments(payslip_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_id ON public.payroll_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run_id ON public.payslips(run_id);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_created_by ON public.paystack_transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_tenant_id ON public.paystack_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payunit_transactions_created_by ON public.payunit_transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_payunit_transactions_tenant_id ON public.payunit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_overrides_updated_by ON public.plan_overrides(updated_by);
CREATE INDEX IF NOT EXISTS idx_promotions_applies_to_tenant_id ON public.promotions(applies_to_tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_created_by ON public.promotions(created_by);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_posting_id ON public.recruitment_candidates(posting_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_tenant_id ON public.recruitment_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_postings_tenant_id ON public.recruitment_postings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_employee_id ON public.reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON public.reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_history_changed_by ON public.role_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_role_history_employee_id ON public.role_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_agents_user_id ON public.sales_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_custom_role_id ON public.tenant_memberships(custom_role_id);
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON public.tenants(created_by);
CREATE INDEX IF NOT EXISTS idx_trainings_employee_id ON public.trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_trainings_tenant_id ON public.trainings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_executed_by ON public.workflow_executions(executed_by);
