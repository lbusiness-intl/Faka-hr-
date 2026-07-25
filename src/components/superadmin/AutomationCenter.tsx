import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, Spinner, Modal, EmptyState } from '../ui';
import {
  Zap, Plus, Trash2, Edit, Play, Pause, Clock, History,
  Workflow, ArrowRight, Check, X, Settings,
} from 'lucide-react';

const TRIGGERS = [
  'employee_created', 'employee_activated', 'employee_deleted', 'role_assigned', 'role_changed',
  'department_changed', 'branch_changed', 'leave_requested', 'leave_approved', 'leave_rejected',
  'attendance_submitted', 'attendance_corrected', 'payroll_started', 'payroll_completed',
  'payslip_generated', 'performance_review_created', 'training_assigned', 'training_completed',
  'document_uploaded', 'document_approved', 'communication_published',
  'subscription_created', 'subscription_renewed', 'subscription_expired',
  'trial_ending', 'invoice_paid', 'invoice_failed',
  'new_branch_created', 'user_suspended', 'user_reactivated',
];

const ACTIONS = [
  'send_email', 'send_inapp_notification', 'generate_document', 'generate_payslip',
  'assign_task', 'assign_training', 'create_reminder', 'create_calendar_event',
  'create_audit_log', 'update_employee_status', 'update_role', 'move_department',
  'move_branch', 'activate_user', 'suspend_user', 'lock_account', 'unlock_account',
  'generate_report', 'call_internal_api', 'trigger_webhook',
];

const CONDITIONS = [
  'tenant', 'branch', 'department', 'role', 'country', 'employee_type',
  'employment_status', 'subscription_plan', 'manager', 'payroll_status',
  'leave_type', 'custom_fields', 'date', 'time',
];

