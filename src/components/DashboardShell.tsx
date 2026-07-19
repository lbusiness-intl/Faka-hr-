import { type ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Wallet, CalendarClock, Banknote, Receipt, Clock,
  UserPlus, GraduationCap, Target, Star, Package, ShieldCheck,
  MessageSquare, CalendarDays, CreditCard, Settings as SettingsIcon, LogOut, Lock, Menu, X,
  Building2, ChevronDown, Moon, Sun, FileText,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { Link, navigate } from '../lib/router';
import { ALL_MODULES, getPlan, isModuleUnlocked, type ModuleKey, type PlanId } from '../lib/plans';
import { Modal, Badge } from './ui';

type NavItem = { key: ModuleKey; icon: typeof LayoutDashboard; label: string };

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
  return { dark, setDark };
}

export function DashboardShell({ children, role }: { children: ReactNode; role: 'admin' | 'employee' | 'super' }) {
  const { t, lang, setLang } = useI18n();
  const { activeTenant, user, signOut, memberships, setActiveTenantId } = useAuth();
  const { dark, setDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [lockedModule, setLockedModule] = useState<ModuleKey | null>(null);
  const [tenantMenu, setTenantMenu] = useState(false);

  const planId = (activeTenant?.plan ?? 'starter') as PlanId;

  const adminNav: NavItem[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('dash.dashboard') },
    { key: 'employees', icon: Users, label: t('dash.employees') },
    { key: 'payroll', icon: Wallet, label: t('dash.payroll') },
    { key: 'leaves', icon: CalendarClock, label: t('dash.leaves') },
    { key: 'advances', icon: Banknote, label: t('dash.advances') },
    { key: 'claims', icon: Receipt, label: t('dash.claims') },
    { key: 'attendance', icon: Clock, label: t('dash.attendance') },
    { key: 'recruitment', icon: UserPlus, label: t('dash.recruitment') },
    { key: 'training', icon: GraduationCap, label: t('dash.training') },
    { key: 'performance', icon: Target, label: t('dash.performance') },
    { key: 'goals', icon: Target, label: t('dash.goals') },
    { key: 'reviews', icon: Star, label: t('dash.reviews') },
    { key: 'assets', icon: Package, label: t('dash.assets') },
    { key: 'compliance', icon: ShieldCheck, label: t('dash.compliance') },
    { key: 'communication', icon: MessageSquare, label: t('dash.communication') },
    { key: 'events', icon: CalendarDays, label: t('dash.events') },
    { key: 'subscription', icon: CreditCard, label: t('dash.subscription') },
    { key: 'settings', icon: SettingsIcon, label: t('dash.settings') },
  ];

  const employeeNav: NavItem[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('emp.my_space') },
    { key: 'attendance', icon: Clock, label: t('dash.attendance') },
    { key: 'leaves', icon: CalendarClock, label: t('emp.leaves') },
    { key: 'advances', icon: Banknote, label: t('emp.advances') },
    { key: 'claims', icon: Receipt, label: t('emp.claims') },
    { key: 'assets', icon: Package, label: t('dash.assets') },
    { key: 'events', icon: CalendarDays, label: t('dash.events') },
    { key: 'communication', icon: MessageSquare, label: t('emp.whatsapp') },
    { key: 'subscription', icon: CreditCard, label: t('dash.subscription') },
  ];

  const nav = role === 'employee' ? employeeNav : adminNav;
  const plan = getPlan(planId);

  function handleNav(key: ModuleKey) {
    if (!isModuleUnlocked(planId, key)) {
      setLockedModule(key);
      return;
    }
    const base = role === 'employee' ? '/dashboard/employee' : '/dashboard/admin';
    navigate(`${base}/${key}`);
    setOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-white flex dark:bg-ink-900">
      {/* Sidebar — sage in light, deep sage in dark */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-sage-100 border-sage-200 dark:bg-sage-950 dark:border-white/10`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-sage-200 dark:border-white/10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-coral-500 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-display text-lg font-bold text-slate-900 dark:text-white">Faka</span>
          </Link>
          <button className="lg:hidden text-slate-500" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        {role !== 'super' && memberships.length > 1 && (
          <div className="px-3 pt-3 relative">
            <button
              onClick={() => setTenantMenu(!tenantMenu)}
              className="w-full flex items-center justify-between rounded-lg bg-white/70 dark:bg-white/5 border border-sage-200 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-white/80 hover:bg-white"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 size={14} /> {activeTenant?.name ?? 'Tenant'}
              </span>
              <ChevronDown size={14} />
            </button>
            {tenantMenu && (
              <div className="absolute left-3 right-3 mt-1 rounded-lg bg-white dark:bg-ink-700 border border-sage-200 dark:border-white/10 shadow-card z-10">
                {memberships.map((m) => (
                  <button
                    key={m.tenant_id}
                    onClick={() => { setActiveTenantId(m.tenant_id); setTenantMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-sage-50 dark:hover:bg-white/5 ${m.tenant_id === activeTenant?.id ? 'text-coral-600' : 'text-slate-700 dark:text-white/70'}`}
                  >
                    {m.tenant?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map((item) => {
            const unlocked = isModuleUnlocked(planId, item.key);
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition group ${
                  unlocked
                    ? 'text-slate-700 hover:text-coral-600 hover:bg-white dark:text-white/80 dark:hover:bg-white/5'
                    : 'text-slate-400 dark:text-white/35 hover:text-slate-500'
                }`}
              >
                <span className="flex items-center gap-3">
                  <item.icon size={16} />
                  {item.label}
                </span>
                {!unlocked && <Lock size={12} className="text-slate-300" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sage-200 dark:border-white/10 p-3">
          <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 mb-2">
            <div className="text-xs text-slate-500 dark:text-white/40">Plan</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-900 dark:text-white font-semibold text-sm">{plan.name}</span>
              <Badge color={activeTenant?.status === 'active' ? 'emerald' : activeTenant?.status === 'trial' ? 'amber' : 'rose'}>
                {activeTenant?.status === 'active' ? t('sub.active') : activeTenant?.status === 'trial' ? t('sub.trial') : t('sub.suspended')}
              </Badge>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-white/60 hover:text-coral-600 hover:bg-white dark:hover:bg-white/5">
            <LogOut size={16} /> {t('dash.logout')}
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main — white in light */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-ink-800/60 backdrop-blur-xl flex items-center justify-between px-5">
          <button className="lg:hidden text-slate-600" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div className="hidden sm:block text-sm text-slate-500 dark:text-white/50">
            {role === 'super' ? 'LIYAH GROUP — Super Admin' : activeTenant?.name}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-600 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-white/5"
              title={dark ? 'Mode clair' : 'Mode sombre'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-0.5 text-xs">
              <button onClick={() => setLang('fr')} className={`px-2 py-1 rounded-md ${lang === 'fr' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/60'}`}>FR</button>
              <button onClick={() => setLang('en')} className={`px-2 py-1 rounded-md ${lang === 'en' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/60'}`}>EN</button>
            </div>
            <div className="text-sm text-slate-600 dark:text-white/70 hidden sm:block">{user?.email}</div>
            <div className="w-8 h-8 rounded-full bg-coral-500 flex items-center justify-center text-white font-bold text-sm">
              {(user?.email ?? 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8 bg-slate-50 dark:bg-ink-900">
          {children}
        </main>
      </div>

      <Modal open={lockedModule !== null} onClose={() => setLockedModule(null)} title={
        <span className="flex items-center gap-2"><Lock size={18} className="text-coral-500" /> {t('lock.title', { plan: plan.name })}</span>
      }>
        <p className="text-slate-600 dark:text-white/60 text-sm mb-5">
          Ce module est verrouillé pour votre plan actuel (<span className="text-slate-900 dark:text-white font-semibold">{plan.name}</span>).
          Upgradez votre plan pour le débloquer.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setLockedModule(null)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={() => { setLockedModule(null); navigate('/subscription'); }} className="btn-primary text-sm">
            {t('lock.cta')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export { ALL_MODULES };
