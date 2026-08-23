import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { PLANS, getPlan, type PlanId } from '../lib/plans';
import { Spinner, Badge } from './ui';
import { Link } from '../lib/router';
import { Check, Receipt, Zap } from 'lucide-react';

type Invoice = {
  id: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export default function Subscription() {
  const { t } = useI18n();
  const { activeTenant, user, refresh } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<PlanId | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);
    supabase.from('invoices').select('*').eq('tenant_id', activeTenant.id).order('created_at', { ascending: false }).then(({ data }) => {
      setInvoices((data as Invoice[]) ?? []);
      setLoading(false);
    });
  }, [activeTenant]);

  if (!activeTenant) {
    return (
      <div className="min-h-screen bg-white dark:bg-ink-900 flex items-center justify-center text-slate-600 dark:text-white/60">
        <div><Link to="/signin" className="text-coral-600">Sign in</Link> to manage your subscription.</div>
      </div>
    );
  }

  const plan = getPlan(activeTenant.plan as PlanId);
  const isSuperAdminUser = user?.app_metadata?.role === 'super_admin';
  const trialEnds = activeTenant.trial_ends_at ? new Date(activeTenant.trial_ends_at) : null;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : 0;
  const isTrial = activeTenant.status === 'trial';
  const isSuspended = activeTenant.status === 'suspended';
  const trialExpired = isTrial && trialEnds ? trialEnds.getTime() < Date.now() : false;
  const isBlocked = !isSuperAdminUser && (isSuspended || trialExpired);

  if (isSuperAdminUser) {
    return (
      <div className="min-h-screen bg-white dark:bg-ink-900 flex items-center justify-center px-6">
        <div className="card p-10 max-w-md text-center">
          <Zap className="mx-auto text-blue-600" size={40} />
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-4">{t('sub.team.access.title')}</h1>
          <p className="text-slate-600 dark:text-white/60 text-sm mt-2">
            En tant que membre de l'équipe interne, votre accès à Faka est gratuit et illimité — aucun abonnement requis.
          </p>
        </div>
      </div>
    );
  }


  async function simulateCheckout(newPlan: PlanId) {
    if (!activeTenant || !user) return;
    setPaying(newPlan);
    const p = getPlan(newPlan);
    const sessionId = `cs_test_${Math.random().toString(36).slice(2, 12)}`;
    setLog((l) => [`→ Initiating Stripe Checkout for ${p.name} ($${p.priceMonthly}/mo)...`, ...l]);

    // Simulate the user completing Stripe Checkout, then the webhook firing.
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;
    try {
      setLog((l) => ['→ Stripe session created: ' + sessionId, ...l]);
      setLog((l) => ['→ Simulating checkout.session.completed webhook...', ...l]);
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'checkout.session.completed',
          tenant_id: activeTenant.id,
          plan: newPlan,
          amount: p.priceMonthly,
          currency: 'USD',
          stripe_session_id: sessionId,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      setLog((l) => ['✓ Webhook received — tenant status → active', ...l]);
      setLog((l) => [`✓ Invoice recorded ($${p.priceMonthly} USD, plan=${newPlan})`, ...l]);
      await refresh();
      setLog((l) => ['✓ Tenant reloaded. Subscription active.', ...l]);
    } catch (err) {
      setLog((l) => [`✗ Error: ${err instanceof Error ? err.message : String(err)}`, ...l]);
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
      <div className="section py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('dash.subscription')}</h1>
            <p className="text-slate-500 dark:text-white/50 text-sm mt-1">{activeTenant.name}</p>
          </div>
          <Link to="/dashboard" className="btn-ghost text-sm">← {t('dash.dashboard')}</Link>
        </div>

        {/* Status card */}
        <div className={`card p-6 mb-6 ${isBlocked ? 'border-amber-300 dark:border-amber-500/40' : ''}`}>
          {isBlocked && (
            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {t('sub.trial.expired')}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-white/40">{t('sub.status')}</div>
              <div className="mt-1 flex items-center gap-2">
                {isTrial && <Badge color="amber">{t('sub.trial')}</Badge>}
                {activeTenant.status === 'active' && <Badge color="emerald">{t('sub.active')}</Badge>}
                {isSuspended && <Badge color="rose">{t('sub.suspended')}</Badge>}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-white/40">{t('sub.plan')}</div>
              <div className="mt-1 text-slate-900 dark:text-white font-semibold">{plan.name}</div>
              <div className="text-slate-500 dark:text-white/50 text-xs">{plan.employeeLimit ?? '∞'} {t('pricing.employees').toLowerCase()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-white/40">{isTrial ? t('sub.trial.ends') : t('sub.renewal')}</div>
              <div className="mt-1 text-slate-900 dark:text-white font-semibold">
                {isTrial
                  ? (trialEnds ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : '—')
                  : (activeTenant.current_period_end ? new Date(activeTenant.current_period_end).toLocaleDateString() : '—')}
              </div>
            </div>
          </div>
        </div>

        {/* Plan grid */}
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">{t('sub.upgrade')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PLANS.map((p) => {
            const current = p.id === activeTenant.plan;
            return (
              <div key={p.id} className={`card p-5 flex flex-col ${p.highlight ? 'border-coral-400 shadow-glow' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-900 dark:text-white font-display font-bold">{p.name}</h3>
                  {current && <Badge color="coral">Actuel</Badge>}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">${p.priceMonthly}<span className="text-sm text-slate-400 dark:text-white/40">/mo</span></div>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600 dark:text-white/70">
                      <Check size={14} className="text-coral-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => simulateCheckout(p.id)}
                  disabled={current || paying !== null}
                  className={`mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition ${current ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40 cursor-not-allowed' : p.highlight ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {paying === p.id ? <Spinner /> : current ? 'Plan actuel' : `${t('sub.paynow')} →`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Webhook log */}
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-3">
            <Zap size={16} className="text-coral-500" /> {t('sub.webhook')}
          </div>
          <div className="rounded-xl bg-slate-900 dark:bg-ink-900 border border-slate-200 dark:border-white/10 p-3 font-mono text-xs space-y-1 min-h-[80px]">
            {log.length === 0 ? (
              <div className="text-slate-500">{t('sub.checkout.waiting')}</div>
            ) : log.map((line, i) => (
              <div key={i} className={line.startsWith('✓') ? 'text-emerald-300' : line.startsWith('✗') ? 'text-rose-300' : 'text-slate-300'}>{line}</div>
            ))}
          </div>
        </div>

        {/* Invoice history */}
        <div className="card p-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold mb-3">
            <Receipt size={16} className="text-coral-500" /> {t('sub.invoices')}
          </div>
          {loading ? (
            <div className="text-slate-400 dark:text-white/40 text-sm py-4"><Spinner /> Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="text-slate-400 dark:text-white/40 text-sm py-4">{t('sub.invoices.none')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 dark:text-white/50 text-xs uppercase">
                  <tr>
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Plan</th>
                    <th className="text-left py-2 font-medium">Montant</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-100 dark:border-white/10">
                      <td className="py-2.5 text-slate-700 dark:text-white/70">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-slate-700 dark:text-white/70 capitalize">{inv.plan}</td>
                      <td className="py-2.5 text-slate-700 dark:text-white/70">${inv.amount} {inv.currency}</td>
                      <td className="py-2.5"><Badge color={inv.status === 'paid' ? 'emerald' : 'amber'}>{inv.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
