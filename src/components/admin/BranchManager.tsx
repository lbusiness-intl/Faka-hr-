import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, EmptyState, Modal, Spinner } from '../ui';
import { GitBranch, MapPin, Plus, Pencil, Trash2, User } from 'lucide-react';

type Branch = { id: string; name: string; location: string | null; manager_id: string | null; created_at: string };
type Employee = { id: string; first_name: string; last_name: string };

export default function BranchManager() {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', location: '', manager_id: '' });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!activeTenant) return;
    const [b, e] = await Promise.all([
      supabase.from('branches').select('*').eq('tenant_id', activeTenant.id).order('name'),
      supabase.from('employees').select('id, first_name, last_name').eq('tenant_id', activeTenant.id).eq('status', 'active'),
    ]);
    setBranches(b.data ?? []);
    setEmployees(e.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeTenant]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', location: '', manager_id: '' });
    setModal(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({ name: b.name, location: b.location ?? '', manager_id: b.manager_id ?? '' });
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
    const payload = { name: form.name.trim(), location: form.location || null, manager_id: form.manager_id || null };
    const { error: saveErr } = editing
      ? await supabase.from('branches').update(payload).eq('id', editing.id)
      : await supabase.from('branches').insert({ ...payload, tenant_id: activeTenant.id });
    if (saveErr) { setError(friendlyError(saveErr.message)); return; }
    setModal(false);
    load();
  }

  async function remove(id: string) {
    const { error: delErr } = await supabase.from('branches').delete().eq('id', id);
    if (delErr) { setError(friendlyError(delErr.message)); return; }
    load();
  }

  const empName = (id: string | null) => {
    if (!id) return '—';
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-coral-50 dark:bg-coral-500/10 border border-coral-100 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">
            <GitBranch size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t('branch.title')}</h2>
            <p className="text-slate-500 dark:text-white/50 text-xs">{branches.length} agence{branches.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm"><Plus size={16} /> {t('branch.add')}</button>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">✕</button>
        </div>
      )}

      {loading ? <Spinner className="mx-auto mt-8" /> : branches.length === 0 ? (
        <EmptyState icon={<GitBranch size={48} />} title={t('branch.none')} hint="Créez votre première agence pour organiser vos équipes." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div key={b.id} className="card p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <GitBranch size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-slate-900 dark:text-white font-semibold">{b.name}</h3>
              {b.location && (
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-white/50 text-xs">
                  <MapPin size={12} /> {b.location}
                </div>
              )}
              {b.manager_id && (
                <div className="flex items-center gap-1.5 mt-2 text-slate-500 dark:text-white/50 text-xs">
                  <User size={12} /> {empName(b.manager_id)}
                </div>
              )}
              <div className="mt-3">
                <Badge color="slate">{new Date(b.created_at).toLocaleDateString()}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'agence' : t('branch.add')}>
        <div className="space-y-3">
          <div>
            <label className="label">{t('branch.name')} *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Siège social" />
          </div>
          <div>
            <label className="label">{t('branch.location')}</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Douala, Cameroun" />
          </div>
          <div>
            <label className="label">{t('branch.manager')}</label>
            <select className="input" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
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
