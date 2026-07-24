import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, EmptyState, Modal, Spinner } from '../ui';
import { Shield, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { PERMISSION_DEFAULTS, ROLE_COLORS } from '../../lib/permissions';

type CustomRole = { id: string; name: string; color: string; permissions: string[]; created_at: string };

const PERMISSION_GROUPS = [
  { label: 'Employés', keys: ['employees.view','employees.create','employees.edit','employees.delete'] },
  { label: 'Paie', keys: ['payroll.view','payroll.run','payroll.approve'] },
  { label: 'Congés', keys: ['leaves.view','leaves.approve'] },
  { label: 'Recrutement', keys: ['recruitment.view','recruitment.manage','recruitment.interview'] },
  { label: 'Documents', keys: ['documents.view_all','documents.upload'] },
  { label: 'Communications', keys: ['comms.send','comms.view_all'] },
  { label: 'Présence / Heures sup.', keys: ['attendance.view','overtime.approve'] },
  { label: 'Avances & Frais', keys: ['advances.approve','claims.approve'] },
  { label: 'Actifs', keys: ['assets.manage'] },
  { label: 'Paramètres', keys: ['settings.branches','settings.departments','settings.roles'] },
  { label: 'Finance', keys: ['finance.view','finance.export'] },
];

const PERM_LABELS: Record<string, string> = {
  'employees.view': 'Voir', 'employees.create': 'Créer', 'employees.edit': 'Modifier', 'employees.delete': 'Supprimer',
  'payroll.view': 'Voir', 'payroll.run': 'Exécuter', 'payroll.approve': 'Approuver',
  'leaves.view': 'Voir', 'leaves.approve': 'Approuver',
  'recruitment.view': 'Voir les offres', 'recruitment.manage': 'Gérer', 'recruitment.interview': 'Entretiens',
  'documents.view_all': 'Voir tout', 'documents.upload': 'Téléverser',
  'comms.send': 'Envoyer', 'comms.view_all': 'Voir tout',
  'attendance.view': 'Voir présence', 'overtime.approve': 'Valider heures sup.',
  'advances.approve': 'Valider avances', 'claims.approve': 'Valider frais',
  'assets.manage': 'Gérer actifs',
  'settings.branches': 'Agences', 'settings.departments': 'Départements', 'settings.roles': 'Rôles',
  'finance.view': 'Voir', 'finance.export': 'Exporter',
};

const COLORS = ['#f97316','#8b5cf6','#06b6d4','#10b981','#3b82f6','#f59e0b','#ec4899','#84cc16','#6366f1'];

export default function RoleManager() {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [form, setForm] = useState({ name: '', color: COLORS[0], permissions: [] as string[] });

  async function load() {
    if (!activeTenant) return;
    const { data } = await supabase.from('custom_roles').select('*').eq('tenant_id', activeTenant.id).order('name');
    setRoles(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeTenant]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', color: COLORS[0], permissions: [] });
    setModal(true);
  }

  function openEdit(r: CustomRole) {
    setEditing(r);
    setForm({ name: r.name, color: r.color, permissions: r.permissions });
    setModal(true);
  }

  function togglePerm(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  }

  async function save() {
    if (!activeTenant || !form.name.trim()) return;
    const payload = { name: form.name.trim(), color: form.color, permissions: form.permissions };
    if (editing) {
      await supabase.from('custom_roles').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('custom_roles').insert({ ...payload, tenant_id: activeTenant.id });
    }
    setModal(false);
    load();
  }

  async function remove(id: string) {
    await supabase.from('custom_roles').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t('settings.roles')}</h2>
            <p className="text-slate-500 dark:text-white/50 text-xs">Rôles personnalisés pour votre organisation</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm"><Plus size={16} /> Créer un rôle</button>
      </div>

      {/* Standard roles info */}
      <div className="card p-5 mb-6">
        <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Rôles standard inclus</h3>
        <div className="flex flex-wrap gap-2">
          {(['admin','hr_manager','hr_assistant','recruiter','payroll_officer','finance','manager','team_lead','employee'] as const).map((r) => (
            <span key={r} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: ROLE_COLORS[r] }}>
              {t(`role.${r}`)}
            </span>
          ))}
        </div>
      </div>

      {loading ? <Spinner className="mx-auto" /> : roles.length === 0 ? (
        <EmptyState icon={<Shield size={48} />} title="Aucun rôle personnalisé" hint="Créez des rôles sur-mesure pour votre organisation." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="card p-5 group hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: r.color }}>
                  {r.name[0].toUpperCase()}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-slate-900 dark:text-white font-semibold">{r.name}</h3>
              <p className="text-slate-400 dark:text-white/40 text-xs mt-1">{r.permissions.length} permission{r.permissions.length !== 1 ? 's' : ''}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.permissions.slice(0, 4).map((p) => (
                  <span key={p} className="text-xs bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 px-2 py-0.5 rounded-full">{PERM_LABELS[p] ?? p}</span>
                ))}
                {r.permissions.length > 4 && <span className="text-xs text-slate-400">+{r.permissions.length - 4}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Modifier — ${editing.name}` : 'Nouveau rôle personnalisé'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom du rôle *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Superviseur terrain" />
            </div>
            <div>
              <label className="label">Couleur</label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 border-2"
                    style={{ backgroundColor: c, borderColor: form.color === c ? '#0f172a' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label mb-3 block">Permissions</label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wide mb-2">{group.label}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${form.permissions.includes(key) ? 'bg-coral-500 border-coral-500' : 'border-slate-300 dark:border-white/30'}`}
                          onClick={() => togglePerm(key)}
                        >
                          {form.permissions.includes(key) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-white/70">{PERM_LABELS[key] ?? key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}
