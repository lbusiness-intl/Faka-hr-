import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardShell } from '../DashboardShell';
import { Badge, Spinner, EmptyState, Modal, StatCard } from '../ui';
import { useRoute, navigate } from '../../lib/router';
import {
  Clock, CalendarClock, Banknote, Receipt, CalendarDays, MessageSquare,
  CreditCard, Play, Pause, Square, Camera, Send, TrendingUp, Target,
  FileText, Package, Plus, Check, X, Wallet, Users, Sparkles, Bell,
} from 'lucide-react';

type Employee = {
  id: string; first_name: string; last_name: string; email: string;
  position: string; department: string; salary: number; currency: string;
  contract_type: string; status: string; hire_date: string | null;
};

function useTenant() {
  const { activeTenant } = useAuth();
  return activeTenant;
}

function PageHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">{icon}</div>
      <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
    </div>
  );
}

function useMe(tenantId: string | undefined, email: string | undefined) {
  const [me, setMe] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tenantId || !email) return;
    supabase.from('employees').select('*').eq('tenant_id', tenantId).eq('email', email).maybeSingle().then(({ data }) => {
      setMe((data as Employee) ?? null);
      setLoading(false);
    });
  }, [tenantId, email]);
  return { me, loading };
}

// ============================================================
// Staff Dashboard — Bayzat-style personal overview
// ============================================================
function Overview() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me, loading } = useMe(tenant?.id, user?.email);
  const [stats, setStats] = useState({ leaves: 0, leaveBalance: 18, advances: 0, claims: 0, goals: 0, pending: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant || !me) return;
    (async () => {
      const [l, a, c, g, allL] = await Promise.all([
        supabase.from('leave_requests').select('id, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('advances').select('amount, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('claims').select('amount, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('goals').select('id, title, progress, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('leave_requests').select('id, type, start_date, end_date, status, created_at').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false }).limit(5),
      ]);
      const leaves = (l.data ?? []) as any[];
      const advances = (a.data ?? []) as any[];
      const claims = (c.data ?? []) as any[];
      const goals = (g.data ?? []) as any[];
      const pendingCount = [...leaves, ...advances, ...claims].filter((x) => x.status === 'pending').length;
      setStats({
        leaves: leaves.length,
        leaveBalance: 18 - leaves.filter((x) => x.status === 'approved').reduce((s, _x) => s + 1, 0),
        advances: advances.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount), 0),
        claims: claims.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount), 0),
        goals: goals.length,
        pending: pendingCount,
      });
      setRecent(allL.data ?? []);
    })();
  }, [tenant, me]);

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  const quickActions = [
    { label: t('emp.leaves'), icon: CalendarClock, color: 'coral', to: 'leaves' },
    { label: t('emp.advances'), icon: Banknote, color: 'emerald', to: 'advances' },
    { label: t('emp.claims'), icon: Receipt, color: 'indigo', to: 'claims' },
    { label: t('dash.attendance'), icon: Clock, color: 'teal', to: 'attendance' },
  ] as const;

  return (
    <div>
      <PageHeader title={t('emp.my_space')} icon={<TrendingUp size={20} />} />
      {loading ? <Spinner /> : (
        <>
          {/* Personal hero card */}
          <div className="card p-6 mb-6 bg-gradient-to-br from-coral-50 to-sage-50 dark:from-ink-800 dark:to-ink-700 border-coral-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-coral-500 flex items-center justify-center text-white font-bold text-2xl">
                {(me?.first_name ?? user?.email ?? 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-slate-900 dark:text-white font-display text-xl font-bold">
                  {me ? `${me.first_name} ${me.last_name}` : user?.email}
                </div>
                <div className="text-slate-500 dark:text-white/50 text-sm">{me?.position ?? '—'} · {me?.department ?? '—'}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge color="emerald">{me?.contract_type?.toUpperCase() ?? 'CDI'}</Badge>
                  <span className="text-xs text-slate-400">Depuis {me?.hire_date ?? '—'}</span>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs text-slate-400">Salaire brut</div>
                <div className="text-slate-900 dark:text-white font-bold">{fmt(me?.salary ?? 0)} {me?.currency ?? tenant.currency}</div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {quickActions.map((qa) => (
              <button
                key={qa.to}
                onClick={() => navigate(`/dashboard/employee/${qa.to}`)}
                className="card p-4 flex items-center gap-3 hover:border-coral-300 transition group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  qa.color === 'coral' ? 'bg-coral-100 text-coral-600' :
                  qa.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                  qa.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                  'bg-teal-100 text-teal-600'
                }`}>
                  <qa.icon size={18} />
                </div>
                <span className="text-slate-900 dark:text-white font-medium text-sm">{qa.label}</span>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Solde de congés" value={`${stats.leaveBalance} j`} sub="restant cette année" icon={<CalendarClock size={18} />} color="coral" />
            <StatCard label={t('emp.advances')} value={`${fmt(stats.advances)} ${tenant.currency}`} sub="en attente" icon={<Banknote size={18} />} color="amber" />
            <StatCard label={t('emp.claims')} value={`${fmt(stats.claims)} ${tenant.currency}`} sub="en attente" icon={<Receipt size={18} />} color="indigo" />
            <StatCard label="Demandes en attente" value={String(stats.pending)} icon={<Bell size={18} />} color="teal" />
          </div>

          {/* Recent activity */}
          <div className="card p-5">
            <h3 className="text-slate-900 dark:text-white font-semibold mb-4">Activité récente</h3>
            {recent.length === 0 ? (
              <EmptyState icon={<CalendarClock size={36} />} title="Aucune activité" />
            ) : (
              <div className="space-y-2">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                    <div>
                      <div className="text-slate-900 dark:text-white text-sm font-medium capitalize">{r.type} — {r.start_date} → {r.end_date}</div>
                      <div className="text-slate-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <Badge color={r.status === 'approved' ? 'emerald' : r.status === 'rejected' ? 'rose' : 'amber'}>{r.status}</Badge>
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
// Attendance — check in / break / out with selfie
// ============================================================
function Attendance() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [today, setToday] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfie, setSelfie] = useState<string | null>(null);

  async function load() {
    if (!tenant || !me) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [todayRes, allRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).gte('created_at', start.toISOString()).order('created_at', { ascending: false }).limit(1),
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false }).limit(10),
    ]);
    setToday(todayRes.data?.[0] ?? null);
    setLogs(allRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function action(type: 'in' | 'break' | 'resume' | 'out') {
    if (!tenant || !me) return;
    const now = new Date().toISOString();
    if (!today) {
      const { data } = await supabase.from('attendance').insert({ tenant_id: tenant.id, employee_id: me.id, check_in: now, selfie_url: selfie }).select().single();
      setToday(data);
    } else {
      const patch: any = {};
      if (type === 'break') patch.break_start = now;
      if (type === 'resume') patch.break_end = now;
      if (type === 'out') patch.check_out = now;
      await supabase.from('attendance').update(patch).eq('id', today.id);
      setToday({ ...today, ...patch });
    }
    setSelfie(null);
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.attendance')} icon={<Clock size={20} />} />
      {loading ? <Spinner /> : (
        <>
          <div className="card p-6 mb-6">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => action('in')} disabled={!!today?.check_in} className="btn-primary text-sm disabled:opacity-40"><Play size={16} /> {t('emp.checkin')}</button>
              <button onClick={() => action('break')} disabled={!today?.check_in || !!today?.break_start} className="btn-ghost text-sm disabled:opacity-40"><Pause size={16} /> {t('emp.break')}</button>
              <button onClick={() => action('resume')} disabled={!today?.break_start || !!today?.break_end} className="btn-ghost text-sm disabled:opacity-40"><Play size={16} /> Reprendre</button>
              <button onClick={() => action('out')} disabled={!today?.check_in || !!today?.check_out} className="btn-ghost text-sm disabled:opacity-40"><Square size={16} /> {t('emp.checkout')}</button>
              <label className="btn-ghost text-sm cursor-pointer">
                <Camera size={16} /> Selfie
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setSelfie(reader.result as string);
                  reader.readAsDataURL(f);
                }} />
              </label>
            </div>
            {selfie && <img src={selfie} alt="selfie" className="mt-4 w-24 h-24 rounded-xl object-cover" />}
            {today && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-slate-400 text-xs">Entrée</div><div className="text-slate-900 dark:text-white">{today.check_in ? new Date(today.check_in).toLocaleTimeString() : '—'}</div></div>
                <div><div className="text-slate-400 text-xs">Pause</div><div className="text-slate-900 dark:text-white">{today.break_start ? new Date(today.break_start).toLocaleTimeString() : '—'}</div></div>
                <div><div className="text-slate-400 text-xs">Reprise</div><div className="text-slate-900 dark:text-white">{today.break_end ? new Date(today.break_end).toLocaleTimeString() : '—'}</div></div>
                <div><div className="text-slate-400 text-xs">Sortie</div><div className="text-slate-900 dark:text-white">{today.check_out ? new Date(today.check_out).toLocaleTimeString() : '—'}</div></div>
              </div>
            )}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                <tr><th className="text-left p-4">Date</th><th className="text-left p-4">Entrée</th><th className="text-left p-4">Sortie</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="p-4 text-slate-700 dark:text-white/70">{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 text-xs">{l.check_in ? new Date(l.check_in).toLocaleTimeString() : '—'}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 text-xs">{l.check_out ? new Date(l.check_out).toLocaleTimeString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Generic staff request page (leaves / advances / claims)
// with category-aware form and status tracking.
// ============================================================
function StaffRequests({ table, title, icon, amountKey, categories }: {
  table: 'leave_requests' | 'advances' | 'claims';
  title: string; icon: ReactNode; amountKey?: 'amount';
  categories?: { value: string; label: string }[];
}) {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});

  async function load() {
    if (!tenant || !me) return;
    setLoading(true);
    const { data } = await supabase.from(table).select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function submit() {
    if (!tenant || !me) return;
    const payload: any = { ...form, tenant_id: tenant.id, employee_id: me.id, currency: tenant.currency, status: 'pending' };
    if (table === 'leave_requests') {
      payload.days = 1;
    }
    await supabase.from(table).insert(payload);
    setModal(false);
    setForm({});
    load();
  }

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  return (
    <div>
      <PageHeader title={title} icon={icon} />
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Nouvelle demande</button>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={icon} title="Aucune demande" hint="Soumettez votre première demande." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                {table === 'leave_requests' && <><th className="text-left p-4">Type</th><th className="text-left p-4">Période</th><th className="text-left p-4">Jours</th></>}
                {amountKey && <><th className="text-left p-4">Catégorie</th><th className="text-left p-4">Montant</th></>}
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4">Soumis le</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-white/5">
                  {table === 'leave_requests' && <><td className="p-4 text-slate-700 dark:text-white/70 capitalize">{it.type}</td><td className="p-4 text-slate-700 dark:text-white/70 text-xs">{it.start_date} → {it.end_date}</td><td className="p-4 text-slate-700 dark:text-white/70">{it.days}</td></>}
                  {amountKey && <><td className="p-4 text-slate-700 dark:text-white/70">{it.category ?? it.reason ?? '—'}</td><td className="p-4 text-slate-700 dark:text-white/70">{fmt(it[amountKey])} {tenant.currency}</td></>}
                  <td className="p-4"><Badge color={it.status === 'approved' ? 'emerald' : it.status === 'rejected' ? 'rose' : 'amber'}>{it.status}</Badge></td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(it.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={`Nouvelle demande — ${title}`}>
        <div className="space-y-3">
          {table === 'leave_requests' && (
            <>
              <div>
                <label className="label">Type de congé</label>
                <select className="input" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="annual" className="bg-white dark:bg-ink-700">Congé annuel</option>
                  <option value="sick" className="bg-white dark:bg-ink-700">Maladie</option>
                  <option value="unpaid" className="bg-white dark:bg-ink-700">Sans solde</option>
                  <option value="maternity" className="bg-white dark:bg-ink-700">Maternité</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Début</label><input type="date" className="input" onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="label">Fin</label><input type="date" className="input" onChange={(e) => setForm({ ...form, end_date: e.target.value, days: 1 })} /></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input" rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </>
          )}
          {table === 'advances' && (
            <>
              <div><label className="label">Montant ({tenant.currency})</label><input type="number" className="input" onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><label className="label">Raison</label><textarea className="input" rows={2} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </>
          )}
          {table === 'claims' && (
            <>
              <div>
                <label className="label">Catégorie</label>
                <select className="input" onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {(categories ?? []).map((c) => <option key={c.value} value={c.value} className="bg-white dark:bg-ink-700">{c.label}</option>)}
                </select>
              </div>
              <div><label className="label">Montant ({tenant.currency})</label><input type="number" className="input" onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={2} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={submit} className="btn-primary text-sm">{t('common.submit')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Assets request (Staff can request equipment)
// ============================================================
function StaffAssets() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [req, setReq] = useState({ name: '', category: '', reason: '' });

  async function load() {
    if (!tenant || !me) return;
    const { data } = await supabase.from('assets').select('*').eq('tenant_id', tenant.id).or(`assigned_to.eq.${me.id},status.eq.available`).order('created_at', { ascending: false });
    setAssets(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function requestAsset() {
    if (!tenant || !me) return;
    // Create an asset request as an audit log entry (staff request category)
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id, action: 'staff.asset_request', details: { employee_id: me.id, ...req },
    });
    setModal(false);
    setReq({ name: '', category: '', reason: '' });
    load();
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.assets')} icon={<Package size={20} />} />
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Demander du matériel</button>
      </div>
      {loading ? <Spinner /> : assets.length === 0 ? (
        <EmptyState icon={<Package size={48} />} title="Aucun matériel" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 dark:text-white font-semibold">{a.name}</h3>
                <Badge color={a.assigned_to === me?.id ? 'coral' : a.status === 'available' ? 'emerald' : 'slate'}>
                  {a.assigned_to === me?.id ? 'Assigné à moi' : a.status}
                </Badge>
              </div>
              <div className="text-slate-500 dark:text-white/50 text-xs mt-1">{a.category} · {a.serial ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Demande de matériel">
        <div className="space-y-3">
          <div><label className="label">Matériel souhaité</label><input className="input" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} placeholder="Ordinateur portable" /></div>
          <div><label className="label">Catégorie</label><input className="input" value={req.category} onChange={(e) => setReq({ ...req, category: e.target.value })} placeholder="Informatique" /></div>
          <div><label className="label">Raison</label><textarea className="input" rows={2} value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={requestAsset} className="btn-primary text-sm">{t('common.submit')}</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Events + WhatsApp assistant
// ============================================================
function EventsView() {
  const { t } = useI18n();
  const tenant = useTenant();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('events').select('*').or(`tenant_id.eq.${tenant.id},scope.eq.panafrican`).order('event_date', { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [tenant]);

  async function rsvp(id: string, status: string) {
    if (!tenant) return;
    const { data } = await supabase.from('events').select('rsvp').eq('id', id).single();
    const rsvp = { ...(data?.rsvp ?? {}), [tenant.id]: status };
    await supabase.from('events').update({ rsvp }).eq('id', id);
    setItems((prev) => prev.map((e) => e.id === id ? { ...e, rsvp } : e));
  }

  if (!tenant) return null;
  return (
    <div>
      <PageHeader title={t('dash.events')} icon={<CalendarDays size={20} />} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<CalendarDays size={48} />} title="Aucun événement" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 dark:text-white font-semibold">{e.title}</h3>
                <Badge color={e.scope === 'panafrican' ? 'indigo' : 'coral'}>{e.scope}</Badge>
              </div>
              <div className="text-slate-500 dark:text-white/50 text-xs mt-1">{e.event_date ? new Date(e.event_date).toLocaleString() : '—'} · {e.location}</div>
              <p className="text-slate-600 dark:text-white/60 text-sm mt-3">{e.description}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => rsvp(e.id, 'yes')} className="btn-soft text-xs">Oui</button>
                <button onClick={() => rsvp(e.id, 'no')} className="btn-soft text-xs">Non</button>
                <button onClick={() => rsvp(e.id, 'maybe')} className="btn-soft text-xs">Peut-être</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatsApp() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<{ from: 'me' | 'bot'; text: string }[]>([
    { from: 'bot', text: `Bonjour ! Je suis l'assistant Faka. Demandez-moi : "mes congés", "mon bulletin", "une avance", "attestation".` },
  ]);
  const [input, setInput] = useState('');

  function send() {
    if (!input.trim()) return;
    const msg = input.toLowerCase();
    const reply = msg.includes('congé') || msg.includes('leave')
      ? 'Vous avez 12 jours de congé restants. Pour poser un congé, cliquez sur l\'onglet Congés.'
      : msg.includes('avance') || msg.includes('advance')
      ? 'Vous pouvez demander une avance sur salaire dans l\'onglet Avances. L\'admin validera sous 48h.'
      : msg.includes('bulletin') || msg.includes('payslip')
      ? 'Votre dernier bulletin est disponible dans Mon Espace. Format PDF bilingue FR/EN.'
      : msg.includes('attestation')
      ? 'Pour une attestation de travail ou de salaire, ouvrez une demande dans Notes de frais > Catégorie "Attestation".'
      : 'Je peux vous aider avec : congés, avances, bulletins de paie, attestations, notes de frais. Que souhaitez-vous ?';
    setMessages((m) => [...m, { from: 'me', text: input }, { from: 'bot', text: reply }]);
    setInput('');
  }

  return (
    <div>
      <PageHeader title={t('emp.whatsapp')} icon={<MessageSquare size={20} />} />
      <div className="card p-0 max-w-lg mx-auto overflow-hidden">
        <div className="bg-coral-500/10 px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-coral-500 flex items-center justify-center text-white font-bold text-sm">F</div>
          <div><div className="text-slate-900 dark:text-white font-semibold text-sm">Assistant Faka</div><div className="text-emerald-600 text-xs">en ligne</div></div>
        </div>
        <div className="p-4 space-y-3 min-h-[300px] bg-slate-50 dark:bg-ink-900/50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.from === 'me' ? 'bg-coral-500 text-white' : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-white/10 flex gap-2">
          <input className="input flex-1" placeholder="Message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button onClick={send} className="btn-primary"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main employee dashboard router
// ============================================================
export default function EmployeeDashboard() {
  const route = useRoute();
  const { user, activeTenant } = useAuth();

  useEffect(() => {
    if (!user) navigate('/signin');
  }, [user]);

  if (!user) return null;
  if (!activeTenant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center text-slate-600 dark:text-white/60">
        Aucun espace. Contactez votre administrateur RH.
      </div>
    );
  }

  const module = route.split('/dashboard/employee/')[1]?.split('?')[0] ?? 'dashboard';

  let content: ReactNode;
  switch (module) {
    case 'dashboard': content = <Overview />; break;
    case 'attendance': content = <Attendance />; break;
    case 'leaves': content = <StaffRequests table="leave_requests" title="Mes congés" icon={<CalendarClock size={20} />} />; break;
    case 'advances': content = <StaffRequests table="advances" title="Mes avances sur salaire" icon={<Banknote size={20} />} amountKey="amount" />; break;
    case 'claims': content = (
      <StaffRequests table="claims" title="Mes notes de frais & demandes" icon={<Receipt size={20} />} amountKey="amount"
        categories={[
          { value: 'expense', label: 'Note de frais' },
          { value: 'attestation', label: 'Attestation de travail' },
          { value: 'salary_cert', label: 'Attestation de salaire' },
          { value: 'reimbursement', label: 'Remboursement' },
          { value: 'other', label: 'Autre' },
        ]}
      />
    ); break;
    case 'assets': content = <StaffAssets />; break;
    case 'events': content = <EventsView />; break;
    case 'communication': content = <WhatsApp />; break;
    case 'subscription': content = <SubscriptionEmbed />; break;
    default: content = <Overview />;
  }

  return <DashboardShell role="employee">{content}</DashboardShell>;
}

import Subscription from '../Subscription';
function SubscriptionEmbed() {
  return <Subscription />;
}
