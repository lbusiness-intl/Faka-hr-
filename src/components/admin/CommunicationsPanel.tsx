import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, EmptyState, Modal, Spinner } from '../ui';
import { MessageSquare, Plus, Send, Users, Bell, FileText, Megaphone, AlertTriangle, Eye, Clock } from 'lucide-react';

type Comm = {
  id: string;
  type: string;
  subject: string;
  body: string;
  recipient_scope: string;
  sent_at: string | null;
  scheduled_at: string | null;
  is_draft: boolean;
  created_at: string;
  sender_id: string | null;
};

type Branch = { id: string; name: string };
type Department = { id: string; name: string };

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  announcement: Megaphone,
  message: MessageSquare,
  alert: AlertTriangle,
  policy: FileText,
  event_invite: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  announcement: 'coral',
  message: 'slate',
  alert: 'rose',
  policy: 'indigo',
  event_invite: 'emerald',
};

export default function CommunicationsPanel({ isEmployee = false }: { isEmployee?: boolean }) {
  const { t } = useI18n();
  const { activeTenant, user } = useAuth();
  const [items, setItems] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'inbox' | 'compose'>('inbox');
  const [selected, setSelected] = useState<Comm | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'announcement',
    subject: '',
    body: '',
    recipient_scope: 'all',
    recipient_target_id: '',
    scheduled_at: '',
    is_draft: false,
  });

  async function load() {
    if (!activeTenant) return;
    const { data } = await supabase
      .from('communications')
      .select('*')
      .eq('tenant_id', activeTenant.id)
      .eq('is_draft', false)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!activeTenant) return;
    load();
    Promise.all([
      supabase.from('branches').select('id, name').eq('tenant_id', activeTenant.id),
      supabase.from('departments').select('id, name').eq('tenant_id', activeTenant.id),
    ]).then(([b, d]) => {
      setBranches(b.data ?? []);
      setDepartments(d.data ?? []);
    });
  }, [activeTenant]);

  async function openComm(comm: Comm) {
    setSelected(comm);
    // Mark as read
    if (user) {
      await supabase.from('communication_read_receipts').upsert({
        communication_id: comm.id,
        user_id: user.id,
      }, { onConflict: 'communication_id,user_id' });
    }
  }

  async function sendComm() {
    if (!activeTenant || !user || !form.subject.trim() || !form.body.trim()) return;
    if ((form.recipient_scope === 'branch' || form.recipient_scope === 'department') && !form.recipient_target_id) return;
    setSending(true);
    setSendError(null);
    try {
      const { error: sendErr } = await supabase.from('communications').insert({
        tenant_id: activeTenant.id,
        sender_id: user.id,
        type: form.type,
        subject: form.subject.trim(),
        body: form.body.trim(),
        recipient_scope: form.recipient_scope,
        recipient_ids: form.recipient_target_id ? [form.recipient_target_id] : [],
        attachments: [],
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        sent_at: form.scheduled_at ? null : new Date().toISOString(),
        is_draft: form.is_draft,
      });
      if (sendErr) {
        setSendError(sendErr.message.includes('TENANT_INACTIVE')
          ? "Votre abonnement n'est pas actif. Renouvelez votre plan pour envoyer une communication."
          : `Échec de l'envoi : ${sendErr.message}`);
        return;
      }
      setForm({ type: 'announcement', subject: '', body: '', recipient_scope: 'all', recipient_target_id: '', scheduled_at: '', is_draft: false });
      setView('inbox');
      load();
    } finally {
      setSending(false);
    }
  }

  const typeOptions = [
    { value: 'announcement', label: t('comms.type.announcement') },
    { value: 'message', label: t('comms.type.message') },
    { value: 'alert', label: t('comms.type.alert') },
    { value: 'policy', label: t('comms.type.policy') },
    { value: 'event_invite', label: t('comms.type.event_invite') },
  ];

  const scopeOptions = [
    { value: 'all', label: t('comms.scope.all') },
    { value: 'hr', label: 'RH' },
    { value: 'hr_assistant', label: 'Assistant RH' },
    { value: 'managers', label: 'Managers' },
    { value: 'payroll', label: 'Paie' },
    { value: 'finance', label: 'Finance' },
    { value: 'branch', label: t('comms.scope.branch') },
    { value: 'department', label: t('comms.scope.department') },
    { value: 'role', label: t('comms.scope.role') },
    { value: 'individual', label: t('comms.scope.individual') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-coral-50 dark:bg-coral-500/10 border border-coral-100 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">
            <MessageSquare size={20} />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t('comms.title')}</h2>
        </div>
        {!isEmployee && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('inbox')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${view === 'inbox' ? 'bg-coral-500 text-white' : 'btn-ghost'}`}
            >
              {t('comms.inbox')}
            </button>
            <button
              onClick={() => setView('compose')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${view === 'compose' ? 'bg-coral-500 text-white' : 'btn-ghost'}`}
            >
              <Plus size={15} /> {t('comms.compose')}
            </button>
          </div>
        )}
      </div>

      {view === 'inbox' && (
        <>
          {loading ? <Spinner className="mx-auto mt-8" /> : items.length === 0 ? (
            <EmptyState icon={<MessageSquare size={48} />} title={t('comms.none')} hint={isEmployee ? 'Les communications de votre entreprise apparaîtront ici.' : 'Envoyez votre première communication ci-dessus.'} />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? MessageSquare;
                const color = TYPE_COLORS[item.type] ?? 'slate';
                return (
                  <div
                    key={item.id}
                    onClick={() => openComm(item)}
                    className="card p-4 cursor-pointer hover:shadow-md transition flex items-start gap-4 group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      color === 'coral' ? 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' :
                      color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' :
                      color === 'indigo' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' :
                      color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' :
                      'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color={color as 'coral' | 'rose' | 'indigo' | 'emerald' | 'slate'}>{typeOptions.find((o) => o.value === item.type)?.label ?? item.type}</Badge>
                        {item.scheduled_at && !item.sent_at && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><Clock size={11} /> Programmé</span>
                        )}
                      </div>
                      <h3 className="text-slate-900 dark:text-white font-semibold text-sm truncate">{item.subject}</h3>
                      <p className="text-slate-500 dark:text-white/50 text-xs mt-0.5 line-clamp-2">{item.body}</p>
                    </div>
                    <div className="text-slate-400 dark:text-white/40 text-xs shrink-0">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'compose' && !isEmployee && (
        <div className="card p-6">
          <h3 className="text-slate-900 dark:text-white font-semibold mb-4">{t('comms.compose')}</h3>
          {sendError && (
            <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
              <span>{sendError}</span>
              <button onClick={() => setSendError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">✕</button>
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Destinataires</label>
                <select className="input" value={form.recipient_scope} onChange={(e) => setForm({ ...form, recipient_scope: e.target.value, recipient_target_id: '' })}>
                  {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {form.recipient_scope === 'branch' && (
              <div>
                <label className="label">Branche</label>
                <select className="input" value={form.recipient_target_id} onChange={(e) => setForm({ ...form, recipient_target_id: e.target.value })}>
                  <option value="">Sélectionner une branche</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {form.recipient_scope === 'department' && (
              <div>
                <label className="label">Département</label>
                <select className="input" value={form.recipient_target_id} onChange={(e) => setForm({ ...form, recipient_target_id: e.target.value })}>
                  <option value="">Sélectionner un département</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">{t('comms.subject')} *</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Titre de la communication" />
            </div>

            <div>
              <label className="label">{t('comms.body')} *</label>
              <textarea className="input resize-none" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Rédigez votre message ici..." />
            </div>

            <div>
              <label className="label">{t('comms.scheduled')} <span className="text-slate-400">(optionnel)</span></label>
              <input type="datetime-local" className="input" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-9 h-5 rounded-full transition ${form.is_draft ? 'bg-amber-400' : 'bg-slate-200 dark:bg-white/20'}`}
                  onClick={() => setForm({ ...form, is_draft: !form.is_draft })}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${form.is_draft ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-slate-700 dark:text-white/70">{t('comms.draft')}</span>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setView('inbox')} className="btn-ghost text-sm">{t('common.cancel')}</button>
              <button
                onClick={sendComm}
                disabled={sending || !form.subject.trim() || !form.body.trim()}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              >
                {sending ? <Spinner /> : <Send size={15} />}
                {form.scheduled_at ? t('comms.scheduled') : t('comms.send.now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View communication modal */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.subject ?? ''} maxWidth="max-w-2xl">
        {selected && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge color={TYPE_COLORS[selected.type] as 'coral' | 'rose' | 'indigo' | 'emerald' | 'slate'}>
                {typeOptions.find((o) => o.value === selected.type)?.label ?? selected.type}
              </Badge>
              <span className="text-slate-400 dark:text-white/40 text-xs flex items-center gap-1">
                <Users size={12} /> {scopeOptions.find((o) => o.value === selected.recipient_scope)?.label ?? selected.recipient_scope}
              </span>
              <span className="text-slate-400 dark:text-white/40 text-xs ml-auto">
                {selected.sent_at ? new Date(selected.sent_at).toLocaleString() : new Date(selected.created_at).toLocaleString()}
              </span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-white/80 text-sm leading-relaxed whitespace-pre-line">{selected.body}</p>
            </div>
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-white/10">
              <Eye size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400 dark:text-white/40">Lu</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
