import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Badge, Spinner, Modal, EmptyState } from '../ui';
import {
  Mail, Settings, FileText, Send, Inbox, Check, Plus, Trash2, Edit,
  Server, ShieldCheck, AlertCircle, RefreshCw,
} from 'lucide-react';

const PROVIDERS = [
  { id: 'smtp', label: 'SMTP' },
  { id: 'resend', label: 'Resend' },
  { id: 'sendgrid', label: 'SendGrid' },
  { id: 'ses', label: 'Amazon SES' },
  { id: 'mailgun', label: 'Mailgun' },
  { id: 'postmark', label: 'Postmark' },
  { id: 'm365', label: 'Microsoft 365 SMTP' },
  { id: 'gmail', label: 'Gmail SMTP' },
  { id: 'custom', label: 'Custom SMTP' },
];

const PLACEHOLDERS = [
  '{{CompanyName}}', '{{EmployeeName}}', '{{FirstName}}', '{{LastName}}',
  '{{Department}}', '{{Position}}', '{{InvitationCode}}', '{{ActivationLink}}',
  '{{CompanyLogo}}', '{{HRName}}', '{{CurrentDate}}', '{{ExpirationDate}}',
  '{{SupportEmail}}', '{{ResetLink}}',
];

export default function EmailCenter() {
  const { t } = useI18n();
  const auth = useAuth();
  const [tab, setTab] = useState<'config' | 'templates' | 'queue' | 'logs' | 'test'>('config');
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const loadTenants = useCallback(async () => {
    const { data } = await supabase.from('tenants').select('id, name').order('name');
    setTenants(data ?? []);
    if (data && data.length > 0 && !selectedTenant) setSelectedTenant(data[0].id);
    setLoading(false);
  }, [selectedTenant]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  async function loadConfig(tenantId: string) {
    const { data } = await supabase.from('email_config').select('*').eq('tenant_id', tenantId).maybeSingle();
    setConfig(data ?? {
      tenant_id: tenantId, provider: 'smtp', smtp_host: '', smtp_port: 587,
      encryption: 'tls', username: '', password_enc: '', sender_name: 'Faka HRMS',
      sender_email: '', reply_to: '', timeout_secs: 30, is_active: true,
    });
  }

  useEffect(() => {
    if (selectedTenant) loadConfig(selectedTenant);
    if (tab === 'templates') loadTemplates(selectedTenant);
    if (tab === 'queue') loadQueue(selectedTenant);
    if (tab === 'logs') loadLogs(selectedTenant);
  }, [selectedTenant, tab]);

  async function saveConfig() {
    setSaving(true);
    try {
      const { password_enc, ...rest } = config;
      const payload = { ...rest, tenant_id: selectedTenant };
      if (password_enc) payload.password_enc = password_enc;
      await supabase.from('email_config').upsert(payload, { onConflict: 'tenant_id' });
    } finally { setSaving(false); }
  }

  async function sendTest() {
    if (!selectedTenant || !testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.session?.access_token ?? ''}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'test', tenant_id: selectedTenant, to_email: testEmail }),
      });
      const json = await res.json();
      setTestResult(json.ok ? 'Email de test envoyé avec succès!' : `Erreur: ${json.error ?? json.detail ?? 'Échec'}`);
    } catch (err: any) {
      setTestResult(`Erreur réseau: ${err?.message}`);
    }
    setTesting(false);
  }

  async function processQueue() {
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.session?.access_token ?? ''}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'process_queue' }),
    });
    if (tab === 'queue') loadQueue(selectedTenant);
    if (tab === 'logs') loadLogs(selectedTenant);
  }

  async function loadTemplates(tenantId: string) {
    const { data } = await supabase.from('email_templates').select('*').or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).order('template_key');
    setTemplates(data ?? []);
  }

  async function loadQueue(tenantId: string) {
    const { data } = await supabase.from('email_queue').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    setQueue(data ?? []);
  }

  async function loadLogs(tenantId: string) {
    const { data } = await supabase.from('email_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    setLogs(data ?? []);
  }

  async function saveTemplate(tpl: any) {
    const { id, ...rest } = tpl;
    if (id) {
      await supabase.from('email_templates').update(rest).eq('id', id);
    } else {
      await supabase.from('email_templates').insert({ ...rest, tenant_id: selectedTenant });
    }
    setEditingTemplate(null);
    loadTemplates(selectedTenant);
  }

  const tenantName = tenants.find((x) => x.id === selectedTenant)?.name ?? '';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Email & Notification Center</h1>
            <p className="text-xs text-slate-500 dark:text-white/50">Configuration, templates, file d'attente et logs</p>
          </div>
        </div>
        <button onClick={processQueue} className="btn-ghost text-sm flex items-center gap-1.5">
          <RefreshCw size={15} /> Traiter la file
        </button>
      </div>

      {/* Tenant selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-slate-500 dark:text-white/50">Entreprise:</label>
        <select className="input max-w-xs" value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
          {tenants.map((t) => <option key={t.id} value={t.id} className="bg-white dark:bg-ink-700">{t.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: 'config', label: 'Configuration SMTP', icon: Server },
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'test', label: 'Email de test', icon: Send },
          { id: 'queue', label: 'File d\'attente', icon: Inbox },
          { id: 'logs', label: 'Logs', icon: ShieldCheck },
        ] as const).map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${tab === tb.id ? 'bg-coral-500 text-white' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'}`}>
            <tb.icon size={14} /> {tb.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Config tab */}
          {tab === 'config' && config && (
            <div className="card p-6 max-w-2xl space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings size={18} className="text-coral-500" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Configuration email — {tenantName}</h2>
              </div>
              <div>
                <label className="label">Fournisseur</label>
                <select className="input" value={config.provider} onChange={(e) => setConfig({ ...config, provider: e.target.value })}>
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id} className="bg-white dark:bg-ink-700">{p.label}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">SMTP Host</label><input className="input" value={config.smtp_host ?? ''} onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })} placeholder="smtp.gmail.com" /></div>
                <div><label className="label">SMTP Port</label><input type="number" className="input" value={config.smtp_port ?? 587} onChange={(e) => setConfig({ ...config, smtp_port: Number(e.target.value) })} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Chiffrement</label>
                  <select className="input" value={config.encryption} onChange={(e) => setConfig({ ...config, encryption: e.target.value })}>
                    <option value="tls" className="bg-white dark:bg-ink-700">TLS</option>
                    <option value="ssl" className="bg-white dark:bg-ink-700">SSL</option>
                    <option value="none" className="bg-white dark:bg-ink-700">Aucun</option>
                  </select>
                </div>
                <div><label className="label">Timeout (secondes)</label><input type="number" className="input" value={config.timeout_secs ?? 30} onChange={(e) => setConfig({ ...config, timeout_secs: Number(e.target.value) })} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Nom d'utilisateur</label><input className="input" value={config.username ?? ''} onChange={(e) => setConfig({ ...config, username: e.target.value })} /></div>
                <div><label className="label">Mot de passe / Clé API</label><input type="password" className="input" value={config.password_enc ?? ''} onChange={(e) => setConfig({ ...config, password_enc: e.target.value })} placeholder="••••••••" /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Nom de l'expéditeur</label><input className="input" value={config.sender_name ?? ''} onChange={(e) => setConfig({ ...config, sender_name: e.target.value })} /></div>
                <div><label className="label">Email expéditeur</label><input type="email" className="input" value={config.sender_email ?? ''} onChange={(e) => setConfig({ ...config, sender_email: e.target.value })} /></div>
              </div>
              <div><label className="label">Reply-To</label><input type="email" className="input" value={config.reply_to ?? ''} onChange={(e) => setConfig({ ...config, reply_to: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/60">
                <input type="checkbox" checked={config.is_active} onChange={(e) => setConfig({ ...config, is_active: e.target.checked })} className="rounded" />
                Configuration active
              </label>
              <button onClick={saveConfig} disabled={saving} className="btn-primary text-sm">
                {saving ? <Spinner /> : 'Enregistrer la configuration'}
              </button>
            </div>
          )}

          {/* Templates tab */}
          {tab === 'templates' && (
            <div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-coral-100 dark:bg-coral-500/10 text-coral-600 flex items-center justify-center">
                        <FileText size={16} />
                      </div>
                      {tpl.is_system ? <Badge color="indigo">Système</Badge> : <Badge color="emerald">Personnalisé</Badge>}
                    </div>
                    <h3 className="mt-3 text-slate-900 dark:text-white font-semibold text-sm">{tpl.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tpl.subject}</p>
                    <button onClick={() => setEditingTemplate({ ...tpl })} className="btn-ghost text-xs mt-3 w-full">
                      <Edit size={13} /> Modifier
                    </button>
                  </div>
                ))}
              </div>

              {/* Template editor modal */}
              <Modal open={editingTemplate !== null} onClose={() => setEditingTemplate(null)} title={`Modifier — ${editingTemplate?.name ?? ''}`} maxWidth="max-w-3xl">
                {editingTemplate && (
                  <div className="space-y-4">
                    <div><label className="label">Sujet</label><input className="input" value={editingTemplate.subject} onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} /></div>
                    <div>
                      <label className="label">Corps HTML</label>
                      <textarea className="input font-mono text-xs" rows={12} value={editingTemplate.html_body} onChange={(e) => setEditingTemplate({ ...editingTemplate, html_body: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Variables disponibles</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PLACEHOLDERS.map((p) => (
                          <span key={p} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-xs text-slate-600 dark:text-white/50 font-mono">{p}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setEditingTemplate(null)} className="btn-ghost text-sm">Annuler</button>
                  <button onClick={() => saveTemplate(editingTemplate)} className="btn-primary text-sm">Enregistrer</button>
                </div>
              </Modal>
            </div>
          )}

          {/* Test email tab */}
          {tab === 'test' && (
            <div className="card p-6 max-w-lg space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Send size={18} className="text-coral-500" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Email de test — {tenantName}</h2>
              </div>
              <div>
                <label className="label">Destinataire</label>
                <input type="email" className="input" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
              </div>
              <button onClick={sendTest} disabled={testing || !testEmail} className="btn-primary text-sm">
                {testing ? <Spinner /> : <><Send size={16} /> Envoyer le test</>}
              </button>
              {testResult && (
                <div className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${testResult.includes('succès') ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'}`}>
                  {testResult.includes('succès') ? <Check size={16} /> : <AlertCircle size={16} />}
                  {testResult}
                </div>
              )}
            </div>
          )}

          {/* Queue tab */}
          {tab === 'queue' && (
            <div className="card overflow-x-auto">
              {queue.length === 0 ? <EmptyState icon={<Inbox size={48} />} title="File vide" hint="Aucun email en attente." /> : (
                <table className="w-full text-sm">
                  <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="text-left p-4">Destinataire</th>
                      <th className="text-left p-4">Sujet</th>
                      <th className="text-left p-4">Template</th>
                      <th className="text-left p-4">Statut</th>
                      <th className="text-left p-4">Tentatives</th>
                      <th className="text-left p-4">Erreur</th>
                      <th className="text-left p-4">Créé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((q) => (
                      <tr key={q.id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="p-4 text-slate-900 dark:text-white font-medium">{q.to_email}</td>
                        <td className="p-4 text-slate-700 dark:text-white/70 truncate max-w-xs">{q.subject}</td>
                        <td className="p-4 text-slate-500 text-xs">{q.template_key ?? '—'}</td>
                        <td className="p-4">
                          <Badge color={q.status === 'sent' ? 'emerald' : q.status === 'failed' ? 'rose' : q.status === 'retrying' ? 'amber' : 'slate'}>{q.status}</Badge>
                        </td>
                        <td className="p-4 text-slate-500 text-xs">{q.retry_count}/{q.max_retries}</td>
                        <td className="p-4 text-rose-500 text-xs truncate max-w-xs">{q.error_message ?? '—'}</td>
                        <td className="p-4 text-slate-400 text-xs">{new Date(q.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Logs tab */}
          {tab === 'logs' && (
            <div className="card overflow-x-auto">
              {logs.length === 0 ? <EmptyState icon={<ShieldCheck size={48} />} title="Aucun log" hint="L'historique des emails apparaîtra ici." /> : (
                <table className="w-full text-sm">
                  <thead className="text-slate-400 dark:text-white/50 text-xs uppercase border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="text-left p-4">Destinataire</th>
                      <th className="text-left p-4">Expéditeur</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Statut</th>
                      <th className="text-left p-4">Raison échec</th>
                      <th className="text-left p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="p-4 text-slate-900 dark:text-white font-medium">{l.recipient}</td>
                        <td className="p-4 text-slate-500 text-xs">{l.sender ?? '—'}</td>
                        <td className="p-4 text-slate-500 text-xs">{l.email_type}</td>
                        <td className="p-4">
                          <Badge color={l.status === 'sent' ? 'emerald' : 'rose'}>{l.status}</Badge>
                        </td>
                        <td className="p-4 text-rose-500 text-xs truncate max-w-xs">{l.failure_reason ?? '—'}</td>
                        <td className="p-4 text-slate-400 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
