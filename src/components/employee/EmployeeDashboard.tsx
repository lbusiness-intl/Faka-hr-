import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { DashboardShell } from '../DashboardShell';
import { Badge, Spinner, EmptyState, Modal, StatCard } from '../ui';
import { useRoute, navigate } from '../../lib/router';
import { notifyHR } from '../../lib/notifications';
import {
  Clock, CalendarClock, Banknote, Receipt, CalendarDays,
  Play, Pause, Square, Camera, TrendingUp,
  FileText, Package, Plus, Check, Wallet, Users, Bell, Download, Upload,
} from 'lucide-react';
import CommunicationsPanel from '../admin/CommunicationsPanel';

type Employee = {
  id: string; first_name: string; last_name: string; email: string;
  position: string; department: string; salary: number; currency: string;
  contract_type: string; status: string; hire_date: string | null;
  phone: string | null; avatar_url: string | null; user_id: string | null;
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
// My Profile — self-service contact info + password change.
// (Previously there was no such screen at all.) Sensitive fields
// like salary/position/status are read-only here and can never be
// changed from this screen — enforced both by the UI and by a
// database trigger, so it's not just a front-end restriction.
// ============================================================
function MyProfile() {
  const tenant = useTenant();
  const { user } = useAuth();
  const { me, loading: loadingMe } = useMe(tenant?.id, user?.email);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!me) return;
    setPhone(me.phone ?? '');
    setAvatarUrl(me.avatar_url ?? null);
  }, [me]);

  async function saveProfile() {
    if (!me || !tenant) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: err } = await supabase.from('employees').update({ phone, avatar_url: avatarUrl }).eq('id', me.id);
    setSaving(false);
    if (err) { setError(`La sauvegarde a échoué : ${err.message}`); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function uploadAvatar(file: File) {
    if (!me || !tenant) return;
    setUploading(true);
    setError(null);
    const path = `${tenant.id}/${me.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); setError(`Le téléversement a échoué : ${upErr.message}`); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function changePassword() {
    setPwMsg(null);
    if (newPassword.length < 8) { setPwMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' }); return; }
    if (newPassword !== confirmPassword) { setPwMsg({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setPwSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (err) { setPwMsg({ type: 'error', text: err.message }); return; }
    setPwMsg({ type: 'ok', text: 'Mot de passe mis à jour avec succès.' });
    setNewPassword('');
    setConfirmPassword('');
  }

  if (!tenant) return null;
  if (loadingMe) return <Spinner />;
  if (!me) return <EmptyState icon={<Users size={24} />} title="Profil introuvable" />;

  return (
    <div>
      <PageHeader title="Mon Profil" icon={<Users size={20} />} />

      <div className="card p-6 mb-6 max-w-xl">
        <h3 className="text-slate-900 dark:text-white font-semibold mb-4">Informations de contact</h3>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold text-xl overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : `${me.first_name[0]}${me.last_name[0]}`}
          </div>
          <label className="btn-ghost text-sm cursor-pointer">
            {uploading ? <Spinner /> : <><Camera size={16} /> Changer la photo</>}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Prénom</label>
            <input className="input opacity-60" value={me.first_name} disabled />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input opacity-60" value={me.last_name} disabled />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60" value={me.email} disabled />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`${tenant?.phone_code ?? '+'} ...`} />
          </div>
          <div>
            <label className="label">Poste</label>
            <input className="input opacity-60" value={me.position ?? '—'} disabled />
          </div>
          <div>
            <label className="label">Département</label>
            <input className="input opacity-60" value={me.department ?? '—'} disabled />
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Le poste, le département et les informations contractuelles sont gérés par votre équipe RH.
        </p>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">✓ Profil mis à jour avec succès.</p>}
        <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">
          {saving ? <Spinner /> : <><Check size={16} /> Enregistrer</>}
        </button>
      </div>

      <div className="card p-6 max-w-xl">
        <h3 className="text-slate-900 dark:text-white font-semibold mb-4">Changer le mot de passe</h3>
        <div className="space-y-3 mb-4">
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        {pwMsg && (
          <p className={`text-sm mb-3 ${pwMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{pwMsg.text}</p>
        )}
        <button onClick={changePassword} disabled={pwSaving || !newPassword} className="btn-primary text-sm">
          {pwSaving ? <Spinner /> : <><Check size={16} /> Mettre à jour le mot de passe</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Staff Dashboard — Bayzat-style personal overview
// ============================================================
type LeaveRequestStat = { id: string; status: string; days?: number };
type AmountStat = { amount: number; status: string };
type GoalStat = { id: string; title: string; progress: number; status: string };
type RecentLeave = { id: string; type: string; start_date: string; end_date: string; status: string; created_at: string };

function Overview() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me, loading } = useMe(tenant?.id, user?.email);
  const [stats, setStats] = useState({ leaves: 0, leaveBalance: 18, advances: 0, claims: 0, goals: 0, pending: 0 });
  const [recent, setRecent] = useState<RecentLeave[]>([]);

  useEffect(() => {
    if (!tenant || !me) return;
    (async () => {
      const [l, a, c, g, allL] = await Promise.all([
        supabase.from('leave_requests').select('id, status, days').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('advances').select('amount, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('claims').select('amount, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('goals').select('id, title, progress, status').eq('tenant_id', tenant.id).eq('employee_id', me.id),
        supabase.from('leave_requests').select('id, type, start_date, end_date, status, created_at').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false }).limit(5),
      ]);
      const leaves = (l.data ?? []) as LeaveRequestStat[];
      const advances = (a.data ?? []) as AmountStat[];
      const claims = (c.data ?? []) as AmountStat[];
      const goals = (g.data ?? []) as GoalStat[];
      const pendingCount = [...leaves, ...advances, ...claims].filter((x) => x.status === 'pending').length;
      setStats({
        leaves: leaves.length,
        leaveBalance: 18 - leaves.filter((x) => x.status === 'approved').reduce((s, x) => s + Number(x.days ?? 1), 0),
        advances: advances.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount), 0),
        claims: claims.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount), 0),
        goals: goals.length,
        pending: pendingCount,
      });
      setRecent((allL.data as RecentLeave[]) ?? []);
    })();
  }, [tenant, me]);

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));

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
type AttendanceLog = {
  id: string; check_in: string | null; check_out: string | null;
  break_start: string | null; break_end: string | null; selfie_url: string | null; created_at: string;
};

