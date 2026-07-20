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
  Target, Star, Package, ShieldCheck, MessageSquare, CalendarDays, Settings as SettingsIcon,
  Plus, Trash2, Check, X, Download, Upload, FileText, TrendingUp,
} from 'lucide-react';

type Employee = {
  id: string; first_name: string; last_name: string; email: string; phone: string;
  position: string; department: string; salary: number; currency: string;
  contract_type: string; status: string; hire_date: string | null;
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
  const { t } = useI18n();
  const tenant = useTenant();
  const [stats, setStats] = useState({ employees: 0, leaves: 0, payroll: 0, advances: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [e, l, p, a] = await Promise.all([
        supabase.from('employees').select('id, salary, currency').eq('tenant_id', tenant.id).eq('status', 'active'),
        supabase.from('leave_requests').select('id').eq('tenant_id', tenant.id).eq('status', 'pending'),
        supabase.from('payslips').select('net, currency').eq('tenant_id', tenant.id).eq('status', 'paid'),
        supabase.from('advances').select('amount').eq('tenant_id', tenant.id).eq('status', 'pending'),
      ]);
      const totalPayroll = ((p.data ?? []) as { net: number }[]).reduce((s, x) => s + Number(x.net), 0);
      const totalAdvances = ((a.data ?? []) as { amount: number }[]).reduce((s, x) => s + Number(x.amount), 0);
      setStats({
        employees: (e.data ?? []).length,
        leaves: (l.data ?? []).length,
        payroll: totalPayroll,
        advances: totalAdvances,
      });
      setLoading(false);
    })();
  }, [tenant]);

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

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
            <div className="flex items-end gap-3 h-48">
              {[42, 55, 48, 70, 62, 85].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full rounded-t bg-gradient-to-t from-coral-500 to-coral-400" style={{ height: `${h}%` }} />
                  <div className="text-xs text-slate-400 dark:text-white/40">M{i + 1}</div>
                </div>
              ))}
            </div>
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
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [offboarding, setOffboarding] = useState<Employee | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', position: '', department: '', salary: 0, contract_type: 'cdi',
  });

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setItems((data as Employee[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function add() {
    if (!tenant) return;
    const { data } = await supabase.from('employees').insert({ ...form, tenant_id: tenant.id, currency: tenant.currency, status: 'active', hire_date: new Date().toISOString().slice(0, 10) }).select().single();
    setModal(false);
    setForm({ first_name: '', last_name: '', email: '', phone: '', position: '', department: '', salary: 0, contract_type: 'cdi' });
    load();
    // Auto-invite after creating the employee record
    if (data && form.email) {
      inviteEmployee(data.id, form.email);
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
        body: JSON.stringify({ action: 'create', tenant_id: tenant.id, employee_id: employeeId, email, role: 'employee' }),
      });
      const json = await res.json();
      if (json.ok) {
        const url = `${window.location.origin}/accept-invite?token=${json.token}`;
        setInviteLink(url);
      }
    } catch { /* ignore */ }
    setInviting(false);
  }

  async function offboard(reason: string, notes: string) {
    if (!offboarding || !tenant) return;
    await supabase.from('employees').update({
      status: 'exited', exit_date: new Date().toISOString().slice(0, 10), exit_reason: reason, exit_notes: notes,
    }).eq('id', offboarding.id);
    await supabase.from('audit_logs').insert({ tenant_id: tenant.id, action: 'employee.offboarded', details: { employee_id: offboarding.id, reason } });
    setOffboarding(null);
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.employees')} icon={<Users size={20} />}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> {t('common.add')}</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Aucun employé" hint="Ajoutez votre premier employé — il recevra une invitation par email." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4 font-medium">Nom</th>
                <th className="text-left p-4 font-medium">Poste</th>
                <th className="text-left p-4 font-medium">Dépt.</th>
                <th className="text-left p-4 font-medium">Salaire</th>
                <th className="text-left p-4 font-medium">Statut</th>
                <th className="text-left p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="text-slate-900 dark:text-white font-medium">{e.first_name} {e.last_name}</div>
                    <div className="text-slate-400 dark:text-white/40 text-xs">{e.email}</div>
                  </td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{e.position || '—'}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{e.department || '—'}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{new Intl.NumberFormat('fr-FR').format(e.salary)} {e.currency}</td>
                  <td className="p-4">
                    <Badge color={e.status === 'active' ? 'emerald' : 'rose'}>{e.status}</Badge>
                  </td>
                  <td className="p-4 flex gap-2">
                    {e.status === 'active' && e.email && (
                      <button onClick={() => inviteEmployee(e.id, e.email)} disabled={inviting} className="text-coral-600 hover:text-coral-500 text-xs font-medium">
                        Inviter
                      </button>
                    )}
                    {e.status === 'active' && (
                      <button onClick={() => setOffboarding(e)} className="text-rose-500 hover:text-rose-400 text-xs">Offboarder</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvel employé">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Prénom</label><input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><label className="label">Nom</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Poste</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Département</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><label className="label">Salaire ({tenant.currency})</label><input type="number" className="input" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></div>
          <div><label className="label">Contrat</label>
            <select className="input" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
              <option value="cdi" className="bg-white dark:bg-ink-700">CDI</option>
              <option value="cdd" className="bg-white dark:bg-ink-700">CDD</option>
              <option value="stage" className="bg-white dark:bg-ink-700">Stage</option>
              <option value="freelance" className="bg-white dark:bg-ink-700">Freelance</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={add} className="btn-primary text-sm">{t('common.save')}</button>
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
function RequestList({ table, title, icon, amountKey }: {
  table: 'leave_requests' | 'advances' | 'claims';
  title: string;
  icon: ReactNode;
  amountKey?: 'amount';
}) {
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [r, emps] = await Promise.all([
      supabase.from(table).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', tenant.id),
    ]);
    setItems(r.data ?? []);
    const map: Record<string, Employee> = {};
    (emps.data ?? []).forEach((e: any) => { map[e.id] = e; });
    setEmployees(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function add() {
    if (!tenant) return;
    await supabase.from(table).insert({ ...form, tenant_id: tenant.id, currency: tenant.currency, status: 'pending' });
    setModal(false);
    setForm({});
    load();
  }
  async function update(id: string, status: string) {
    await supabase.from(table).update({ status }).eq('id', id);
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
                  </>}
                  {amountKey && <td className="p-4 text-slate-700 dark:text-white/70">{new Intl.NumberFormat('fr-FR').format(it[amountKey])} {tenant.currency}</td>}
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
                <div><label className="label">Début</label><input type="date" className="input" onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="label">Fin</label><input type="date" className="input" onChange={(e) => setForm({ ...form, end_date: e.target.value, days: 1 })} /></div>
              </div>
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
  const { t } = useI18n();
  const tenant = useTenant();
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const [r, e] = await Promise.all([
      supabase.from('payroll_runs').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('employees').select('*').eq('tenant_id', tenant.id).eq('status', 'active'),
    ]);
    setRuns(r.data ?? []);
    setEmployees((e.data as Employee[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function runPayroll() {
    if (!tenant || employees.length === 0) return;
    setRunning(true);
    const period = new Date().toISOString().slice(0, 7);
    const gross = employees.reduce((s, e) => s + Number(e.salary), 0);
    const deductions = gross * 0.15;
    const net = gross - deductions;
    const { data: run } = await supabase.from('payroll_runs').insert({
      tenant_id: tenant.id, period, status: 'draft', total_gross: gross, total_net: net, currency: tenant.currency,
    }).select().single();
    if (run) {
      const payslips = employees.map((e) => ({
        tenant_id: tenant.id, run_id: run.id, employee_id: e.id,
        gross: Number(e.salary), deductions: Number(e.salary) * 0.15, net: Number(e.salary) * 0.85,
        currency: tenant.currency, status: 'pending',
      }));
      await supabase.from('payslips').insert(payslips);
    }
    setRunning(false);
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

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  return (
    <div>
      <PageHeader title={t('dash.payroll')} icon={<Wallet size={20} />}
        action={
          <div className="flex gap-2">
            <button onClick={payAll} className="btn-ghost text-sm">Marquer tout payé</button>
            <button onClick={runPayroll} disabled={running || employees.length === 0} className="btn-primary text-sm">
              {running ? <Spinner /> : <><Plus size={16} /> Lancer la paie</>}
            </button>
          </div>
        } />
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
                <Badge color={r.status === 'draft' ? 'slate' : 'emerald'}>{r.status}</Badge>
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
  const [form, setForm] = useState({ title: '', department: '', location: '', description: '' });

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

  async function moveCandidate(id: string, stage: string) {
    await supabase.from('recruitment_candidates').update({ stage }).eq('id', id);
    load();
  }

  const stages = ['applied', 'screening', 'interview', 'offer', 'hired'];

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.recruitment')} icon={<UserPlus size={20} />}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Offre</button>} />
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
    </div>
  );
}

// ============================================================
// Training, Goals, Reviews, Assets, Compliance, Communication, Events
// ============================================================
function SimpleList({ table, title, icon, fields, extraInsert }: {
  table: string; title: string; icon: ReactNode; fields: { key: string; label: string; type?: string }[];
  extraInsert?: (form: any) => Record<string, any>;
}) {
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});

  async function load() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from(table).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant]);

  async function add() {
    if (!tenant) return;
    const payload = { ...form, tenant_id: tenant.id, ...(extraInsert ? extraInsert(form) : {}) };
    await supabase.from(table).insert(payload);
    setModal(false);
    setForm({});
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={title} icon={icon}
        action={<button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> {t('common.add')}</button>} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={icon} title="Rien pour le moment" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="card p-5">
              {fields.map((f) => (
                <div key={f.key} className="mb-1">
                  {f.key === fields[0].key && <div className="text-slate-900 dark:text-white font-semibold">{it[f.key]}</div>}
                  {f.key !== fields[0].key && <div className="text-slate-500 dark:text-white/50 text-xs">{f.label}: {String(it[f.key] ?? '—')}</div>}
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
              <input
                type={f.type ?? 'text'}
                className="input"
                value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
              />
            </div>
          ))}
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
    if (!tenant) return;
    const { data } = await supabase.from('events').select('rsvp').eq('id', id).single();
    const rsvp = { ...(data?.rsvp ?? {}), [tenant.id]: status };
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

function Communication() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [text, setText] = useState('');

  async function load() {
    if (!tenant) return;
    const { data } = await supabase.from('audit_logs').select('*').eq('tenant_id', tenant.id).eq('action', 'announcement').order('created_at', { ascending: false });
    setAnnouncements((data ?? []).map((a) => ({ id: a.id, text: a.details?.text, created_at: a.created_at })));
  }
  useEffect(() => { load(); }, [tenant]);

  async function post() {
    if (!tenant || !text.trim()) return;
    await supabase.from('audit_logs').insert({ tenant_id: tenant.id, action: 'announcement', details: { text } });
    setText('');
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.communication')} icon={<MessageSquare size={20} />} />
      <div className="card p-5 mb-4">
        <textarea className="input" rows={3} placeholder="Annonce à toute l'entreprise..." value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end mt-3"><button onClick={post} className="btn-primary text-sm">Publier</button></div>
      </div>
      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="text-slate-700 dark:text-white/70 text-sm">{a.text}</div>
            <div className="text-slate-400 dark:text-white/40 text-xs mt-2">{new Date(a.created_at).toLocaleString()}</div>
          </div>
        ))}
        {announcements.length === 0 && <div className="text-slate-400 dark:text-white/40 text-sm">Aucune annonce.</div>}
      </div>
    </div>
  );
}

function Compliance() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('dash.compliance')} icon={<ShieldCheck size={20} />} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-2"><FileText size={18} className="text-coral-500" /> Lettres RH</div>
          <p className="text-slate-600 dark:text-white/60 text-sm mb-4">Générez des lettres (attestation d'emploi, certificat de travail, etc.) en FR/EN.</p>
          <button className="btn-ghost text-sm" onClick={() => alert('Modèle de lettre généré (démo).')}>Générer une lettre</button>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-2"><ShieldCheck size={18} className="text-coral-500" /> AI Compliance Monitor</div>
          <p className="text-slate-600 dark:text-white/60 text-sm mb-4">Surveille automatiquement les changements réglementaires (RGPD, code du travail).</p>
          <Badge color="emerald">Actif</Badge>
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
    if (upErr) { alert('Upload failed'); return; }
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
  const { t } = useI18n();
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

  async function add() {
    if (!tenant || !form.employee_id) return;
    const emp = employees.find((x) => x.id === form.employee_id);
    const amount = Number(form.hours) * Number(form.rate) * (emp?.salary ?? 0) / 173.33; // hourly rate from monthly
    await supabase.from('overtime').insert({
      tenant_id: tenant.id,
      employee_id: form.employee_id,
      date: form.date,
      hours: Number(form.hours),
      rate: Number(form.rate),
      amount,
      currency: tenant.currency,
      status: 'pending',
      notes: form.notes,
    });
    setModal(false);
    setForm({ employee_id: '', date: new Date().toISOString().slice(0, 10), hours: 1, rate: 1.5, notes: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('overtime').update({ status }).eq('id', id);
    load();
  }

  if (!tenant) return null;
  const empName = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.first_name} ${e.last_name}` : '—'; };
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

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
                  <td className="p-4"><Badge color={o.status === 'approved' ? 'emerald' : o.status === 'rejected' ? 'rose' : 'amber'}>{o.status}</Badge></td>
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
  const { activeTenant, activeRole, user } = useAuth();

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
    case 'training': content = <SimpleList table="trainings" title="Formation / LMS" icon={<GraduationCap size={20} />} fields={[{ key: 'title', label: 'Titre' }, { key: 'progress', label: 'Progression %', type: 'number' }]} extraInsert={() => ({ status: 'assigned' })} />; break;
    case 'goals': content = <SimpleList table="goals" title="Objectifs OKR" icon={<Target size={20} />} fields={[{ key: 'title', label: 'Titre' }, { key: 'progress', label: 'Progression %', type: 'number' }]} extraInsert={() => ({ status: 'active' })} />; break;
    case 'reviews': content = <SimpleList table="reviews" title="Évaluations 360°" icon={<Star size={20} />} fields={[{ key: 'period', label: 'Période' }, { key: 'rating', label: 'Note /5', type: 'number' }]} extraInsert={() => ({ status: 'draft' })} />; break;
    case 'assets': content = <SimpleList table="assets" title="Actifs" icon={<Package size={20} />} fields={[{ key: 'name', label: 'Nom' }, { key: 'category', label: 'Catégorie' }, { key: 'serial', label: 'Série' }]} extraInsert={() => ({ status: 'available' })} />; break;
    case 'compliance': content = <Compliance />; break;
    case 'communication': content = <Communication />; break;
    case 'events': content = <Events />; break;
    case 'documents': content = <Documents />; break;
    case 'overtime': content = <Overtime />; break;
    case 'subscription': content = <SubscriptionEmbed />; break;
    case 'settings': content = <Settings />; break;
    default: content = <Overview />;
  }

  return <DashboardShell role="admin">{content}</DashboardShell>;
}

import Subscription from '../Subscription';
function SubscriptionEmbed() {
  return <Subscription />;
}
