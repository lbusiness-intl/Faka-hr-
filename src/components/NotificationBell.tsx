import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { subscribeToNotifications } from '../lib/notifications';
import { Bell, Archive, Filter, X } from 'lucide-react';

type NotifItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  priority: string;
  is_read: boolean;
  is_archived: boolean;
  link: string | null;
  created_at: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  normal: 'bg-blue-500',
  low: 'bg-slate-400',
};

export function NotificationBell() {
  const { user, activeTenant } = useAuth();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || !activeTenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', activeTenant.id)
      .or(`user_id.eq.${user.id},employee_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as NotifItem[]) ?? []);
    setLoading(false);
  }, [user, activeTenant]);

  useEffect(() => {
    load();
    if (!user) return;
    const unsub = subscribeToNotifications(user.id, () => load());
    return unsub;
  }, [user, activeTenant, load]);

  const unreadCount = items.filter((n) => !n.is_read && !n.is_archived).length;

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    load();
  }

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    load();
  }

  async function archive(id: string) {
    await supabase.from('notifications').update({ is_archived: true }).eq('id', id);
    load();
  }

  const filtered = items.filter((n) => {
    if (filter === 'unread') return !n.is_read && !n.is_archived;
    if (filter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative w-9 h-9 rounded-full border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-800 shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Notifications</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={16} /></button>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-white/10">
              <Filter size={13} className="text-slate-400" />
              {(['all', 'unread', 'archived'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    filter === f
                      ? 'bg-coral-100 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300'
                      : 'text-slate-500 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {f === 'all' ? 'Toutes' : f === 'unread' ? 'Non lues' : 'Archivées'}
                </button>
              ))}
              <button onClick={markAllRead} className="ml-auto text-xs text-coral-600 hover:text-coral-500 font-medium">
                Tout marquer lu
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-400">Chargement…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 dark:text-white/40">
                  <Bell size={32} className="mx-auto mb-2 opacity-40" />
                  Aucune notification
                </div>
              ) : (
                filtered.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer ${!n.is_read ? 'bg-coral-50/40 dark:bg-coral-500/5' : ''}`}
                    onClick={() => { if (!n.is_read) markRead(n.id); }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_COLORS[n.priority] ?? PRIORITY_COLORS.normal} ${n.is_read ? 'opacity-30' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 dark:text-white font-medium text-sm truncate">{n.title}</span>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-coral-500 shrink-0" />}
                        </div>
                        {n.body && <p className="text-slate-500 dark:text-white/50 text-xs mt-0.5 line-clamp-2">{n.body}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-wide">{n.category}</span>
                          <span className="text-[10px] text-slate-400 dark:text-white/30">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); archive(n.id); }}
                        className="p-1.5 rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white/60 transition shrink-0"
                        title="Archiver"
                      >
                        <Archive size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
