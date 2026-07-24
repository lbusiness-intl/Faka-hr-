-- ============================================================
-- branches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  location    text,
  manager_id  uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "branches_insert" ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "branches_update" ON public.branches FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "branches_delete" ON public.branches FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TRIGGER branches_touch BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON public.branches(tenant_id);

-- ============================================================
-- departments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name        text NOT NULL,
  head_id     uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "departments_insert" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "departments_update" ON public.departments FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "departments_delete" ON public.departments FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TRIGGER departments_touch BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_departments_tenant ON public.departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_branch ON public.departments(branch_id);

-- ============================================================
-- employees: add branch_id and department_id columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='branch_id') THEN
    ALTER TABLE public.employees ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='department_id') THEN
    ALTER TABLE public.employees ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept   ON public.employees(department_id);
