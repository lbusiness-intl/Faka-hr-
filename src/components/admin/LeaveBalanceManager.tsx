import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notifications';
import { Spinner } from '../ui';
import { CalendarClock, Pencil } from 'lucide-react';

type Employee = { id: string; first_name: string; last_name: string; user_id: string | null };
type Balance = { id: string; employee_id: string; type: string; year: number; entitled: number; used: number; carried_over: number };

export default function LeaveBalanceManager() {
  const { t } = useI18n();
  const { activeTenant, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ entitled: 18, carried_over: 0 });
  const [saving, setSaving] = useState(false);
  const year = new Date().getFullYear();

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    const [e, b] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, user_id').eq('tenant_id', activeTenant.id).eq('status', 'active').order('first_name'),
      supabase.from('leave_balances').select('*').eq('tenant_id', activeTenant.id).eq('type', 'annual').eq('year', year),
    ]);
    setEmployees((e.data as Employee[]) ?? []);
    const map: Record<string, Balance> = {};
    (b.data ?? []).forEach((row: any) => { map[row.employee_id] = row; });
    setBalances(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, [activeTenant]);

  function openEdit(empId: string) {
    const b = balances[empId];
    setEditValue({ entitled: b ? Number(b.entitled) : 18, carried_over: b ? Number(b.carried_over) : 0 });
    setEditingId(empId);
  }

  async function save(empId: string) {
    if (!activeTenant || !user) return;
    setSaving(true);
    const existing = balances[empId];
    if (existing) {
      await supabase.from('leave_balances').update({
        entitled: editValue.entitled, carried_over: editValue.carried_over,
      }).eq('id', existing.id);
    } else {
      await supabase.from('leave_balances').insert({
        tenant_id: activeTenant.id, employee_id: empId, type: 'annual', year,
        entitled: editValue.entitled, carried_over: editValue.carried_over, used: 0,
      });
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp?.user_id) {
      await notify({
        tenantId: activeTenant.id, userId: emp.user_id, employeeId: emp.id,
        category: 'leave', title: 'Solde de congés mis à jour',
        body: `Votre solde de congés ${year} a été mis à jour : ${editValue.entitled + editValue.carried_over} jours au total.`,
        priority: 'normal',
      });
    }
    setSaving(false);
    setEditingId(null);
    load();
  }

  if (!activeTenant) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={20} className="text-coral-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Soldes de congés — {year}</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-white/50 mb-4">
        Chaque nouvel employé reçoit automatiquement 18 jours de congé annuel. Ajustez ici le nombre de jours
        acquis (entitled) ou reportés (carried_over) pour chaque personne. Les jours "pris" se mettent à jour
        automatiquement lorsqu'une demande de congé est approuvée.
      </p>
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left p-4 font-medium">Employé</th>
                <th className="text-left p-4 font-medium">Acquis</th>
                <th className="text-left p-4 font-medium">Reportés</th>
                <th className="text-left p-4 font-medium">Pris</th>
                <th className="text-left p-4 font-medium">Restant</th>
                <th className="text-left p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const b = balances[emp.id];
                const entitled = b ? Number(b.entitled) : 18;
                const carried = b ? Number(b.carried_over) : 0;
                const used = b ? Number(b.used) : 0;
                const remaining = entitled + carried - used;
                const isEditing = editingId === emp.id;
                return (
                  <tr key={emp.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="p-4 text-slate-900 dark:text-white font-medium">{emp.first_name} {emp.last_name}</td>
                    {isEditing ? (
                      <>
                        <td className="p-4">
                          <input type="number" className="input py-1 w-20 text-xs" value={editValue.entitled}
                            onChange={(e) => setEditValue({ ...editValue, entitled: Number(e.target.value) })} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="input py-1 w-20 text-xs" value={editValue.carried_over}
                            onChange={(e) => setEditValue({ ...editValue, carried_over: Number(e.target.value) })} />
                        </td>
                        <td className="p-4 text-slate-400 text-xs">{used}</td>
                        <td className="p-4 text-slate-400 text-xs">—</td>
                        <td className="p-4 flex gap-2">
                          <button onClick={() => save(emp.id)} disabled={saving} className="btn-primary text-xs px-3 py-1">{saving ? <Spinner /> : t('common.save')}</button>
                          <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1">{t('common.cancel')}</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-slate-700 dark:text-white/70">{entitled}</td>
                        <td className="p-4 text-slate-700 dark:text-white/70">{carried}</td>
                        <td className="p-4 text-slate-700 dark:text-white/70">{used}</td>
                        <td className="p-4">
                          <span className={remaining <= 2 ? 'text-rose-500 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                            {remaining} j.
                          </span>
                        </td>
                        <td className="p-4">
                          <button onClick={() => openEdit(emp.id)} className="text-coral-600 hover:text-coral-500 text-xs flex items-center gap-1">
                            <Pencil size={14} /> Ajuster
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
