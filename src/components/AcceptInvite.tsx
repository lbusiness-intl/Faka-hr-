import { useEffect, useState } from 'react';
import { useRoute, Link } from '../lib/router';
import { supabase } from '../lib/supabase';
import { Spinner } from './ui';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';

export default function AcceptInvite() {
  const route = useRoute();
  const token = new URLSearchParams(route.split('?')[1] ?? '').get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid' | 'expired' | 'used' | 'submitting' | 'done' | 'error'>('verifying');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'verify', token }),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus(json.error === 'EXPIRED' ? 'expired' : json.error === 'ALREADY_USED' ? 'used' : 'invalid');
        } else {
          setEmail(json.email);
          setStatus('valid');
        }
      } catch { setStatus('invalid'); }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setStatus('submitting');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'accept', token, password, full_name: fullName }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error === 'EXPIRED' ? 'Invitation expirée.' : json.error === 'ALREADY_USED' ? 'Invitation déjà utilisée.' : 'Erreur lors de la création du compte.');
        setStatus('valid');
        return;
      }
      // Sign in the user
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) { setStatus('done'); return; }
      setStatus('done');
    } catch {
      setError('Erreur réseau. Réessayez.');
      setStatus('valid');
    }
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-ink-900 relative overflow-hidden flex items-center justify-center px-6 py-12">
      <div className="absolute inset-0 opacity-60 dark:opacity-30" style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,112,224,0.18), transparent 50%)',
      }} />
      <div className="relative card w-full max-w-md p-8 animate-scale-in">
        <Link to="/" className="flex items-center gap-2.5 mb-6">
          <img src="/icon-192.png" alt="Faka" className="w-9 h-9 rounded-xl shadow-glow" />
          <span className="font-display text-xl font-bold text-slate-900 dark:text-white">Faka</span>
        </Link>

        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner className="w-6 h-6" />
            <p className="text-slate-600 dark:text-white/60 text-sm">Vérification de l'invitation...</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center mx-auto mb-4">
              <X size={26} className="text-rose-600" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Invitation invalide</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm mt-2">Ce lien d'invitation n'est pas valide. Contactez votre RH.</p>
            <Link to="/" className="btn-ghost text-sm mt-5 inline-flex">Retour à l'accueil</Link>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">!</span>
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Invitation expirée</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm mt-2">Cette invitation a expiré (délai de 72h dépassé). Demandez à votre RH d'en générer une nouvelle.</p>
            <Link to="/" className="btn-ghost text-sm mt-5 inline-flex">Retour à l'accueil</Link>
          </div>
        )}

        {status === 'used' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4 dark:bg-white/5 dark:border-white/10">
              <Check size={26} className="text-slate-500" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Invitation déjà utilisée</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm mt-2">Ce lien a déjà servi à créer un compte. Connectez-vous directement.</p>
            <Link to="/signin" className="btn-primary text-sm mt-5 inline-flex">Se connecter <ArrowRight size={16} /></Link>
          </div>
        )}

        {(status === 'valid' || status === 'submitting' || status === 'error') && (
          <>
            <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 px-3 py-1 text-xs text-coral-700 dark:text-coral-300 mb-5">
              <Sparkles size={14} /> Bienvenue chez Faka
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Configurez votre accès</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
              Email : <span className="text-slate-900 dark:text-white font-medium">{email}</span>
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label">Nom complet</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aïssa Bello" />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
              </div>
              <div>
                <label className="label">Confirmer le mot de passe</label>
                <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
              )}
              <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full">
                {status === 'submitting' ? <Spinner /> : <>Créer mon accès <ArrowRight size={18} /></>}
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <Check size={26} className="text-emerald-600" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Compte créé !</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm mt-2">Connectez-vous avec votre email et mot de passe.</p>
            <Link to="/signin" className="btn-primary text-sm mt-5 inline-flex">Se connecter <ArrowRight size={16} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
