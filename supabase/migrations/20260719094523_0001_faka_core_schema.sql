/*
# Faka core multi-tenant schema (re-ordered)

Creates tenants + tenant_memberships tables FIRST, then the helper functions
that read them, then the rest of the schema with policies.
*/

-- =========================================================
-- Base tables (no policies yet)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  industry text,
  company_size text,
  country text NOT NULL DEFAULT 'CM',
  region text,
  city text,
  region_custom text,
  city_custom text,
  currency text NOT NULL DEFAULT 'XAF',
  timezone text NOT NULL DEFAULT 'Africa/Douala',
  phone_code text NOT NULL DEFAULT '+237',
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'trial',
  employee_limit int NOT NULL DEFAULT 15,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  sales_code text,
  default_payment_methods text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  status text NOT NULL DEFAULT 'active',
  custom_role jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- =========================================================
-- Helper functions (depend on tenants + tenant_memberships)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'raw_app_meta_data' ->> 'role') = 'super_admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(tenant uuid)
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
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_role(tenant uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT m.role::text FROM public.tenant_memberships m
  WHERE m.tenant_id = tenant
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$;

-- =========================================================
-- Enable RLS + policies on tenants
-- =========================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_member_or_super" ON public.tenants;
CREATE POLICY "tenants_select_member_or_super"
ON public.tenants FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(id));

DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "tenants_update_member_or_super" ON public.tenants;
CREATE POLICY "tenants_update_member_or_super"
ON public.tenants FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(id));

