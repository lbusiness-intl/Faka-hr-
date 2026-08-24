import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, Spinner, Modal, EmptyState, StatCard } from '../ui';
import { navigate } from '../../lib/router';
import { PLANS, getPlan, type PlanId } from '../../lib/plans';
import { COUNTRIES } from '../../lib/geo';
import {
  Building2, DollarSign, TrendingDown, Globe2, Ticket, LogOut,
  Crown, ShieldCheck, MapPin, Plus, Trash2, Mail, Trophy, Percent,
} from 'lucide-react';
import EmailCenter from './EmailCenter';
import AutomationCenter from './AutomationCenter';

type TenantRow = {
  id: string; name: string; country: string; currency: string; plan: string;
  status: string; created_at: string; trial_ends_at: string | null;
  sales_code: string | null; employee_limit: number;
};

export default function SuperAdminDashboard() {
  const { t } = useI18n();
  const auth = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<TenantRow | null>(null);
  const [tab, setTab] = useState<'overview' | 'tenants' | 'sales' | 'invitations' | 'plans' | 'promotions' | 'geo' | 'email' | 'automation'>('overview');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants((data as TenantRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateTenant(id: string, patch: Partial<TenantRow>) {
    await supabase.from('tenants').update(patch).eq('id', id);
    setEdit(null);
    load();
  }

  // Compute metrics
  const activeCount = tenants.filter((x) => x.status === 'active').length;
  const trialCount = tenants.filter((x) => x.status === 'trial').length;
  const suspendedCount = tenants.filter((x) => x.status === 'suspended').length;
  const mrr = tenants.filter((x) => x.status === 'active').reduce((s, x) => s + (getPlan(x.plan as PlanId).priceMonthly), 0);
  const arr = mrr * 12;
  const churn = tenants.length > 0 ? (suspendedCount / tenants.length) * 100 : 0;

  // Sales codes
  const salesMap: Record<string, number> = {};
  tenants.forEach((x) => {
    const code = x.sales_code || '—';
    salesMap[code] = (salesMap[code] ?? 0) + 1;
  });
  const salesRows = Object.entries(salesMap).sort((a, b) => b[1] - a[1]);

  // Geo distribution
  const geoMap: Record<string, { count: number; currencies: Set<string> }> = {};
  tenants.forEach((x) => {
    if (!geoMap[x.country]) geoMap[x.country] = { count: 0, currencies: new Set() };
    geoMap[x.country].count += 1;
    geoMap[x.country].currencies.add(x.currency);
  });
  const geoRows = Object.entries(geoMap).sort((a, b) => b[1].count - a[1].count);

  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
      <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-ink-800/60 backdrop-blur-xl flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-coral-500 flex items-center justify-center">
            <Crown size={18} className="text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-slate-900 dark:text-white">Faka Super Admin</div>
            <div className="text-xs text-slate-400 dark:text-white/40">LiAfrik — Console interne</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="indigo"><ShieldCheck size={12} /> Super Admin</Badge>
          <span className="text-sm text-slate-600 dark:text-white/60">{auth.user?.email}</span>
          <button onClick={async () => { await auth.signOut(); navigate('/'); }} className="btn-ghost text-sm"><LogOut size={16} /> {t('dash.logout')}</button>
        </div>
      </header>

      <div className="section py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { id: 'overview', label: 'Vue d\'ensemble' },
            { id: 'tenants', label: t('super.tenants') },
            { id: 'sales', label: 'Commerciaux' },
            { id: 'invitations', label: 'Invitations' },
            { id: 'plans', label: 'Plans' },
            { id: 'promotions', label: 'Promotions' },
            { id: 'geo', label: t('super.geo') },
            { id: 'email', label: 'Email Center' },
            { id: 'automation', label: 'Automation' },
          ] as const).map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === tb.id ? 'bg-coral-500 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label={t('super.mrr')} value={`$${fmt(mrr)}`} sub="USD" icon={<DollarSign size={18} />} color="emerald" />
                  <StatCard label={t('super.arr')} value={`$${fmt(arr)}`} sub="USD / an" icon={<TrendingDown size={18} />} color="teal" />
                  <StatCard label={t('super.active')} value={String(activeCount)} sub={`${trialCount} en essai`} icon={<Building2 size={18} />} color="indigo" />
                  <StatCard label={t('super.churn')} value={`${churn.toFixed(1)}%`} icon={<TrendingDown size={18} />} color="rose" />
                </div>
                <div className="card p-6">
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-4">Répartition par plan</h3>
                  <div className="space-y-3">
                    {PLANS.map((p) => {
                      const count = tenants.filter((x) => x.plan === p.id).length;
                      const pct = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
                      return (
                        <div key={p.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700 dark:text-white/70">{p.name}</span>
                            <span className="text-slate-500 dark:text-white/50">{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-coral-500 to-coral-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'tenants' && (
              <div className="card overflow-x-auto">
                {tenants.length === 0 ? <EmptyState icon={<Building2 size={48} />} title="Aucun tenant" /> : (
                  <table className="w-full text-sm">
                    <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="text-left p-4">Entreprise</th>
                        <th className="text-left p-4">Pays</th>
                        <th className="text-left p-4">Plan</th>
                        <th className="text-left p-4">Statut</th>
                        <th className="text-left p-4">Code commercial</th>
                        <th className="text-left p-4">Créé</th>
                        <th className="text-left p-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((x) => (
                        <tr key={x.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="p-4 text-slate-900 dark:text-white font-medium">{x.name}</td>
                          <td className="p-4 text-slate-700 dark:text-white/70">{x.country} · {x.currency}</td>
                          <td className="p-4"><span className="capitalize text-slate-700 dark:text-white/70">{x.plan}</span></td>
                          <td className="p-4">
                            <Badge color={x.status === 'active' ? 'emerald' : x.status === 'trial' ? 'amber' : 'rose'}>{x.status}</Badge>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-white/60">{x.sales_code ?? '—'}</td>
                          <td className="p-4 text-slate-500 dark:text-white/50 text-xs">{new Date(x.created_at).toLocaleDateString()}</td>
                          <td className="p-4"><button onClick={() => setEdit(x)} className="text-coral-600 hover:text-coral-500 text-xs">Gérer</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'sales' && (
              <div className="card overflow-x-auto">
                {salesRows.length === 0 ? <EmptyState icon={<Ticket size={48} />} title="Aucun code" /> : (
                  <table className="w-full text-sm">
                    <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                      <tr><th className="text-left p-4">Code</th><th className="text-left p-4">Conversions</th></tr>
                    </thead>
                    <tbody>
                      {salesRows.map(([code, n]) => (
                        <tr key={code} className="border-b border-slate-100 dark:border-white/5">
                          <td className="p-4 text-slate-900 dark:text-white font-medium">{code}</td>
                          <td className="p-4 text-slate-700 dark:text-white/70">{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'geo' && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {geoRows.length === 0 ? <EmptyState icon={<Globe2 size={48} />} title="Aucune donnée" /> : (
                  geoRows.map(([code, info]) => {
                    const country = COUNTRIES.find((c) => c.code === code);
                    return (
                      <div key={code} className="card p-5">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                          <MapPin size={16} className="text-coral-500" />
                          {country ? (country.nameFr + ' / ' + country.name) : code}
                        </div>
                        <div className="mt-2 text-2xl font-bold text-coral-600">{info.count}</div>
                        <div className="text-xs text-slate-400 dark:text-white/40 mt-1">Devises: {[...info.currencies].join(', ')}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === 'sales' && <SalesAgents tenants={tenants} />}
            {tab === 'invitations' && <Invitations />}
            {tab === 'plans' && <PlanEditor />}
            {tab === 'promotions' && <Promotions />}
            {tab === 'email' && <EmailCenter />}
            {tab === 'automation' && <AutomationCenter />}
          </>
        )}
      </div>

      <EditTenantModal tenant={edit} onClose={() => setEdit(null)} onSave={updateTenant} />
    </div>
  );
}

function EditTenantModal({ tenant, onClose, onSave }: {
  tenant: TenantRow | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<TenantRow>) => void;
}) {
  const [plan, setPlan] = useState(tenant?.plan ?? 'starter');
  const [status, setStatus] = useState(tenant?.status ?? 'trial');
  useEffect(() => {
    setPlan(tenant?.plan ?? 'starter');
    setStatus(tenant?.status ?? 'trial');
  }, [tenant]);
  if (!tenant) return null;
  return (
    <Modal open={true} onClose={onClose} title={`Gérer — ${tenant.name}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Plan</label>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => <option key={p.id} value={p.id} className="bg-white dark:bg-ink-700">{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="trial" className="bg-white dark:bg-ink-700">trial</option>
            <option value="active" className="bg-white dark:bg-ink-700">active</option>
            <option value="suspended" className="bg-white dark:bg-ink-700">suspended</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn-ghost text-sm">Annuler</button>
        <button onClick={() => onSave(tenant.id, { plan, status })} className="btn-primary text-sm">Enregistrer</button>
      </div>
    </Modal>
  );
}

// ============================================================
// Sales Agents — commercial tracking + leaderboard
// ============================================================
type SalesAgent = { id: string; name: string; email: string; sales_code: string; commission_rate: number; status: string; created_at: string };

function SalesAgents({ tenants }: { tenants: TenantRow[] }) {
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', sales_code: '', commission_rate: 10 });

  async function load() {
    const { data } = await supabase.from('sales_agents').select('*').order('created_at', { ascending: false });
    setAgents((data as SalesAgent[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    await supabase.from('sales_agents').insert({ ...form, status: 'active' });
    setModal(false);
    setForm({ name: '', email: '', sales_code: '', commission_rate: 10 });
    load();
  }

  async function remove(id: string) {
    await supabase.from('sales_agents').delete().eq('id', id);
    load();
  }

  async function inviteAgent(agent: SalesAgent) {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await supabase.from('invitations').insert({
      email: agent.email,
      role: 'commercial',
      token,
      sales_code: agent.sales_code,
      created_by: (await supabase.auth.getUser()).data.user?.id,
      status: 'pending',
    });
    alert(`Lien d'invitation (commercial) : ${window.location.origin}/accept-invite?token=${token}`);
  }

  // Compute per-agent stats from tenants
  const stats = agents.map((a) => {
    const agentTenants = tenants.filter((t) => t.sales_code === a.sales_code);
    const active = agentTenants.filter((t) => t.status === 'active');
    const revenue = active.reduce((s, t) => s + getPlan(t.plan as PlanId).priceMonthly, 0);
    const commission = (revenue * a.commission_rate) / 100;
    return { ...a, tenants: agentTenants.length, active: active.length, revenue, commission };
  }).sort((a, b) => b.revenue - a.revenue);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300"><Trophy size={20} /></div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Commerciaux & Leaderboard</h1>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Ajouter</button>
      </div>

      {loading ? <Spinner /> : stats.length === 0 ? (
        <EmptyState icon={<Trophy size={48} />} title="Aucun commercial" hint="Ajoutez vos agents de vente et suivez leurs conversions." />
      ) : (
        <>
          {/* Leaderboard */}
          <div className="card overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="text-left p-4">#</th>
                  <th className="text-left p-4">Commercial</th>
                  <th className="text-left p-4">Code</th>
                  <th className="text-left p-4">Tenants</th>
                  <th className="text-left p-4">Actifs</th>
                  <th className="text-left p-4">MRR généré</th>
                  <th className="text-left p-4">Commission</th>
                  <th className="text-left p-4"></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((a, i) => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="p-4">
                      {i < 3 ? <Badge color={i === 0 ? 'amber' : i === 1 ? 'slate' : 'coral'}><Trophy size={12} /> {i + 1}</Badge> : <span className="text-slate-400">{i + 1}</span>}
                    </td>
                    <td className="p-4 text-slate-900 dark:text-white font-medium">{a.name}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{a.sales_code}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{a.tenants}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{a.active}</td>
                    <td className="p-4 text-emerald-600 font-semibold">${a.revenue}</td>
                    <td className="p-4 text-coral-600 font-semibold">${a.commission.toFixed(2)}</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => inviteAgent(a)} className="text-coral-600 hover:text-coral-500 text-xs"><Mail size={14} /></button>
                      <button onClick={() => remove(a.id)} className="text-rose-500 hover:text-rose-400 text-xs"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => {
            const csv = ['Rank,Name,Code,Tenants,Active,MRR,Commission'];
            stats.forEach((a, i) => csv.push(`${i + 1},${a.name},${a.sales_code},${a.tenants},${a.active},${a.revenue},${a.commission.toFixed(2)}`));
            const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = 'commerciaux.csv'; link.click();
          }} className="btn-ghost text-sm">Exporter CSV</button>
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau commercial">
        <div className="space-y-3">
          <div><label className="label">Nom</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Code commercial</label><input className="input" value={form.sales_code} onChange={(e) => setForm({ ...form, sales_code: e.target.value })} placeholder="FAKA-001" /></div>
          <div><label className="label">Taux de commission (%)</label><input type="number" className="input" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={add} className="btn-primary text-sm">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Invitations — history of all sent invitations
// ============================================================
type InvitationRow = { id: string; email: string; role: string; sales_code: string | null; status: string; created_at: string; expires_at: string };

function Invitations() {
  const [items, setItems] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
    setItems((data as InvitationRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300"><Mail size={20} /></div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Historique des invitations</h1>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Mail size={48} />} title="Aucune invitation envoyée" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Rôle</th>
                <th className="text-left p-4">Code commercial</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4">Envoyée</th>
                <th className="text-left p-4">Expire</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="p-4 text-slate-900 dark:text-white font-medium">{it.email}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70 capitalize">{it.role}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{it.sales_code ?? '—'}</td>
                  <td className="p-4"><Badge color={it.status === 'used' ? 'emerald' : it.status === 'expired' ? 'rose' : 'amber'}>{it.status}</Badge></td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(it.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(it.expires_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Plan Editor — edit prices, limits, features without code
// ============================================================
type PlanOverride = { id: string; plan_id: string; name: string; price_monthly: number; price_yearly: number; employee_limit: number | null; features: string[]; modules: string[] };
type PlanOverrideForm = Partial<PlanOverride>;

function PlanEditor() {
  const [overrides, setOverrides] = useState<PlanOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<PlanId | null>(null);
  const [form, setForm] = useState<PlanOverrideForm>({});

  async function load() {
    const { data } = await supabase.from('plan_overrides').select('*');
    setOverrides((data as PlanOverride[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEdit(planId: PlanId) {
    const existing = overrides.find((o) => o.plan_id === planId);
    const base = PLANS.find((p) => p.id === planId)!;
    setForm(existing ?? {
      plan_id: planId,
      name: base.name,
      price_monthly: base.priceMonthly,
      price_yearly: base.priceYearly,
      employee_limit: base.employeeLimit,
      features: base.features,
      modules: base.modules,
    });
    setEditPlan(planId);
  }

  async function save() {
    await supabase.from('plan_overrides').upsert({
      plan_id: form.plan_id,
      name: form.name,
      price_monthly: Number(form.price_monthly),
      price_yearly: Number(form.price_yearly),
      employee_limit: form.employee_limit ? Number(form.employee_limit) : null,
      features: form.features,
      modules: form.modules,
    }, { onConflict: 'plan_id' });
    setEditPlan(null);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300"><DollarSign size={20} /></div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Contrôle des plans</h1>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const ov = overrides.find((o) => o.plan_id === p.id);
          return (
            <div key={p.id} className="card p-5">
              <h3 className="text-slate-900 dark:text-white font-display font-bold">{p.name}</h3>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">${ov?.price_monthly ?? p.priceMonthly}<span className="text-sm text-slate-400">/mo</span></div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-1">{ov?.employee_limit ?? p.employeeLimit ?? '∞'} employés</div>
              <button onClick={() => startEdit(p.id)} className="btn-ghost text-xs mt-4 w-full">Modifier</button>
            </div>
          );
        })}
      </div>

      <Modal open={editPlan !== null} onClose={() => setEditPlan(null)} title={`Modifier — ${form.name}`}>
        <div className="space-y-3">
          <div><label className="label">Nom</label><input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Prix mensuel ($)</label><input type="number" className="input" value={form.price_monthly ?? 0} onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })} /></div>
            <div><label className="label">Prix annuel ($)</label><input type="number" className="input" value={form.price_yearly ?? 0} onChange={(e) => setForm({ ...form, price_yearly: Number(e.target.value) })} /></div>
          </div>
          <div><label className="label">Limite d'employés (vide = illimité)</label><input type="number" className="input" value={form.employee_limit ?? ''} onChange={(e) => setForm({ ...form, employee_limit: e.target.value ? Number(e.target.value) : null })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setEditPlan(null)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={save} className="btn-primary text-sm">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Promotions — promo codes
// ============================================================
type PromoCode = { id: string; code: string; description: string | null; discount_percent: number; discount_amount?: number; max_uses: number | null; used_count: number; valid_until: string | null; active: boolean };

function Promotions() {
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_percent: 10, discount_amount: 0, max_uses: 100, valid_until: '' });

  async function load() {
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    setItems((data as PromoCode[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    await supabase.from('promotions').insert({
      code: form.code.toUpperCase(),
      description: form.description,
      discount_percent: Number(form.discount_percent),
      discount_amount: Number(form.discount_amount),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until || null,
      active: true,
    });
    setModal(false);
    setForm({ code: '', description: '', discount_percent: 10, discount_amount: 0, max_uses: 100, valid_until: '' });
    load();
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from('promotions').update({ active: !active }).eq('id', id);
    load();
  }

  async function remove(id: string) {
    await supabase.from('promotions').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300"><Percent size={20} /></div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Promotions & codes promo</h1>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary text-sm"><Plus size={16} /> Créer</button>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<Percent size={48} />} title="Aucune promotion" hint="Créez des codes promo pour des utilisateurs ou groupes." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Code</th>
                <th className="text-left p-4">Description</th>
                <th className="text-left p-4">Remise</th>
                <th className="text-left p-4">Utilisations</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="p-4 text-slate-900 dark:text-white font-mono font-bold">{p.code}</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{p.description ?? '—'}</td>
                  <td className="p-4 text-coral-600 font-semibold">{p.discount_percent}%</td>
                  <td className="p-4 text-slate-700 dark:text-white/70">{p.used_count}/{p.max_uses ?? '∞'}</td>
                  <td className="p-4"><Badge color={p.active ? 'emerald' : 'slate'}>{p.active ? 'Actif' : 'Inactif'}</Badge></td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => toggle(p.id, p.active)} className="text-coral-600 hover:text-coral-500 text-xs">{p.active ? 'Désactiver' : 'Activer'}</button>
                    <button onClick={() => remove(p.id)} className="text-rose-500 hover:text-rose-400 text-xs"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau code promo">
        <div className="space-y-3">
          <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FAKA20" /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Remise (%)</label><input type="number" className="input" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} /></div>
            <div><label className="label">Remise ($)</label><input type="number" className="input" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Max utilisations</label><input type="number" className="input" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} /></div>
            <div><label className="label">Expire le</label><input type="date" className="input" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={add} className="btn-primary text-sm">Créer</button>
        </div>
      </Modal>
    </div>
  );
}
