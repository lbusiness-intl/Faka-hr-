import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Spinner, Modal, EmptyState } from '../ui';
import { CalendarClock, Plus, Edit, Trash2 } from 'lucide-react';

type Employee = { id: string; first_name: string; last_name: string };
type LeaveBalance = {
  id: string; employee_id: string; type: string; year: number;
  entitled: number; used: number; carried_over: number;
};

export default function LeaveBalanceManager() {
  const { activeTenant } = useAuth();
  const [items, setItems] = useState<LeaveBalance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<LeaveBalance | null>(null);
  const [form, setForm] = useState({
    employee_id: '', type: 'annual', year: new Date().getFullYear(),
    entitled: 18, used: 0, carried_over: 0
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    const [balRes, empRes] = await Promise.all([
      supabase.from('leave_balances').select('*').eq('tenant_id', activeTenant.id).order('year', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', activeTenant.id).eq('status', 'active')
    ]);
    setItems((balRes.data as LeaveBalance[]) ?? []);
    const emps = (empRes.data as Employee[]) ?? [];
    setEmployees(emps);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [activeTenant]);

  function startAdd() {
    setEditing(null);
    setForm({
      employee_id: employees[0]?.id ?? '', type: 'annual', year: new Date().getFullYear(),
      entitled: 18, used: 0, carried_over: 0
    });
    setModal(true);
  }

  function startEdit(item: LeaveBalance) {
    setEditing(item);
    setForm({
      employee_id: item.employee_id, type: item.type, year: item.year,
      entitled: item.entitled, used: item.used, carried_over: item.carried_over
    });
    setModal(true);
  }

  async function save() {
    if (!activeTenant) return;
    setError(null);
    const payload = {
      tenant_id: activeTenant.id,
      employee_id: form.employee_id,
      type: form.type,
      year: Number(form.year),
      entitled: Number(form.entitled),
      used: Number(form.used),
      carried_over: Number(form.carried_over)
    };

    const { error: saveErr } = editing
      ? await supabase.from('leave_balances').update(payload).eq('id', editing.id)
      : await supabase.from('leave_balances').insert(payload);
    if (saveErr) {
      setError(saveErr.message.includes('TENANT_INACTIVE')
        ? "Votre abonnement n'est pas actif. Renouvelez votre plan pour continuer."
        : saveErr.message);
      return;
    }
    setModal(false);
    load();
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer ce solde ?')) return;
    const { error: delErr } = await supabase.from('leave_balances').delete().eq('id', id);
    if (delErr) { setError(delErr.message); return; }
    load();
  }

  const getEmpName = (id: string) => {
    const e = employees.find(x => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };

  if (!activeTenant) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">
            <CalendarClock size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Soldes de congés</h1>
            <p className="text-xs text-slate-500 dark:text-white/50">Gérez les quotas de congés annuels acquis et utilisés</p>
          </div>
        </div>
        <button onClick={startAdd} disabled={employees.length === 0} className="btn-primary text-sm">
          <Plus size={16} /> Allouer un solde
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">✕</button>
        </div>
      )}

      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<CalendarClock size={48} />} title="Aucun solde alloué" hint="Allouez un quota de congés à un collaborateur." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/40 text-[11px] font-semibold uppercase tracking-wide border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Employé</th>
                <th className="text-left p-4">Année</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Acquis (jours)</th>
                <th className="text-left p-4">Reportés (jours)</th>
                <th className="text-left p-4">Pris (jours)</th>
                <th className="text-left p-4">Restants</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const total = Number(item.entitled) + Number(item.carried_over);
                const remaining = total - Number(item.used);
                return (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 text-slate-900 dark:text-white font-medium">{getEmpName(item.employee_id)}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{item.year}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70 capitalize">{item.type}</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{item.entitled} j.</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{item.carried_over} j.</td>
                    <td className="p-4 text-slate-700 dark:text-white/70">{item.used} j.</td>
                    <td className="p-4 font-semibold text-coral-600">{remaining} j.</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => startEdit(item)} className="text-coral-600 hover:text-coral-500"><Edit size={16} /></button>
                      <button onClick={() => remove(item.id)} className="text-rose-500 hover:text-rose-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocation Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le solde' : 'Allouer un solde'}>
        <div className="space-y-4">
          <div>
            <label className="label">Collaborateur *</label>
            <select className="input" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              {employees.map(e => (
                <option key={e.id} value={e.id} className="bg-white dark:bg-ink-700">{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type de congé</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="annual" className="bg-white dark:bg-ink-700">Congé annuel</option>
                <option value="sick" className="bg-white dark:bg-ink-700">Maladie</option>
                <option value="unpaid" className="bg-white dark:bg-ink-700">Sans solde</option>
              </select>
            </div>
            <div>
              <label className="label">Année *</label>
              <input type="number" className="input" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Acquis (jours)</label>
              <input type="number" className="input" value={form.entitled} onChange={e => setForm({ ...form, entitled: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Reportés (jours)</label>
              <input type="number" className="input" value={form.carried_over} onChange={e => setForm({ ...form, carried_over: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Pris (jours)</label>
              <input type="number" className="input" value={form.used} onChange={e => setForm({ ...form, used: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={save} disabled={!form.employee_id} className="btn-primary text-sm">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}
