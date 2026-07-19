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
      <div className={`relative card w-full ${maxWidth} p-6 animate-scale-in`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block w-4 h-4 border-2 border-slate-200 border-t-coral-500 rounded-full animate-spin ${className}`} />
  );
}

export function Badge({ children, color = 'emerald' }: { children: ReactNode; color?: 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo' | 'coral' }) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border border-rose-200',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200',
    indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    coral: 'bg-coral-100 text-coral-700 border border-coral-200',
  };
  return <span className={`badge ${colors[color]}`}>{children}</span>;
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-300 mb-4">{icon}</div>}
      <p className="text-slate-700 font-medium">{title}</p>
      {hint && <p className="text-slate-400 text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const color = type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800';
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className={`rounded-xl border px-4 py-3 backdrop-blur-md ${color}`}>{message}</div>
    </div>
  );
}

// Stat card with circular icon background (Bayzat-style)
export function StatCard({ label, value, sub, icon, color = 'emerald' }: {
  label: string; value: string; sub?: string; icon: ReactNode;
  color?: 'emerald' | 'coral' | 'indigo' | 'amber' | 'teal' | 'rose';
}) {
  const bg = {
    emerald: 'bg-emerald-100 text-emerald-600',
    coral: 'bg-coral-100 text-coral-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
    teal: 'bg-teal-100 text-teal-600',
    rose: 'bg-rose-100 text-rose-600',
  }[color];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}
