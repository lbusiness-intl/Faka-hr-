-- Expand super admin list
DO $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"super_admin"')
  WHERE email IN ('vincentnogue2@gmail.com','vincentnogue@yahoo.com','webdxb1@gmail.com','liyahjoha@gmail.com');
END $$;

-- rbac_permissions reference table
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE,
  label_fr     text NOT NULL,
  label_en     text NOT NULL,
  module       text NOT NULL,
  default_roles text[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_perms_select" ON public.rbac_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rbac_perms_write"  ON public.rbac_permissions FOR ALL    TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.rbac_permissions (key, label_fr, label_en, module, default_roles) VALUES
('employees.view',        'Voir les employés',             'View employees',          'employees',   ARRAY['admin','hr_manager','hr_assistant','manager','team_lead']),
('employees.create',      'Créer un employé',              'Create employee',          'employees',   ARRAY['admin','hr_manager']),
('employees.edit',        'Modifier un employé',           'Edit employee',            'employees',   ARRAY['admin','hr_manager']),
('employees.delete',      'Supprimer un employé',          'Delete employee',          'employees',   ARRAY['admin']),
('payroll.view',          'Voir la paie',                  'View payroll',             'payroll',     ARRAY['admin','payroll_officer','finance']),
('payroll.run',           'Exécuter la paie',              'Run payroll',              'payroll',     ARRAY['admin','payroll_officer']),
('payroll.approve',       'Approuver la paie',             'Approve payroll',          'payroll',     ARRAY['admin','finance']),
('leaves.view',           'Voir les congés',               'View leaves',              'leaves',      ARRAY['admin','hr_manager','hr_assistant','manager','team_lead']),
('leaves.approve',        'Approuver les congés',          'Approve leaves',           'leaves',      ARRAY['admin','hr_manager','manager']),
('recruitment.view',      'Voir les offres',               'View postings',            'recruitment', ARRAY['admin','hr_manager','recruiter']),
('recruitment.manage',    'Gérer le recrutement',          'Manage recruitment',       'recruitment', ARRAY['admin','hr_manager','recruiter']),
('documents.view_all',    'Voir tous les documents',       'View all documents',       'documents',   ARRAY['admin','hr_manager']),
('documents.upload',      'Téléverser un document',        'Upload document',          'documents',   ARRAY['admin','hr_manager','hr_assistant']),
('comms.send',            'Envoyer une communication',     'Send communication',       'comms',       ARRAY['admin','hr_manager','hr_assistant','manager']),
('comms.view_all',        'Voir toutes les comms',         'View all comms',           'comms',       ARRAY['admin','hr_manager']),
('settings.branches',     'Gérer les agences',             'Manage branches',          'settings',    ARRAY['admin']),
('settings.departments',  'Gérer les départements',        'Manage departments',       'settings',    ARRAY['admin','hr_manager']),
('settings.roles',        'Gérer les rôles',               'Manage roles',             'settings',    ARRAY['admin']),
('finance.view',          'Voir les finances',             'View finance',             'finance',     ARRAY['admin','finance']),
('finance.export',        'Exporter les finances',         'Export finance',           'finance',     ARRAY['admin','finance'])
ON CONFLICT (key) DO NOTHING;
