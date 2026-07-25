-- ============================================================
-- notifications: unified notification system for employees and HR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  category      text NOT NULL DEFAULT 'general'
                  CHECK (category IN ('payroll','document','leave','performance','training','meeting','communication','profile','attendance','claim','advance','system','role','general')),
  title         text NOT NULL,
  body          text NOT NULL DEFAULT '',
  priority      text NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),
  is_read       boolean NOT NULL DEFAULT false,
  is_archived   boolean NOT NULL DEFAULT false,
  link          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(tenant_id, is_read) WHERE is_read = false;

-- ============================================================
-- payroll_adjustments: audit trail for every salary modification
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payslip_id    uuid REFERENCES public.payslips(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  field         text NOT NULL CHECK (field IN ('salary','bonus','allowances','deductions','overtime','taxes')),
  old_value     numeric(14,2) NOT NULL DEFAULT 0,
  new_value     numeric(14,2) NOT NULL DEFAULT 0,
  reason        text NOT NULL DEFAULT '',
  changed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_adj_select" ON public.payroll_adjustments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "payroll_adj_insert" ON public.payroll_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_payroll_adj_tenant  ON public.payroll_adjustments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_emp    ON public.payroll_adjustments(employee_id);

-- ============================================================
-- role_history: track every role assignment change
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  old_role      text,
  new_role      text NOT NULL,
  changed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_history_select" ON public.role_history FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "role_history_insert" ON public.role_history FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_role_history_tenant ON public.role_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_history_user   ON public.role_history(user_id);

-- ============================================================
-- payslips: add bonus, allowances, overtime_pay, taxes columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='bonus') THEN
    ALTER TABLE public.payslips ADD COLUMN bonus numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='allowances') THEN
    ALTER TABLE public.payslips ADD COLUMN allowances numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='overtime_pay') THEN
    ALTER TABLE public.payslips ADD COLUMN overtime_pay numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='taxes') THEN
    ALTER TABLE public.payslips ADD COLUMN taxes numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- employees: add employee_id, employment_type, manager_id, start_date
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='employee_id') THEN
    ALTER TABLE public.employees ADD COLUMN employee_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='employment_type') THEN
    ALTER TABLE public.employees ADD COLUMN employment_type text NOT NULL DEFAULT 'cdi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='manager_id') THEN
    ALTER TABLE public.employees ADD COLUMN manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='start_date') THEN
    ALTER TABLE public.employees ADD COLUMN start_date date;
  END IF;
END $$;

-- ============================================================
-- invitations: add cancelled status support (status already has CHECK? add if needed)
-- ============================================================
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_status_check
  CHECK (status IN ('pending','sent','accepted','expired','cancelled'));
