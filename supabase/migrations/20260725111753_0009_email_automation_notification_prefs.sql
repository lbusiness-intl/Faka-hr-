/*
# Email, Automation & Notification Preferences

1. New Tables
- `email_config` — per-tenant email provider settings (SMTP host/port/encryption/credentials, sender info, provider type). One row per tenant.
- `email_templates` — editable email templates with placeholders. Seeded with 17 default templates.
- `email_queue` — outbound email queue with statuses (pending, sending, sent, failed, retrying), retry count, error message.
- `email_logs` — audit log of every email sent (recipient, sender, type, status, delivery result, failure reason).
- `workflows` — automation workflows with trigger, conditions (JSONB), actions (JSONB), enabled flag, optional schedule (cron).
- `workflow_executions` — execution history for workflows.
- `notification_preferences` — per-user notification settings (email on/off, in-app on/off, frequency, categories).

2. Security
- All tables RLS-enabled. Tenant members can access their own tenant's data; super_admin can access all.
- notification_preferences scoped to the owning user.

3. Important Notes
- `email_config` stores ONE active config per tenant (unique on tenant_id).
- `email_templates` are global (system defaults, tenant_id NULL) but can be overridden per-tenant.
- `email_queue` is processed by the `send-email` edge function.
- `workflows` support `schedule_cron` for time-based triggers.
*/

-- ============================================================
-- email_config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider      text NOT NULL DEFAULT 'smtp'
                  CHECK (provider IN ('smtp','resend','sendgrid','ses','mailgun','postmark','m365','gmail','custom')),
  smtp_host     text,
  smtp_port     integer DEFAULT 587,
  encryption    text NOT NULL DEFAULT 'tls' CHECK (encryption IN ('ssl','tls','none')),
  username      text,
  password_enc  text,
  sender_name   text NOT NULL DEFAULT 'Faka HRMS',
  sender_email  text NOT NULL,
  reply_to      text,
  timeout_secs  integer NOT NULL DEFAULT 30,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_config_select" ON public.email_config;
CREATE POLICY "email_config_select" ON public.email_config FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_config_insert" ON public.email_config;
CREATE POLICY "email_config_insert" ON public.email_config FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_config_update" ON public.email_config;
CREATE POLICY "email_config_update" ON public.email_config FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_config_delete" ON public.email_config;
CREATE POLICY "email_config_delete" ON public.email_config FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

-- ============================================================
-- email_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_key  text NOT NULL,
  name          text NOT NULL,
  subject       text NOT NULL,
  html_body     text NOT NULL,
  text_body     text,
  is_system     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON public.email_templates;
CREATE POLICY "email_templates_select" ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_super_admin() OR tenant_id IS NULL OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_templates_insert" ON public.email_templates;
CREATE POLICY "email_templates_insert" ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_templates_update" ON public.email_templates;
CREATE POLICY "email_templates_update" ON public.email_templates FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_templates_delete" ON public.email_templates;
CREATE POLICY "email_templates_delete" ON public.email_templates FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_email_templates_key ON public.email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON public.email_templates(tenant_id);

