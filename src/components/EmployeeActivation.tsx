import { useState, type FormEvent } from 'react';
import { useRoute, navigate, Link } from '../lib/router';
import { supabase } from '../lib/supabase';
import { Spinner } from './ui';
import { Check, X, Sparkles, ArrowRight, Mail, KeyRound, Building2 } from 'lucide-react';

export default function EmployeeActivation() {
  const route = useRoute();
  const tokenFromUrl = new URLSearchParams(route.split('?')[1] ?? '').get('token') ?? '';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(tokenFromUrl ? '' : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'form' | 'submitting' | 'done' | 'error'>('form');
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('L\'email professionnel est obligatoire.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Email invalide.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

    setStatus('submitting');
    try {
      // Use the invitation code or token to verify + activate
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'activate',
          email: email.trim().toLowerCase(),
          code: code || undefined,
          token: tokenFromUrl || undefined,
          password,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        const msg = json.error === 'NOT_FOUND' ? 'Aucune invitation trouvée pour cet email. Vérifiez avec votre RH.'
          : json.error === 'EXPIRED' ? 'Invitation expirée. Demandez à votre RH d\'en générer une nouvelle.'
          : json.error === 'ALREADY_USED' ? 'Ce compte est déjà activé. Connectez-vous directement.'
          : json.error === 'CODE_INVALID' ? 'Code d\'invitation invalide.'
          : `Erreur lors de l'activation. Réessayez.${json.detail ? ` (${json.detail})` : json.error ? ` (${json.error})` : ''}`;
        setError(msg);
        setStatus('form');
        return;
      }

      // Sign in the user
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInErr) {
        setStatus('done');
        return;
      }
      setCompanyName(json.company_name ?? '');
      setStatus('done');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(`Erreur réseau. Réessayez. (${raw})`);
      setStatus('form');
    }
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-ink-900 relative overflow-hidden flex items-center justify-center px-6 py-12">
      <div className="absolute inset-0 opacity-60 dark:opacity-30" style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(45,212,191,0.18), transparent 50%)',
      }} />
      <div className="relative card w-full max-w-md p-8 animate-scale-in">
        <Link to="/" className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-coral-500 flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="font-display text-xl font-bold text-slate-900 dark:text-white">Faka</span>
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 px-3 py-1 text-xs text-teal-700 dark:text-teal-300 mb-5">
          <Sparkles size={14} /> Activation Employé
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Activez votre compte</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
          Entrez votre email professionnel et le code d'invitation fourni par votre RH.
        </p>

        {status === 'done' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <Check size={30} className="text-emerald-600" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Compte activé !</h2>
            {companyName && (
              <p className="text-slate-600 dark:text-white/60 text-sm mt-2">
                Bienvenue chez <span className="font-semibold text-slate-900 dark:text-white">{companyName}</span>.
              </p>
            )}
            <p className="text-slate-500 dark:text-white/50 text-sm mt-1">Redirection en cours…</p>
            <button onClick={() => navigate('/dashboard/employee/dashboard')} className="btn-primary text-sm mt-5 inline-flex">
              Accéder à mon espace <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={13} /> Email professionnel</label>
              <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.com" />
            </div>
            {!tokenFromUrl && (
              <div>
                <label className="label flex items-center gap-1.5"><KeyRound size={13} /> Code d'invitation</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code fourni par votre RH" />
                <p className="text-xs text-slate-400 mt-1">Le code se trouve dans l'email d'invitation envoyé par votre RH.</p>
              </div>
            )}
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
            </div>
            <div>
              <label className="label">Confirmer le mot de passe</label>
              <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" minLength={6} />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <X size={16} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
            <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full">
              {status === 'submitting' ? <Spinner /> : <>Activer mon compte <ArrowRight size={18} /></>}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-white/40">
          <Building2 size={14} className="text-teal-500" />
          Vous êtes une entreprise ? <Link to="/signup" className="text-coral-600 hover:text-coral-500 font-medium">Créer un espace</Link>
        </div>
      </div>
    </div>
  );
}
