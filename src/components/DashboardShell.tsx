import { type ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Wallet, CalendarClock, Banknote, Receipt, Clock,
  UserPlus, GraduationCap, Target, Star, Package, ShieldCheck,
  MessageSquare, CalendarDays, CreditCard, Settings as SettingsIcon, LogOut, Lock, Menu, X,
  Building2, ChevronDown, Moon, Sun, FileText, Home, AlertTriangle,
  GitBranch, Layers, Shield,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { Link, navigate, useRoute } from '../lib/router';
import { ALL_MODULES, getPlan, isModuleUnlocked, type ModuleKey, type PlanId } from '../lib/plans';
import { Modal, Badge } from './ui';
import { NotificationBell } from './NotificationBell';

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

  // Super admins (LIYAH GROUP platform team, and any staff they appoint via
  // the same app_metadata claim) never pay for a plan and always have full
  // access to every module, on every tenant they view — plan limits only
  // apply to actual paying customers. Trust ONLY the JWT app_metadata claim
  // here, never `memberships`: that table is writable by a tenant's own
  // admin to manage their own team, so it must never be treated as proof
  // of platform-wide super-admin status (see migration 0011/0012).
  const isSuperAdmin = user?.app_metadata?.role === 'super_admin';

  const trialEnded = activeTenant?.status === 'trial' && activeTenant?.trial_ends_at
    ? new Date(activeTenant.trial_ends_at).getTime() < Date.now()
    : false;
  const isBlocked = !isSuperAdmin && (activeTenant?.status === 'suspended' || trialEnded);

  const adminNav: NavItem[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: t('dash.dashboard') },
    { key: 'employees', icon: Users, label: t('dash.employees') },
    { key: 'payroll', icon: Wallet, label: t('dash.payroll') },
    { key: 'leaves', icon: CalendarClock, label: t('dash.leaves') },
    { key: 'advances', icon: Banknote, label: t('dash.advances') },
    { key: 'claims', icon: Receipt, label: t('dash.claims') },
    { key: 'attendance', icon: Clock, label: t('dash.attendance') },
    { key: 'overtime', icon: Clock, label: t('dash.overtime') },
    { key: 'documents', icon: FileText, label: t('dash.documents') },
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
    { key: 'overtime', icon: Clock, label: t('dash.overtime') },
    { key: 'leaves', icon: CalendarClock, label: t('emp.leaves') },
    { key: 'advances', icon: Banknote, label: t('emp.advances') },
    { key: 'claims', icon: Receipt, label: t('emp.claims') },
    { key: 'documents', icon: FileText, label: t('dash.documents') },
    { key: 'payslips', icon: Wallet, label: t('dash.payroll') },
    { key: 'assets', icon: Package, label: t('dash.assets') },
    { key: 'events', icon: CalendarDays, label: t('dash.events') },
    { key: 'communication', icon: MessageSquare, label: t('dash.communication') },
    { key: 'subscription', icon: CreditCard, label: t('dash.subscription') },
    { key: 'profile', icon: Users, label: 'Mon Profil' },
  ];

  const nav = role === 'employee' ? employeeNav : adminNav;
  const plan = getPlan(planId);
  const currentRoute = useRoute();
  const currentModule = currentRoute.split(role === 'employee' ? '/dashboard/employee/' : '/dashboard/admin/')[1]?.split('?')[0] ?? '';

  function handleNav(key: ModuleKey) {
    // Plan-based paywalling only makes sense for admin/company-level
    // features (recruitment, training, compliance...). An employee's
    // own self-service screens (payslips, profile, communication...)
    // must always be reachable regardless of the company's plan —
    // previously they were being blocked by the same gate as premium
    // admin modules, which made no sense.
    if (role !== 'employee' && !isSuperAdmin && !isModuleUnlocked(planId, key)) {
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

  const settingsSubs = [
    { sub: 'settings', icon: SettingsIcon, label: t('settings.company') },
    { sub: 'settings/branches', icon: GitBranch, label: t('settings.branches') },
    { sub: 'settings/departments', icon: Layers, label: t('settings.departments') },
    { sub: 'settings/leave-balances', icon: CalendarClock, label: 'Soldes de congés' },
    { sub: 'settings/roles', icon: Shield, label: t('settings.roles') },
  ];

  return (
    <div className="min-h-screen bg-white flex dark:bg-ink-900">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-white border-slate-200 dark:bg-ink-800 dark:border-white/10`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-white/10">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="Faka" className="w-7 h-7 rounded-lg" />
            <span className="font-display text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight">Faka</span>
          </Link>
          <button className="lg:hidden text-slate-500" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        {role !== 'super' && memberships.length > 1 && (
          <div className="px-3 pt-3 relative">
            <button
              onClick={() => setTenantMenu(!tenantMenu)}
              className="w-full flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 size={14} /> {activeTenant?.name ?? 'Tenant'}
              </span>
              <ChevronDown size={14} />
            </button>
            {tenantMenu && (
              <div className="absolute left-3 right-3 mt-1 rounded-lg bg-white dark:bg-ink-700 border border-slate-200 dark:border-white/10 shadow-popover z-10 py-1">
                {memberships.map((m) => (
                  <button
                    key={m.tenant_id}
                    onClick={() => { setActiveTenantId(m.tenant_id); setTenantMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 ${m.tenant_id === activeTenant?.id ? 'text-coral-600 font-medium' : 'text-slate-700 dark:text-white/70'}`}
                  >
                    {m.tenant?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {nav.map((item) => {
            const unlocked = role === 'employee' || isSuperAdmin || isModuleUnlocked(planId, item.key);
            const isSettingsItem = item.key === 'settings' && role !== 'employee';
            const isActive = currentModule === item.key || (isSettingsItem && currentModule.startsWith('settings'));
            return (
              <div key={item.key}>
                <button
                  onClick={() => handleNav(item.key)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-coral-50 dark:bg-coral-500/10 text-coral-600 dark:text-coral-300 font-medium'
                      : unlocked
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white'
                      : 'text-slate-400 dark:text-white/30'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={16} strokeWidth={isActive ? 2.25 : 2} />
                    {item.label}
                  </span>
                  {!unlocked && <Lock size={12} className="text-slate-400 dark:text-white/30" />}
                </button>
                {isSettingsItem && isActive && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {settingsSubs.map(({ sub, icon: Icon, label }) => (
                      <button
                        key={sub}
                        onClick={() => { navigate(`/dashboard/admin/${sub}`); setOpen(false); }}
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
                          currentModule === sub
                            ? 'text-coral-600 dark:text-coral-400 font-medium'
                            : 'text-slate-500 dark:text-white/50 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 dark:border-white/10 p-3">
          <div className="rounded-lg bg-slate-50 dark:bg-white/5 p-3 mb-2">
            <div className="text-xs text-slate-400 dark:text-white/40">Plan</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-slate-900 dark:text-white font-semibold text-sm">{plan.name}</span>
              <Badge color={activeTenant?.status === 'active' ? 'emerald' : activeTenant?.status === 'trial' ? 'amber' : 'rose'}>
                {activeTenant?.status === 'active' ? t('sub.active') : activeTenant?.status === 'trial' ? t('sub.trial') : t('sub.suspended')}
              </Badge>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-white/5 dark:hover:text-white transition-colors duration-150">
            <LogOut size={16} /> {t('dash.logout')}
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-ink-800/60 backdrop-blur-xl flex items-center justify-between px-5">
          <button className="lg:hidden text-slate-600 dark:text-slate-300" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/50 hover:text-coral-600 dark:hover:text-coral-300 transition-colors">
            <Home size={15} /> <span className="hidden sm:inline">{t('nav.home')}</span>
          </Link>
          <div className="hidden sm:block text-sm text-slate-500 dark:text-white/50">
            {role === 'super' ? 'LIYAH GROUP — Super Admin' : activeTenant?.name}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-500 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              title={dark ? 'Mode clair' : 'Mode sombre'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-0.5 text-xs">
              <button onClick={() => setLang('fr')} className={`px-2 py-1 rounded-md transition-colors ${lang === 'fr' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/60'}`}>FR</button>
              <button onClick={() => setLang('en')} className={`px-2 py-1 rounded-md transition-colors ${lang === 'en' ? 'bg-coral-500 text-white' : 'text-slate-500 dark:text-white/60'}`}>EN</button>
            </div>
            <div className="text-sm text-slate-600 dark:text-white/70 hidden sm:block">{user?.email}</div>
            <div className="w-8 h-8 rounded-full bg-coral-500 flex items-center justify-center text-white font-semibold text-sm">
              {(user?.email ?? 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8 bg-slate-50 dark:bg-ink-900">
          {isBlocked && role !== 'super' ? (
            <TrialBlocked />
          ) : (
            children
          )}
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

function TrialBlocked() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 max-w-lg text-center">
        <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-5">
          <AlertTriangle size={28} />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-3">{t('sub.paynow.title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm mb-6">{t('sub.paynow.desc')}</p>
        <button onClick={() => navigate('/subscription')} className="btn-primary">
          {t('sub.paynow')} →
        </button>
      </div>
    </div>
  );
}

export { ALL_MODULES };
