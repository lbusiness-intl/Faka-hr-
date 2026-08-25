import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { EmptyState, Modal, Spinner } from '../ui';
import { Shield, Plus, Pencil, Trash2, Check, Search, History, UserCog } from 'lucide-react';
import { ROLE_COLORS, ALL_STANDARD_ROLES } from '../../lib/permissions';
import type { AppRole } from '../../lib/auth';
import { notify } from '../../lib/notifications';

type CustomRole = { id: string; name: string; color: string; permissions: string[]; created_at: string };

type MembershipEmployee = { id?: string; first_name: string; last_name: string; department: string | null; email: string | null };
type Membership = {
  id: string;
  user_id: string;
  role: AppRole;
  status: string;
  custom_role_id: string | null;
  custom_role: { id: string; name: string; color: string } | null;
  employee: MembershipEmployee | null;
  email?: string;
  originalRole?: AppRole;
};
type RoleHistoryEntry = {
  id: string;
  old_role: AppRole | null;
  new_role: AppRole;
  reason?: string | null;
  created_at: string;
  employee: { first_name: string; last_name: string } | null;
};

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
  const { activeTenant, user } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [form, setForm] = useState({ name: '', color: COLORS[0], permissions: [] as string[] });
  // Role assignment state
  const [members, setMembers] = useState<Membership[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<RoleHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmAssign, setConfirmAssign] = useState<{ membership: Membership; newRole: AppRole } | null>(null);
  const [confirmCustomAssign, setConfirmCustomAssign] = useState<{ membership: Membership; customRoleId: string | null; customRoleName: string } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  async function load() {
    if (!activeTenant) return;
    const { data } = await supabase.from('custom_roles').select('*').eq('tenant_id', activeTenant.id).order('name');
    setRoles(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeTenant]);

  // Load members with their roles
  async function loadMembers() {
    if (!activeTenant || !user) return;
    setMembersLoading(true);
    const { data } = await supabase
      .from('tenant_memberships')
      .select('id, user_id, role, status, custom_role_id, custom_role:custom_roles(id, name, color), employee:employees(first_name, last_name, department, email)')
      .eq('tenant_id', activeTenant.id)
      .eq('status', 'active');
    // Supabase's generic (non-codegen) type inference always models embedded
    // relations as arrays; at runtime these many-to-one joins come back as a
    // single object, so we narrow via `unknown` rather than fight the
    // inferred shape here.
    const rows = (data ?? []) as unknown as Membership[];
    // Get emails from auth.users is not possible via RLS, so use employee emails
    const enriched: Membership[] = rows.map((m) => ({
      ...m,
      email: m.employee?.email ?? '—',
      originalRole: m.role,
    }));
    setMembers(enriched);
    setMembersLoading(false);
  }
  useEffect(() => { loadMembers(); }, [activeTenant]);

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.employee?.first_name?.toLowerCase().includes(q) ?? false) ||
      (m.employee?.last_name?.toLowerCase().includes(q) ?? false) ||
      (m.email?.toLowerCase().includes(q) ?? false) ||
      (m.employee?.department?.toLowerCase().includes(q) ?? false)
    );
  });

  async function assignRole(membership: Membership, newRole: AppRole) {
    if (!activeTenant || !user) return;
    if (membership.role === newRole) return;
    setConfirmAssign({ membership, newRole });
  }

  async function confirmAssignRole() {
    if (!confirmAssign || !activeTenant || !user) return;
    const { membership, newRole } = confirmAssign;
    const oldRole = membership.role;
    setAssigning(true);
    setRoleError(null);
    try {
      const { error: updErr } = await supabase.from('tenant_memberships').update({ role: newRole }).eq('id', membership.id);
      if (updErr) {
        setRoleError(updErr.message.includes('Only a verified super administrator')
          ? "Seul un super administrateur peut attribuer le rôle super_admin."
          : `Échec de la mise à jour du rôle : ${updErr.message}`);
        return;
      }
      await supabase.from('role_history').insert({
        tenant_id: activeTenant.id,
        user_id: membership.user_id,
        employee_id: membership.employee?.id ?? null,
        old_role: oldRole,
        new_role: newRole,
        changed_by: user.id,
        reason: 'Changement manuel par admin',
      });
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenant.id, actor: user.id,
        action: 'role.changed',
        details: { user_id: membership.user_id, old_role: oldRole, new_role: newRole },
      });
      await notify({
        tenantId: activeTenant.id,
        userId: membership.user_id,
        category: 'role',
        title: 'Rôle modifié',
        body: `Votre rôle est maintenant: ${t(`role.${newRole}`) ?? newRole}`,
        priority: 'high',
      });
      setSuccessMsg(`Rôle de ${membership.employee?.first_name ?? membership.email} mis à jour: ${t(`role.${newRole}`) ?? newRole}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setConfirmAssign(null);
      loadMembers();
    } finally {
      setAssigning(false);
    }
  }

  function assignCustomRole(membership: Membership, customRoleId: string | null) {
    if (!activeTenant || !user) return;
    if ((membership.custom_role_id ?? null) === customRoleId) return;
    const customRoleName = customRoleId ? (roles.find((r) => r.id === customRoleId)?.name ?? 'Rôle personnalisé') : 'Aucun (rôle standard)';
    setConfirmCustomAssign({ membership, customRoleId, customRoleName });
  }

  async function confirmAssignCustomRoleFn() {
    if (!confirmCustomAssign || !activeTenant || !user) return;
    const { membership, customRoleId, customRoleName } = confirmCustomAssign;
    setAssigning(true);
    setRoleError(null);
    try {
      const { error: updErr } = await supabase.from('tenant_memberships').update({ custom_role_id: customRoleId }).eq('id', membership.id);
      if (updErr) { setRoleError(`Échec de la mise à jour : ${updErr.message}`); return; }
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenant.id, actor: user.id,
        action: 'custom_role.assigned',
        details: { user_id: membership.user_id, custom_role_id: customRoleId, custom_role_name: customRoleName },
      });
      await notify({
        tenantId: activeTenant.id,
        userId: membership.user_id,
        category: 'role',
        title: 'Permissions mises à jour',
        body: customRoleId
          ? `Un rôle personnalisé (${customRoleName}) vous a été attribué.`
          : 'Votre rôle personnalisé a été retiré ; vos permissions standard s\'appliquent à nouveau.',
        priority: 'high',
      });
      setSuccessMsg(`Rôle personnalisé de ${membership.employee?.first_name ?? membership.email} mis à jour: ${customRoleName}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setConfirmCustomAssign(null);
      loadMembers();
    } finally {
      setAssigning(false);
    }
  }

  async function loadHistory() {
    if (!activeTenant) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from('role_history')
      .select('id, old_role, new_role, reason, created_at, employee:employees(first_name, last_name)')
      .eq('tenant_id', activeTenant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data ?? []) as unknown as RoleHistoryEntry[]);
    setHistoryLoading(false);
  }
  useEffect(() => { if (historyOpen) loadHistory(); }, [historyOpen]);

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
    setRoleError(null);
    const payload = { name: form.name.trim(), color: form.color, permissions: form.permissions };
    const { error: saveErr } = editing
      ? await supabase.from('custom_roles').update(payload).eq('id', editing.id)
      : await supabase.from('custom_roles').insert({ ...payload, tenant_id: activeTenant.id });
    if (saveErr) {
      setRoleError(saveErr.message.includes('TENANT_INACTIVE')
        ? "Votre abonnement n'est pas actif. Renouvelez votre plan pour continuer."
        : `Échec de l'enregistrement : ${saveErr.message}`);
      return;
    }
    setModal(false);
    load();
  }

  async function remove(id: string) {
    const { error: delErr } = await supabase.from('custom_roles').delete().eq('id', id);
    if (delErr) { setRoleError(`Échec de la suppression : ${delErr.message}`); return; }
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

      {/* Role Assignment Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCog size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Attribution des rôles</h2>
              <p className="text-slate-500 dark:text-white/50 text-xs">Assignez et modifiez les rôles des membres</p>
            </div>
          </div>
          <button onClick={() => setHistoryOpen(!historyOpen)} className="btn-ghost text-sm flex items-center gap-1.5">
            <History size={15} /> Historique
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, email, département…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Members table */}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4 font-medium">Employé</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-left p-4 font-medium">Département</th>
                <th className="text-left p-4 font-medium">Rôle actuel</th>
                <th className="text-left p-4 font-medium">Nouveau rôle</th>
                <th className="text-left p-4 font-medium">Rôle personnalisé</th>
                <th className="text-left p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {membersLoading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun membre trouvé</td></tr>
              ) : filteredMembers.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-4 text-slate-900 dark:text-white font-medium">
                    {m.employee?.first_name ?? m.email} {m.employee?.last_name ?? ''}
                  </td>
                  <td className="p-4 text-slate-500 dark:text-white/50 text-xs">{m.email ?? '—'}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{m.employee?.department ?? '—'}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ROLE_COLORS[m.role as string] ?? '#6b7280' }}>
                      {t(`role.${m.role}`) ?? m.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      className="input py-1 text-xs"
                      value={m.role}
                      onChange={(e) => { assignRole(m, e.target.value as AppRole); e.target.value = m.role; }}
                    >
                      {ALL_STANDARD_ROLES.map((r) => (
                        <option key={r} value={r} className="bg-white dark:bg-ink-700">{t(`role.${r}`) ?? r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      className="input py-1 text-xs"
                      value={m.custom_role_id ?? ''}
                      onChange={(e) => { const v = e.target.value || null; assignCustomRole(m, v); e.target.value = m.custom_role_id ?? ''; }}
                    >
                      <option value="">Aucun (rôle standard)</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id} className="bg-white dark:bg-ink-700">{r.name}</option>
                      ))}
                    </select>
                    {m.custom_role && (
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: m.custom_role.color }}>
                        {m.custom_role.name}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {m.role !== m.originalRole && <span className="text-emerald-600 dark:text-emerald-400">Mis à jour</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Success toast */}
        {successMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-scale-in">
            <Check size={18} /> {successMsg}
          </div>
        )}

        {/* Error toast */}
        {roleError && (
          <div className="fixed bottom-6 right-6 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-scale-in max-w-md">
            <span className="text-sm">{roleError}</span>
            <button onClick={() => setRoleError(null)} className="text-white/80 hover:text-white shrink-0">✕</button>
          </div>
        )}

        {/* Role assignment confirmation modal */}
        <Modal open={confirmAssign !== null} onClose={() => setConfirmAssign(null)} title="Confirmer l'attribution du rôle" maxWidth="max-w-md">
          {confirmAssign && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
                <div className="w-10 h-10 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold">
                  {(confirmAssign.membership.employee?.first_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-medium text-sm">
                    {confirmAssign.membership.employee?.first_name ?? confirmAssign.membership.email} {confirmAssign.membership.employee?.last_name ?? ''}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/50">{confirmAssign.membership.email}</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ROLE_COLORS[confirmAssign.membership.role as string] ?? '#6b7280' }}>
                  {t(`role.${confirmAssign.membership.role}`) ?? confirmAssign.membership.role}
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ROLE_COLORS[confirmAssign.newRole] ?? '#6b7280' }}>
                  {t(`role.${confirmAssign.newRole}`) ?? confirmAssign.newRole}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-white/60 text-center">
                Cette action enregistrera le changement, notifiera l'employé et créera une entrée d'historique.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConfirmAssign(null)} className="btn-ghost text-sm">Annuler</button>
            <button onClick={confirmAssignRole} disabled={assigning} className="btn-primary text-sm">
              {assigning ? <Spinner /> : <>Confirmer l'attribution</>}
            </button>
          </div>
        </Modal>

        {/* Custom role assignment confirmation modal */}
        <Modal open={confirmCustomAssign !== null} onClose={() => setConfirmCustomAssign(null)} title="Confirmer le rôle personnalisé" maxWidth="max-w-md">
          {confirmCustomAssign && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
                <div className="w-10 h-10 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold">
                  {(confirmCustomAssign.membership.employee?.first_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-medium text-sm">
                    {confirmCustomAssign.membership.employee?.first_name ?? confirmCustomAssign.membership.email} {confirmCustomAssign.membership.employee?.last_name ?? ''}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/50">{confirmCustomAssign.membership.email}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-white/60 text-center">
                Attribuer le rôle personnalisé <strong>{confirmCustomAssign.customRoleName}</strong> à cette personne ?
                Ses permissions précises remplaceront celles de son rôle standard ({t(`role.${confirmCustomAssign.membership.role}`) ?? confirmCustomAssign.membership.role}).
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConfirmCustomAssign(null)} className="btn-ghost text-sm">{t('common.cancel')}</button>
            <button onClick={confirmAssignCustomRoleFn} disabled={assigning} className="btn-primary text-sm">
              {assigning ? <Spinner /> : <>Confirmer</>}
            </button>
          </div>
        </Modal>

        {/* History modal */}
        <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historique des rôles" maxWidth="max-w-2xl">
          {historyLoading ? <Spinner className="mx-auto" /> : history.length === 0 ? (
            <EmptyState icon={<History size={40} />} title="Aucun historique" hint="Les changements de rôles apparaîtront ici." />
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 text-xs font-bold">
                    {(h.employee?.first_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-white text-sm font-medium">
                      {h.employee?.first_name ?? 'Utilisateur'} {h.employee?.last_name ?? ''}
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="text-slate-400">{h.old_role ? t(`role.${h.old_role}`) ?? h.old_role : '—'}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-coral-600 dark:text-coral-400 font-medium">{t(`role.${h.new_role}`) ?? h.new_role}</span>
                    </div>
                    {h.reason && <div className="text-xs text-slate-400 mt-0.5">{h.reason}</div>}
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{new Date(h.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
