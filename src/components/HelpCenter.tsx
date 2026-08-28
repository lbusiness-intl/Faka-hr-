import { useState, useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { Link } from '../lib/router';
import {
  Search, LifeBuoy, Users, Wallet, ShieldCheck,
  CreditCard, ChevronDown, Mail, MessageCircle,
} from 'lucide-react';

type FaqCategory = { key: string; icon: typeof Users; titleFr: string; titleEn: string; items: { qFr: string; aFr: string; qEn: string; aEn: string }[] };

const CATEGORIES: FaqCategory[] = [
  {
    key: 'getting-started',
    icon: LifeBuoy,
    titleFr: 'Démarrage',
    titleEn: 'Getting started',
    items: [
      {
        qFr: 'Comment créer mon espace Faka ?',
        aFr: "Cliquez sur \"Essai gratuit\" depuis la page d'accueil, renseignez le nom de votre entreprise et votre pays — la devise, le fuseau horaire et l'indicatif téléphonique se configurent automatiquement. Vous disposez de 7 jours d'essai gratuit sans carte bancaire requise.",
        qEn: 'How do I create my Faka workspace?',
        aEn: 'Click "Free trial" from the homepage, enter your company name and country — currency, timezone and phone code are configured automatically. You get a 7-day free trial, no card required.',
      },
      {
        qFr: 'Comment inviter mes employés ?',
        aFr: 'Depuis Employés → Inviter, saisissez leur email. Ils reçoivent un lien sécurisé pour activer leur compte et rejoindre votre espace en tant qu\'employé, avec un accès limité à leurs propres données.',
        qEn: 'How do I invite my employees?',
        aEn: 'From Employees → Invite, enter their email. They receive a secure link to activate their account and join your workspace as an employee, with access limited to their own data.',
      },
      {
        qFr: 'Puis-je changer la langue de l\'interface ?',
        aFr: 'Oui, un bouton FR/EN est disponible dans l\'en-tête de votre tableau de bord et sur la page d\'accueil. Toute la plateforme est bilingue.',
        qEn: 'Can I change the interface language?',
        aEn: 'Yes, an FR/EN toggle is available in your dashboard header and on the homepage. The entire platform is bilingual.',
      },
    ],
  },
  {
    key: 'payroll',
    icon: Wallet,
    titleFr: 'Paie',
    titleEn: 'Payroll',
    items: [
      {
        qFr: 'Comment lancer un cycle de paie ?',
        aFr: 'Depuis Paie → Run Payroll, sélectionnez les employés concernés (ou laissez la sélection vide pour inclure tout le monde). Faka calcule automatiquement le brut, les primes, les heures supplémentaires approuvées et génère un bulletin par employé.',
        qEn: 'How do I run a payroll cycle?',
        aEn: 'From Payroll → Run Payroll, select the relevant employees (or leave the selection empty to include everyone). Faka automatically computes gross pay, bonuses, approved overtime, and generates a payslip per employee.',
      },
      {
        qFr: 'Comment ajuster le salaire d\'un employé ?',
        aFr: 'Ouvrez la fiche employé depuis Paie, cliquez sur "Ajuster", choisissez le champ concerné (salaire, prime, avantages, déductions) et indiquez une raison. L\'historique de tous les ajustements est conservé.',
        qEn: 'How do I adjust an employee\'s salary?',
        aEn: 'Open the employee record from Payroll, click "Adjust", choose the field (salary, bonus, allowances, deductions) and provide a reason. A full history of every adjustment is kept.',
      },
      {
        qFr: 'Un bulletin de paie a été généré avec une erreur, que faire ?',
        aFr: 'Ne relancez jamais un cycle de paie complet pour corriger un seul bulletin — cela créerait un doublon. Modifiez le bulletin concerné individuellement, ou contactez le support si l\'erreur est déjà enregistrée comme payée.',
        qEn: 'A payslip was generated with an error, what do I do?',
        aEn: 'Never re-run a full payroll cycle to fix a single payslip — that would create a duplicate. Edit the affected payslip individually, or contact support if it\'s already marked as paid.',
      },
    ],
  },
  {
    key: 'employees',
    icon: Users,
    titleFr: 'Employés & congés',
    titleEn: 'Employees & leave',
    items: [
      {
        qFr: 'Comment fonctionne le solde de congés ?',
        aFr: 'Chaque employé dispose d\'un solde annuel (jours acquis + reportés − jours pris). Ce solde est mis à jour automatiquement dès qu\'une demande de congé est approuvée, et restauré si elle est annulée ou rejetée après coup.',
        qEn: 'How does the leave balance work?',
        aEn: 'Each employee has an annual balance (accrued + carried-over − used days). This balance updates automatically as soon as a leave request is approved, and is restored if later cancelled or rejected.',
      },
      {
        qFr: 'Qui peut approuver une demande de congé ?',
        aFr: 'Les rôles admin, RH manager et manager peuvent approuver ou rejeter les demandes. Un employé ne peut jamais approuver ses propres demandes.',
        qEn: 'Who can approve a leave request?',
        aEn: 'Admin, HR manager and manager roles can approve or reject requests. An employee can never approve their own requests.',
      },
    ],
  },
  {
    key: 'billing',
    icon: CreditCard,
    titleFr: 'Facturation & abonnement',
    titleEn: 'Billing & subscription',
    items: [
      {
        qFr: 'Quels moyens de paiement sont acceptés ?',
        aFr: 'Faka accepte le Mobile Money / Orange Money via PayUnit, ainsi que les cartes bancaires internationales via Stripe. Choisissez l\'option qui vous convient depuis Abonnement.',
        qEn: 'What payment methods are accepted?',
        aEn: 'Faka accepts Mobile Money / Orange Money via PayUnit, as well as international bank cards via Stripe. Choose whichever suits you from Subscription.',
      },
      {
        qFr: 'Que se passe-t-il si mon essai gratuit expire ?',
        aFr: 'Votre accès en lecture reste disponible, mais toute action (ajouter un employé, lancer une paie, approuver une demande...) est bloquée jusqu\'à la souscription d\'un plan payant.',
        qEn: 'What happens when my free trial expires?',
        aEn: 'Read access remains available, but any action (adding an employee, running payroll, approving a request...) is blocked until you subscribe to a paid plan.',
      },
      {
        qFr: 'Puis-je changer de plan à tout moment ?',
        aFr: 'Oui, depuis Abonnement vous pouvez passer à un plan supérieur ou inférieur à tout moment. Les modules et la limite d\'employés s\'ajustent immédiatement après confirmation du paiement.',
        qEn: 'Can I change plans at any time?',
        aEn: 'Yes, from Subscription you can upgrade or downgrade at any time. Modules and the employee limit update immediately once payment is confirmed.',
      },
    ],
  },
  {
    key: 'security',
    icon: ShieldCheck,
    titleFr: 'Sécurité & confidentialité',
    titleEn: 'Security & privacy',
    items: [
      {
        qFr: 'Mes données sont-elles isolées des autres entreprises ?',
        aFr: 'Oui, strictement. Chaque entreprise cliente est cloisonnée par des règles d\'accès appliquées au niveau de la base de données (Row Level Security) — aucun employé d\'une autre entreprise ne peut jamais accéder à vos données, quelle que soit la façon dont il essaierait d\'y accéder.',
        qEn: 'Is my data isolated from other companies?',
        aEn: 'Yes, strictly. Every client company is isolated by access rules enforced at the database level (Row Level Security) — no employee of another company can ever access your data, no matter how they attempt to.',
      },
      {
        qFr: 'Qui peut voir mon bulletin de paie ?',
        aFr: 'Uniquement vous et les rôles RH/paie de votre entreprise. Aucun autre employé, même avec un accès direct à l\'API, ne peut consulter le bulletin d\'un collègue.',
        qEn: 'Who can see my payslip?',
        aEn: 'Only you and your company\'s HR/payroll roles. No other employee, even with direct API access, can view a coworker\'s payslip.',
      },
    ],
  },
];

export default function HelpCenter() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        if (!q) return true;
        const question = lang === 'fr' ? it.qFr : it.qEn;
        const answer = lang === 'fr' ? it.aFr : it.aEn;
        return question.toLowerCase().includes(q) || answer.toLowerCase().includes(q);
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [query, lang]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
      <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-ink-800/60 backdrop-blur-xl flex items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="Faka" className="w-8 h-8 rounded-lg shadow-glow" />
          <span className="font-display text-lg font-semibold text-slate-900 dark:text-white">Faka</span>
        </Link>
        <Link to="/" className="btn-ghost text-sm">← {t('nav.home')}</Link>
      </header>

      <div className="bg-white dark:bg-ink-800 border-b border-slate-200 dark:border-white/10">
        <div className="section py-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 px-3 py-1.5 text-xs text-coral-700 dark:text-coral-300 mb-4">
            <LifeBuoy size={14} /> {lang === 'fr' ? 'Centre d\'aide' : 'Help Center'}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {lang === 'fr' ? 'Comment pouvons-nous vous aider ?' : 'How can we help you?'}
          </h1>
          <div className="mt-6 max-w-lg mx-auto relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'fr' ? 'Rechercher une question...' : 'Search a question...'}
              className="input pl-11 w-full"
            />
          </div>
        </div>
      </div>

      <div className="section py-14 max-w-3xl">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 dark:text-white/50">
              {lang === 'fr' ? 'Aucun résultat pour cette recherche.' : 'No results for this search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map((cat) => (
              <div key={cat.key}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300">
                    <cat.icon size={18} />
                  </div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    {lang === 'fr' ? cat.titleFr : cat.titleEn}
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {cat.items.map((it, i) => {
                    const itemKey = `${cat.key}-${i}`;
                    const isOpen = openKey === itemKey;
                    const question = lang === 'fr' ? it.qFr : it.qEn;
                    const answer = lang === 'fr' ? it.aFr : it.aEn;
                    return (
                      <div key={itemKey} className="card overflow-hidden">
                        <button
                          onClick={() => setOpenKey(isOpen ? null : itemKey)}
                          className="w-full flex items-center justify-between gap-4 p-4 text-left"
                        >
                          <span className="text-slate-900 dark:text-white font-medium text-sm">{question}</span>
                          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-sm text-slate-600 dark:text-white/60 leading-relaxed whitespace-pre-line">
                            {answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 card p-8 text-center bg-sage-50 dark:bg-white/5">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            {lang === 'fr' ? 'Vous ne trouvez pas votre réponse ?' : "Can't find your answer?"}
          </h3>
          <p className="mt-2 text-slate-600 dark:text-white/60 text-sm">
            {lang === 'fr' ? 'Notre équipe support est là pour vous aider.' : 'Our support team is here to help.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a href="mailto:support@faka-hr.com" className="btn-primary text-sm">
              <Mail size={16} /> support@faka-hr.com
            </a>
            <Link to="/page/contact" className="btn-ghost text-sm">
              <MessageCircle size={16} /> {lang === 'fr' ? 'Page contact' : 'Contact page'}
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 dark:border-white/10">
        <div className="section py-5 text-sm text-slate-500 dark:text-white/50 text-center">
          {t('footer.tagline')}
        </div>
      </footer>
    </div>
  );
}