DROP POLICY IF EXISTS "tenants_delete_super" ON public.tenants;
CREATE POLICY "tenants_delete_super"
ON public.tenants FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- =========================================================
-- tenant_memberships RLS
-- =========================================================
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memberships_select_member_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_select_member_or_super"
ON public.tenant_memberships FOR SELECT
TO authenticated
USING (public.is_super_admin() OR user_id = auth.uid() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "memberships_insert_tenant_admin_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_insert_tenant_admin_or_super"
ON public.tenant_memberships FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin')));

DROP POLICY IF EXISTS "memberships_update_tenant_admin_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_update_tenant_admin_or_super"
ON public.tenant_memberships FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin')))
WITH CHECK (public.is_super_admin() OR (public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin')));

DROP POLICY IF EXISTS "memberships_delete_tenant_admin_or_super" ON public.tenant_memberships;
CREATE POLICY "memberships_delete_tenant_admin_or_super"
ON public.tenant_memberships FOR DELETE
TO authenticated
USING (public.is_super_admin() OR (public.is_tenant_member(tenant_id) AND public.tenant_role(tenant_id) IN ('admin','super_admin')));

-- =========================================================
-- employees
-- =========================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  position text,
  department text,
  salary numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  contract_type text NOT NULL DEFAULT 'cdi',
  status text NOT NULL DEFAULT 'active',
  hire_date date,
  exit_date date,
  exit_reason text,
  exit_notes text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select_member_or_super" ON public.employees;
CREATE POLICY "employees_select_member_or_super"
ON public.employees FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "employees_insert_member_or_super" ON public.employees;
CREATE POLICY "employees_insert_member_or_super"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "employees_update_member_or_super" ON public.employees;
CREATE POLICY "employees_update_member_or_super"
ON public.employees FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "employees_delete_member_or_super" ON public.employees;
CREATE POLICY "employees_delete_member_or_super"
ON public.employees FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- leave_requests
-- =========================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(5,1) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaves_select_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_select_member_or_super"
ON public.leave_requests FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leaves_insert_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_insert_member_or_super"
ON public.leave_requests FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leaves_update_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_update_member_or_super"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "leaves_delete_member_or_super" ON public.leave_requests;
CREATE POLICY "leaves_delete_member_or_super"
ON public.leave_requests FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- payroll_runs + payslips
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_select_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_select_member_or_super"
ON public.payroll_runs FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payroll_insert_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_insert_member_or_super"
ON public.payroll_runs FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payroll_update_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_update_member_or_super"
ON public.payroll_runs FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payroll_delete_member_or_super" ON public.payroll_runs;
CREATE POLICY "payroll_delete_member_or_super"
ON public.payroll_runs FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gross numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payslips_select_member_or_super" ON public.payslips;
CREATE POLICY "payslips_select_member_or_super"
ON public.payslips FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payslips_insert_member_or_super" ON public.payslips;
CREATE POLICY "payslips_insert_member_or_super"
ON public.payslips FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payslips_update_member_or_super" ON public.payslips;
CREATE POLICY "payslips_update_member_or_super"
ON public.payslips FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "payslips_delete_member_or_super" ON public.payslips;
CREATE POLICY "payslips_delete_member_or_super"
ON public.payslips FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- advances + claims + attendance
-- =========================================================
CREATE TABLE IF NOT EXISTS public.advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advances_select_member_or_super" ON public.advances;
CREATE POLICY "advances_select_member_or_super"
ON public.advances FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "advances_insert_member_or_super" ON public.advances;
CREATE POLICY "advances_insert_member_or_super"
ON public.advances FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "advances_update_member_or_super" ON public.advances;
CREATE POLICY "advances_update_member_or_super"
ON public.advances FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "advances_delete_member_or_super" ON public.advances;
CREATE POLICY "advances_delete_member_or_super"
ON public.advances FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  category text,
  status text NOT NULL DEFAULT 'pending',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claims_select_member_or_super" ON public.claims;
CREATE POLICY "claims_select_member_or_super"
ON public.claims FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "claims_insert_member_or_super" ON public.claims;
CREATE POLICY "claims_insert_member_or_super"
ON public.claims FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "claims_update_member_or_super" ON public.claims;
CREATE POLICY "claims_update_member_or_super"
ON public.claims FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "claims_delete_member_or_super" ON public.claims;
CREATE POLICY "claims_delete_member_or_super"
ON public.claims FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_in timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  check_out timestamptz,
  selfie_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_member_or_super" ON public.attendance;
CREATE POLICY "attendance_select_member_or_super"
ON public.attendance FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "attendance_insert_member_or_super" ON public.attendance;
CREATE POLICY "attendance_insert_member_or_super"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "attendance_update_member_or_super" ON public.attendance;
CREATE POLICY "attendance_update_member_or_super"
ON public.attendance FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "attendance_delete_member_or_super" ON public.attendance;
CREATE POLICY "attendance_delete_member_or_super"
ON public.attendance FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- =========================================================
-- assets, recruitment, trainings, goals, reviews, events, invoices, audit
-- =========================================================
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  serial text,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select_member_or_super" ON public.assets;
CREATE POLICY "assets_select_member_or_super"
ON public.assets FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "assets_insert_member_or_super" ON public.assets;
CREATE POLICY "assets_insert_member_or_super"
ON public.assets FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "assets_update_member_or_super" ON public.assets;
CREATE POLICY "assets_update_member_or_super"
ON public.assets FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "assets_delete_member_or_super" ON public.assets;
CREATE POLICY "assets_delete_member_or_super"
ON public.assets FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.recruitment_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text,
  location text,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruitment_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postings_select_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_select_member_or_super"
ON public.recruitment_postings FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "postings_insert_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_insert_member_or_super"
ON public.recruitment_postings FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "postings_update_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_update_member_or_super"
ON public.recruitment_postings FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "postings_delete_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_delete_member_or_super"
ON public.recruitment_postings FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.recruitment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  posting_id uuid REFERENCES public.recruitment_postings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  stage text NOT NULL DEFAULT 'applied',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruitment_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidates_select_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_select_member_or_super"
ON public.recruitment_candidates FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "candidates_insert_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_insert_member_or_super"
ON public.recruitment_candidates FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "candidates_update_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_update_member_or_super"
ON public.recruitment_candidates FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "candidates_delete_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_delete_member_or_super"
ON public.recruitment_candidates FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  progress int NOT NULL DEFAULT 0,
  certificate boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainings_select_member_or_super" ON public.trainings;
CREATE POLICY "trainings_select_member_or_super"
ON public.trainings FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "trainings_insert_member_or_super" ON public.trainings;
CREATE POLICY "trainings_insert_member_or_super"
ON public.trainings FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "trainings_update_member_or_super" ON public.trainings;
CREATE POLICY "trainings_update_member_or_super"
ON public.trainings FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "trainings_delete_member_or_super" ON public.trainings;
CREATE POLICY "trainings_delete_member_or_super"
ON public.trainings FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  progress int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_select_member_or_super" ON public.goals;
CREATE POLICY "goals_select_member_or_super"
ON public.goals FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "goals_insert_member_or_super" ON public.goals;
CREATE POLICY "goals_insert_member_or_super"
ON public.goals FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "goals_update_member_or_super" ON public.goals;
CREATE POLICY "goals_update_member_or_super"
ON public.goals FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "goals_delete_member_or_super" ON public.goals;
CREATE POLICY "goals_delete_member_or_super"
ON public.goals FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  period text,
  rating int,
  self_rating int,
  comments text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_member_or_super" ON public.reviews;
CREATE POLICY "reviews_select_member_or_super"
ON public.reviews FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "reviews_insert_member_or_super" ON public.reviews;
CREATE POLICY "reviews_insert_member_or_super"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "reviews_update_member_or_super" ON public.reviews;
CREATE POLICY "reviews_update_member_or_super"
ON public.reviews FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "reviews_delete_member_or_super" ON public.reviews;
CREATE POLICY "reviews_delete_member_or_super"
ON public.reviews FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'company',
  title text NOT NULL,
  description text,
  event_date timestamptz,
  location text,
  rsvp jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_member_or_super" ON public.events;
CREATE POLICY "events_select_member_or_super"
ON public.events FOR SELECT
TO authenticated
USING (public.is_super_admin() OR scope = 'panafrican' OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "events_insert_member_or_super" ON public.events;
CREATE POLICY "events_insert_member_or_super"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "events_update_member_or_super" ON public.events;
CREATE POLICY "events_update_member_or_super"
ON public.events FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "events_delete_member_or_super" ON public.events;
CREATE POLICY "events_delete_member_or_super"
ON public.events FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_member_or_super" ON public.invoices;
CREATE POLICY "invoices_select_member_or_super"
ON public.invoices FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "invoices_insert_member_or_super" ON public.invoices;
CREATE POLICY "invoices_insert_member_or_super"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "invoices_update_member_or_super" ON public.invoices;
CREATE POLICY "invoices_update_member_or_super"
ON public.invoices FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "invoices_delete_super" ON public.invoices;
CREATE POLICY "invoices_delete_super"
ON public.invoices FOR DELETE
TO authenticated
USING (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_member_or_super" ON public.audit_logs;
CREATE POLICY "audit_select_member_or_super"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "audit_insert_member_or_super" ON public.audit_logs;
CREATE POLICY "audit_insert_member_or_super"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "audit_update_super" ON public.audit_logs;
CREATE POLICY "audit_update_super"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "audit_delete_super" ON public.audit_logs;
CREATE POLICY "audit_delete_super"
ON public.audit_logs FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON public.employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leaves_tenant ON public.leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payslips_tenant ON public.payslips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_touch ON public.tenants;
CREATE TRIGGER tenants_touch BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS employees_touch ON public.employees;
CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
