import { useEffect } from 'react';
import { I18nProvider, useI18n } from './lib/i18n';
import { AuthProvider, useAuth } from './lib/auth';
import { useRoute, navigate } from './lib/router';
import Landing from './components/Landing';
import { AuthScreen } from './components/Auth';
import Onboarding from './components/Onboarding';
import Subscription from './components/Subscription';
import AdminDashboard from './components/admin/AdminDashboard';
import EmployeeDashboard from './components/employee/EmployeeDashboard';
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard';
import AcceptInvite from './components/AcceptInvite';
import SimplePage from './components/SimplePage';
import { Spinner } from './components/ui';
import { getPlan, type PlanId } from './lib/plans';
import { AlertTriangle } from 'lucide-react';

function Router() {
  const route = useRoute();
  const path = route.split('?')[0];
  const { user, loading, activeTenant, activeRole, memberships } = useAuth();
  const { t } = useI18n();

  // While auth state is resolving, show a splash
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-500 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <Spinner />
        </div>
      </div>
    );
  }

  // Public routes
  if (path === '/' || path === '') return <Landing />;
  if (path === '/signin' || path === '/signup') {
    // If already signed in, go to dashboard
    if (user) {
      navigate('/dashboard');
      return null;
    }
    return <AuthScreen />;
  }
  if (path === '/onboarding') {
    if (!user) { navigate('/signin'); return null; }
    return <Onboarding />;
  }
  if (path === '/accept-invite') {
    return <AcceptInvite />;
  }

  // Static footer pages
  if (path.startsWith('/page/')) {
    return <SimplePage />;
  }

  // Super admin route — requires super_admin role
  if (path === '/super-admin' || path.startsWith('/super-admin')) {
    if (!user) { navigate('/signin'); return null; }
    // Role check: super_admin role is stored in raw_app_meta_data. The auth
    // context exposes it via memberships' role OR we check user_role claim.
    const isSuper = (user.app_metadata?.role === 'super_admin') || memberships.some((m) => m.role === 'super_admin');
    if (!isSuper) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center text-center px-6">
          <div className="card p-8 max-w-md">
            <h2 className="text-slate-900 dark:text-white font-display text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-slate-600 dark:text-white/60 text-sm">Cette console est réservée à l'équipe interne LIYAH GROUP.</p>
          </div>
        </div>
      );
    }
    return <SuperAdminDashboard />;
  }

  // Subscription route (also embedded in dashboards)
  if (path === '/subscription') {
    if (!user) { navigate('/signin'); return null; }
    return <Subscription />;
  }

  // Dashboard routes
  if (path === '/dashboard' || path.startsWith('/dashboard/admin') || path.startsWith('/dashboard/employee')) {
    if (!user) { navigate('/signin'); return null; }
    if (!activeTenant) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center px-6">
          <div className="card p-8 max-w-md text-center">
            <h2 className="text-slate-900 dark:text-white font-display text-xl font-bold mb-2">Aucun espace</h2>
            <p className="text-slate-600 dark:text-white/60 text-sm mb-5">Complétez l'onboarding pour créer votre espace Faka.</p>
            <button onClick={() => navigate('/onboarding')} className="btn-primary">Configurer mon espace</button>
          </div>
        </div>
      );
    }

    // Trial expired paywall: J+7 from created_at, no active plan
    const trialEnds = activeTenant.trial_ends_at ? new Date(activeTenant.trial_ends_at) : null;
    const trialExpired = activeTenant.status === 'trial' && trialEnds && trialEnds.getTime() < Date.now();
    const isSuspended = activeTenant.status === 'suspended';

    if ((trialExpired || isSuspended) && !path.includes('/subscription')) {
      return <ExpiredPaywall status={activeTenant.status} trialEnds={trialEnds} />;
    }

    // Route to admin or employee based on active role
    const role = activeRole ?? 'admin';
    // Only pure 'employee' role gets the employee dashboard
    if (role === 'employee') {
      if (path === '/dashboard') { navigate('/dashboard/employee/dashboard'); return null; }
      return <EmployeeDashboard />;
    }
    // All admin-like roles (admin, hr_manager, recruiter, etc.) get the admin shell
    if (path === '/dashboard') { navigate('/dashboard/admin/dashboard'); return null; }
    return <AdminDashboard />;
  }

  // Fallback
  return <Landing />;
}

function ExpiredPaywall({ status, trialEnds }: { status: string; trialEnds: Date | null }) {
  const { signOut } = useAuth();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center px-6">
      <div className="card p-10 max-w-lg text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {status === 'suspended' ? t('sub.suspended') : t('sub.expired')}
        </h1>
        <p className="text-slate-600 dark:text-white/60 mt-3">
          {trialEnds && (
            <>Votre essai gratuit s'est terminé le {trialEnds.toLocaleDateString()}.</>
          )}{' '}
          Choisissez un plan pour réactiver votre espace Faka.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button onClick={() => navigate('/subscription')} className="btn-primary">
            {t('sub.upgrade')}
          </button>
          <button onClick={async () => { await signOut(); navigate('/'); }} className="btn-ghost">
            {t('dash.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </I18nProvider>
  );
}
