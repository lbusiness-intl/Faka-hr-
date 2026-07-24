-- ============================================================
-- custom_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6366f1',
  permissions jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_roles_select" ON public.custom_roles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "custom_roles_insert" ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "custom_roles_update" ON public.custom_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "custom_roles_delete" ON public.custom_roles FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TRIGGER custom_roles_touch BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant ON public.custom_roles(tenant_id);

-- ============================================================
-- tenant_memberships: add custom_role_id FK + expand role values
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_memberships' AND column_name='custom_role_id') THEN
    ALTER TABLE public.tenant_memberships
      ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old check constraint if any, add expanded one
ALTER TABLE public.tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_role_check
  CHECK (role IN ('super_admin','admin','employee','hr_manager','hr_assistant','recruiter','payroll_officer','finance','manager','team_lead'));

-- ============================================================
-- communications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type             text NOT NULL DEFAULT 'announcement'
                     CHECK (type IN ('announcement','message','alert','policy','event_invite')),
  subject          text NOT NULL,
  body             text NOT NULL DEFAULT '',
  recipient_scope  text NOT NULL DEFAULT 'all'
                     CHECK (recipient_scope IN ('all','branch','department','role','individual')),
  recipient_ids    jsonb NOT NULL DEFAULT '[]',
  attachments      jsonb NOT NULL DEFAULT '[]',
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  is_draft         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comms_select" ON public.communications FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "comms_insert" ON public.communications FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "comms_update" ON public.communications FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "comms_delete" ON public.communications FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (sender_id = auth.uid() AND is_draft = true));

CREATE TRIGGER comms_touch BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_comms_tenant ON public.communications(tenant_id);

-- ============================================================
-- communication_read_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_read_receipts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_id, user_id)
);

ALTER TABLE public.communication_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select" ON public.communication_read_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "receipts_insert" ON public.communication_read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "receipts_delete" ON public.communication_read_receipts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_receipts_comm ON public.communication_read_receipts(communication_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON public.communication_read_receipts(user_id);

-- ============================================================
-- document_folders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  parent_id   uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{"roles":["admin"],"employee_self":false}',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_folders_select" ON public.document_folders FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "doc_folders_insert" ON public.document_folders FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "doc_folders_update" ON public.document_folders FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE POLICY "doc_folders_delete" ON public.document_folders FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE TRIGGER doc_folders_touch BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_doc_folders_tenant ON public.document_folders(tenant_id);

-- documents: add folder_id column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='folder_id') THEN
    ALTER TABLE public.documents ADD COLUMN folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder_id);
