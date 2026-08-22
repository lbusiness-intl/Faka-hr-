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
import EmployeeActivation from './components/EmployeeActivation';
import SimplePage from './components/SimplePage';
import { Spinner } from './components/ui';
import { AlertTriangle } from 'lucide-react';

function Router() {
  const route = useRoute();
  const path = route.split('?')[0];
  const { user, loading, activeTenant, activeRole } = useAuth();

  // While auth state is resolving, show a splash
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/icon-192.png" alt="Faka" className="w-10 h-10 rounded-xl animate-pulse" />
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
  if (path === '/activate' || path.startsWith('/activate')) {
    return <EmployeeActivation />;
  }

  // Static footer pages
  if (path.startsWith('/page/')) {
    return <SimplePage />;
  }

  // Super admin route — reserved for the platform's own super admins and
  // internal staff, never for a tenant's own users.
  //
  // SECURITY: this check trusts ONLY `user.app_metadata.role`, which lives in
  // the Supabase Auth JWT and can only ever be written server-side (via the
  // Admin API / service role) — a client can never set or forge it, no
  // matter what request they craft by hand.
  //
  // We deliberately do NOT also trust `memberships.some(m => m.role ===
  // 'super_admin')` here: that value comes from the `tenant_memberships`
  // table, which a tenant's own admin can write to (to manage their own
  // team). A now-patched bug let a tenant admin grant themselves that role
  // directly through the API — the underlying database hole is closed
  // (see migration 0011), but the UI gate itself must not depend on a
  // tenant-writable value for a platform-wide permission, so it never
  // trusts it again even if a similar mistake is reintroduced later.
  if (path === '/super-admin' || path.startsWith('/super-admin')) {
    if (!user) { navigate('/signin'); return null; }
    const isSuper = user.app_metadata?.role === 'super_admin';
    if (!isSuper) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center text-center px-6">
          <div className="card p-8 max-w-md">
            <h2 className="text-slate-900 dark:text-white font-display text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-slate-600 dark:text-white/60 text-sm">Cette console est réservée à l'équipe interne LiAfrik.</p>
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