INSERT INTO public.email_templates (template_key, name, subject, html_body, is_system) VALUES
  ('employee_invitation', 'Invitation Employé', 'Bienvenue chez {{CompanyName}} — Activez votre compte',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#ff6b35,#ff8c5a);padding:32px 40px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">Bienvenue chez {{CompanyName}}</h1></div><div style="padding:40px"><p style="color:#334155;font-size:16px;line-height:1.6">Bonjour {{FirstName}},</p><p style="color:#334155;font-size:16px;line-height:1.6">Vous avez ete invite a rejoindre {{CompanyName}} sur Faka HRMS. Cliquez sur le bouton ci-dessous pour activer votre compte.</p><div style="text-align:center;margin:32px 0"><a href="{{ActivationLink}}" style="background:#ff6b35;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Activer mon compte</a></div><p style="color:#64748b;font-size:14px">Si le bouton ne fonctionne pas, utilisez ce code: <strong>{{InvitationCode}}</strong></p><p style="color:#64748b;font-size:14px">Cette invitation expire le {{ExpirationDate}}.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0"><p style="color:#94a3b8;font-size:12px">Support: {{SupportEmail}}<br>Faka HRMS — LIYAH GROUP</p></div></div>', true),
  ('password_reset', 'Réinitialisation Mot de Passe', 'Réinitialisez votre mot de passe Faka',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Reinitialisation de mot de passe</h2><p>Bonjour {{FirstName}},</p><p>Cliquez sur le lien ci-dessous pour reinitialiser votre mot de passe:</p><a href="{{ResetLink}}">Reinitialiser</a><p>Ce lien expire dans 1 heure.</p></div>', true),
  ('welcome_email', 'Email de Bienvenue', 'Bienvenue sur Faka HRMS',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Bienvenue {{FirstName}}!</h2><p>Votre compte Faka HRMS a ete active. Vous faites desormais partie de {{CompanyName}}.</p><p>Connectez-vous pour acceder a votre tableau de bord.</p></div>', true),
  ('payroll_notification', 'Notification Paie', 'Traitement de la paie — {{CompanyName}}',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Paie traitee</h2><p>Bonjour {{FirstName}},</p><p>La paie de {{CurrentDate}} a ete traitee. Votre fiche de paie est disponible.</p></div>', true),
  ('payslip_available', 'Fiche de Paie Disponible', 'Votre fiche de paie est disponible',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Fiche de paie disponible</h2><p>Bonjour {{FirstName}},</p><p>Votre fiche de paie pour {{CurrentDate}} est maintenant disponible sur votre tableau de bord.</p></div>', true),
  ('leave_approved', 'Congé Approuvé', 'Votre demande de congé a été approuvée',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Conge approuve</h2><p>Bonjour {{FirstName}},</p><p>Votre demande de conge a ete approuvee par {{HRName}}.</p></div>', true),
  ('leave_rejected', 'Congé Refusé', 'Votre demande de congé a été refusée',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Conge refuse</h2><p>Bonjour {{FirstName}},</p><p>Votre demande de conge a ete refusee. Contactez votre RH pour plus d informations.</p></div>', true),
  ('leave_request_received', 'Demande de Congé Reçue', 'Nouvelle demande de congé — {{EmployeeName}}',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Nouvelle demande de conge</h2><p>{{EmployeeName}} ({{Department}}) a soumis une demande de conge.</p><p>Connectez-vous pour l examiner.</p></div>', true),
  ('performance_review', 'Évaluation Performance', 'Évaluation de performance programmée',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Evaluation de performance</h2><p>Bonjour {{FirstName}},</p><p>Une evaluation de performance a ete programmee. Connectez-vous pour plus de details.</p></div>', true),
  ('document_uploaded', 'Document Téléversé', 'Nouveau document disponible',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Nouveau document</h2><p>Bonjour {{FirstName}},</p><p>Un nouveau document a ete ajoute a votre dossier. Consultez-le sur votre tableau de bord.</p></div>', true),
  ('training_assigned', 'Formation Assignée', 'Nouvelle formation assignée',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Formation assignee</h2><p>Bonjour {{FirstName}},</p><p>Une nouvelle formation vous a ete assignee. Connectez-vous pour commencer.</p></div>', true),
  ('meeting_invitation', 'Invitation Réunion', 'Invitation à une réunion — {{CompanyName}}',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Invitation a une reunion</h2><p>Bonjour {{FirstName}},</p><p>Vous etes invite a une reunion. Consultez votre tableau de bord pour les details.</p></div>', true),
  ('company_announcement', 'Annonce Entreprise', 'Annonce — {{CompanyName}}',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Annonce</h2><p>Bonjour {{FirstName}},</p><p>{{CompanyName}} a une nouvelle annonce. Consultez votre tableau de bord.</p></div>', true),
  ('subscription_expiring', 'Expiration Abonnement', 'Votre abonnement expire bientôt',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Abonnement expirant</h2><p>Votre abonnement Faka HRMS expire bientot. Renouvelez des maintenant pour eviter toute interruption.</p></div>', true),
  ('payment_successful', 'Paiement Réussi', 'Paiement confirmé — Faka HRMS',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Paiement confirme</h2><p>Merci! Votre paiement a ete traite avec succes.</p></div>', true),
  ('trial_ending', 'Fin d''Essai', 'Votre essai gratuit se termine bientôt',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Fin d essai</h2><p>Votre essai gratuit de Faka HRMS se termine bientot. Choisissez un plan pour continuer.</p></div>', true),
  ('account_activated', 'Compte Activé', 'Votre compte est activé — {{CompanyName}}',
   '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Compte active!</h2><p>Bonjour {{FirstName}},</p><p>Votre compte Faka HRMS a ete active. Bienvenue dans l equipe de {{CompanyName}}!</p><p>Connectez-vous avec votre email et mot de passe.</p></div>', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- email_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  to_email      text NOT NULL,
  from_email    text,
  subject       text NOT NULL,
  html_body     text,
  text_body     text,
  template_key  text,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sending','sent','failed','retrying')),
  retry_count   integer NOT NULL DEFAULT 0,
  max_retries   integer NOT NULL DEFAULT 3,
  error_message text,
  scheduled_at  timestamptz DEFAULT now(),
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_queue_select" ON public.email_queue;
CREATE POLICY "email_queue_select" ON public.email_queue FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_queue_insert" ON public.email_queue;
CREATE POLICY "email_queue_insert" ON public.email_queue FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_queue_update" ON public.email_queue;
CREATE POLICY "email_queue_update" ON public.email_queue FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_queue_delete" ON public.email_queue;
CREATE POLICY "email_queue_delete" ON public.email_queue FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_tenant ON public.email_queue(tenant_id);

-- ============================================================
-- email_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient     text NOT NULL,
  sender        text,
  email_type    text NOT NULL,
  status        text NOT NULL,
  delivery_result text,
  failure_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_select" ON public.email_logs;
CREATE POLICY "email_logs_select" ON public.email_logs FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_logs_insert" ON public.email_logs;
CREATE POLICY "email_logs_insert" ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "email_logs_delete" ON public.email_logs;
CREATE POLICY "email_logs_delete" ON public.email_logs FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON public.email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at);

-- ============================================================
-- workflows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  trigger       text NOT NULL,
  conditions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule_cron text,
  is_enabled    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflows_select" ON public.workflows;
CREATE POLICY "workflows_select" ON public.workflows FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "workflows_insert" ON public.workflows;
CREATE POLICY "workflows_insert" ON public.workflows FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "workflows_update" ON public.workflows;
CREATE POLICY "workflows_update" ON public.workflows FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "workflows_delete" ON public.workflows;
CREATE POLICY "workflows_delete" ON public.workflows FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON public.workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.workflows(trigger);

-- ============================================================
-- workflow_executions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id   uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  trigger       text NOT NULL,
  executed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success','failed','partial','running','retrying')),
  duration_ms   integer,
  errors        text,
  retries       integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_exec_select" ON public.workflow_executions;
CREATE POLICY "workflow_exec_select" ON public.workflow_executions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "workflow_exec_insert" ON public.workflow_executions;
CREATE POLICY "workflow_exec_insert" ON public.workflow_executions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "workflow_exec_delete" ON public.workflow_executions;
CREATE POLICY "workflow_exec_delete" ON public.workflow_executions FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_workflow_exec_tenant ON public.workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_workflow ON public.workflow_executions(workflow_id);

-- ============================================================
-- notification_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled     boolean NOT NULL DEFAULT true,
  inapp_enabled     boolean NOT NULL DEFAULT true,
  frequency         text NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant','hourly','daily','weekly')),
  categories        text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_select" ON public.notification_preferences;
CREATE POLICY "notif_prefs_select" ON public.notification_preferences FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "notif_prefs_insert" ON public.notification_preferences;
CREATE POLICY "notif_prefs_insert" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id OR public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "notif_prefs_update" ON public.notification_preferences;
CREATE POLICY "notif_prefs_update" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_prefs_delete" ON public.notification_preferences;
CREATE POLICY "notif_prefs_delete" ON public.notification_preferences FOR DELETE TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);
