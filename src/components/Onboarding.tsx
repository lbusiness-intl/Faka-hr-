import { useMemo, useState, type FormEvent } from 'react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { COUNTRIES, getCountry, PAYMENT_METHODS } from '../lib/geo';
import { PLANS, getPlan, type PlanId } from '../lib/plans';
import { createTenantForUser } from './Auth';
import { Spinner } from './ui';
import { Check, ChevronLeft, ChevronRight, Globe2, Building2, MapPin, CreditCard } from 'lucide-react';

const INDUSTRIES = [
  'Technologie', 'Finance', 'Agriculture', 'Manufacture', 'Commerce', 'Santé',
  'Éducation', 'Transport', 'Construction', 'Hôtellerie', 'Télécom', 'Autre',
];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function Onboarding() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initialPlan = (sessionStorage.getItem('faka_signup_plan') as PlanId) || 'pro';

  const [form, setForm] = useState({
    name: '', subdomain: '', industry: INDUSTRIES[0], company_size: SIZES[0],
    country: 'CM', region: '', city: '', region_custom: '', city_custom: '',
    currency: 'XAF', timezone: 'Africa/Douala', phone_code: '+237',
    sales_code: '',
    payment_methods: ['bank'] as string[],
    plan: initialPlan,
  });

  const country = getCountry(form.country);
  const regions = country?.regions ?? [];

  const regionIsOther = form.region === '__other__';
  const cityIsOther = form.city === '__other__';
  const cities = useMemo(() => {
    const r = regions.find((x) => x.name === form.region);
    return r?.cities ?? [];
  }, [regions, form.region]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onCountryChange(code: string) {
    const c = getCountry(code);
    if (c) {
      setForm((f) => ({
        ...f,
        country: code,
        currency: c.currency,
        timezone: c.timezone,
        phone_code: c.phoneCode,
        region: '',
        city: '',
        region_custom: '',
        city_custom: '',
      }));
    }
  }

  function onRegionChange(val: string) {
    setForm((f) => ({ ...f, region: val, city: '', region_custom: val === '__other__' ? f.region_custom : '', city_custom: '' }));
  }

  function togglePayment(id: string) {
    setForm((f) => ({
      ...f,
      payment_methods: f.payment_methods.includes(id)
        ? f.payment_methods.filter((x) => x !== id)
        : [...f.payment_methods, id],
    }));
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!user) throw new Error('No authenticated user');
      const finalRegion = regionIsOther ? form.region_custom : form.region;
      const finalCity = cityIsOther ? form.city_custom : form.city;
      if (!finalRegion || !finalCity) throw new Error('Region and city are required');
      await createTenantForUser(user.id, {
        name: form.name, subdomain: form.subdomain, industry: form.industry,
        company_size: form.company_size, country: form.country,
        region: finalRegion, city: finalCity,
        region_custom: regionIsOther ? form.region_custom : null,
        city_custom: cityIsOther ? form.city_custom : null,
        currency: form.currency, timezone: form.timezone, phone_code: form.phone_code,
        sales_code: form.sales_code, payment_methods: form.payment_methods, plan: form.plan,
      });
      sessionStorage.removeItem('faka_signup_plan');
      navigate('/dashboard');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // The edge function throws keys like "tenant.error.create"; translate
      // them. Never surface the raw Postgres/Supabase message.
      const key = raw.startsWith('tenant.error.') ? raw : 'tenant.error.unknown';
      setError(t(key));
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { n: 1, label: t('onboarding.step1'), icon: Building2 },
    { n: 2, label: t('onboarding.step2'), icon: MapPin },
    { n: 3, label: t('onboarding.step3'), icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-ink-900 relative">
      <div className="absolute inset-0 opacity-60 dark:opacity-30" style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.18), transparent 50%)',
      }} />
      <div className="relative section py-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('onboarding.title')}</h1>
          <div className="mt-6 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${step === s.n ? 'border-coral-400 bg-coral-50 dark:bg-coral-500/10' : step > s.n ? 'border-coral-200 bg-coral-50/50' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-coral-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-white/50'}`}>
                    {step > s.n ? <Check size={14} /> : s.n}
                  </div>
                  <span className={`text-xs hidden sm:inline ${step >= s.n ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-white/50'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`h-px flex-1 ${step > s.n ? 'bg-coral-300' : 'bg-slate-200 dark:bg-white/10'}`} />}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={finish} className="card p-6 space-y-5 animate-fade-in">
          {step === 1 && (
            <>
              <div>
                <label className="label">{t('onboarding.company.name')} *</label>
                <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Bandjoun Industries" />
              </div>
              <div>
                <label className="label">{t('onboarding.company.subdomain')}</label>
                <div className="flex items-center">
                  <input className="input rounded-r-none" value={form.subdomain} onChange={(e) => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="bandjoun" />
                  <span className="px-3 py-3 rounded-r-xl border border-l-0 border-white/10 bg-white/5 text-white/50 text-sm">.faka.app</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.company.industry')}</label>
                  <select className="input" value={form.industry} onChange={(e) => update('industry', e.target.value)}>
                    {INDUSTRIES.map((i) => <option key={i} value={i} className="bg-ink-700">{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('onboarding.company.size')}</label>
                  <select className="input" value={form.company_size} onChange={(e) => update('company_size', e.target.value)}>
                    {SIZES.map((s) => <option key={s} value={s} className="bg-ink-700">{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('sub.plan')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLANS.map((p) => (
                    <button
                      type="button" key={p.id}
                      onClick={() => update('plan', p.id)}
                      className={`rounded-xl border p-3 text-left transition ${form.plan === p.id ? 'border-coral-400 bg-coral-50 dark:bg-coral-500/10' : 'border-slate-200 dark:border-white/10 hover:border-coral-300'}`}
                    >
                      <div className="text-slate-900 dark:text-white font-semibold text-sm">{p.name}</div>
                      <div className="text-slate-400 dark:text-white/50 text-xs">${p.priceMonthly}/mo</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="label">{t('onboarding.country')} *</label>
                <select className="input" value={form.country} onChange={(e) => onCountryChange(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-ink-700">
                      {lang === 'fr' ? c.nameFr : c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.region')} *</label>
                  <select className="input" value={form.region} onChange={(e) => onRegionChange(e.target.value)}>
                    <option value="" className="bg-ink-700">—</option>
                    {regions.map((r) => <option key={r.name} value={r.name} className="bg-ink-700">{r.name}</option>)}
                    <option value="__other__" className="bg-ink-700">{t('onboarding.region.other')}</option>
                  </select>
                  {regionIsOther && (
                    <input className="input mt-2" placeholder={t('onboarding.region')} value={form.region_custom} onChange={(e) => update('region_custom', e.target.value)} required />
                  )}
                </div>
                <div>
                  <label className="label">{t('onboarding.city')} *</label>
                  <select className="input" value={form.city} onChange={(e) => update('city', e.target.value)} disabled={!form.region || regionIsOther}>
                    <option value="" className="bg-ink-700">—</option>
                    {cities.map((c) => <option key={c} value={c} className="bg-ink-700">{c}</option>)}
                    <option value="__other__" className="bg-ink-700">{t('onboarding.city.other')}</option>
                  </select>
                  {cityIsOther && (
                    <input className="input mt-2" placeholder={t('onboarding.city')} value={form.city_custom} onChange={(e) => update('city_custom', e.target.value)} required />
                  )}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">{t('onboarding.currency')}</label>
                  <input className="input opacity-70" value={form.currency} disabled />
                  <p className="text-[11px] text-white/40 mt-1">{t('onboarding.currency.locked')}</p>
                </div>
                <div>
                  <label className="label">{t('onboarding.timezone')}</label>
                  <input className="input opacity-70" value={form.timezone} disabled />
                </div>
                <div>
                  <label className="label">{t('onboarding.phonecode')}</label>
                  <input className="input opacity-70" value={form.phone_code} disabled />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="label">{t('onboarding.payments')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const active = form.payment_methods.includes(m.id);
                    return (
                      <button
                        type="button" key={m.id}
                        onClick={() => togglePayment(m.id)}
                        className={`rounded-xl border p-3 text-sm transition ${active ? 'border-coral-400 bg-coral-50 dark:bg-coral-500/10 text-coral-700 dark:text-white' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-coral-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border ${active ? 'bg-coral-500 border-coral-500' : 'border-slate-300 dark:border-white/30'}`}>
                            {active && <Check size={12} className="text-white" />}
                          </div>
                          {lang === 'fr' ? m.labelFr : m.labelEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">{t('onboarding.salescode')}</label>
                <input className="input" value={form.sales_code} onChange={(e) => update('sales_code', e.target.value)} placeholder="LIYAH-2026" />
                <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">{t('onboarding.salescode.hint')}</p>
              </div>
              <div className="rounded-xl border border-coral-200 bg-coral-50 dark:bg-coral-500/5 p-4 text-sm text-slate-700 dark:text-white/70">
                <div className="flex items-center gap-2 text-coral-700 dark:text-coral-300 font-medium mb-1">
                  <Globe2 size={16} /> {t('sub.trial')} — {getPlan(form.plan as PlanId).name}
                </div>
                {t('pricing.trial')}. {t('sub.plan')}: <span className="text-slate-900 dark:text-white font-semibold">{getPlan(form.plan as PlanId).name}</span> ({getPlan(form.plan as PlanId).employeeLimit ?? '∞'} {t('pricing.employees').toLowerCase()}).
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="btn-ghost text-sm disabled:opacity-40"
            >
              <ChevronLeft size={16} /> {t('common.previous')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                className="btn-primary text-sm"
                disabled={step === 1 && !form.name}
              >
                {t('common.next')} <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-60">
                {loading ? <Spinner /> : t('onboarding.finish')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
