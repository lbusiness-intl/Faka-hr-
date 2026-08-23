import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardShell } from '../DashboardShell';
import { Modal, Badge, Spinner, EmptyState, StatCard } from '../ui';
import { useRoute, navigate } from '../../lib/router';
import { getPlan, type PlanId } from '../../lib/plans';
import {
  Users, Wallet, CalendarClock, BanknoteIcon, Receipt, Clock, UserPlus, GraduationCap,
  Target, Star, Package, ShieldCheck, CalendarDays, Settings as SettingsIcon,
  Plus, Check, X, FileText, TrendingUp,
  Send,
} from 'lucide-react';
import BranchManager from './BranchManager';
import DepartmentManager from './DepartmentManager';
import LeaveBalanceManager from './LeaveBalanceManager';
import RoleManager from './RoleManager';
import CommunicationsPanel from './CommunicationsPanel';
import InviteWizard from './InviteWizard';
import { notify } from '../../lib/notifications';

type Employee = {
  id: string; first_name: string; last_name: string; email: string; phone: string;
  position: string; department: string; salary: number; currency: string;
  contract_type: string; status: string; hire_date: string | null;
  employee_id: string | null; employment_type: string; manager_id: string | null;
  start_date: string | null; branch_id: string | null; department_id: string | null;
  avatar_url: string | null; user_id: string | null;
  allowances: number; recurring_deductions: number;
};

type Invitation = {
  id: string; email: string; role: string; status: string; token: string;
  expires_at: string; created_at: string; used_at: string | null;
};

function PageHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">{icon}</div>}
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function useTenant() {
  const { activeTenant } = useAuth();
  return activeTenant;
}

