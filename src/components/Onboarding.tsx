import { useState, useEffect } from 'react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { createTenantForUser } from './Auth';
import { COUNTRIES, PAYMENT_METHODS } from '../lib/geo';
import { Spinner } from './ui';
import { Building2, MapPin, CreditCard, ArrowRight, ArrowLeft, Check, Moon, Sun } from 'lucide-react';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icon-192.png" alt="Faka" className="w-9 h-9 rounded-xl shadow-glow" />
      <span className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">Faka</span>
    </div>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('faka_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('faka_theme', dark ? 'dark' : 'light');
  }, [dark]);
  const toggle = () => setDark((d) => !d);
  return { dark, toggle };
}

export default function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const { user, refresh } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('1-10');

  const [country, setCountry] = useState('CM');
  const [region, setRegion] = useState('');
  const [customRegion, setRegionCustom] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCityCustom] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [timezone, setTimezone] = useState('Africa/Douala');
  const [phoneCode, setPhoneCode] = useState('+237');
  const [salesCode, setSalesCode] = useState('');

  const [selectedPayments, setSelectedPayments] = useState<string[]>(['bank']);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) navigate('/signin');
  }, [user]);

  // Handle country defaults
  useEffect(() => {
    const selectedCountryInfo = COUNTRIES.find(c => c.code === country);
    if (selectedCountryInfo) {
      setCurrency(selectedCountryInfo.currency);
      setTimezone(selectedCountryInfo.timezone);
      setPhoneCode(selectedCountryInfo.phoneCode);
      setRegion('');
      setCity('');
      setRegionCustom('');
      setCityCustom('');
    }
  }, [country]);

  const activeCountryInfo = COUNTRIES.find(c => c.code === country);
  const regions = activeCountryInfo?.regions ?? [];
  const activeRegionInfo = regions.find(r => r.name === region);
  const cities = activeRegionInfo?.cities ?? [];

  // Toggle payment method selection
  const handlePaymentToggle = (id: string) => {
    setSelectedPayments(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim()) {
        setError(t('onboarding.error.missing'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const finalRegion = region === 'other' ? customRegion : region;
      const finalCity = city === 'other' ? customCity : city;
      if (!country || !finalRegion.trim() || !finalCity.trim() || !currency) {
        setError(t('onboarding.error.missing'));
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);

    const finalRegion = region === 'other' ? 'other' : region;
    const finalCity = city === 'other' ? 'other' : city;
    const regionCustomVal = region === 'other' ? customRegion.trim() : null;
    const cityCustomVal = city === 'other' ? customCity.trim() : null;

    try {
      const plan = sessionStorage.getItem('faka_signup_plan') || 'starter';
      await createTenantForUser(user.id, {
        name: name.trim(),
        subdomain: subdomain.trim(),
        industry: industry,
        company_size: companySize,
        country,
        region: finalRegion,
        city: finalCity,
        region_custom: regionCustomVal,
        city_custom: cityCustomVal,
        currency,
        timezone,
        phone_code: phoneCode,
        sales_code: salesCode.trim() || undefined,
        payment_methods: selectedPayments,
        plan,
      });

      // Clear the plan state
      sessionStorage.removeItem('faka_signup_plan');

      // Refresh authentication memberships
      await refresh();

      // Navigate to main workspace dashboard
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'onboarding.error.unknown';
      if (msg.startsWith('tenant.error.')) {
        setError(t(msg));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-ink-900 flex flex-col relative overflow-hidden transition-colors duration-200">
      {/* Background radial glow */}
      <div className="absolute inset-0 opacity-60 dark:opacity-30 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse at 10% 0%, rgba(226,58,80,0.12), transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(45,212,191,0.1), transparent 50%)',
      }} />

      {/* Header with theme / lang */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="w-9 h-9 rounded-full border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-600 dark:text-amber-300 hover:bg-white dark:hover:bg-white/5 transition">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="inline-flex rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-0.5 text-xs">
            <button onClick={() => setLang('fr')} className={`px-2.5 py-1 rounded-full font-medium transition ${lang === 'fr' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/70'}`}>FR</button>
            <button onClick={() => setLang('en')} className={`px-2.5 py-1 rounded-full font-medium transition ${lang === 'en' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/70'}`}>EN</button>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="card w-full max-w-xl p-8 shadow-glow animate-scale-in">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-white/10 -translate-y-1/2 z-0" />

            {([1, 2, 3] as const).map(s => {
              const active = step >= s;
              const current = step === s;
              return (
                <div key={s} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                    current ? 'bg-coral-500 text-white border-coral-500 shadow-glow' :
                    active ? 'bg-emerald-500 text-white border-emerald-500' :
                    'bg-white dark:bg-ink-800 text-slate-400 dark:text-white/30 border-slate-200 dark:border-white/10'
                  }`}>
                    {active && s < step ? <Check size={16} /> : s}
                  </div>
                  <span className={`text-[11px] font-medium mt-1.5 uppercase tracking-wider ${current ? 'text-coral-500 font-bold' : 'text-slate-400'}`}>
                    {t(`onboarding.step${s}`)}
                  </span>
                </div>
              );
            })}
          </div>

          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white text-center mb-6">
            {t('onboarding.title')}
          </h1>

          {error && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-3.5 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* STEP 1: Company Profile */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-coral-500 uppercase tracking-wider">
                <Building2 size={16} /> {t('onboarding.step1')}
              </div>
              <div>
                <label className="label">{t('onboarding.company.name')} *</label>
                <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Sonatel" />
              </div>
              <div>
                <label className="label">{t('onboarding.company.subdomain')}</label>
                <div className="relative">
                  <input className="input pr-20" value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="sonatel" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">.faka.app</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.company.industry')}</label>
                  <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
                    <option value="" className="bg-white dark:bg-ink-700">—</option>
                    <option value="tech" className="bg-white dark:bg-ink-700">Technology</option>
                    <option value="finance" className="bg-white dark:bg-ink-700">Finance & Banking</option>
                    <option value="retail" className="bg-white dark:bg-ink-700">Retail & Commerce</option>
                    <option value="logistics" className="bg-white dark:bg-ink-700">Logistics & Transport</option>
                    <option value="telecom" className="bg-white dark:bg-ink-700">Telecommunications</option>
                    <option value="other" className="bg-white dark:bg-ink-700">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('onboarding.company.size')}</label>
                  <select className="input" value={companySize} onChange={e => setCompanySize(e.target.value)}>
                    <option value="1-10" className="bg-white dark:bg-ink-700">1 - 10 employees</option>
                    <option value="11-50" className="bg-white dark:bg-ink-700">11 - 50 employees</option>
                    <option value="51-200" className="bg-white dark:bg-ink-700">51 - 200 employees</option>
                    <option value="201-500" className="bg-white dark:bg-ink-700">201 - 500 employees</option>
                    <option value="500+" className="bg-white dark:bg-ink-700">500+ employees</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Location & Geo Defaults */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-coral-500 uppercase tracking-wider">
                <MapPin size={16} /> {t('onboarding.step2')}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.country')} *</label>
                  <select className="input" value={country} onChange={e => setCountry(e.target.value)}>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code} className="bg-white dark:bg-ink-700">
                        {lang === 'fr' ? c.nameFr : c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('onboarding.region')} *</label>
                  {regions.length > 0 ? (
                    <select className="input" value={region} onChange={e => setRegion(e.target.value)}>
                      <option value="" className="bg-white dark:bg-ink-700">—</option>
                      {regions.map(r => (
                        <option key={r.name} value={r.name} className="bg-white dark:bg-ink-700">{r.name}</option>
                      ))}
                      <option value="other" className="bg-white dark:bg-ink-700">{t('onboarding.region.other')}</option>
                    </select>
                  ) : (
                    <input className="input" value={customRegion} onChange={e => { setRegion('other'); setRegionCustom(e.target.value); }} placeholder="Région" />
                  )}
                </div>
              </div>

              {region === 'other' && regions.length > 0 && (
                <div>
                  <label className="label">Saisir la Région / Province *</label>
                  <input className="input animate-fade-in" value={customRegion} onChange={e => setRegionCustom(e.target.value)} placeholder="Centre-Sud" />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.city')} *</label>
                  {region && region !== 'other' && cities.length > 0 ? (
                    <select className="input" value={city} onChange={e => setCity(e.target.value)}>
                      <option value="" className="bg-white dark:bg-ink-700">—</option>
                      {cities.map(c => (
                        <option key={c} value={c} className="bg-white dark:bg-ink-700">{c}</option>
                      ))}
                      <option value="other" className="bg-white dark:bg-ink-700">{t('onboarding.city.other')}</option>
                    </select>
                  ) : (
                    <input className="input" value={city === 'other' ? customCity : city} onChange={e => { setCity('other'); setCityCustom(e.target.value); }} placeholder="Ville" />
                  )}
                </div>
                {city === 'other' && region && region !== 'other' && cities.length > 0 && (
                  <div>
                    <label className="label">Saisir la Ville *</label>
                    <input className="input animate-fade-in" value={customCity} onChange={e => setCityCustom(e.target.value)} placeholder="Ma ville" />
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">{t('onboarding.currency')} *</label>
                  <input className="input opacity-70 bg-slate-50 dark:bg-ink-700 cursor-not-allowed" value={currency} disabled />
                  <span className="text-[10px] text-slate-400 mt-1 block">{t('onboarding.currency.locked')}</span>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">{t('onboarding.timezone')}</label>
                  <input className="input opacity-70 bg-slate-50 dark:bg-ink-700 cursor-not-allowed" value={timezone} disabled />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('onboarding.phonecode')}</label>
                  <input className="input opacity-70 bg-slate-50 dark:bg-ink-700 cursor-not-allowed" value={phoneCode} disabled />
                </div>
                <div>
                  <label className="label">{t('onboarding.salescode')}</label>
                  <input className="input" value={salesCode} onChange={e => setSalesCode(e.target.value)} placeholder="FAKA-100" />
                  <span className="text-[10px] text-slate-400 mt-1 block">{t('onboarding.salescode.hint')}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Payments & Confirmation */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-coral-500 uppercase tracking-wider">
                <CreditCard size={16} /> {t('onboarding.step3')}
              </div>
              <label className="label">{t('onboarding.payments')}</label>

              <div className="grid sm:grid-cols-2 gap-2.5">
                {PAYMENT_METHODS.map(p => {
                  const isSelected = selectedPayments.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePaymentToggle(p.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-sm text-left font-medium transition-all ${
                        isSelected
                          ? 'border-coral-500 bg-coral-500/10 text-coral-700 dark:text-coral-300'
                          : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      {lang === 'fr' ? p.labelFr : p.labelEn}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-coral-500 border-coral-500 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 flex justify-between gap-3">
            {step > 1 ? (
              <button onClick={handleBack} disabled={loading} className="btn-ghost text-sm">
                <ArrowLeft size={16} /> {t('common.back')}
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button onClick={handleNext} className="btn-primary text-sm ml-auto">
                {t('common.next')} <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading || selectedPayments.length === 0} className="btn-primary text-sm ml-auto">
                {loading ? <Spinner /> : <>{t('onboarding.finish')} <Check size={16} /></>}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
