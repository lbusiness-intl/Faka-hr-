import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { EmptyState, Modal, Spinner } from '../ui';
import { Layers, Plus, Pencil, Trash2, GitBranch } from 'lucide-react';

type Branch = { id: string; name: string };
type Employee = { id: string; first_name: string; last_name: string };
type Department = { id: string; name: string; branch_id: string | null; head_id: string | null; created_at: string };

export default function DepartmentManager() {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', branch_id: '', head_id: '' });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!activeTenant) return;
    const [d, b, e] = await Promise.all([
      supabase.from('departments').select('*').eq('tenant_id', activeTenant.id).order('name'),
      supabase.from('branches').select('id, name').eq('tenant_id', activeTenant.id).order('name'),
      supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', activeTenant.id).eq('status', 'active'),
    ]);
    setDepartments(d.data ?? []);
    setBranches(b.data ?? []);
    setEmployees(e.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeTenant]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', branch_id: '', head_id: '' });
    setModal(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({ name: d.name, branch_id: d.branch_id ?? '', head_id: d.head_id ?? '' });
    setModal(true);
  }

  function friendlyError(msg: string): string {
    return msg.includes('TENANT_INACTIVE')
      ? "Votre abonnement n'est pas actif. Renouvelez votre plan pour continuer."
      : msg;
  }

  async function save() {
    if (!activeTenant || !form.name.trim()) return;
    setError(null);
    const payload = { name: form.name.trim(), branch_id: form.branch_id || null, head_id: form.head_id || null };
    const { error: saveErr } = editing
      ? await supabase.from('departments').update(payload).eq('id', editing.id)
      : await supabase.from('departments').insert({ ...payload, tenant_id: activeTenant.id });
    if (saveErr) { setError(friendlyError(saveErr.message)); return; }
    setModal(false);
    load();
  }

  async function remove(id: string) {
    const { error: delErr } = await supabase.from('departments').delete().eq('id', id);
    if (delErr) { setError(friendlyError(delErr.message)); return; }
    load();
  }

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';
  const empName = (id: string | null) => {
    if (!id) return '—';
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t('dept.title')}</h2>
            <p className="text-slate-500 dark:text-white/50 text-xs">{departments.length} département{departments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm"><Plus size={16} /> {t('dept.add')}</button>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">✕</button>
        </div>
      )}

      {loading ? <Spinner className="mx-auto mt-8" /> : departments.length === 0 ? (
        <EmptyState icon={<Layers size={48} />} title={t('dept.none')} hint="Créez vos départements pour structurer votre organisation." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 dark:text-white/40 text-[11px] font-semibold uppercase tracking-wide border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="text-left p-4">Département</th>
                <th className="text-left p-4">Agence</th>
                <th className="text-left p-4">Responsable</th>
                <th className="text-left p-4">Créé</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 group">
                  <td className="p-4 text-slate-900 dark:text-white font-medium">{d.name}</td>
                  <td className="p-4">
                    {d.branch_id ? (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-white/70">
                        <GitBranch size={13} className="text-blue-500" /> {branchName(d.branch_id)}
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-white/70">{empName(d.head_id)}</td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(d.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le département' : t('dept.add')}>
        <div className="space-y-3">
          <div>
            <label className="label">{t('dept.name')} *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ressources Humaines" />
          </div>
          <div>
            <label className="label">{t('dept.branch')}</label>
            <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">— Toutes les agences —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('dept.head')}</label>
            <select className="input" value={form.head_id} onChange={(e) => setForm({ ...form, head_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary text-sm">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}