// ============================================================
// Dashboard overview
// ============================================================
function Overview() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const [stats, setStats] = useState({ employees: 0, leaves: 0, payroll: 0, advances: 0 });
  const [history, setHistory] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [e, l, p, a, runs] = await Promise.all([
        supabase.from('employees').select('id, salary, currency').eq('tenant_id', tenant.id).eq('status', 'active'),
        supabase.from('leave_requests').select('id').eq('tenant_id', tenant.id).eq('status', 'pending'),
        supabase.from('payslips').select('net, currency').eq('tenant_id', tenant.id).eq('status', 'paid'),
        supabase.from('advances').select('amount').eq('tenant_id', tenant.id).eq('status', 'pending'),
        supabase.from('payroll_runs').select('period, total_net').eq('tenant_id', tenant.id).order('period', { ascending: true }),
      ]);
      const totalPayroll = ((p.data ?? []) as { net: number }[]).reduce((s, x) => s + Number(x.net), 0);
      const totalAdvances = ((a.data ?? []) as { amount: number }[]).reduce((s, x) => s + Number(x.amount), 0);
      setStats({
        employees: (e.data ?? []).length,
        leaves: (l.data ?? []).length,
        payroll: totalPayroll,
        advances: totalAdvances,
      });

      // Build the real last-6-months payroll cost history from actual
      // payroll_runs (previously this chart showed fixed, fake numbers).
      const byPeriod = new Map<string, number>();
      ((runs.data ?? []) as { period: string; total_net: number }[]).forEach((r) => {
        byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + Number(r.total_net));
      });
      const now = new Date();
      const months: { label: string; value: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString(localeTag, { month: 'short' });
        months.push({ label, value: byPeriod.get(key) ?? 0 });
      }
      setHistory(months);
      setLoading(false);
    })();
  }, [tenant]);

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));
  const maxHistory = Math.max(1, ...history.map((h) => h.value));

  return (
    <div>
      <PageHeader title={t('dash.dashboard')} icon={<TrendingUp size={20} />} />
      {loading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label={t('dash.employees')} value={String(stats.employees)} sub={`limite ${getPlan(tenant.plan as PlanId).employeeLimit ?? '∞'}`} icon={<Users size={18} />} color="coral" />
            <StatCard label={t('dash.payroll')} value={`${fmt(stats.payroll)} ${tenant.currency}`} icon={<Wallet size={18} />} color="teal" />
            <StatCard label={t('dash.leaves')} value={String(stats.leaves)} sub="en attente" icon={<CalendarClock size={18} />} color="indigo" />
            <StatCard label={t('dash.advances')} value={`${fmt(stats.advances)} ${tenant.currency}`} sub="en attente" icon={<BanknoteIcon size={18} />} color="amber" />
          </div>
          <div className="card p-6">
            <h3 className="text-slate-900 dark:text-white font-semibold mb-4">Coût de paie — 6 derniers mois</h3>
            {history.every((h) => h.value === 0) ? (
              <p className="text-slate-400 dark:text-white/40 text-sm">Aucune paie exécutée sur cette période pour l'instant.</p>
            ) : (
              <div className="flex items-end gap-3 h-48">
                {history.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2" title={`${fmt(h.value)} ${tenant.currency}`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-coral-500 to-coral-400" style={{ height: `${Math.max(2, (h.value / maxHistory) * 100)}%` }} />
                    <div className="text-xs text-slate-400 dark:text-white/40 capitalize">{h.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Employees
// ============================================================
function Employees() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const [items, setItems] = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [offboarding, setOffboarding] = useState<Employee | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteWizard, setInviteWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', employee_id: '', phone: '', position: '',
    department: '', branch_id: '', department_id: '', employment_type: 'cdi',
    salary: 0, manager_id: '', start_date: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [emps, invs, brs, depts] = await Promise.all([
      supabase.from('employees').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('invitations').select('id, email, role, status, token, expires_at, created_at, used_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('departments').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ]);
    setItems((emps.data as Employee[]) ?? []);
    setInvitations((invs.data as Invitation[]) ?? []);
    setBranches(brs.data ?? []);
    setDepartments(depts.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  // Real-time subscription
  useEffect(() => {
    if (!tenant) return;
    const channel = supabase.channel(`employees_invitations:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant]);

  function validateForm(): string | null {
    if (!form.first_name.trim()) return 'Le prénom est obligatoire';
    if (!form.last_name.trim()) return 'Le nom est obligatoire';
    if (!form.email.trim()) return 'L\'email est obligatoire';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email invalide';
    if (!form.position.trim()) return 'Le poste est obligatoire';
    if (!form.start_date) return 'La date de début est obligatoire';
    return null;
  }

  async function add() {
    if (!tenant) return;
    const err = validateForm();
    if (err) { setError(err); return; }
    setError(null);
    setConfirmCreate(true);
  }

  async function confirmAndCreate() {
    if (!tenant) return;
    setSaving(true);
    try {
      const { data, error: insErr } = await supabase.from('employees').insert({
        tenant_id: tenant.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        employee_id: form.employee_id || null,
        phone: form.phone,
        position: form.position,
        department: form.department,
        branch_id: form.branch_id || null,
        department_id: form.department_id || null,
        employment_type: form.employment_type,
        salary: Number(form.salary) || 0,
        currency: tenant.currency,
        contract_type: form.employment_type,
        manager_id: form.manager_id || null,
        start_date: form.start_date,
        status: 'pending_invite',
        hire_date: form.start_date,
      }).select().single();

      if (insErr) { setError(insErr.message); setSaving(false); return; }

      // Auto-invite after creating the employee record
      if (data && form.email) {
        await inviteEmployee(data.id, form.email.trim().toLowerCase());
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.id, actor: user?.id,
        action: 'employee.created',
        details: { employee_id: data.id, name: `${form.first_name} ${form.last_name}`, email: form.email },
      });

      setModal(false);
      setConfirmCreate(false);
      setForm({ first_name: '', last_name: '', email: '', employee_id: '', phone: '', position: '', department: '', branch_id: '', department_id: '', employment_type: 'cdi', salary: 0, manager_id: '', start_date: new Date().toISOString().slice(0, 10) });
      setSuccessMsg(`${form.first_name} ${form.last_name} a été créé et invité.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function inviteEmployee(employeeId: string, email: string) {
    if (!tenant || !email) return;
    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData?.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'create', tenantId: tenant.id, email, role: 'employee' }),
      });
      const json = await res.json();
      if (json.ok) {
        const url = `${window.location.origin}/#/accept-invite?token=${json.token}`;
        setInviteLink(url);
        // Update invitation status to 'sent'
        await supabase.from('invitations').update({ status: 'sent' }).eq('token', json.token);
        load();
      }
    } catch { /* ignore */ }
    setInviting(false);
  }

  async function cancelInvitation(token: string) {
    await supabase.from('invitations').update({ status: 'cancelled' }).eq('token', token);
    load();
  }

  async function resendInvitation(inv: Invitation) {
    await inviteEmployee('', inv.email);
  }

  async function offboard(reason: string, notes: string) {
    if (!offboarding || !tenant) return;
    await supabase.from('employees').update({
      status: 'exited', exit_date: new Date().toISOString().slice(0, 10), exit_reason: reason, exit_notes: notes,
    }).eq('id', offboarding.id);
    await supabase.from('audit_logs').insert({ tenant_id: tenant.id, actor: user?.id, action: 'employee.offboarded', details: { employee_id: offboarding.id, reason } });
    // Notify the employee
    if (offboarding.user_id) {
      await notify({ tenantId: tenant.id, userId: offboarding.user_id, category: 'system', title: 'Offboarding', body: `Votre départ a été enregistré: ${reason}`, priority: 'high' });
    }
    setOffboarding(null);
    load();
  }

  const inviteStatusForEmail = (email: string): Invitation | null => {
    return invitations.find((i) => i.email === email.toLowerCase()) ?? null;
  };

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.employees')} icon={<Users size={20} />}
        action={
          <button onClick={() => setInviteWizard(true)} className="btn-primary text-sm"><UserPlus size={16} /> Inviter</button>
        } />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Aucun employé" hint="Invitez votre premier employé — il recevra un lien d'activation sécurisé." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4 font-medium">Employé</th>
                <th className="text-left p-4 font-medium">Poste</th>
                <th className="text-left p-4 font-medium">Dépt.</th>
                <th className="text-left p-4 font-medium">Salaire</th>
                <th className="text-left p-4 font-medium">Statut</th>
                <th className="text-left p-4 font-medium">Invitation</th>
                <th className="text-left p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const inv = inviteStatusForEmail(e.email);
                return (
                  <tr key={e.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold text-sm shrink-0">
                          {(e.first_name?.[0] ?? '?').toUpperCase()}{(e.last_name?.[0] ?? '').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-slate-900 dark:text-white font-medium">{e.first_name} {e.last_name}</div>
                          <div className="text-slate-400 dark:text-white/40 text-xs">{e.email}</div>
                          {e.employee_id && <div className="text-slate-400 dark:text-white/40 text-xs">ID: {e.employee_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{e.position || '—'}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{e.department || '—'}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{new Intl.NumberFormat(localeTag).format(e.salary)} {e.currency}</td>
                    <td className="p-4">
                      <Badge color={e.status === 'active' ? 'emerald' : e.status === 'pending_invite' ? 'amber' : e.status === 'exited' ? 'slate' : 'rose'}>
                        {e.status === 'pending_invite' ? 'En attente' : e.status === 'active' ? 'Actif' : e.status === 'exited' ? 'Sorti' : e.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {inv ? (
                        <div className="flex items-center gap-2">
                          <Badge color={
                            inv.status === 'accepted' ? 'emerald' :
                            inv.status === 'sent' ? 'indigo' :
                            inv.status === 'pending' ? 'amber' :
                            inv.status === 'expired' ? 'rose' :
                            inv.status === 'cancelled' ? 'slate' : 'slate'
                          }>
                            {inv.status === 'accepted' ? 'Acceptée' :
                             inv.status === 'sent' ? 'Envoyée' :
                             inv.status === 'pending' ? 'En attente' :
                             inv.status === 'expired' ? 'Expirée' :
                             inv.status === 'cancelled' ? 'Annulée' : inv.status}
                          </Badge>
                          {(inv.status === 'pending' || inv.status === 'sent' || inv.status === 'expired') && (
                            <button onClick={() => resendInvitation(inv)} className="text-coral-600 hover:text-coral-500 text-xs" title="Renvoyer">
                              <Send size={13} />
                            </button>
                          )}
                          {(inv.status === 'pending' || inv.status === 'sent') && (
                            <button onClick={() => cancelInvitation(inv.token)} className="text-rose-500 hover:text-rose-400 text-xs" title="Annuler">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-white/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 flex gap-2">
                      {e.status !== 'exited' && e.email && !inv && (
                        <button onClick={() => inviteEmployee(e.id, e.email)} disabled={inviting} className="text-coral-600 hover:text-coral-500 text-xs font-medium">
                          Inviter
                        </button>
                      )}
                      {e.status !== 'exited' && (
                        <button onClick={() => setOffboarding(e)} className="text-rose-500 hover:text-rose-400 text-xs">Offboarder</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-scale-in">
          <Check size={18} /> {successMsg}
        </div>
      )}

      {/* Employee creation form modal */}
      <Modal open={modal && !confirmCreate} onClose={() => setModal(false)} title="Nouvel employé" maxWidth="max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><label className="label">Email professionnel *</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">ID Employé</label><input className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="EMP-001" /></div>
          <div><label className="label">Poste / Titre *</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <label className="label">Agence</label>
            <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">— Aucune —</option>
              {branches.map((b) => <option key={b.id} value={b.id} className="bg-white dark:bg-ink-700">{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Département</label>
            <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {departments.map((d) => <option key={d.id} value={d.id} className="bg-white dark:bg-ink-700">{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type d'emploi</label>
            <select className="input" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
              <option value="cdi" className="bg-white dark:bg-ink-700">CDI</option>
              <option value="cdd" className="bg-white dark:bg-ink-700">CDD</option>
              <option value="stage" className="bg-white dark:bg-ink-700">Stage</option>
              <option value="freelance" className="bg-white dark:bg-ink-700">Freelance</option>
              <option value="consultant" className="bg-white dark:bg-ink-700">Consultant</option>
            </select>
          </div>
          <div><label className="label">Salaire ({tenant.currency})</label><input type="number" className="input" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></div>
          <div>
            <label className="label">Manager</label>
            <select className="input" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {items.filter((e) => e.status === 'active').map((e) => <option key={e.id} value={e.id} className="bg-white dark:bg-ink-700">{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div><label className="label">Date de début *</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        </div>
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">Suivant</button>
        </div>
      </Modal>

      {/* Confirmation modal — review before creating */}
      <Modal open={confirmCreate} onClose={() => setConfirmCreate(false)} title="Confirmer la création de l'employé" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
            <div className="w-12 h-12 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold text-lg">
              {form.first_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="text-slate-900 dark:text-white font-semibold">{form.first_name} {form.last_name}</div>
              <div className="text-xs text-slate-500 dark:text-white/50">{form.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400">Poste:</span> <span className="text-slate-900 dark:text-white font-medium">{form.position}</span></div>
            <div><span className="text-slate-400">Type:</span> <span className="text-slate-900 dark:text-white font-medium uppercase">{form.employment_type}</span></div>
            <div><span className="text-slate-400">Salaire:</span> <span className="text-slate-900 dark:text-white font-medium">{new Intl.NumberFormat(localeTag).format(form.salary)} {tenant.currency}</span></div>
            <div><span className="text-slate-400">Début:</span> <span className="text-slate-900 dark:text-white font-medium">{form.start_date}</span></div>
            {form.employee_id && <div><span className="text-slate-400">ID:</span> <span className="text-slate-900 dark:text-white font-medium">{form.employee_id}</span></div>}
            {form.department_id && <div><span className="text-slate-400">Dépt:</span> <span className="text-slate-900 dark:text-white font-medium">{departments.find((d) => d.id === form.department_id)?.name ?? '—'}</span></div>}
          </div>
          <div className="rounded-xl border border-coral-200 dark:border-coral-500/30 bg-coral-50 dark:bg-coral-500/10 p-3 text-sm text-coral-700 dark:text-coral-300">
            <strong>Action:</strong> L'employé sera créé, une invitation sera générée et envoyée par email, et le tableau de bord sera mis à jour.
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setConfirmCreate(false)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={confirmAndCreate} disabled={saving} className="btn-primary text-sm">
            {saving ? <Spinner /> : <>Confirmer & Envoyer l'invitation <Send size={16} /></>}
          </button>
        </div>
      </Modal>

      <OffboardModal employee={offboarding} onClose={() => setOffboarding(null)} onConfirm={offboard} />

      <Modal open={inviteLink !== null} onClose={() => setInviteLink(null)} title="Invitation envoyée">
        <p className="text-slate-600 dark:text-white/70 text-sm mb-3">
          L'employé recevra un email d'invitation. Partagez aussi ce lien sécurisé (valide 72h) :
        </p>
        <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-3 font-mono text-xs text-slate-700 dark:text-white/70 break-all">
          {inviteLink}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => { if (inviteLink) navigator.clipboard?.writeText(inviteLink); }} className="btn-ghost text-sm">Copier</button>
          <button onClick={() => setInviteLink(null)} className="btn-primary text-sm">Fermer</button>
        </div>
      </Modal>

      <InviteWizard open={inviteWizard} onClose={() => setInviteWizard(false)} onDone={() => { setInviteWizard(false); load(); }} />
    </div>
  );
}

function OffboardModal({ employee, onClose, onConfirm }: {
  employee: Employee | null;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('resignation');
  const [notes, setNotes] = useState('');
  if (!employee) return null;
  return (
    <Modal open={true} onClose={onClose} title={`Offboarding — ${employee.first_name} ${employee.last_name}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Motif</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="resignation" className="bg-white dark:bg-ink-700">Démission</option>
            <option value="dismissal" className="bg-white dark:bg-ink-700">Licenciement</option>
            <option value="end_of_contract" className="bg-white dark:bg-ink-700">Fin de contrat</option>
            <option value="retirement" className="bg-white dark:bg-ink-700">Retraite</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn-ghost text-sm">{t('common.cancel')}</button>
        <button onClick={() => onConfirm(reason, notes)} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-sm text-white bg-rose-500 hover:bg-rose-600 transition">Confirmer l'offboarding</button>
      </div>
    </Modal>
  );
}

// ============================================================
// Generic requests list (leaves, advances, claims)
// ============================================================
function computeLeaveDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

type RequestItem = {
  id: string;
  employee_id: string;
  status: 'pending' | 'approved' | 'rejected';
  type?: string;
  start_date?: string;
  end_date?: string;
  days?: number;
  amount?: number;
  created_at: string;
};
type EmployeeBasic = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'user_id'>;
type LeaveBalance = { id: string; employee_id: string; entitled: number; used: number; carried_over?: number };

function RequestList({ table, title, icon, amountKey }: {
  table: 'leave_requests' | 'advances' | 'claims';
  title: string;
  icon: ReactNode;
  amountKey?: 'amount';
}) {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [employees, setEmployees] = useState<Record<string, EmployeeBasic>>({});
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const isLeave = table === 'leave_requests';
  const thisYear = new Date().getFullYear();

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const calls: [
      PromiseLike<{ data: RequestItem[] | null }>,
      PromiseLike<{ data: EmployeeBasic[] | null }>,
      PromiseLike<{ data: LeaveBalance[] | null }>?,
    ] = [
      supabase.from(table).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, user_id').eq('tenant_id', tenant.id),
    ];
    if (isLeave) calls.push(supabase.from('leave_balances').select('*').eq('tenant_id', tenant.id).eq('type', 'annual').eq('year', thisYear));
    const [r, emps, bal] = await Promise.all(calls);
    setItems(r.data ?? []);
    const map: Record<string, EmployeeBasic> = {};
    (emps.data ?? []).forEach((e) => { map[e.id] = e; });
    setEmployees(map);
    if (isLeave && bal) {
      const bmap: Record<string, LeaveBalance> = {};
      (bal.data ?? []).forEach((b) => { bmap[b.employee_id] = b; });
      setBalances(bmap);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  // Real-time subscription
  useEffect(() => {
    if (!tenant) return;
    const ch = supabase.channel(`${table}:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant, table]);

  async function add() {
    if (!tenant) return;
    await supabase.from(table).insert({ ...form, tenant_id: tenant.id, currency: tenant.currency, status: 'pending' });
    // Notify HR that a new request was submitted
    const emp = employees[form.employee_id as string];
    if (emp) {
      const { notifyHR } = await import('../../lib/notifications');
      await notifyHR(tenant.id, {
        category: table === 'leave_requests' ? 'leave' : table === 'advances' ? 'advance' : 'claim',
        title: `Nouvelle demande — ${title}`,
        body: `${emp.first_name} ${emp.last_name} a soumis une demande.`,
        priority: 'normal',
      });
    }
    setModal(false);
    setForm({});
    load();
  }

  function remainingFor(employeeId: string): number | null {
    const b = balances[employeeId];
    if (!b) return null;
    return Number(b.entitled) + Number(b.carried_over) - Number(b.used);
  }

  async function update(id: string, status: string) {
    const item = items.find((it) => it.id === id);

    // Leave-specific: keep the employee's remaining balance accurate as
    // requests move in and out of "approved" (previously nothing ever
    // touched leave_balances, so quotas were never actually enforced).
    if (isLeave && item) {
      const days = computeLeaveDays(item.start_date ?? '', item.end_date ?? '');
      const wasApproved = item.status === 'approved';
      const willBeApproved = status === 'approved';
      if (!wasApproved && willBeApproved) {
        const b = balances[item.employee_id];
        const remaining = b ? Number(b.entitled) + Number(b.carried_over) - Number(b.used) : null;
        if (b && remaining !== null && remaining < days) {
          const proceed = window.confirm(
            `${empName(item.employee_id)} n'a que ${remaining} jour(s) restant(s) mais demande ${days} jour(s). Approuver quand même ?`
          );
          if (!proceed) return;
        }
        if (b) {
          await supabase.from('leave_balances').update({ used: Number(b.used) + days }).eq('id', b.id);
        }
      } else if (wasApproved && !willBeApproved) {
        const b = balances[item.employee_id];
        if (b) {
          await supabase.from('leave_balances').update({ used: Math.max(0, Number(b.used) - days) }).eq('id', b.id);
        }
      }
    }

    await supabase.from(table).update({ status }).eq('id', id);
    // Notify the employee
    const emp = item ? employees[item.employee_id] : null;
    if (emp?.user_id && tenant) {
      const cat = table === 'leave_requests' ? 'leave' : table === 'advances' ? 'advance' : 'claim';
      const titleText = table === 'leave_requests'
        ? (status === 'approved' ? 'Congé approuvé' : 'Congé refusé')
        : table === 'advances'
        ? (status === 'approved' ? 'Avance approuvée' : 'Avance refusée')
        : (status === 'approved' ? 'Note de frais approuvée' : 'Note de frais refusée');
      await notify({ tenantId: tenant.id, userId: emp.user_id, employeeId: emp.id, category: cat, title: titleText, body: `Votre demande a été ${status === 'approved' ? 'approuvée' : 'refusée'}.`, priority: status === 'approved' ? 'normal' : 'high' });
    }
    load();
  }

  if (!tenant) return null;
  const empName = (id: string) => {
    const e = employees[id];
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };

  return (
    <div>
      <PageHeader title={title} icon={icon}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> {t('common.add')}</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={icon} title="Aucune demande" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4 font-medium">Employé</th>
                {table === 'leave_requests' && <>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Période</th>
                  <th className="text-left p-4 font-medium">Jours</th>
                  <th className="text-left p-4 font-medium">Solde restant</th>
                </>}
                {amountKey && <th className="text-left p-4 font-medium">Montant</th>}
                <th className="text-left p-4 font-medium">Statut</th>
                <th className="text-left p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-4 text-slate-900 dark:text-white">{empName(it.employee_id)}</td>
                  {table === 'leave_requests' && <>
                    <td className="p-4 text-slate-700 dark:text-white/70 capitalize">{it.type}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 text-xs">{it.start_date} → {it.end_date}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{it.days}</td>
                    <td className="p-4">
                      {remainingFor(it.employee_id) === null ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <span className={remainingFor(it.employee_id)! < (it.days ?? 0) ? 'text-rose-500 font-medium' : 'text-slate-700 dark:text-white/70'}>
                          {remainingFor(it.employee_id)} j.
                        </span>
                      )}
                    </td>
                  </>}
                  {amountKey && <td className="p-4 text-slate-700 dark:text-white/70">{new Intl.NumberFormat(localeTag).format(it[amountKey] ?? 0)} {tenant.currency}</td>}
                  <td className="p-4"><Badge color={it.status === 'approved' ? 'emerald' : it.status === 'rejected' ? 'rose' : 'amber'}>{it.status}</Badge></td>
                  <td className="p-4">
                    {it.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => update(it.id, 'approved')} className="text-emerald-600 hover:text-emerald-500"><Check size={16} /></button>
                        <button onClick={() => update(it.id, 'rejected')} className="text-rose-500 hover:text-rose-400"><X size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={`Nouvelle demande — ${title}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="" className="bg-white dark:bg-ink-700">—</option>
              {Object.entries(employees).map(([id, e]) => <option key={id} value={id} className="bg-white dark:bg-ink-700">{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          {table === 'leave_requests' && (
            <>
              <div>
                <label className="label">Type</label>
                <select className="input" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="annual" className="bg-white dark:bg-ink-700">Congé annuel</option>
                  <option value="sick" className="bg-white dark:bg-ink-700">Maladie</option>
                  <option value="unpaid" className="bg-white dark:bg-ink-700">Sans solde</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Début</label><input type="date" className="input" onChange={(e) => {
                  const start = e.target.value;
                  const days = form.end_date ? computeLeaveDays(start, form.end_date as string) : form.days;
                  setForm({ ...form, start_date: start, days });
                }} /></div>
                <div><label className="label">Fin</label><input type="date" className="input" onChange={(e) => {
                  const end = e.target.value;
                  const days = form.start_date ? computeLeaveDays(form.start_date as string, end) : 1;
                  setForm({ ...form, end_date: end, days });
                }} /></div>
              </div>
              {form.start_date && form.end_date && (
                <p className="text-xs text-slate-500 dark:text-white/50">Durée calculée : <strong>{(form.days as number) ?? computeLeaveDays(form.start_date as string, form.end_date as string)} jour(s)</strong></p>
              )}
            </>
          )}
          {amountKey && (
            <>
              <div><label className="label">Montant ({tenant.currency})</label><input type="number" className="input" onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><label className="label">Raison / Description</label><textarea className="input" rows={2} onChange={(e) => setForm({ ...form, reason: e.target.value, description: e.target.value })} /></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Payroll
// ============================================================
function Payroll() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editModal, setEditModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [adjustForm, setAdjustForm] = useState({ field: 'salary', old_value: 0, new_value: 0, reason: '' });

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [r, e, b, d] = await Promise.all([
      supabase.from('payroll_runs').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('status', 'active'),
      supabase.from('branches').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('departments').select('id, name').eq('tenant_id', tenant.id),
    ]);
    setRuns(r.data ?? []);
    setEmployees((e.data as Employee[]) ?? []);
    setBranches(b.data ?? []);
    setDepartments(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  // Real-time
  useEffect(() => {
    if (!tenant) return;
    const ch = supabase.channel(`payroll:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_runs', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payslips', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  }
  function selectAll() { setSelected(new Set(employees.map((e) => e.id))); }
  function selectNone() { setSelected(new Set()); }

  function openEdit(emp: Employee) {
    setEditingEmp(emp);
    setAdjustForm({ field: 'salary', old_value: Number(emp.salary), new_value: Number(emp.salary), reason: '' });
    setEditModal(true);
  }

  async function saveAdjustment() {
    if (!tenant || !editingEmp || !adjustForm.reason.trim()) return;
    const field = adjustForm.field as 'salary' | 'bonus' | 'allowances' | 'deductions' | 'overtime' | 'taxes';
    // Recurring fields (salary, allowances, deductions) apply immediately and every
    // future payroll run picks them up from the employee record — so they're marked
    // "consumed" right away. Bonus / overtime / one-off tax corrections stay pending
    // (consumed = false) until the next payroll run actually uses them.
    const isRecurring = field === 'salary' || field === 'allowances' || field === 'deductions';
    await supabase.from('payroll_adjustments').insert({
      tenant_id: tenant.id,
      employee_id: editingEmp.id,
      field,
      old_value: adjustForm.old_value,
      new_value: adjustForm.new_value,
      reason: adjustForm.reason.trim(),
      changed_by: user?.id,
      consumed: isRecurring,
    });
    if (field === 'salary') {
      await supabase.from('employees').update({ salary: adjustForm.new_value }).eq('id', editingEmp.id);
    } else if (field === 'allowances') {
      await supabase.from('employees').update({ allowances: adjustForm.new_value }).eq('id', editingEmp.id);
    } else if (field === 'deductions') {
      await supabase.from('employees').update({ recurring_deductions: adjustForm.new_value }).eq('id', editingEmp.id);
    }
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id, actor: user?.id,
      action: 'payroll.adjustment',
      details: { employee_id: editingEmp.id, field, old: adjustForm.old_value, new: adjustForm.new_value, reason: adjustForm.reason },
    });
    setEditModal(false);
    load();
  }

  async function runPayroll() {
    if (!tenant || employees.length === 0) return;
    const period = new Date().toISOString().slice(0, 7);
    const alreadyRun = runs.some((r) => r.period === period);
    if (alreadyRun) {
      alert(`La paie pour ${period} a déjà été exécutée. Pour corriger un bulletin, modifiez-le individuellement plutôt que de relancer un run complet (cela créerait des doublons).`);
      return;
    }
    setRunning(true);
    const selectedEmps = selected.size > 0 ? employees.filter((e) => selected.has(e.id)) : employees;
    const empIds = selectedEmps.map((e) => e.id);

    // Pull any pending one-off adjustments (bonus / overtime / manual tax
    // corrections) HR recorded since the last run, so they actually land on
    // this period's payslip instead of being silently ignored.
    const { data: pendingAdj } = await supabase
      .from('payroll_adjustments')
      .select('id, employee_id, field, new_value')
      .eq('tenant_id', tenant.id)
      .eq('consumed', false)
      .in('employee_id', empIds)
      .in('field', ['bonus', 'overtime', 'taxes']);

    // Pull approved overtime hours that haven't been paid out yet, so they
    // actually land on the payslip instead of vanishing after approval.
    const { data: approvedOT } = await supabase
      .from('overtime')
      .select('id, employee_id, amount')
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .in('employee_id', empIds);

    type AdjBucket = { bonus: number; overtime: number; taxAdj: number; ids: string[]; otIds: string[] };
    const adjByEmp = new Map<string, AdjBucket>();
    (pendingAdj ?? []).forEach((a: any) => {
      const bucket = adjByEmp.get(a.employee_id) ?? { bonus: 0, overtime: 0, taxAdj: 0, ids: [], otIds: [] };
      if (a.field === 'bonus') bucket.bonus += Number(a.new_value);
      if (a.field === 'overtime') bucket.overtime += Number(a.new_value);
      if (a.field === 'taxes') bucket.taxAdj += Number(a.new_value);
      bucket.ids.push(a.id);
      adjByEmp.set(a.employee_id, bucket);
    });
    (approvedOT ?? []).forEach((o: any) => {
      const bucket = adjByEmp.get(o.employee_id) ?? { bonus: 0, overtime: 0, taxAdj: 0, ids: [], otIds: [] };
      bucket.overtime += Number(o.amount);
      bucket.otIds.push(o.id);
      adjByEmp.set(o.employee_id, bucket);
    });

    const computed = selectedEmps.map((e) => {
      const base = Number(e.salary);
      const allowances = Number(e.allowances ?? 0);
      const recurringDeductions = Number(e.recurring_deductions ?? 0);
      const adj = adjByEmp.get(e.id) ?? { bonus: 0, overtime: 0, taxAdj: 0, ids: [], otIds: [] };
      const grossPay = base + allowances + adj.bonus + adj.overtime;
      const taxes = grossPay * 0.15 + adj.taxAdj;
      const deductions = recurringDeductions + taxes;
      const net = grossPay - deductions;
      return { employee: e, gross: grossPay, deductions, net, bonus: adj.bonus, allowances, overtime_pay: adj.overtime, taxes, consumedIds: adj.ids, otIds: adj.otIds };
    });

    const gross = computed.reduce((s, c) => s + c.gross, 0);
    const net = computed.reduce((s, c) => s + c.net, 0);
    const { data: run } = await supabase.from('payroll_runs').insert({
      tenant_id: tenant.id, period, status: 'completed', total_gross: gross, total_net: net, currency: tenant.currency,
    }).select().single();
    if (run) {
      const payslips = computed.map((c) => ({
        tenant_id: tenant.id, run_id: run.id, employee_id: c.employee.id,
        gross: c.gross, deductions: c.deductions, net: c.net,
        bonus: c.bonus, allowances: c.allowances, overtime_pay: c.overtime_pay, taxes: c.taxes,
        currency: tenant.currency, status: 'pending',
      }));
      await supabase.from('payslips').insert(payslips);

      // Mark the one-off adjustments as used so they aren't applied again next month
      const consumedIds = computed.flatMap((c) => c.consumedIds);
      if (consumedIds.length > 0) {
        await supabase.from('payroll_adjustments').update({ consumed: true }).in('id', consumedIds);
      }
      // Mark the approved overtime entries as paid so they don't get paid twice
      const paidOtIds = computed.flatMap((c) => c.otIds);
      if (paidOtIds.length > 0) {
        await supabase.from('overtime').update({ status: 'paid' }).in('id', paidOtIds);
      }

      // Notify each employee
      await Promise.all(selectedEmps.map((e) => {
        if (e.user_id) {
          return notify({ tenantId: tenant.id, userId: e.user_id, employeeId: e.id, category: 'payroll', title: 'Paie disponible', body: `Votre bulletin de paie pour ${period} est disponible.`, priority: 'high', link: '/dashboard/employee/documents' });
        }
        return Promise.resolve();
      }));
      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.id, actor: user?.id, action: 'payroll.run', details: { period, count: selectedEmps.length, gross, net },
      });
    }
    setRunning(false);
    setSelected(new Set());
    load();
  }

  async function payAll() {
    if (!tenant) return;
    const { data: pending } = await supabase.from('payslips').select('id').eq('tenant_id', tenant.id).eq('status', 'pending');
    if (pending && pending.length > 0) {
      await supabase.from('payslips').update({ status: 'paid', paid_at: new Date().toISOString() }).in('id', pending.map((p: any) => p.id));
    }
    load();
  }

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? '—';
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.payroll')} icon={<Wallet size={20} />}
        action={
          <div className="flex gap-2">
            <button onClick={payAll} className="btn-ghost text-sm">Marquer tout payé</button>
            <button onClick={runPayroll} disabled={running || employees.length === 0} className="btn-primary text-sm">
              {running ? <Spinner /> : <><Plus size={16} /> Run Payroll ({selected.size || employees.length})</>}
            </button>
          </div>
        } />

      {/* Employee payroll table */}
      <div className="card overflow-x-auto mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/70 cursor-pointer">
              <input type="checkbox" checked={selected.size === employees.length && employees.length > 0} onChange={() => selected.size === employees.length ? selectNone() : selectAll()} className="rounded border-slate-300" />
              Tout sélectionner
            </label>
            <span className="text-xs text-slate-400">{selected.size}/{employees.length} sélectionnés</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
            <tr>
              <th className="text-left p-3 w-10"></th>
              <th className="text-left p-3 font-medium">Employé</th>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">Dépt.</th>
              <th className="text-left p-3 font-medium">Agence</th>
              <th className="text-left p-3 font-medium">Poste</th>
              <th className="text-right p-3 font-medium">Salaire</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className={`border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 ${selected.has(e.id) ? 'bg-coral-50/40 dark:bg-coral-500/5' : ''}`}>
                <td className="p-3"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} className="rounded border-slate-300" /></td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold text-xs shrink-0">
                      {(e.first_name?.[0] ?? '?').toUpperCase()}{(e.last_name?.[0] ?? '').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-slate-900 dark:text-white font-medium">{e.first_name} {e.last_name}</div>
                      <div className="text-slate-400 dark:text-white/40 text-xs">{e.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-slate-500 dark:text-white/50 text-xs">{e.employee_id ?? '—'}</td>
                <td className="p-3 text-slate-700 dark:text-white/70">{e.department_id ? deptName(e.department_id) : (e.department || '—')}</td>
                <td className="p-3 text-slate-700 dark:text-white/70">{e.branch_id ? branchName(e.branch_id) : '—'}</td>
                <td className="p-3 text-slate-700 dark:text-white/70">{e.position || '—'}</td>
                <td className="p-3 text-right text-slate-900 dark:text-white font-medium">{fmt(Number(e.salary))} {e.currency}</td>
                <td className="p-3"><Badge color={e.status === 'active' ? 'emerald' : 'amber'}>{e.status === 'active' ? 'Actif' : e.status}</Badge></td>
                <td className="p-3"><button onClick={() => openEdit(e)} className="text-coral-600 hover:text-coral-500 text-xs font-medium">Ajuster</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payroll history */}
      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">Historique</h3>
      {loading ? <Spinner /> : runs.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Aucune paie" hint="Lancez votre première paie mensuelle." />
      ) : (
        <div className="space-y-4">
          {runs.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold">Période {r.period}</div>
                  <div className="text-slate-500 dark:text-white/50 text-xs">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <Badge color={r.status === 'draft' ? 'slate' : r.status === 'completed' ? 'emerald' : 'amber'}>{r.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <StatCard label="Brut" value={`${fmt(r.total_gross)} ${r.currency}`} icon={<Wallet size={18} />} color="teal" />
                <StatCard label="Net" value={`${fmt(r.total_net)} ${r.currency}`} icon={<Wallet size={18} />} color="emerald" />
                <StatCard label="Employés" value={String(employees.length)} icon={<Users size={18} />} color="indigo" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjustment modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Ajustement de paie" maxWidth="max-w-md">
        {editingEmp && (
          <div className="space-y-3">
            <div className="card p-3 bg-slate-50 dark:bg-ink-700/50 border-0">
              <div className="text-slate-900 dark:text-white font-medium text-sm">{editingEmp.first_name} {editingEmp.last_name}</div>
              <div className="text-slate-400 dark:text-white/40 text-xs">{editingEmp.position} · {editingEmp.email}</div>
            </div>
            <div>
              <label className="label">Champ à ajuster</label>
              <select className="input" value={adjustForm.field} onChange={(e) => setAdjustForm({ ...adjustForm, field: e.target.value, old_value: e.target.value === 'salary' ? Number(editingEmp.salary) : 0, new_value: e.target.value === 'salary' ? Number(editingEmp.salary) : 0 })}>
                <option value="salary" className="bg-white dark:bg-ink-700">Salaire de base</option>
                <option value="bonus" className="bg-white dark:bg-ink-700">Prime / Bonus</option>
                <option value="allowances" className="bg-white dark:bg-ink-700">Indemnités</option>
                <option value="deductions" className="bg-white dark:bg-ink-700">Déductions</option>
                <option value="overtime" className="bg-white dark:bg-ink-700">Heures sup.</option>
                <option value="taxes" className="bg-white dark:bg-ink-700">Taxes</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Ancienne valeur</label><input type="number" className="input bg-slate-50 dark:bg-ink-700/50" value={adjustForm.old_value} readOnly /></div>
              <div><label className="label">Nouvelle valeur</label><input type="number" className="input" value={adjustForm.new_value} onChange={(e) => setAdjustForm({ ...adjustForm, new_value: Number(e.target.value) })} /></div>
            </div>
            <div><label className="label">Raison de la modification *</label><textarea className="input" rows={2} value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="Augmentation annuelle, correction d'erreur…" /></div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              Cette modification sera enregistrée dans le journal d'audit avec votre nom, la date et la raison.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
              <button onClick={saveAdjustment} disabled={!adjustForm.reason.trim()} className="btn-primary text-sm">{t('common.save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// Attendance
// ============================================================
function Attendance() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [a, e] = await Promise.all([
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', tenant.id),
    ]);
    setItems(a.data ?? []);
    const map: Record<string, Employee> = {};
    (e.data ?? []).forEach((x: any) => { map[x.id] = x; });
    setEmployees(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.attendance')} icon={<Clock size={20} />} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="Aucun pointage" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr><th className="text-left p-4">Employé</th><th className="text-left p-4">Entrée</th><th className="text-left p-4">Sortie</th></tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const e = employees[a.employee_id];
                return (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="p-4 text-slate-900 dark:text-white">{e ? `${e.first_name} ${e.last_name}` : '—'}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 text-xs">{a.check_in ? new Date(a.check_in).toLocaleString() : '—'}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 text-xs">{a.check_out ? new Date(a.check_out).toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Recruitment
// ============================================================
function Recruitment() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [postings, setPostings] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [form, setForm] = useState({ title: '', department: '', location: '', description: '' });
  const [candidateForm, setCandidateForm] = useState({ posting_id: '', full_name: '', email: '', phone: '', notes: '' });

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from('recruitment_postings').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('recruitment_candidates').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    setPostings(p.data ?? []);
    setCandidates(c.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function addPosting() {
    if (!tenant) return;
    await supabase.from('recruitment_postings').insert({ ...form, tenant_id: tenant.id, status: 'open' });
    setModal(false);
    setForm({ title: '', department: '', location: '', description: '' });
    load();
  }

  async function addCandidate() {
    if (!tenant || !candidateForm.full_name.trim()) return;
    await supabase.from('recruitment_candidates').insert({
      tenant_id: tenant.id,
      posting_id: candidateForm.posting_id || null,
      full_name: candidateForm.full_name.trim(),
      email: candidateForm.email.trim() || null,
      phone: candidateForm.phone.trim() || null,
      notes: candidateForm.notes.trim() || null,
      stage: 'applied',
    });
    setCandidateModal(false);
    setCandidateForm({ posting_id: '', full_name: '', email: '', phone: '', notes: '' });
    load();
  }

  async function moveCandidate(id: string, stage: string) {
    await supabase.from('recruitment_candidates').update({ stage }).eq('id', id);
    load();
  }

  const stages = ['applied', 'screening', 'interview', 'offer', 'hired'];

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.recruitment')} icon={<UserPlus size={20} />}
        action={
          <div className="flex gap-2">
            <button onClick={() => setCandidateModal(true)} className="btn-ghost text-sm"><Plus size={16} /> Candidat</button>
            <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Offre</button>
          </div>
        } />
      {loading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {postings.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-900 dark:text-white font-semibold">{p.title}</h3>
                  <Badge color={p.status === 'open' ? 'emerald' : 'slate'}>{p.status}</Badge>
                </div>
                <div className="text-slate-500 dark:text-white/50 text-xs mt-1">{p.department} · {p.location}</div>
                <p className="text-slate-600 dark:text-white/60 text-sm mt-3">{p.description}</p>
              </div>
            ))}
            {postings.length === 0 && <div className="text-slate-400 dark:text-white/40 text-sm">Aucune offre.</div>}
          </div>

          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">Pipeline candidats</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stages.map((stage) => (
              <div key={stage} className="card p-3 min-h-[200px]">
                <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-white/40 mb-3 capitalize">{stage}</div>
                <div className="space-y-2">
                  {candidates.filter((c) => c.stage === stage).map((c) => (
                    <div key={c.id} className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5">
                      <div className="text-slate-900 dark:text-white text-sm font-medium">{c.full_name}</div>
                      <div className="text-slate-400 dark:text-white/40 text-xs truncate">{c.email}</div>
                      {c.posting_id && (
                        <div className="text-slate-400 dark:text-white/40 text-[10px] truncate mt-0.5">
                          {postings.find((p) => p.id === c.posting_id)?.title ?? ''}
                        </div>
                      )}
                      <select
                        value={c.stage}
                        onChange={(e) => moveCandidate(c.id, e.target.value)}
                        className="mt-2 w-full text-xs bg-white dark:bg-ink-700 border border-slate-200 dark:border-white/10 rounded px-1.5 py-1 text-slate-700 dark:text-white/70"
                      >
                        {stages.map((s) => <option key={s} value={s} className="bg-white dark:bg-ink-700 capitalize">{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle offre">
        <div className="space-y-3">
          <div><label className="label">Titre du poste</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Département</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><label className="label">Localisation</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={addPosting} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>

      <Modal open={candidateModal} onClose={() => setCandidateModal(false)} title="Nouveau candidat">
        <div className="space-y-3">
          <div>
            <label className="label">Offre associée <span className="text-slate-400">(optionnel)</span></label>
            <select className="input" value={candidateForm.posting_id} onChange={(e) => setCandidateForm({ ...candidateForm, posting_id: e.target.value })}>
              <option value="">— Aucune —</option>
              {postings.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div><label className="label">Nom complet *</label><input className="input" value={candidateForm.full_name} onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input type="email" className="input" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} /></div>
            <div><label className="label">Téléphone</label><input className="input" value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={candidateForm.notes} onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setCandidateModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={addCandidate} disabled={!candidateForm.full_name.trim()} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Training, Goals, Reviews, Assets, Compliance, Communication, Events
// ============================================================
function Performance() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [goals, setGoals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [g, r, e] = await Promise.all([
        supabase.from('goals').select('*').eq('tenant_id', tenant.id),
        supabase.from('reviews').select('*').eq('tenant_id', tenant.id),
        supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', tenant.id),
      ]);
      setGoals(g.data ?? []);
      setReviews(r.data ?? []);
      const map: Record<string, Employee> = {};
      (e.data ?? []).forEach((x: any) => { map[x.id] = x as Employee; });
      setEmployees(map);
      setLoading(false);
    })();
  }, [tenant]);

  if (!tenant) return null;
  const avgProgress = goals.length ? Math.round(goals.reduce((s, g) => s + Number(g.progress ?? 0), 0) / goals.length) : 0;
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviews.length).toFixed(1) : '—';
  const empName = (id: string) => { const e = employees[id]; return e ? `${e.first_name} ${e.last_name}` : '—'; };

  return (
    <div>
      <PageHeader title={t('dash.performance')} icon={<Target size={20} />} />
      {loading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Objectifs en cours" value={String(goals.length)} icon={<Target size={18} />} color="coral" />
            <StatCard label="Progression moyenne" value={`${avgProgress}%`} icon={<TrendingUp size={18} />} color="teal" />
            <StatCard label="Note moyenne (évaluations)" value={String(avgRating)} sub="sur 5" icon={<Star size={18} />} color="amber" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="text-slate-900 dark:text-white font-semibold mb-3">Objectifs récents</h3>
              {goals.length === 0 ? <p className="text-sm text-slate-400">Aucun objectif défini pour l'instant.</p> : (
                <div className="space-y-2">
                  {goals.slice(0, 8).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-white/5 pb-2">
                      <div>
                        <div className="text-slate-800 dark:text-white/80 font-medium">{g.title}</div>
                        <div className="text-xs text-slate-400">{empName(g.employee_id)}</div>
                      </div>
                      <span className="text-coral-600 dark:text-coral-400 font-semibold">{g.progress ?? 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="text-slate-900 dark:text-white font-semibold mb-3">Évaluations récentes</h3>
              {reviews.length === 0 ? <p className="text-sm text-slate-400">Aucune évaluation pour l'instant.</p> : (
                <div className="space-y-2">
                  {reviews.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-white/5 pb-2">
                      <div>
                        <div className="text-slate-800 dark:text-white/80 font-medium">{empName(r.employee_id)}</div>
                        <div className="text-xs text-slate-400">{r.period ?? '—'}</div>
                      </div>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{r.rating ?? '—'}/5</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Astuce : gérez les objectifs et évaluations en détail depuis les onglets "Objectifs OKR" et "Évaluations 360°".</p>
        </>
      )}
    </div>
  );
}

function SimpleList({ table, title, icon, fields, extraInsert }: {
  table: string; title: string; icon: ReactNode; fields: { key: string; label: string; type?: string; required?: boolean }[];
  extraInsert?: (form: any) => Record<string, any>;
}) {
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const needsEmployees = fields.some((f) => f.type === 'employee_select');

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const calls: any[] = [supabase.from(table).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })];
    if (needsEmployees) calls.push(supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', tenant.id));
    const [r, e] = await Promise.all(calls);
    setItems(r.data ?? []);
    if (e) {
      const map: Record<string, Employee> = {};
      (e.data ?? []).forEach((x: any) => { map[x.id] = x as Employee; });
      setEmployees(map);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function add() {
    if (!tenant) return;
    setSaveError(null);
    const missing = fields.find((f) => f.required && !form[f.key]);
    if (missing) { setSaveError(`Le champ "${missing.label}" est requis.`); return; }
    const payload = { ...form, tenant_id: tenant.id, ...(extraInsert ? extraInsert(form) : {}) };
    const { error } = await supabase.from(table).insert(payload);
    if (error) { setSaveError(`L'enregistrement a échoué : ${error.message}`); return; }
    setModal(false);
    setForm({});
    load();
  }

  const empName = (id: string) => {
    const e = employees[id];
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={title} icon={icon}
        action={<button onClick={() => { setSaveError(null); setModal(true); }} className="btn-primary text-sm"><Plus size={16} /> {t('common.add')}</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={icon} title="Rien pour le moment" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="card p-5">
              {fields.map((f) => (
                <div key={f.key} className="mb-1">
                  {f.key === fields[0].key && <div className="text-slate-900 dark:text-white font-semibold">{f.type === 'employee_select' ? empName(it[f.key]) : it[f.key]}</div>}
                  {f.key !== fields[0].key && <div className="text-slate-500 dark:text-white/50 text-xs">{f.label}: {f.type === 'employee_select' ? empName(it[f.key]) : String(it[f.key] ?? '—')}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={`Ajouter — ${title}`}>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.type === 'employee_select' ? (
                <select className="input" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {Object.entries(employees).map(([id, e]) => <option key={id} value={id}>{e.first_name} {e.last_name}</option>)}
                </select>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  className="input"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                />
              )}
            </div>
          ))}
          {saveError && <p className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

function Events() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', event_date: '' });

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('events').select('*').or(`tenant_id.eq.${tenant.id},scope.eq.panafrican`).order('event_date', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function add() {
    if (!tenant) return;
    await supabase.from('events').insert({
      ...form, tenant_id: tenant.id, scope: 'company', event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
    });
    setModal(false);
    setForm({ title: '', description: '', location: '', event_date: '' });
    load();
  }

  async function rsvp(id: string, status: string) {
    if (!tenant || !user) return;
    const { data } = await supabase.from('events').select('rsvp').eq('id', id).single();
    const rsvp = { ...(data?.rsvp ?? {}), [user.id]: status };
    await supabase.from('events').update({ rsvp }).eq('id', id);
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.events')} icon={<CalendarDays size={20} />}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Événement</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<CalendarDays size={48} />} title="Aucun événement" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 dark:text-white font-semibold">{e.title}</h3>
                <Badge color={e.scope === 'panafrican' ? 'indigo' : 'emerald'}>{e.scope}</Badge>
              </div>
              <div className="text-slate-500 dark:text-white/50 text-xs mt-1">{e.event_date ? new Date(e.event_date).toLocaleString() : '—'} · {e.location}</div>
              <p className="text-slate-600 dark:text-white/60 text-sm mt-3">{e.description}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => rsvp(e.id, 'yes')} className="btn-ghost text-xs">Oui</button>
                <button onClick={() => rsvp(e.id, 'no')} className="btn-ghost text-xs">Non</button>
                <button onClick={() => rsvp(e.id, 'maybe')} className="btn-ghost text-xs">Peut-être</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Nouvel événement">
        <div className="space-y-3">
          <div><label className="label">Titre</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Lieu</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">Date</label><input type="datetime-local" className="input" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

function Compliance() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [letterEmpId, setLetterEmpId] = useState('');
  const [letterType, setLetterType] = useState<'attestation' | 'certificat'>('attestation');

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('status', 'active');
    setEmployees((data as Employee[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  // Real, data-driven compliance checklist — flags employees with missing
  // required information, computed live from the database (not a hardcoded claim).
  const issues = employees.flatMap((e) => {
    const missing: string[] = [];
    if (!e.email) missing.push('email');
    if (!e.phone) missing.push('téléphone');
    if (!e.position) missing.push('poste');
    if (!e.hire_date) missing.push("date d'embauche");
    if (!e.contract_type) missing.push('type de contrat');
    return missing.length > 0 ? [{ employee: e, missing }] : [];
  });

  function generateLetter() {
    if (!tenant || !letterEmpId) return;
    const emp = employees.find((e) => e.id === letterEmpId);
    if (!emp) return;
    const today = new Date().toLocaleDateString(localeTag, { year: 'numeric', month: 'long', day: 'numeric' });
    const hireDate = emp.hire_date ? new Date(emp.hire_date).toLocaleDateString(localeTag, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const title = letterType === 'attestation' ? "ATTESTATION DE TRAVAIL" : "CERTIFICAT DE TRAVAIL";
    const body = letterType === 'attestation'
      ? `Nous, soussignés <strong>${tenant.name}</strong>, certifions que <strong>${emp.first_name} ${emp.last_name}</strong> est employé(e) au sein de notre entreprise depuis le <strong>${hireDate}</strong>, en qualité de <strong>${emp.position || '—'}</strong>, sous contrat de type <strong>${emp.contract_type || '—'}</strong>.<br/><br/>Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`
      : `Nous, soussignés <strong>${tenant.name}</strong>, certifions que <strong>${emp.first_name} ${emp.last_name}</strong> a été employé(e) au sein de notre entreprise depuis le <strong>${hireDate}</strong>, en qualité de <strong>${emp.position || '—'}</strong>.<br/><br/>Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.`;

    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; padding: 60px; color: #1a1a1a; line-height: 1.7; }
        h1 { font-size: 20px; letter-spacing: 2px; text-align: center; margin-bottom: 50px; }
        .header { text-align: center; margin-bottom: 40px; font-weight: bold; font-size: 15px; }
        .date { text-align: right; margin-top: 60px; }
        .sign { margin-top: 80px; text-align: right; }
        @media print { body { padding: 40px; } }
      </style></head><body>
      <div class="header">${tenant.name}</div>
      <h1>${title}</h1>
      <p>${body}</p>
      <div class="date">Fait le ${today}</div>
      <div class="sign">La Direction<br/><br/><br/>______________________</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.compliance')} icon={<ShieldCheck size={20} />} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-2"><FileText size={18} className="text-coral-500" /> Lettres RH</div>
          <p className="text-slate-600 dark:text-white/60 text-sm mb-4">Générez une attestation ou un certificat de travail pour un employé — prêt à imprimer ou enregistrer en PDF.</p>
          <div className="space-y-2">
            <select className="input" value={letterType} onChange={(e) => setLetterType(e.target.value as any)}>
              <option value="attestation">Attestation de travail</option>
              <option value="certificat">Certificat de travail</option>
            </select>
            <select className="input" value={letterEmpId} onChange={(e) => setLetterEmpId(e.target.value)}>
              <option value="">— Choisir un employé —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <button className="btn-primary text-sm w-full justify-center" disabled={!letterEmpId} onClick={generateLetter}>
              Générer la lettre
            </button>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-2"><ShieldCheck size={18} className="text-coral-500" /> Contrôle de conformité des dossiers</div>
          <p className="text-slate-600 dark:text-white/60 text-sm mb-4">Vérification automatique des informations obligatoires manquantes dans vos dossiers employés.</p>
          {loading ? <Spinner /> : issues.length === 0 ? (
            <Badge color="emerald">Tous les dossiers sont complets</Badge>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {issues.map(({ employee, missing }) => (
                <div key={employee.id} className="flex items-start justify-between text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <span className="text-slate-800 dark:text-white/80">{employee.first_name} {employee.last_name}</span>
                  <span className="text-amber-700 dark:text-amber-300 text-xs text-right">{missing.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [name, setName] = useState(tenant?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!tenant) return;
    setSaving(true);
    await supabase.from('tenants').update({ name }).eq('id', tenant.id);
    setSaving(false);
  }
  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.settings')} icon={<SettingsIcon size={20} />} />
      <div className="card p-6 max-w-lg">
        <div><label className="label">{t('onboarding.company.name')}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div><label className="label">{t('onboarding.currency')}</label><input className="input opacity-70" value={tenant.currency} disabled /></div>
          <div><label className="label">{t('onboarding.country')}</label><input className="input opacity-70" value={tenant.country} disabled /></div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary text-sm mt-4">{saving ? <Spinner /> : t('common.save')}</button>
      </div>
    </div>
  );
}

// ============================================================
// Documents — HR uploads for employees (contracts, payslips, etc.)
// ============================================================
function Documents() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', name: '', type: 'contract' });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    if (!tenant) return;
    const [e, d] = await Promise.all([
      supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    setEmployees((e.data as Employee[]) ?? []);
    setDocs(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function upload() {
    if (!tenant || !file || !form.employee_id || !form.name) return;
    const path = `${tenant.id}/${form.employee_id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) { alert(`Le téléversement a échoué : ${upErr.message}`); return; }
    await supabase.from('documents').insert({
      tenant_id: tenant.id,
      employee_id: form.employee_id,
      name: form.name,
      type: form.type,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || 'application/pdf',
      uploaded_by: user?.id,
      uploaded_by_role: 'hr',
    });
    setModal(false);
    setForm({ employee_id: '', name: '', type: 'contract' });
    setFile(null);
    load();
  }

  async function remove(id: string, path: string) {
    await supabase.storage.from('documents').remove([path]);
    await supabase.from('documents').delete().eq('id', id);
    load();
  }

  if (!tenant) return null;
  const empName = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.first_name} ${e.last_name}` : '—'; };

  return (
    <div>
      <PageHeader title="Documents" icon={<FileText size={20} />}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Téléverser</button>} />
      {loading ? <Spinner /> : docs.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="Aucun document" hint="Téléversez un contrat, bulletin, attestation..." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Nom</th>
                <th className="text-left p-4">Employé</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Ajouté par</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="p-4 text-slate-900 dark:text-white font-medium">{d.name}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{empName(d.employee_id)}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70 capitalize">{d.type}</td>
                  <td className="p-4"><Badge color={d.uploaded_by_role === 'hr' ? 'coral' : 'indigo'}>{d.uploaded_by_role}</Badge></td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="p-4 flex gap-2">
                    <button onClick={async () => { const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60); if (data) window.open(data.signedUrl, '_blank'); }} className="text-coral-600 hover:text-coral-500 text-xs">Voir</button>
                    <button onClick={() => remove(d.id, d.storage_path)} className="text-rose-500 hover:text-rose-400 text-xs">Suppr.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Téléverser un document">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="" className="bg-white dark:bg-ink-700">—</option>
              {employees.map((e) => <option key={e.id} value={e.id} className="bg-white dark:bg-ink-700">{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div><label className="label">Nom du document</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contrat CDI 2026" /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="contract" className="bg-white dark:bg-ink-700">Contrat</option>
              <option value="payslip" className="bg-white dark:bg-ink-700">Bulletin de paie</option>
              <option value="attestation" className="bg-white dark:bg-ink-700">Attestation</option>
              <option value="id" className="bg-white dark:bg-ink-700">Pièce d'identité</option>
              <option value="diploma" className="bg-white dark:bg-ink-700">Diplôme</option>
              <option value="other" className="bg-white dark:bg-ink-700">Autre</option>
            </select>
          </div>
          <div><label className="label">Fichier (PDF)</label><input type="file" accept=".pdf,image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={upload} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Overtime
// ============================================================
function Overtime() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: new Date().toISOString().slice(0, 10), hours: 1, rate: 1.5, notes: '' });

  async function load() {
    if (!tenant) return;
    const [e, o] = await Promise.all([
      supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('status', 'active'),
      supabase.from('overtime').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    setEmployees((e.data as Employee[]) ?? []);
    setItems(o.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  // Real-time
  useEffect(() => {
    if (!tenant) return;
    const ch = supabase.channel(`overtime:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overtime', filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant]);

  async function add() {
    if (!tenant || !form.employee_id) return;
    const emp = employees.find((x) => x.id === form.employee_id);
    const amount = Number(form.hours) * Number(form.rate) * (emp?.salary ?? 0) / 173.33;
    await supabase.from('overtime').insert({
      tenant_id: tenant.id, employee_id: form.employee_id, date: form.date,
      hours: Number(form.hours), rate: Number(form.rate), amount,
      currency: tenant.currency, status: 'pending', notes: form.notes,
    });
    // Notify HR
    const { notifyHR } = await import('../../lib/notifications');
    await notifyHR(tenant.id, { category: 'attendance', title: 'Demande d\'heures sup.', body: `${emp?.first_name} ${emp?.last_name} a soumis ${form.hours}h sup.`, priority: 'normal' });
    setModal(false);
    setForm({ employee_id: '', date: new Date().toISOString().slice(0, 10), hours: 1, rate: 1.5, notes: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('overtime').update({ status }).eq('id', id);
    // Notify employee
    const item = items.find((it) => it.id === id);
    const emp = item ? employees.find((e) => e.id === item.employee_id) : null;
    if (emp?.user_id && tenant) {
      await notify({ tenantId: tenant.id, userId: emp.user_id, employeeId: emp.id, category: 'attendance', title: status === 'approved' ? 'Heures sup. approuvées' : 'Heures sup. refusées', body: `Votre demande de ${item?.hours}h a été ${status === 'approved' ? 'approuvée' : 'refusée'}.`, priority: status === 'approved' ? 'normal' : 'high' });
    }
    load();
  }

  if (!tenant) return null;
  const empName = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.first_name} ${e.last_name}` : '—'; };
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));

  return (
    <div>
      <PageHeader title="Heures supplémentaires" icon={<Clock size={20} />}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> {t('common.add')}</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="Aucune heure supplémentaire" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Employé</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Heures</th>
                <th className="text-left p-4">Taux</th>
                <th className="text-left p-4">Montant</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="p-4 text-slate-900 dark:text-white font-medium">{empName(o.employee_id)}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{o.date}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{o.hours}h</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">x{o.rate}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{fmt(o.amount)} {o.currency}</td>
                  <td className="p-4"><Badge color={o.status === 'paid' ? 'indigo' : o.status === 'approved' ? 'emerald' : o.status === 'rejected' ? 'rose' : 'amber'}>{o.status === 'paid' ? 'payé' : o.status}</Badge></td>
                  <td className="p-4 flex gap-2">
                    {o.status === 'pending' && <>
                      <button onClick={() => setStatus(o.id, 'approved')} className="text-emerald-600 hover:text-emerald-500 text-xs">Approuver</button>
                      <button onClick={() => setStatus(o.id, 'rejected')} className="text-rose-500 hover:text-rose-400 text-xs">Refuser</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle heure supplémentaire">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="" className="bg-white dark:bg-ink-700">—</option>
              {employees.map((e) => <option key={e.id} value={e.id} className="bg-white dark:bg-ink-700">{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="label">Heures</label><input type="number" step="0.5" className="input" value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></div>
            <div><label className="label">Taux</label><input type="number" step="0.5" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Main admin dashboard router
// ============================================================
export default function AdminDashboard() {
  const route = useRoute();
  const { activeTenant, user } = useAuth();

  // Redirect logic
  useEffect(() => {
    if (!user) navigate('/signin');
  }, [user]);

  if (!user) return null;
  if (!activeTenant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-slate-900 dark:text-white font-display text-xl font-bold mb-2">Aucun espace configuré</h2>
          <p className="text-slate-600 dark:text-white/60 text-sm mb-5">Complétez l'onboarding pour créer votre espace Faka.</p>
          <button onClick={() => navigate('/onboarding')} className="btn-primary">Configurer mon espace</button>
        </div>
      </div>
    );
  }

  // Determine module from route
  const module = route.split('/dashboard/admin/')[1]?.split('?')[0] ?? 'dashboard';

  let content: ReactNode;
  switch (module) {
    case 'dashboard': content = <Overview />; break;
    case 'employees': content = <Employees />; break;
    case 'payroll': content = <Payroll />; break;
    case 'leaves': content = <RequestList table="leave_requests" title="Congés" icon={<CalendarClock size={20} />} />; break;
    case 'advances': content = <RequestList table="advances" title="Avances sur salaire" icon={<BanknoteIcon size={20} />} amountKey="amount" />; break;
    case 'claims': content = <RequestList table="claims" title="Notes de frais" icon={<Receipt size={20} />} amountKey="amount" />; break;
    case 'attendance': content = <Attendance />; break;
    case 'recruitment': content = <Recruitment />; break;
    case 'training': content = <SimpleList table="trainings" title="Formation / LMS" icon={<GraduationCap size={20} />} fields={[{ key: 'title', label: 'Titre', required: true }, { key: 'employee_id', label: 'Employé', type: 'employee_select' }, { key: 'progress', label: 'Progression %', type: 'number' }]} extraInsert={() => ({ status: 'assigned' })} />; break;
    case 'goals': content = <SimpleList table="goals" title="Objectifs OKR" icon={<Target size={20} />} fields={[{ key: 'title', label: 'Titre', required: true }, { key: 'employee_id', label: 'Employé', type: 'employee_select', required: true }, { key: 'progress', label: 'Progression %', type: 'number' }]} extraInsert={() => ({ status: 'active' })} />; break;
    case 'performance': content = <Performance />; break;
    case 'reviews': content = <SimpleList table="reviews" title="Évaluations 360°" icon={<Star size={20} />} fields={[{ key: 'employee_id', label: 'Employé', type: 'employee_select', required: true }, { key: 'period', label: 'Période' }, { key: 'rating', label: 'Note /5', type: 'number' }]} extraInsert={() => ({ status: 'draft' })} />; break;
    case 'assets': content = <SimpleList table="assets" title="Actifs" icon={<Package size={20} />} fields={[{ key: 'name', label: 'Nom', required: true }, { key: 'category', label: 'Catégorie' }, { key: 'serial', label: 'Série' }, { key: 'assigned_to', label: 'Assigné à', type: 'employee_select' }]} extraInsert={() => ({ status: 'available' })} />; break;
    case 'compliance': content = <Compliance />; break;
    case 'communication': content = <CommunicationsPanel />; break;
    case 'events': content = <Events />; break;
    case 'documents': content = <Documents />; break;
    case 'overtime': content = <Overtime />; break;
    case 'subscription': content = <SubscriptionEmbed />; break;
    case 'settings': content = <Settings />; break;
    case 'settings/branches': content = <BranchManager />; break;
    case 'settings/departments': content = <DepartmentManager />; break;
    case 'settings/leave-balances': content = <LeaveBalanceManager />; break;
    case 'settings/roles': content = <RoleManager />; break;
    default: content = <Overview />;
  }

  return <DashboardShell role="admin">{content}</DashboardShell>;
}

import Subscription from '../Subscription';
function SubscriptionEmbed() {
  return <Subscription />;
}
