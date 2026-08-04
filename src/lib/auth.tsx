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

export const SUPER_ADMIN_EMAILS = [
  'vincentnogue2@gmail.com',
  'vincentnogue@yahoo.com',
  'webdxb1@gmail.com',
  'liyahjoha@gmail.com',
];

export const PROTECTED_ADMIN_EMAILS = ['vincentnogue@yahoo.com', 'webdxb1@gmail.com', 'liyahjoha@gmail.com'];

export function getSuperAdminEmails(): string[] {
  let custom: string[] = [];
  try {
    const saved = localStorage.getItem('faka_custom_super_admins');
    if (saved) {
      custom = JSON.parse(saved);
    } else {
      custom = [...SUPER_ADMIN_EMAILS];
      localStorage.setItem('faka_custom_super_admins', JSON.stringify(custom));
    }
  } catch {
    custom = [...SUPER_ADMIN_EMAILS];
  }
  // Ensure we return unique and lowercase emails
  const all = custom.map(e => e.toLowerCase().trim());
  return Array.from(new Set(all));
}

export function saveSuperAdminEmails(emails: string[]) {
  try {
    const unique = Array.from(new Set(emails.map(e => e.toLowerCase().trim())));
    localStorage.setItem('faka_custom_super_admins', JSON.stringify(unique));
  } catch { /* ignore */ }
}

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase().trim());
}

export function isProtectedAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return PROTECTED_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

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
    if (!isSupabaseConfigured) {
      let list: Membership[] = [];
      try {
        const saved = localStorage.getItem('faka_mock_memberships');
        if (saved) {
          const all = JSON.parse(saved);
          list = all[userId] ?? [];
        }
      } catch { /* ignore */ }
      setMemberships(list);
      const savedTenantId = localStorage.getItem('faka_active_tenant');
      if (list.length > 0) {
        const chosen = list.find((m) => m.tenant_id === savedTenantId) ?? list[0];
        setActiveTenantIdState(chosen.tenant_id);
        localStorage.setItem('faka_active_tenant', chosen.tenant_id);
      }
      return;
    }
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
    if (!isSupabaseConfigured) {
      try {
        const savedSess = localStorage.getItem('faka_mock_session');
        if (savedSess) {
          const sess = JSON.parse(savedSess);
          setSession(sess);
          loadMemberships(sess.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
          return;
        }
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }

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
    if (!isSupabaseConfigured) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Simulate successful sign-in
      const mockUser = {
        id: 'mock-user-id-' + email.replace(/[^a-zA-Z0-9]/g, ''),
        email: email,
        app_metadata: { role: isSuperAdminEmail(email) ? 'super_admin' : 'admin' },
        user_metadata: { full_name: email.split('@')[0] },
      };
      const mockSess = {
        access_token: 'mock-access-token',
        user: mockUser,
      };
      localStorage.setItem('faka_mock_session', JSON.stringify(mockSess));
      setSession(mockSess as any);
      await loadMemberships(mockUser.id);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    if (!isSupabaseConfigured) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Simulate successful signup
      const mockUser = {
        id: 'mock-user-id-' + email.replace(/[^a-zA-Z0-9]/g, ''),
        email: email,
        app_metadata: { role: isSuperAdminEmail(email) ? 'super_admin' : 'admin' },
        user_metadata: { full_name: fullName },
      };
      const mockSess = {
        access_token: 'mock-access-token',
        user: mockUser,
      };
      localStorage.setItem('faka_mock_session', JSON.stringify(mockSess));
      setSession(mockSess as any);
      // Ensure we clear any pre-existing mock memberships for this fresh signup
      const saved = localStorage.getItem('faka_mock_memberships') ? JSON.parse(localStorage.getItem('faka_mock_memberships')!) : {};
      delete saved[mockUser.id];
      localStorage.setItem('faka_mock_memberships', JSON.stringify(saved));
      setMemberships([]);
      return { error: null, user: mockUser as any };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null, user: data.user ?? null };
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem('faka_mock_session');
      setSession(null);
      setMemberships([]);
      setActiveTenantIdState(null);
      localStorage.removeItem('faka_active_tenant');
      return;
    }
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
