/*
# Faka — overtime, leave quotas, documents, invitations, promotions, sales tracking
*/

-- =========================================================
-- Overtime
-- =========================================================
CREATE TABLE IF NOT EXISTS public.overtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours numeric(5,2) NOT NULL DEFAULT 0,
  rate numeric(5,2) NOT NULL DEFAULT 1.5,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.overtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_select_member_or_super" ON public.overtime;
CREATE POLICY "overtime_select_member_or_super"
ON public.overtime FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "overtime_insert_member_or_super" ON public.overtime;
CREATE POLICY "overtime_insert_member_or_super"
ON public.overtime FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "overtime_update_member_or_super" ON public.overtime;
CREATE POLICY "overtime_update_member_or_super"
ON public.overtime FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "overtime_delete_member_or_super" ON public.overtime;
CREATE POLICY "overtime_delete_member_or_super"
ON public.overtime FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- Leave balances (quotas per type per year)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'annual',
  year int NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  entitled numeric(5,1) NOT NULL DEFAULT 18,
  used numeric(5,1) NOT NULL DEFAULT 0,
  carried_over numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, type, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_balances_select_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_select_member_or_super"
ON public.leave_balances FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leave_balances_insert_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_insert_member_or_super"
ON public.leave_balances FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leave_balances_update_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_update_member_or_super"
ON public.leave_balances FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leave_balances_delete_member_or_super" ON public.leave_balances;
CREATE POLICY "leave_balances_delete_member_or_super"
ON public.leave_balances FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- Documents (contracts, payslips, ID, diplomas, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_role text NOT NULL DEFAULT 'hr',
  signed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_member_or_super" ON public.documents;
CREATE POLICY "documents_select_member_or_super"
ON public.documents FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  public.is_tenant_member(tenant_id) OR
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = documents.employee_id
    AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "documents_insert_member_or_super" ON public.documents;
CREATE POLICY "documents_insert_member_or_super"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR
  public.is_tenant_member(tenant_id) OR
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = documents.employee_id
    AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "documents_update_member_or_super" ON public.documents;
CREATE POLICY "documents_update_member_or_super"
ON public.documents FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "documents_delete_member_or_super" ON public.documents;
CREATE POLICY "documents_delete_member_or_super"
ON public.documents FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- Invitations (HR → employee, Super Admin → commercial/admin)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  custom_role jsonb,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  sales_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_select_member_or_super" ON public.invitations;
CREATE POLICY "invitations_select_member_or_super"
ON public.invitations FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)) OR
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "invitations_insert_member_or_super" ON public.invitations;
CREATE POLICY "invitations_insert_member_or_super"
ON public.invitations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR
  (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin'))
);

DROP POLICY IF EXISTS "invitations_update_member_or_super" ON public.invitations;
CREATE POLICY "invitations_update_member_or_super"
ON public.invitations FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)))
WITH CHECK (public.is_super_admin() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS "invitations_delete_member_or_super" ON public.invitations;
CREATE POLICY "invitations_delete_member_or_super"
ON public.invitations FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- =========================================================
-- Promotions / promo codes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  applies_to_plan text,
  applies_to_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_select" ON public.promotions;
CREATE POLICY "promotions_select"
ON public.promotions FOR SELECT
TO authenticated
USING (public.is_super_admin() OR active = true);

DROP POLICY IF EXISTS "promotions_insert_super" ON public.promotions;
CREATE POLICY "promotions_insert_super"
ON public.promotions FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "promotions_update_super" ON public.promotions;
CREATE POLICY "promotions_update_super"
ON public.promotions FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "promotions_delete_super" ON public.promotions;
CREATE POLICY "promotions_delete_super"
ON public.promotions FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- =========================================================
-- Sales agents (commercials) tracking
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  sales_code text NOT NULL UNIQUE,
  commission_rate numeric(5,2) NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_agents_select" ON public.sales_agents;
CREATE POLICY "sales_agents_select"
ON public.sales_agents FOR SELECT
TO authenticated
USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "sales_agents_insert_super" ON public.sales_agents;
CREATE POLICY "sales_agents_insert_super"
ON public.sales_agents FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "sales_agents_update_super" ON public.sales_agents;
CREATE POLICY "sales_agents_update_super"
ON public.sales_agents FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "sales_agents_delete_super" ON public.sales_agents;
CREATE POLICY "sales_agents_delete_super"
ON public.sales_agents FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- =========================================================
-- Plan overrides (Super Admin can edit plans without code)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.plan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  name text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  employee_limit int,
  features jsonb NOT NULL DEFAULT '[]',
  modules jsonb NOT NULL DEFAULT '[]',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_overrides_select" ON public.plan_overrides;
CREATE POLICY "plan_overrides_select"
ON public.plan_overrides FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "plan_overrides_write" ON public.plan_overrides;
CREATE POLICY "plan_overrides_write"
ON public.plan_overrides FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- =========================================================
-- Seed founder Super Admins (raw_app_meta_data)
-- =========================================================
DO $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}', '"super_admin"'
  )
  WHERE email IN ('vincentnogue2@gmail.com', 'vincentnogue@yahoo.com');
END $$;
