import { supabase } from './supabase';

export type NotificationCategory =
  | 'payroll' | 'document' | 'leave' | 'performance' | 'training'
  | 'meeting' | 'communication' | 'profile' | 'attendance' | 'claim'
  | 'advance' | 'system' | 'role' | 'general';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Insert a notification for a specific user (employee or HR).
 * Works fire-and-forget — never blocks the caller.
 */
export async function notify(opts: {
  tenantId: string;
  userId?: string | null;
  employeeId?: string | null;
  category: NotificationCategory;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  link?: string;
}) {
  if (!opts.userId && !opts.employeeId) return;
  try {
    await supabase.from('notifications').insert({
      tenant_id: opts.tenantId,
      user_id: opts.userId ?? null,
      employee_id: opts.employeeId ?? null,
      category: opts.category,
      title: opts.title,
      body: opts.body ?? '',
      priority: opts.priority ?? 'normal',
      is_read: false,
      is_archived: false,
      link: opts.link ?? null,
    });
  } catch {
    // fire-and-forget: never break the caller's flow
  }
}

/**
 * Notify all HR/admin members of a tenant (for employee-initiated actions).
 */
export async function notifyHR(tenantId: string, opts: {
  category: NotificationCategory;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  link?: string;
}) {
  try {
    const { data: memberships } = await supabase
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('role', ['admin', 'hr_manager', 'hr_assistant']);
    if (!memberships || memberships.length === 0) return;
    await Promise.all(
      memberships.map((m: any) =>
        supabase.from('notifications').insert({
          tenant_id: tenantId,
          user_id: m.user_id,
          category: opts.category,
          title: opts.title,
          body: opts.body ?? '',
          priority: opts.priority ?? 'normal',
          is_read: false,
          is_archived: false,
          link: opts.link ?? null,
        })
      )
    );
  } catch {
    // fire-and-forget
  }
}

/**
 * Subscribe to real-time notification inserts for a specific user.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  onNew: () => void
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => onNew()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * Subscribe to real-time changes on any table for a tenant.
 * Returns an unsubscribe function.
 */
export function subscribeToTable(
  table: string,
  tenantId: string,
  onChange: () => void
): () => void {
  const channel = supabase
    .channel(`${table}:${tenantId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` },
      () => onChange()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