function Attendance() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [today, setToday] = useState<AttendanceLog | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfie, setSelfie] = useState<string | null>(null);

  async function load() {
    if (!tenant || !me) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [todayRes, allRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).gte('created_at', start.toISOString()).order('created_at', { ascending: false }).limit(1),
      supabase.from('attendance').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false }).limit(10),
    ]);
    setToday((todayRes.data?.[0] as AttendanceLog) ?? null);
    setLogs((allRes.data as AttendanceLog[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function action(type: 'in' | 'break' | 'resume' | 'out') {
    if (!tenant || !me) return;
    const now = new Date().toISOString();
    if (!today) {
      const { data } = await supabase.from('attendance').insert({ tenant_id: tenant.id, employee_id: me.id, check_in: now, selfie_url: selfie }).select().single();
      setToday(data as AttendanceLog);
    } else {
      const patch: Partial<AttendanceLog> = {};
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
function computeLeaveDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

// ============================================================
// Generic staff request page (leaves / advances / claims)
// with category-aware form and status tracking.
// ============================================================
type StaffRequestItem = {
  id: string;
  employee_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  type?: string;
  category?: string;
  reason?: string;
  start_date?: string;
  end_date?: string;
  days?: number;
  amount?: number;
  description?: string;
  created_at: string;
};
type LeaveBalanceInfo = { entitled: number; used: number; carried_over: number };

function StaffRequests({ table, title, icon, amountKey, categories }: {
  table: 'leave_requests' | 'advances' | 'claims';
  title: string; icon: ReactNode; amountKey?: 'amount';
  categories?: { value: string; label: string }[];
}) {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [items, setItems] = useState<StaffRequestItem[]>([]);
  const [balance, setBalance] = useState<LeaveBalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const isLeave = table === 'leave_requests';
  const thisYear = new Date().getFullYear();

  async function load() {
    if (!tenant || !me) return;
    setLoading(true);
    const calls: PromiseLike<{ data: unknown }>[] = [supabase.from(table).select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false })];
    if (isLeave) calls.push(supabase.from('leave_balances').select('entitled, used, carried_over').eq('tenant_id', tenant.id).eq('employee_id', me.id).eq('type', 'annual').eq('year', thisYear).maybeSingle());
    const [r, b] = await Promise.all(calls);
    setItems((r.data as StaffRequestItem[]) ?? []);
    if (isLeave) setBalance((b?.data as LeaveBalanceInfo) ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  // Real-time subscription
  useEffect(() => {
    if (!tenant || !me) return;
    const ch = supabase.channel(`emp_${table}:${tenant.id}:${me.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenant.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant, me, table]);

  async function submit() {
    if (!tenant || !me) return;
    const payload: Record<string, unknown> = { ...form, tenant_id: tenant.id, employee_id: me.id, currency: tenant.currency, status: 'pending' };
    if (table === 'leave_requests') {
      const days = computeLeaveDays(form.start_date as string, form.end_date as string);
      payload.days = days;
      if (balance) {
        const remaining = Number(balance.entitled) + Number(balance.carried_over) - Number(balance.used);
        if (days > remaining) {
          const proceed = window.confirm(`Vous demandez ${days} jour(s) mais il ne vous reste que ${remaining} jour(s) de solde. Soumettre quand même ? La RH pourra examiner votre demande.`);
          if (!proceed) return;
        }
      }
    }
    await supabase.from(table).insert(payload);
    // Notify HR
    const cat = table === 'leave_requests' ? 'leave' : table === 'advances' ? 'advance' : 'claim';
    const label = table === 'leave_requests' ? 'Congé' : table === 'advances' ? 'Avance' : 'Note de frais';
    await notifyHR(tenant.id, { category: cat, title: `Nouvelle demande — ${label}`, body: `${me.first_name} ${me.last_name} a soumis une demande.`, priority: 'normal' });
    setModal(false);
    setForm({});
    load();
  }

  if (!tenant) return null;
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(n);

  return (
    <div>
      <PageHeader title={title} icon={icon} />
      {isLeave && balance && (
        <div className="card p-4 mb-4 flex items-center gap-6 max-w-md">
          <div>
            <div className="text-xs text-slate-400 dark:text-white/40">Solde restant {thisYear}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">
              {Number(balance.entitled) + Number(balance.carried_over) - Number(balance.used)} <span className="text-sm font-normal text-slate-400">jours</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50">
            {Number(balance.entitled)} acquis + {Number(balance.carried_over)} reportés − {Number(balance.used)} pris
          </div>
        </div>
      )}
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
                  {amountKey && <><td className="p-4 text-slate-700 dark:text-white/70">{it.category ?? it.reason ?? '—'}</td><td className="p-4 text-slate-700 dark:text-white/70">{fmt(it[amountKey] ?? 0)} {tenant.currency}</td></>}
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
                <div><label className="label">Fin</label><input type="date" className="input" onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              {balance && (
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Solde restant : <strong>{Number(balance.entitled) + Number(balance.carried_over) - Number(balance.used)} jour(s)</strong>
                </p>
              )}
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
type AssetRow = { id: string; name: string; category: string | null; serial: string | null; assigned_to: string | null; status: string };

function StaffAssets() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [req, setReq] = useState({ name: '', category: '', reason: '' });

  async function load() {
    if (!tenant || !me) return;
    const { data } = await supabase.from('assets').select('*').eq('tenant_id', tenant.id).or(`assigned_to.eq.${me.id},status.eq.available`).order('created_at', { ascending: false });
    setAssets((data as AssetRow[]) ?? []);
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
type CompanyEventView = { id: string; title: string; description: string | null; location: string | null; event_date: string | null; scope: string; rsvp: Record<string, string> };

function EventsView() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const [items, setItems] = useState<CompanyEventView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('events').select('*').or(`tenant_id.eq.${tenant.id},scope.eq.panafrican`).order('event_date', { ascending: false }).then(({ data }) => {
      setItems((data as CompanyEventView[]) ?? []);
      setLoading(false);
    });
  }, [tenant]);

  async function rsvp(id: string, status: string) {
    if (!tenant || !user) return;
    const { data } = await supabase.from('events').select('rsvp').eq('id', id).single();
    const rsvp = { ...(data?.rsvp ?? {}), [user.id]: status };
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

// ============================================================
// Documents — employee sees HR uploads + own uploads + signed contracts
// ============================================================
type MyDocumentRow = { id: string; employee_id: string; name: string; type: string; storage_path: string; signed?: boolean; uploaded_by_role?: string; created_at: string };

function MyDocuments() {
  const { t } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [docs, setDocs] = useState<MyDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'other' });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    if (!tenant || !me) return;
    const { data } = await supabase.from('documents').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false });
    setDocs((data as MyDocumentRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function upload() {
    if (!tenant || !me || !file || !form.name) return;
    const path = `${tenant.id}/${me.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) { alert(`Le téléversement a échoué : ${upErr.message}`); return; }
    await supabase.from('documents').insert({
      tenant_id: tenant.id,
      employee_id: me.id,
      name: form.name,
      type: form.type,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || 'application/pdf',
      uploaded_by: user?.id,
      uploaded_by_role: 'employee',
    });
    setModal(false);
    setForm({ name: '', type: 'other' });
    setFile(null);
    load();
  }

  if (!tenant || !me) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Mes documents" icon={<FileText size={20} />} />
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Upload size={16} /> Téléverser</button>
      </div>
      {loading ? <Spinner /> : docs.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="Aucun document" hint="Votre RH peut téléverser vos documents ici, ils apparaîtront automatiquement." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-coral-100 dark:bg-coral-500/10 text-coral-600 flex items-center justify-center">
                  <FileText size={18} />
                </div>
                {d.signed && <Badge color="emerald">Signé</Badge>}
              </div>
              <h3 className="mt-3 text-slate-900 dark:text-white font-semibold text-sm">{d.name}</h3>
              <div className="text-slate-400 dark:text-white/40 text-xs mt-1 capitalize">{d.type} · {new Date(d.created_at).toLocaleDateString()}</div>
              <div className="mt-1"><Badge color={d.uploaded_by_role === 'hr' ? 'coral' : 'indigo'}>{d.uploaded_by_role === 'hr' ? 'par RH' : 'par moi'}</Badge></div>
              <button
                onClick={async () => { const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60); if (data) window.open(data.signedUrl, '_blank'); }}
                className="mt-3 btn-ghost text-xs w-full"
              >
                <Download size={14} /> Télécharger
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Téléverser un document">
        <div className="space-y-3">
          <div><label className="label">Nom</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pièce d'identité" /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="id" className="bg-white dark:bg-ink-700">Pièce d'identité</option>
              <option value="diploma" className="bg-white dark:bg-ink-700">Diplôme</option>
              <option value="attestation" className="bg-white dark:bg-ink-700">Attestation</option>
              <option value="other" className="bg-white dark:bg-ink-700">Autre</option>
            </select>
          </div>
          <div><label className="label">Fichier</label><input type="file" accept=".pdf,image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
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
// Payslips (employee view — see own payslips)
// ============================================================
type PayslipRow = { id: string; employee_id: string; period?: string; gross: number; bonus?: number; deductions: number; net: number; currency: string; status: string; created_at: string };

function MyPayslips() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [items, setItems] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!tenant || !me) return;
    const { data } = await supabase.from('payslips').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false });
    setItems((data as PayslipRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  // Real-time
  useEffect(() => {
    if (!tenant || !me) return;
    const ch = supabase.channel(`payslips_emp:${me.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payslips', filter: `employee_id=eq.${me.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant, me]);

  if (!tenant || !me) return null;
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));

  return (
    <div>
      <PageHeader title={t('dash.payroll')} icon={<Wallet size={20} />} />
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Aucun bulletin" hint="Vos bulletins de paie apparaîtront ici dès qu'ils seront générés." />
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold">Période {p.period ?? new Date(p.created_at).toISOString().slice(0, 7)}</div>
                  <div className="text-slate-400 dark:text-white/40 text-xs">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <Badge color={p.status === 'paid' ? 'emerald' : 'amber'}>{p.status === 'paid' ? 'Payé' : 'En attente'}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div><div className="text-xs text-slate-400">Brut</div><div className="text-slate-900 dark:text-white font-medium">{fmt(Number(p.gross))} {p.currency}</div></div>
                <div><div className="text-xs text-slate-400">Bonus</div><div className="text-slate-900 dark:text-white font-medium">{fmt(Number(p.bonus ?? 0))} {p.currency}</div></div>
                <div><div className="text-xs text-slate-400">Déductions</div><div className="text-rose-600 font-medium">-{fmt(Number(p.deductions))} {p.currency}</div></div>
                <div><div className="text-xs text-slate-400">Net</div><div className="text-emerald-600 font-bold">{fmt(Number(p.net))} {p.currency}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Overtime (employee view — submit + see own)
// ============================================================
type OvertimeRow = { id: string; employee_id: string; date: string; hours: number; rate?: number; amount: number; currency: string; status: string };

function MyOvertime() {
  const { t, localeTag } = useI18n();
  const tenant = useTenant();
  const { user } = useAuth();
  const { me } = useMe(tenant?.id, user?.email);
  const [items, setItems] = useState<OvertimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: 1, notes: '' });

  async function load() {
    if (!tenant || !me) return;
    const { data } = await supabase.from('overtime').select('*').eq('tenant_id', tenant.id).eq('employee_id', me.id).order('created_at', { ascending: false });
    setItems((data as OvertimeRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tenant, me]);

  async function submit() {
    if (!tenant || !me) return;
    await supabase.from('overtime').insert({
      tenant_id: tenant.id, employee_id: me.id, date: form.date, hours: Number(form.hours), rate: 1.5, amount: 0, currency: tenant.currency, status: 'pending', notes: form.notes,
    });
    // Notify HR
    await notifyHR(tenant.id, { category: 'attendance', title: 'Demande d\'heures sup.', body: `${me.first_name} ${me.last_name} a soumis ${form.hours}h sup.`, priority: 'normal' });
    setModal(false);
    setForm({ date: new Date().toISOString().slice(0, 10), hours: 1, notes: '' });
    load();
  }

  if (!tenant || !me) return null;
  const fmt = (n: number) => new Intl.NumberFormat(localeTag).format(Math.round(n));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Heures supplémentaires" icon={<Clock size={20} />} />
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Demander</button>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="Aucune heure supplémentaire" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr><th className="text-left p-4">Date</th><th className="text-left p-4">Heures</th><th className="text-left p-4">Montant</th><th className="text-left p-4">Statut</th></tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="p-4 text-slate-700 dark:text-white/70">{o.date}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{o.hours}h</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{fmt(o.amount)} {o.currency}</td>
                  <td className="p-4"><Badge color={o.status === 'approved' ? 'emerald' : o.status === 'rejected' ? 'rose' : 'amber'}>{o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Déclarer des heures supplémentaires">
        <div className="space-y-3">
          <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">Heures</label><input type="number" step="0.5" className="input" value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
    case 'communication': content = <CommunicationsPanel isEmployee={true} />; break;
    case 'documents': content = <MyDocuments />; break;
    case 'payslips': content = <MyPayslips />; break;
    case 'overtime': content = <MyOvertime />; break;
    case 'subscription': content = <SubscriptionEmbed />; break;
    case 'profile': content = <MyProfile />; break;
    default: content = <Overview />;
  }

  return <DashboardShell role="employee">{content}</DashboardShell>;
}

import Subscription from '../Subscription';
function SubscriptionEmbed() {
  return <Subscription />;
}
