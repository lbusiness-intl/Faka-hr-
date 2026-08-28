import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative card w-full ${maxWidth} p-6 animate-scale-in max-h-[90vh] flex flex-col shadow-popover`}>
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-white/50 dark:hover:text-white transition-colors rounded-md p-1 hover:bg-slate-100 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto -mr-2 pr-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block w-4 h-4 border-2 border-slate-200 dark:border-white/20 border-t-coral-500 rounded-full animate-spin ${className}`} />
  );
}

export function Badge({ children, color = 'emerald' }: {
  children: ReactNode;
  color?: 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo' | 'coral';
}) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    amber: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    rose: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-white/70 dark:border-white/15',
    indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
    coral: 'bg-coral-100 text-coral-700 border border-coral-200 dark:bg-coral-500/15 dark:text-coral-300 dark:border-coral-500/30',
  };
  return <span className={`badge ${colors[color]}`}>{children}</span>;
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-300 dark:text-white/20 mb-4">{icon}</div>}
      <p className="text-slate-700 dark:text-white font-medium">{title}</p>
      {hint && <p className="text-slate-400 dark:text-white/50 text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const color = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-200'
    : 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-200';
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`rounded-xl border px-4 py-3 backdrop-blur-md shadow-lg ${color}`}>{message}</div>
    </div>
  );
}

export function StatCard({ label, value, sub, icon, color = 'emerald' }: {
  label: string; value: string; sub?: string; icon: ReactNode;
  color?: 'emerald' | 'coral' | 'indigo' | 'amber' | 'teal' | 'rose';
}) {
  const bg = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    coral: 'bg-coral-50 text-coral-600 dark:bg-coral-500/10 dark:text-coral-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[color];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-white/50 font-medium">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">{value}</div>
          {sub && <div className="text-xs text-slate-400 dark:text-white/40 mt-1">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}
