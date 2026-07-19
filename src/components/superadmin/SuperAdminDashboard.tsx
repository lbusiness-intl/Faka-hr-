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
  Crown, ShieldCheck, MapPin,
} from 'lucide-react';

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
  const [tab, setTab] = useState<'overview' | 'tenants' | 'sales' | 'geo'>('overview');

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
            <div className="text-xs text-slate-400 dark:text-white/40">LIYAH GROUP — Console interne</div>
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
            { id: 'sales', label: t('super.sales') },
            { id: 'geo', label: t('super.geo') },
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
