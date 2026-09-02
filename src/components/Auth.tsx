import { useState, type FormEvent } from 'react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { Link, navigate, useRoute } from '../lib/router';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Spinner } from './ui';
import { ArrowRight, ShieldCheck, Sparkles, Building2, Mail } from 'lucide-react';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/icon-192.png" alt="Faka" className="w-9 h-9 rounded-xl shadow-glow" />
      <span className="font-display text-xl font-bold text-slate-900 dark:text-white">Faka</span>
    </Link>
  );
}

function parseQuery(hash: string): Record<string, string> {
  const q = hash.split('?')[1];
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const pair of q.split('&')) {
    const [k, v] = pair.split('=');
    if (k) out[k] = decodeURIComponent(v ?? '');
  }
  return out;
}

export function AuthScreen() {
  const route = useRoute();
  const isSignup = route.startsWith('/signup');
  const query = parseQuery(route);
  const prefilledPlan = query.plan;
  const prefilledEmail = query.email ?? '';

  const { t } = useI18n();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setGoogleLoading(false);
    }
    // On success the browser navigates away to Google, then back — no
    // further action needed here.
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        const { error, user } = await signUp(email, password, fullName);
        if (error) {
          setError(error);
        } else if (user) {
          if (prefilledPlan) sessionStorage.setItem('faka_signup_plan', prefilledPlan);
          setShowGate(true);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) setError(error);
        else navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }

  if (showGate) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-70 dark:opacity-40" style={{
          backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(226,58,80,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(45,212,191,0.15), transparent 50%)',
        }} />
        <div className="relative section py-8"><Logo /></div>
        <div className="relative section flex items-center justify-center py-12">
          <div className="card w-full max-w-lg p-8 animate-scale-in text-center">
            <div className="w-16 h-16 rounded-2xl bg-coral-100 dark:bg-coral-500/15 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-400 mx-auto mb-5">
              <Sparkles size={28} />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('gate.title')}</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm mb-8">{t('gate.subtitle')}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/onboarding')}
                className="group card p-6 flex flex-col items-center gap-3 hover:border-coral-400 hover:shadow-glow transition cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 group-hover:scale-110 transition">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">{t('gate.company')}</div>
                  <div className="text-slate-400 dark:text-white/40 text-xs mt-1">Créez votre espace RH</div>
                </div>
              </button>
              <button
                onClick={() => navigate('/activate')}
                className="group card p-6 flex flex-col items-center gap-3 hover:border-teal-400 hover:shadow-md transition cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/15 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-110 transition">
                  <Mail size={24} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">{t('gate.invited')}</div>
                  <div className="text-slate-400 dark:text-white/40 text-xs mt-1">Entrez votre code d'accès</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-ink-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 dark:opacity-40" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(226,58,80,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(45,212,191,0.15), transparent 50%)',
      }} />
      <div className="relative section py-8">
        <Logo />
      </div>
      <div className="relative section flex items-center justify-center py-12">
        <div className="card w-full max-w-md p-8 animate-scale-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 px-3 py-1 text-xs text-coral-700 dark:text-coral-300 mb-5">
            <Sparkles size={14} /> {isSignup ? t('auth.signup') : t('auth.signin')}
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {isSignup ? t('auth.signup') : t('auth.signin')}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
            {isSignup ? t('auth.noaccount') : t('auth.haveaccount')}{' '}
            <Link to={isSignup ? '/signin' : '/signup'} className="text-coral-600 hover:text-coral-500 font-medium">
              {isSignup ? t('auth.signin.here') : t('auth.signup.here')}
            </Link>
          </p>

          {!isSupabaseConfigured && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              Mode démo : Supabase n'est pas configuré. L'inscription crée un compte local simulé.
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-full border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-white/80 transition-colors disabled:opacity-60"
          >
            {googleLoading ? <Spinner /> : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
                </svg>
                {t('auth.google')}
              </>
            )}
          </button>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs text-slate-400 dark:text-white/40">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {isSignup && (
              <div>
                <label className="label">{t('auth.fullname')}</label>
                <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aïssa Bello" />
              </div>
            )}
            <div>
              <label className="label">{t('auth.email')}</label>
              <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aissa@entreprise.com" />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? <Spinner /> : (isSignup ? t('auth.signup.cta') : t('auth.signin.cta'))}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-white/40">
            <ShieldCheck size={14} className="text-coral-500" />
            Isolation multi-tenant via Supabase RLS (tenant_id)
          </div>
        </div>
      </div>
    </div>
  );
}

export async function createTenantForUser(_userId: string, data: {
  name: string; subdomain: string; industry: string; company_size: string;
  country: string; region: string; city: string; region_custom?: string | null; city_custom?: string | null;
  currency: string; timezone: string; phone_code: string; sales_code?: string;
  payment_methods: string[]; plan: string;
}) {
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tenant`;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      name: data.name, subdomain: data.subdomain, industry: data.industry,
      company_size: data.company_size, country: data.country, region: data.region,
      city: data.city, region_custom: data.region_custom ?? null,
      city_custom: data.city_custom ?? null, currency: data.currency,
      timezone: data.timezone, phone_code: data.phone_code,
      sales_code: data.sales_code, payment_methods: data.payment_methods, plan: data.plan,
    }),
  });

  let json: Record<string, unknown> | null = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok || !json || json.ok === false) {
    const code = (json?.error as string) ?? 'UNKNOWN';
    const mapped = mapErrorCode(code);
    // Surface the real detail from the edge function instead of hiding it
    const detail = (json?.detail as string) ?? '';
    if (mapped === 'unknown' && detail) {
      throw new Error(detail);
    }
    throw new Error(`tenant.error.${mapped}`);
  }

  return json;
}

function mapErrorCode(code: string): string {
  switch (code) {
    case 'UNAUTHORIZED': return 'unauthorized';
    case 'MISSING_FIELDS': return 'missing';
    case 'TENANT_CREATE_FAILED': return 'create';
    case 'MEMBERSHIP_CREATE_FAILED': return 'membership';
    case 'SUBDOMAIN_TAKEN': return 'subdomain_taken';
    case 'INTERNAL_ERROR': return 'unknown';
    default: return 'unknown';
  }
}