export default function AutomationCenter() {
  const { t } = useI18n();
  const auth = useAuth();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'workflows' | 'history'>('workflows');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: '', description: '', trigger: '', conditions: [], actions: [], schedule_cron: '', is_enabled: true });

  async function load() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.data.user) return;
    // Get all tenants for super admin
    const { data: tenants } = await supabase.from('tenants').select('id');
    const tenantIds = (tenants ?? []).map((x: any) => x.id);
    if (tenantIds.length === 0) { setLoading(false); return; }

    const [wfs, execs] = await Promise.all([
      supabase.from('workflows').select('*').in('tenant_id', tenantIds).order('created_at', { ascending: false }),
      supabase.from('workflow_executions').select('*').in('tenant_id', tenantIds).order('created_at', { ascending: false }).limit(100),
    ]);
    setWorkflows(wfs.data ?? []);
    setExecutions(execs.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() {
    setEditing(null);
    setForm({ name: '', description: '', trigger: '', conditions: [], actions: [], schedule_cron: '', is_enabled: true });
    setModal(true);
  }

  function startEdit(wf: any) {
    setEditing(wf);
    setForm({
      name: wf.name, description: wf.description ?? '', trigger: wf.trigger,
      conditions: wf.conditions ?? [], actions: wf.actions ?? [],
      schedule_cron: wf.schedule_cron ?? '', is_enabled: wf.is_enabled,
    });
    setModal(true);
  }

  async function save() {
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    const tenantId = (tenants ?? [])[0]?.id;
    if (!tenantId) return;

    if (editing) {
      await supabase.from('workflows').update({
        name: form.name, description: form.description, trigger: form.trigger,
        conditions: form.conditions, actions: form.actions, schedule_cron: form.schedule_cron || null,
        is_enabled: form.is_enabled, updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('workflows').insert({
        tenant_id: tenantId, name: form.name, description: form.description, trigger: form.trigger,
        conditions: form.conditions, actions: form.actions, schedule_cron: form.schedule_cron || null,
        is_enabled: form.is_enabled,
      });
    }
    setModal(false);
    load();
  }

  async function toggle(wf: any) {
    await supabase.from('workflows').update({ is_enabled: !wf.is_enabled }).eq('id', wf.id);
    load();
  }

  async function remove(id: string) {
    await supabase.from('workflows').delete().eq('id', id);
    load();
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Zap size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Automation Center</h1>
            <p className="text-xs text-slate-500 dark:text-white/50">Créez des workflows automatisés sans code</p>
          </div>
        </div>
        <button onClick={startNew} className="btn-primary text-sm"><Plus size={16} /> Nouveau workflow</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('workflows')} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${tab === 'workflows' ? 'bg-coral-500 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/70 border border-slate-200 dark:border-white/10'}`}>
          <Workflow size={14} /> Workflows
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${tab === 'history' ? 'bg-coral-500 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/70 border border-slate-200 dark:border-white/10'}`}>
          <History size={14} /> Historique
        </button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab === 'workflows' && (
            workflows.length === 0 ? (
              <EmptyState icon={<Zap size={48} />} title="Aucun workflow" hint="Créez votre premier workflow d'automatisation." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map((wf) => (
                  <div key={wf.id} className="card p-5">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Zap size={18} />
                      </div>
                      <Badge color={wf.is_enabled ? 'emerald' : 'slate'}>{wf.is_enabled ? 'Actif' : 'Inactif'}</Badge>
                    </div>
                    <h3 className="mt-3 text-slate-900 dark:text-white font-semibold">{wf.name}</h3>
                    {wf.description && <p className="text-xs text-slate-500 dark:text-white/50 mt-1">{wf.description}</p>}
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-coral-100 dark:bg-coral-500/10 text-coral-600 dark:text-coral-400 font-mono">{wf.trigger}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="text-slate-500">{(wf.actions ?? []).length} action(s)</span>
                    </div>
                    {wf.schedule_cron && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} /> {wf.schedule_cron}
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => startEdit(wf)} className="btn-ghost text-xs flex-1"><Edit size={13} /> Modifier</button>
                      <button onClick={() => toggle(wf)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded">
                        {wf.is_enabled ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => remove(wf.id)} className="text-rose-500 hover:text-rose-400 p-1.5 rounded"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'history' && (
            executions.length === 0 ? (
              <EmptyState icon={<History size={48} />} title="Aucun historique" hint="Les exécutions de workflows apparaîtront ici." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="text-left p-4">Workflow</th>
                      <th className="text-left p-4">Déclencheur</th>
                      <th className="text-left p-4">Statut</th>
                      <th className="text-left p-4">Durée</th>
                      <th className="text-left p-4">Erreurs</th>
                      <th className="text-left p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="p-4 text-slate-900 dark:text-white font-medium">{e.workflow_name}</td>
                        <td className="p-4 text-slate-500 text-xs font-mono">{e.trigger}</td>
                        <td className="p-4">
                          <Badge color={e.status === 'success' ? 'emerald' : e.status === 'failed' ? 'rose' : e.status === 'partial' ? 'amber' : 'slate'}>{e.status}</Badge>
                        </td>
                        <td className="p-4 text-slate-500 text-xs">{e.duration_ms ? `${e.duration_ms}ms` : '—'}</td>
                        <td className="p-4 text-rose-500 text-xs truncate max-w-xs">{e.errors ?? '—'}</td>
                        <td className="p-4 text-slate-400 text-xs">{new Date(e.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* Workflow builder modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le workflow' : 'Nouveau workflow'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div><label className="label">Nom du workflow *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Invitation automatique" /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          {/* Trigger */}
          <div>
            <label className="label">Déclencheur *</label>
            <select className="input" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
              <option value="" className="bg-white dark:bg-ink-700">— Choisir —</option>
              {TRIGGERS.map((tr) => <option key={tr} value={tr} className="bg-white dark:bg-ink-700">{tr.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Conditions */}
          <div>
            <label className="label">Conditions (optionnel)</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, conditions: toggleArray(form.conditions, c) })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${form.conditions.includes(c) ? 'bg-coral-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60'}`}>
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="label">Actions *</label>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <button key={a} type="button" onClick={() => setForm({ ...form, actions: toggleArray(form.actions, a) })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${form.actions.includes(a) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60'}`}>
                  {a.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="label">Planification (cron — optionnel)</label>
            <input className="input font-mono text-xs" value={form.schedule_cron} onChange={(e) => setForm({ ...form, schedule_cron: e.target.value })} placeholder="0 9 * * * (tous les jours à 9h)" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/60">
            <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} className="rounded" />
            Workflow actif
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(false)} className="btn-ghost text-sm">Annuler</button>
          <button onClick={save} disabled={!form.name || !form.trigger || form.actions.length === 0} className="btn-primary text-sm disabled:opacity-50">
            {editing ? 'Enregistrer' : 'Créer le workflow'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
