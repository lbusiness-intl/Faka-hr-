import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Modal, Spinner } from '../ui';
import { Mail, User, GitBranch, Layers, Check, Copy, ChevronRight, ChevronLeft } from 'lucide-react';
import { ROLE_COLORS, ALL_STANDARD_ROLES } from '../../lib/permissions';
import type { AppRole } from '../../lib/auth';

type Branch = { id: string; name: string };
type Department = { id: string; name: string; branch_id: string | null };

const ROLE_DESCRIPTIONS: Partial<Record<AppRole, string>> = {
  admin:           'Accès complet à tous les modules et paramètres',
  hr_manager:      'Gestion RH complète, approbations, rapports',
  hr_assistant:    'Saisie, documents, gestion des demandes',
  recruiter:       'Offres d\'emploi, candidats, entretiens',
  payroll_officer: 'Exécution et validation de la paie',
  finance:         'Paie, avances, notes de frais, exports',
  manager:         'Équipe, congés, présence, objectifs',
  team_lead:       'Voir l\'équipe et les présences',
  employee:        'Accès au portail self-service uniquement',
};

type WizardState = {
  step: 1 | 2 | 3;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  role: AppRole;
  branch_id: string;
  department_id: string;
};

export default function InviteWizard({ open, onClose, onDone }: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { activeTenant, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const [wiz, setWiz] = useState<WizardState>({
    step: 1, email: '', first_name: '', last_name: '', position: '',
    role: 'employee', branch_id: '', department_id: '',
  });

  useEffect(() => {
    if (!activeTenant) return;
    Promise.all([
      supabase.from('branches').select('id, name').eq('tenant_id', activeTenant.id).order('name'),
      supabase.from('departments').select('id, name, branch_id').eq('tenant_id', activeTenant.id).order('name'),
    ]).then(([b, d]) => {
      setBranches(b.data ?? []);
      setDepartments(d.data ?? []);
    });
  }, [activeTenant]);

  function reset() {
    setWiz({ step: 1, email: '', first_name: '', last_name: '', position: '', role: 'employee', branch_id: '', department_id: '' });
    setInviteLink(null);
    setError(null);
    setCopied(false);
    setEmailSent(false);
    setEmailWarning(null);
  }

  function mapInviteError(code: string, detail: string | undefined, status: number): string {
    switch (code) {
      case 'UNAUTHORIZED':
        return 'Votre session a expiré. Reconnectez-vous et réessayez.';
      case 'FORBIDDEN':
        return "Vous n'avez pas les droits pour inviter quelqu'un dans cette entreprise. Vérifiez que vous êtes bien connecté avec un compte Admin/RH de cette entreprise précise.";
      case 'MISSING_FIELDS':
        return 'Certains champs obligatoires sont manquants.';
      case 'INVITATION_FAILED':
        return `L'enregistrement de l'invitation a échoué.${detail ? ` (${detail})` : ''}`;
      case 'EMPLOYEE_LIMIT_REACHED':
        return "Limite d'employés atteinte pour votre plan actuel. Passez à un plan supérieur pour inviter davantage de collaborateurs.";
      case 'TENANT_INACTIVE':
        return "Votre abonnement n'est pas actif (essai expiré ou paiement en attente). Renouvelez votre plan pour inviter de nouveaux collaborateurs.";
      case 'EMPLOYEE_CREATE_FAILED':
        return `La création de la fiche employé a échoué.${detail ? ` (${detail})` : ''}`;
      case 'EMPLOYEE_UPDATE_FAILED':
        return `La mise à jour de la fiche employé a échoué.${detail ? ` (${detail})` : ''}`;
      default:
        return `Erreur lors de l'envoi (${code || status}).${detail ? ` ${detail}` : ''}`;
    }
  }

  function handleClose() { reset(); onClose(); }

  const filteredDepts = wiz.branch_id
    ? departments.filter((d) => d.branch_id === wiz.branch_id)
    : departments;

  async function send() {
    if (!activeTenant || !user) return;
    setError(null);
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          email: wiz.email.trim().toLowerCase(),
          first_name: wiz.first_name.trim(),
          last_name: wiz.last_name.trim(),
          position: wiz.position.trim(),
          role: wiz.role,
          tenantId: activeTenant.id,
          branch_id: wiz.branch_id || undefined,
          department_id: wiz.department_id || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(mapInviteError(json.error, json.detail, res.status));
      setInviteLink(json.invite_url ?? `${window.location.origin}/#/accept-invite?token=${json.token}`);
      setInviteCode(json.token ? String(json.token).slice(0, 8).toUpperCase() : null);
      setEmailSent(Boolean(json.email_sent));
      setEmailWarning(json.email_sent ? null : (json.email_error ?? "L'email n'a pas pu être envoyé automatiquement."));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const stepTitles = [t('invite.step.identity'), t('invite.step.placement'), t('invite.step.preview')];

  return (
    <Modal open={open} onClose={handleClose} title={t('invite.wizard.title')} maxWidth="max-w-lg">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {stepTitles.map((label, i) => {
          const num = i + 1;
          const active = wiz.step === num;
          const done = wiz.step > num;
          return (
            <div key={num} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${done ? 'bg-coral-500 text-white' : active ? 'bg-coral-100 text-coral-700 dark:bg-coral-500/20 dark:text-coral-300 ring-2 ring-coral-500' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                {done ? <Check size={13} /> : num}
              </div>
              <span className={`text-xs font-medium truncate ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-white/40'}`}>{label}</span>
              {i < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />}
            </div>
          );
        })}
      </div>

      {/* Step 1 */}
      {wiz.step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom *</label>
              <input className="input" value={wiz.first_name} onChange={(e) => setWiz({ ...wiz, first_name: e.target.value })} placeholder="Aïcha" />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={wiz.last_name} onChange={(e) => setWiz({ ...wiz, last_name: e.target.value })} placeholder="Diallo" />
            </div>
          </div>
          <div>
            <label className="label">Email professionnel *</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" type="email" value={wiz.email} onChange={(e) => setWiz({ ...wiz, email: e.target.value })} placeholder="aicha@monentreprise.com" />
            </div>
          </div>
          <div>
            <label className="label">Poste / Titre</label>
            <input className="input" value={wiz.position} onChange={(e) => setWiz({ ...wiz, position: e.target.value })} placeholder="Développeur Senior" />
          </div>
          <div>
            <label className="label">{t('invite.role.hint')}</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {ALL_STANDARD_ROLES.map((r) => (
                <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${wiz.role === r ? 'border-coral-400 bg-coral-50 dark:bg-coral-500/10 dark:border-coral-500/50' : 'border-slate-200 dark:border-white/10 hover:border-coral-200 dark:hover:border-coral-500/30'}`}>
                  <input type="radio" name="role" className="sr-only" checked={wiz.role === r} onChange={() => setWiz({ ...wiz, role: r })} />
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: ROLE_COLORS[r] }}>
                    {t(`role.${r}`)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-white font-medium text-sm">{t(`role.${r}`)}</div>
                    <div className="text-slate-400 dark:text-white/40 text-xs truncate">{ROLE_DESCRIPTIONS[r]}</div>
                  </div>
                  {wiz.role === r && <Check size={16} className="text-coral-500 shrink-0" />}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {wiz.step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="label"><GitBranch size={14} className="inline mr-1" />{t('branch.title')}</label>
            <select className="input" value={wiz.branch_id} onChange={(e) => setWiz({ ...wiz, branch_id: e.target.value, department_id: '' })}>
              <option value="">— Toutes les agences —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {branches.length === 0 && <p className="text-xs text-slate-400 mt-1">Aucune agence configurée. Vous pouvez en créer dans Paramètres → Agences.</p>}
          </div>
          <div>
            <label className="label"><Layers size={14} className="inline mr-1" />{t('dept.title')}</label>
            <select className="input" value={wiz.department_id} onChange={(e) => setWiz({ ...wiz, department_id: e.target.value })}>
              <option value="">— Tous les départements —</option>
              {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
            Ces informations peuvent être modifiées plus tard depuis le profil de l'employé.
          </div>
        </div>
      )}

      {/* Step 3 — Preview & Send */}
      {wiz.step === 3 && !inviteLink && (
        <div className="space-y-4">
          <div className="card p-4 bg-slate-50 dark:bg-ink-700/50 border-0">
            <h3 className="text-slate-900 dark:text-white font-semibold mb-3">Récapitulatif</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-white/50 flex items-center gap-1.5"><User size={13} /> Nom</dt>
                <dd className="text-slate-900 dark:text-white font-medium">{wiz.first_name} {wiz.last_name}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-white/50 flex items-center gap-1.5"><Mail size={13} /> Email</dt>
                <dd className="text-slate-900 dark:text-white font-medium">{wiz.email}</dd>
              </div>
              {wiz.position && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 dark:text-white/50">Poste</dt>
                  <dd className="text-slate-900 dark:text-white">{wiz.position}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-white/50">Rôle</dt>
                <dd>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ROLE_COLORS[wiz.role] }}>
                    {t(`role.${wiz.role}`)}
                  </span>
                </dd>
              </div>
              {wiz.branch_id && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 dark:text-white/50 flex items-center gap-1.5"><GitBranch size={13} /> Agence</dt>
                  <dd className="text-slate-900 dark:text-white">{branches.find((b) => b.id === wiz.branch_id)?.name ?? '—'}</dd>
                </div>
              )}
              {wiz.department_id && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 dark:text-white/50 flex items-center gap-1.5"><Layers size={13} /> Département</dt>
                  <dd className="text-slate-900 dark:text-white">{departments.find((d) => d.id === wiz.department_id)?.name ?? '—'}</dd>
                </div>
              )}
            </dl>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Invite link success */}
      {wiz.step === 3 && inviteLink && (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-center text-slate-700 dark:text-white/70 text-sm">
            {emailSent ? (
              <>Un email d'invitation a été envoyé à <strong>{wiz.email}</strong>.<br />Vous pouvez aussi partager ce lien directement :</>
            ) : (
              <><strong>{wiz.email}</strong> a été ajouté(e), mais l'email automatique n'a pas pu être envoyé.<br />Partagez ce lien directement avec la personne :</>
            )}
          </p>
          {emailWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-500/10 rounded-lg py-2 px-3">
              {emailWarning.includes('configuration') || emailWarning.includes('No email')
                ? "Aucun fournisseur d'email n'est configuré pour votre entreprise. Contactez le support pour l'activer, ou partagez le lien manuellement en attendant."
                : `Détail technique : ${emailWarning}`}
            </p>
          )}
          <div className="flex gap-2">
            <input className="input flex-1 text-xs font-mono" readOnly value={inviteLink} />
            <button onClick={copyLink} className="btn-ghost text-sm shrink-0">
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>
          </div>
          {inviteCode && (
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-white/50 mb-1">
                Si vous préférez communiquer un code plutôt que le lien (la personne le saisira sur la page "J'ai reçu une invitation") :
              </p>
              <span className="font-mono text-lg font-bold tracking-widest text-coral-600 dark:text-coral-400">{inviteCode}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        {wiz.step > 1 && !inviteLink ? (
          <button onClick={() => setWiz({ ...wiz, step: (wiz.step - 1) as 1 | 2 | 3 })} className="btn-ghost text-sm flex items-center gap-1">
            <ChevronLeft size={16} /> Précédent
          </button>
        ) : <div />}

        {inviteLink ? (
          <button onClick={handleClose} className="btn-primary text-sm">Terminé</button>
        ) : wiz.step < 3 ? (
          <button
            onClick={() => setWiz({ ...wiz, step: (wiz.step + 1) as 2 | 3 })}
            disabled={wiz.step === 1 && (!wiz.email.trim() || !wiz.first_name.trim() || !wiz.last_name.trim())}
            className="btn-primary text-sm flex items-center gap-1 disabled:opacity-40"
          >
            Suivant <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={send} disabled={sending} className="btn-primary text-sm flex items-center gap-1">
            {sending ? <Spinner /> : <><Mail size={16} /> {t('invite.send')}</>}
          </button>
        )}
      </div>
    </Modal>
  );
}
