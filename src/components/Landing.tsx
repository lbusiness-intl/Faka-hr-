import { useState, useEffect, useRef } from 'react';
import {
  Users, Wallet, BarChart3, MessageSquare, ShieldCheck, Globe2,
  Check, Star, Menu, X, ArrowRight, Sparkles, Moon, Sun,
  Briefcase, UserCog,
  TrendingUp, Clock, Download,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Link, navigate } from '../lib/router';
import { PLANS, recommendPlan, type PlanId } from '../lib/plans';

function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: React.ReactNode; delay?: number; className?: string; as?: React.ElementType }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={`${visible ? 'animate-slide-up' : 'opacity-0'} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
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

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icon-192.png" alt="Faka" className="w-9 h-9 rounded-xl shadow-glow" />
      <span className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">Faka</span>
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

function DashboardMockup() {
  return (
    <div className="card p-0 overflow-hidden shadow-2xl border border-slate-200/60 dark:border-white/10">
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-ink-800/60">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-400/70" />
          <div className="w-3 h-3 rounded-full bg-amber-400/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
        </div>
        <div className="ml-3 flex-1 rounded-md bg-white dark:bg-ink-700/50 border border-slate-200 dark:border-white/10 px-3 py-1 text-[10px] text-slate-400">
          faka.app/dashboard
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5 bg-white dark:bg-ink-900">
        {/* Top row: greeting + avatar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-slate-900 dark:text-white font-display font-bold text-base">Good morning, Aïcha</div>
            <div className="text-xs text-slate-400">Tuesday, August 1, 2026</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-coral-100 dark:bg-coral-500/15 flex items-center justify-center text-coral-600 dark:text-coral-400 font-bold text-xs">AD</div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400"><Download size={14} /></div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Headcount', value: '248', delta: '+12', icon: Users, color: 'coral' },
            { label: 'Payroll', value: '$182K', delta: '+3.2%', icon: Wallet, color: 'teal' },
            { label: 'Pending', value: '7', delta: '−2', icon: Clock, color: 'indigo' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 dark:bg-ink-800/50 border border-slate-200 dark:border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  s.color === 'coral' ? 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' :
                  s.color === 'teal' ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400' :
                  'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
                }`}>
                  <s.icon size={14} />
                </div>
                <span className="text-[9px] font-semibold text-emerald-500">{s.delta}</span>
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Chart + side panel */}
        <div className="grid grid-cols-3 gap-3">
          {/* Chart */}
          <div className="col-span-2 rounded-xl bg-slate-50 dark:bg-ink-800/50 border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-white/70">Payroll Cost — 6 months</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                <TrendingUp size={11} /> +8.4%
              </div>
            </div>
            <div className="flex items-end gap-2 h-24">
              {[45, 58, 50, 72, 65, 88].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-gradient-to-t from-coral-500/80 to-coral-400 transition-all hover:from-coral-500 hover:to-coral-300" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-slate-400">{['Mar','Apr','May','Jun','Jul','Aug'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side panel — recent activity */}
          <div className="rounded-xl bg-slate-50 dark:bg-ink-800/50 border border-slate-200 dark:border-white/10 p-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-white/70 mb-3">Recent</div>
            <div className="space-y-2.5">
              {[
                { name: 'John M.', action: 'Leave approved', color: 'emerald' },
                { name: 'Sarah K.', action: 'Payslip generated', color: 'coral' },
                { name: 'Mike T.', action: 'Onboarding', color: 'indigo' },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    a.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' :
                    a.color === 'coral' ? 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' :
                    'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
                  }`}>
                    {a.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-700 dark:text-white/70 truncate">{a.name}</div>
                    <div className="text-[9px] text-slate-400 truncate">{a.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-sage-50 dark:bg-ink-900">
      <div className="absolute inset-0 opacity-70 dark:opacity-40" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(255,107,53,0.15), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(45,212,191,0.12), transparent 50%)',
      }} />
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }} />
      <div className="relative section pt-20 pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 px-3 py-1.5 text-xs text-coral-700 dark:text-coral-300 mb-6">
            <Sparkles size={14} /> {t('app.badge')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-slate-900 dark:text-white leading-[1.08] tracking-tight">
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
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-white/50">
            <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> {t('pricing.trial')}</div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-500" /> GDPR / ISO 27001 ready</div>
            <div className="flex items-center gap-2"><Globe2 size={16} className="text-emerald-500" /> FR / EN</div>
          </div>
        </div>
        <div className="relative animate-scale-in">
          <DashboardMockup />
          {/* Floating cards */}
          <div className="absolute -bottom-5 -left-5 card p-3.5 w-52 hidden sm:block animate-float">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Check size={14} />
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">Payroll approved</div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/50">248 employees · $182K net</div>
          </div>
          <div className="absolute -top-4 -right-4 card p-3 w-44 hidden sm:block animate-float" style={{ animationDelay: '1.2s' }}>
            <div className="flex items-center gap-2 text-coral-600 text-xs mb-1"><MessageSquare size={13} /> Employee chat</div>
            <div className="text-slate-700 dark:text-white/70 text-[11px]">"Can I see my payslip?"</div>
            <div className="mt-1.5 text-[10px] text-emerald-500 font-medium">Auto-replied in 0.3s</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoCloud() {
  const logos = ['Sonatel', 'LIYAH GROUP', 'Earth Scientific', 'Max Capital', 'Lagos Logistics', 'Atlas Corp', 'Sahara Tech', 'Gulf Trading'];
  return (
    <section className="border-y border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 py-10">
      <div className="section">
        <Reveal><p className="text-center text-xs uppercase tracking-widest text-slate-400 mb-6">Trusted by teams across Africa, the Middle East & beyond</p></Reveal>
        <Reveal delay={100}>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {logos.map((l) => (
            <span key={l} className="font-display text-lg font-bold text-slate-300 dark:text-white/20 hover:text-slate-400 dark:hover:text-white/40 transition">{l}</span>
          ))}
        </div>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  const items = [
    { icon: Briefcase, title: 'Core HR', desc: 'Contracts, onboarding, offboarding, e-signatures, document management.' },
    { icon: Wallet, title: 'Multichannel Payroll', desc: 'Bank transfer, Mobile Money, multi-currency — non-custodial, audit-ready.' },
    { icon: MessageSquare, title: 'Employee Self-Service', desc: 'Leave requests, advances, payslips via WhatsApp or web portal.' },
    { icon: BarChart3, title: 'HR Analytics', desc: 'Cost breakdown, absenteeism, performance — exportable to PDF/CSV.' },
    { icon: UserCog, title: 'Recruitment & LMS', desc: 'Kanban pipeline, training, certifications, 360° reviews.' },
    { icon: ShieldCheck, title: 'Compliance & Security', desc: 'Multi-tenant isolation (RLS), HR letters, audit trails, GDPR-ready.' },
  ];
  return (
    <section id="features" className="section py-24 bg-white dark:bg-ink-900">
      <Reveal className="text-center mb-14">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{t('features.title')}</h2>
        <p className="mt-3 text-slate-600 dark:text-white/60 max-w-2xl mx-auto">{t('features.subtitle')}</p>
      </Reveal>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((f, i) => (
          <Reveal key={f.title} delay={i * 80}>
          <div className="card p-6 hover:border-coral-300 hover:shadow-lg transition group h-full">
            <div className="w-11 h-11 rounded-xl bg-coral-100 text-coral-600 dark:bg-coral-500/10 dark:text-coral-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <f.icon size={22} />
            </div>
            <h3 className="font-display text-slate-900 dark:text-white font-bold text-lg">{f.title}</h3>
            <p className="mt-2 text-slate-600 dark:text-white/60 text-sm leading-relaxed">{f.desc}</p>
          </div>
          </Reveal>
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
      <Reveal className="text-center mb-12">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{t('pricing.title')}</h2>
        <p className="mt-3 text-slate-600 dark:text-white/60">{t('pricing.subtitle')}</p>
      </Reveal>

      <div className="flex items-center justify-center gap-4 mb-8">
        <span className={`text-sm ${!yearly ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{t('pricing.monthly')}</span>
        <button onClick={() => setYearly(!yearly)} className={`relative w-14 h-7 rounded-full transition ${yearly ? 'bg-coral-500' : 'bg-slate-200 dark:bg-white/15'}`}>
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${yearly ? 'translate-x-7' : ''}`} />
        </button>
        <span className={`text-sm ${yearly ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{t('pricing.yearly')}</span>
        <span className="badge bg-coral-100 text-coral-700 border border-coral-200">-2 months</span>
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
              {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-coral-500 text-white font-bold">Popular</div>}
              <h3 className="text-slate-900 dark:text-white font-display text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">${price}</span>
                <span className="text-slate-400 text-sm">{yearly ? t('pricing.peryear') : t('pricing.permonth')}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{plan.employeeLimit ? `≤ ${plan.employeeLimit} employees` : 'Unlimited employees'}</div>
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
    { name: 'Aïcha Diallo', role: 'CHRO, Sonatel (Senegal)', text: 'Faka cut our payroll processing time by 3x. The self-service portal transformed how our employees interact with HR.' },
    { name: 'Jean-Paul Kamga', role: 'CEO, LIYAH GROUP (Cameroon)', text: 'Finally an HR tool designed for our reality. Mobile Money, multi-currency, bilingual contracts — everything is there.' },
    { name: 'Funke Adeyemi', role: 'CFO, Lagos Logistics (Nigeria)', text: 'The multi-tenant isolation and analytics give us board-level visibility we never had before.' },
  ];
  return (
    <section id="testimonials" className="section py-24 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900">
      <Reveal className="text-center mb-12">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{t('testimonials.title')}</h2>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-5">
        {items.map((it, i) => (
          <Reveal key={it.name} delay={i * 100}>
          <div className="card p-6 hover:shadow-lg transition h-full">
            <div className="flex gap-1 mb-3 text-amber-400">
              {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p className="text-slate-700 dark:text-white/80 text-sm leading-relaxed">"{it.text}"</p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="text-slate-900 dark:text-white font-semibold text-sm">{it.name}</div>
              <div className="text-slate-400 text-xs">{it.role}</div>
            </div>
          </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  const { t } = useI18n();
  return (
    <section className="section py-20 bg-sage-50/40 dark:bg-ink-900 border-t border-slate-200 dark:border-white/10">
      <div className="card p-10 text-center max-w-2xl mx-auto bg-gradient-to-br from-coral-50 to-sage-50 dark:from-ink-800 dark:to-ink-700 border-coral-200 dark:border-white/10">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{t('hero.cta.start')}</h2>
        <p className="mt-3 text-slate-600 dark:text-white/60 text-sm max-w-md mx-auto">{t('hero.subtitle')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className="btn-primary">{t('hero.cta.start')} <ArrowRight size={18} /></Link>
          <Link to="/signin" className="btn-ghost">{t('hero.cta.demo')}</Link>
        </div>
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
          <p className="mt-3 text-xs text-slate-400">Developed by LiAfrik</p>
        </div>
        <div>
          <div className="text-slate-900 dark:text-white/80 font-semibold text-sm mb-3">Product</div>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-white/50">
            <li><a href="#features" className="hover:text-coral-600 transition">{t('nav.features')}</a></li>
            <li><a href="#pricing" className="hover:text-coral-600 transition">{t('nav.pricing')}</a></li>
            <li><Link to="/signin" className="hover:text-coral-600 transition">{t('nav.login')}</Link></li>
            <li><Link to="/signup" className="hover:text-coral-600 transition">{t('nav.cta')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-slate-900 dark:text-white/80 font-semibold text-sm mb-3">Company</div>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-white/50">
            <li><Link to="/page/about" className="hover:text-coral-600 transition">{t('footer.about')}</Link></li>
            <li><Link to="/page/contact" className="hover:text-coral-600 transition">{t('footer.contact')}</Link></li>
            <li><Link to="/page/privacy" className="hover:text-coral-600 transition">{t('footer.privacy')}</Link></li>
            <li><Link to="/page/terms" className="hover:text-coral-600 transition">{t('footer.terms')}</Link></li>
            <li><Link to="/page/security" className="hover:text-coral-600 transition">{t('footer.security')}</Link></li>
            <li><Link to="/page/status" className="hover:text-coral-600 transition">{t('footer.status')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-white/10">
        <div className="section py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500 dark:text-white/50">
          <div>{t('footer.tagline')}</div>
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
      <LogoCloud />
      <Features />
      <Pricing />
      <Testimonials />
      <CTASection />
      <Footer />
      <CookieBanner />
    </div>
  );
}
