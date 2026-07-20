import { useState } from 'react';
import {
  Building2, Users, Wallet, BarChart3, MessageSquare, ShieldCheck, Globe2,
  Check, Star, Menu, X, ArrowRight, Sparkles, Moon, Sun,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Link, navigate } from '../lib/router';
import { PLANS, recommendPlan, type PlanId } from '../lib/plans';

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('faka_theme') === 'dark');
  const toggle = () => setDark((d) => {
    const next = !d;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('faka_theme', next ? 'dark' : 'light');
    return next;
  });
  return { dark, toggle };
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-coral-500 flex items-center justify-center shadow-glow">
        <span className="text-white font-bold text-lg">F</span>
      </div>
      <span className="font-display text-xl font-bold text-slate-900 dark:text-white">Faka</span>
    </div>
  );
}

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-0.5 text-xs">
      <button onClick={() => setLang('fr')} className={`px-2.5 py-1 rounded-md font-medium transition ${lang === 'fr' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/70'}`}>FR</button>
      <button onClick={() => setLang('en')} className={`px-2.5 py-1 rounded-md font-medium transition ${lang === 'en' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/70'}`}>EN</button>
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-ink-900/80 border-b border-slate-200 dark:border-white/10">
      <div className="section flex items-center justify-between h-16">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600 dark:text-white/70">
          <a href="#features" className="hover:text-coral-600 transition">{t('nav.features')}</a>
          <a href="#pricing" className="hover:text-coral-600 transition">{t('nav.pricing')}</a>
          <a href="#testimonials" className="hover:text-coral-600 transition">{t('nav.testimonials')}</a>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={toggle} className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-600 dark:text-amber-300">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <LangSwitch />
          <Link to="/signin" className="btn-ghost text-sm">{t('nav.login')}</Link>
          <Link to="/signup" className="btn-primary text-sm">{t('nav.cta')}</Link>
        </div>
        <button className="md:hidden text-slate-600" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-6 py-4 space-y-3">
          <a href="#features" onClick={() => setOpen(false)} className="block text-slate-700 dark:text-white/80">{t('nav.features')}</a>
          <a href="#pricing" onClick={() => setOpen(false)} className="block text-slate-700 dark:text-white/80">{t('nav.pricing')}</a>
          <a href="#testimonials" onClick={() => setOpen(false)} className="block text-slate-700 dark:text-white/80">{t('nav.testimonials')}</a>
          <div className="flex gap-3 pt-2">
            <Link to="/signin" className="btn-ghost flex-1 text-sm">{t('nav.login')}</Link>
            <Link to="/signup" className="btn-primary flex-1 text-sm">{t('nav.cta')}</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-sage-50 dark:bg-ink-900">
      <div className="absolute inset-0 opacity-70 dark:opacity-40" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(255,107,53,0.18), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(45,212,191,0.15), transparent 50%)',
      }} />
      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.025]" style={{
        backgroundImage: 'linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      <div className="relative section pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 px-3 py-1.5 text-xs text-coral-700 dark:text-coral-300 mb-6">
            <Sparkles size={14} /> {t('app.badge')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-[1.1] tracking-tight">
            {t('hero.title')}
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-white/70 leading-relaxed max-w-xl">
            {t('hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">
              {t('hero.cta.start')} <ArrowRight size={18} />
            </Link>
            <Link to="/signin" className="btn-ghost">
              {t('hero.cta.demo')}
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-slate-500 dark:text-white/50">
            <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> {t('pricing.trial')}</div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-500" /> RLS Supabase</div>
            <div className="flex items-center gap-2"><Globe2 size={16} className="text-emerald-500" /> FR / EN</div>
          </div>
        </div>
        <div className="relative animate-scale-in">
          <div className="card p-5 animate-float">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-rose-400/70" />
              <div className="w-3 h-3 rounded-full bg-amber-400/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
              <div className="ml-3 text-xs text-slate-400">faka.app/dashboard</div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Employés', value: '128', color: 'text-coral-600' },
                { label: 'Paie (FCFA)', value: '42,1M', color: 'text-teal-600' },
                { label: 'Congés', value: '7', color: 'text-indigo-600' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-slate-50 dark:bg-ink-700/60 border border-slate-200 dark:border-white/10 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</div>
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-ink-700/60 border border-slate-200 dark:border-white/10 p-4">
              <div className="text-xs text-slate-500 dark:text-white/50 mb-3">Coût de paie — 6 mois</div>
              <div className="flex items-end gap-2 h-28">
                {[40, 55, 48, 70, 62, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-coral-500 to-coral-400" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 card p-4 w-48 hidden sm:block animate-float" style={{ animationDelay: '1.5s' }}>
            <div className="flex items-center gap-2 text-coral-600 text-xs mb-1"><MessageSquare size={14} /> WhatsApp</div>
            <div className="text-slate-700 dark:text-white/70 text-xs">"Mon bulletin du mois ?"</div>
            <div className="mt-2 text-[10px] text-slate-400">Réponse auto envoyée</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  const items = [
    { icon: Building2, title: 'Core HR', desc: 'Contrats, onboarding, offboarding, documents signés.' },
    { icon: Wallet, title: 'Paie multicanal', desc: 'Virement, Orange Money, MTN, Wave, M-Pesa — non-custodial.' },
    { icon: MessageSquare, title: 'Self-service WhatsApp', desc: 'Congés, avances, bulletins — via un assistant simulé.' },
    { icon: BarChart3, title: 'Analytics RH', desc: 'Coûts, absentéisme, performance, exports PDF/CSV.' },
    { icon: Users, title: 'Recrutement & LMS', desc: 'Pipeline Kanban, formations, certificats, 360°.' },
    { icon: ShieldCheck, title: 'Conformité & RLS', desc: 'Isolation multi-tenant stricte, lettres RH, audits.' },
  ];
  return (
    <section id="features" className="section py-24 bg-white dark:bg-ink-900">
      <div className="text-center mb-14">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{t('features.title')}</h2>
        <p className="mt-3 text-slate-600 dark:text-white/60 max-w-2xl mx-auto">{t('features.subtitle')}</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((f) => (
          <div key={f.title} className="card p-6 hover:border-coral-300 transition group">
            <div className="w-11 h-11 rounded-xl bg-coral-100 text-coral-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <f.icon size={22} />
            </div>
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg">{f.title}</h3>
            <p className="mt-2 text-slate-600 dark:text-white/60 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useI18n();
  const [yearly, setYearly] = useState(false);
  const [employees, setEmployees] = useState(25);
  const recommended = recommendPlan(employees);

  function startCheckout(planId: PlanId) {
    const plan = PLANS.find((p) => p.id === planId)!;
    const price = yearly ? plan.priceYearly : plan.priceMonthly;
    navigate(`/signup?plan=${planId}&yearly=${yearly}&price=${price}`);
  }

  return (
    <section id="pricing" className="section py-24 border-t border-slate-200 dark:border-white/10 bg-sage-50/40 dark:bg-ink-900">
      <div className="text-center mb-12">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{t('pricing.title')}</h2>
        <p className="mt-3 text-slate-600 dark:text-white/60">{t('pricing.subtitle')}</p>
      </div>

      <div className="flex items-center justify-center gap-4 mb-8">
        <span className={`text-sm ${!yearly ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{t('pricing.monthly')}</span>
        <button onClick={() => setYearly(!yearly)} className={`relative w-14 h-7 rounded-full transition ${yearly ? 'bg-coral-500' : 'bg-slate-200 dark:bg-white/15'}`}>
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${yearly ? 'translate-x-7' : ''}`} />
        </button>
        <span className={`text-sm ${yearly ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{t('pricing.yearly')}</span>
        <span className="badge bg-coral-100 text-coral-700 border border-coral-200">-2 mois</span>
      </div>

      <div className="max-w-md mx-auto mb-10">
        <div className="flex justify-between text-sm text-slate-600 dark:text-white/60 mb-2">
          <span>{t('pricing.employees')}</span>
          <span className="text-slate-900 dark:text-white font-semibold">{employees}</span>
        </div>
        <input type="range" min={1} max={300} value={employees} onChange={(e) => setEmployees(Number(e.target.value))} className="w-full accent-coral-500" />
        <div className="mt-3 text-center text-sm text-slate-600 dark:text-white/60">
          {t('pricing.recommended')}: <span className="text-coral-600 font-semibold">{recommended.name}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const price = yearly ? plan.priceYearly : plan.priceMonthly;
          const isRec = recommended.id === plan.id;
          return (
            <div key={plan.id} className={`card p-6 relative flex flex-col transition ${plan.highlight ? 'border-coral-400 shadow-glow' : ''} ${isRec ? 'ring-2 ring-coral-300' : ''}`}>
              {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-coral-500 text-white font-bold">Populaire</div>}
              <h3 className="text-slate-900 dark:text-white font-display text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">${price}</span>
                <span className="text-slate-400 text-sm">{yearly ? t('pricing.peryear') : t('pricing.permonth')}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{plan.employeeLimit ? `≤ ${plan.employeeLimit} employés` : 'Employés illimités'}</div>
              <ul className="mt-5 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-white/70">
                    <Check size={16} className="text-coral-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => startCheckout(plan.id)} className={`mt-6 w-full rounded-xl px-4 py-2.5 font-semibold text-sm transition ${plan.highlight ? 'btn-primary' : 'btn-ghost'}`}>
                {t('pricing.cta')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Testimonials() {
  const { t } = useI18n();
  const items = [
    { name: 'Aïcha Diallo', role: 'DRH, Sonatel (Sénégal)', text: 'Faka a divisé notre temps de paie par 3. Le self-service WhatsApp a transformé notre relation avec les employés.' },
    { name: 'Jean-Paul Kamga', role: 'CEO, Bandjoun Industries (Cameroun)', text: 'Enfin un outil RH pensé pour nos réalités. Mobile Money, FCFA, contrats bilingues — tout est là.' },
    { name: 'Funke Adeyemi', role: 'CFO, Lagos Logistics (Nigeria)', text: 'The multi-tenant isolation and analytics give us board-level visibility we never had before.' },
  ];
  return (
    <section id="testimonials" className="section py-24 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900">
      <div className="text-center mb-12">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{t('testimonials.title')}</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {items.map((it) => (
          <div key={it.name} className="card p-6">
            <div className="flex gap-1 mb-3 text-amber-400">
              {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p className="text-slate-700 dark:text-white/80 text-sm leading-relaxed">"{it.text}"</p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="text-slate-900 dark:text-white font-semibold text-sm">{it.name}</div>
              <div className="text-slate-400 text-xs">{it.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-sage-50 dark:bg-ink-900">
      <div className="section py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-slate-500 dark:text-white/50 text-sm max-w-sm">{t('app.tagline')}.</p>
        </div>
        <div>
          <div className="text-slate-900 dark:text-white/80 font-semibold text-sm mb-3">Produit</div>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-white/50">
            <li><a href="#features" className="hover:text-coral-600 transition">{t('nav.features')}</a></li>
            <li><a href="#pricing" className="hover:text-coral-600 transition">{t('nav.pricing')}</a></li>
            <li><Link to="/signin" className="hover:text-coral-600 transition">{t('nav.login')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-slate-900 dark:text-white/80 font-semibold text-sm mb-3">Légal</div>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-white/50">
            <li><a href="#" className="hover:text-coral-600 transition">Mentions légales</a></li>
            <li><a href="#" className="hover:text-coral-600 transition">Confidentialité</a></li>
            <li><a href="#" className="hover:text-coral-600 transition">RGPD</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-white/10">
        <div className="section py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-400 dark:text-white/40">
          <div>© {new Date().getFullYear()} LIYAH GROUP. {t('footer.rights')}</div>
          <div className="text-slate-500 dark:text-white/50">{t('footer.developed')}</div>
        </div>
      </div>
    </footer>
  );
}

function CookieBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => localStorage.getItem('faka_cookies') === null);
  if (!visible) return null;
  function set(pref: 'all' | 'rejected') { localStorage.setItem('faka_cookies', pref); setVisible(false); }
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-40 animate-fade-in">
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-white/70">{t('cookies.text')}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => set('all')} className="btn-primary text-xs px-3 py-2">{t('cookies.accept')}</button>
          <button onClick={() => set('rejected')} className="btn-ghost text-xs px-3 py-2">{t('cookies.reject')}</button>
          <button onClick={() => set('rejected')} className="btn-ghost text-xs px-3 py-2">{t('cookies.customize')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-ink-900">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <Footer />
      <CookieBanner />
    </div>
  );
}
