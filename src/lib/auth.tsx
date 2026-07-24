import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export type AppRole =
  | 'super_admin' | 'admin' | 'employee'
  | 'hr_manager' | 'hr_assistant' | 'recruiter'
  | 'payroll_officer' | 'finance' | 'manager' | 'team_lead';

export const ADMIN_LIKE_ROLES: AppRole[] = [
  'admin', 'hr_manager', 'hr_assistant', 'recruiter',
  'payroll_officer', 'finance', 'manager', 'team_lead',
];

export type Tenant = {
  id: string;
  name: string;
  subdomain: string | null;
  country: string;
  currency: string;
  timezone: string;
  phone_code: string;
  plan: string;
  status: 'trial' | 'active' | 'suspended';
  employee_limit: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  sales_code: string | null;
  default_payment_methods: string[];
};

export type CustomRoleInfo = {
  name: string;
  color: string;
  permissions: string[];
};

export type Membership = {
  id: string;
  tenant_id: string;
  role: AppRole;
  status: string;
  custom_role_id: string | null;
  custom_role: CustomRoleInfo | null;
  tenant: Tenant | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  memberships: Membership[];
  activeTenant: Tenant | null;
  activeMembership: Membership | null;
  activeRole: AppRole | null;
  isAdminLike: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; user: User | null }>;
  signOut: () => Promise<void>;
  setActiveTenantId: (id: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMemberships(userId: string) {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('tenant_memberships')
      .select('id, tenant_id, role, status, custom_role_id, custom_role:custom_roles(name, color, permissions), tenant:tenants(*)')
      .eq('user_id', userId)
      .eq('status', 'active');
    const list = (data ?? []) as unknown as Membership[];
    setMemberships(list);
    const saved = localStorage.getItem('faka_active_tenant');
    if (list.length > 0) {
      const chosen = list.find((m) => m.tenant_id === saved) ?? list[0];
      setActiveTenantIdState(chosen.tenant_id);
      localStorage.setItem('faka_active_tenant', chosen.tenant_id);
    }
  }

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        if (!mounted) return;
        setSession(sess);
        if (sess?.user) {
          await loadMemberships(sess.user.id);
        } else {
          setMemberships([]);
          setActiveTenantIdState(null);
        }
        setLoading(false);
      })();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadMemberships(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const activeTenant = memberships.find((m) => m.tenant_id === activeTenantId)?.tenant ?? null;
  const activeMembership = memberships.find((m) => m.tenant_id === activeTenantId) ?? null;
  const activeRole = activeMembership?.role ?? null;
  const isAdminLike = activeRole ? ADMIN_LIKE_ROLES.includes(activeRole) : false;

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null, user: data.user ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMemberships([]);
    setActiveTenantIdState(null);
    localStorage.removeItem('faka_active_tenant');
  }

  function setActiveTenantId(id: string) {
    setActiveTenantIdState(id);
    localStorage.setItem('faka_active_tenant', id);
  }

  async function refresh() {
    if (session?.user) await loadMemberships(session.user.id);
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    memberships,
    activeTenant,
    activeMembership,
    activeRole,
    isAdminLike,
    loading,
    signIn,
    signUp,
    signOut,
    setActiveTenantId,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
