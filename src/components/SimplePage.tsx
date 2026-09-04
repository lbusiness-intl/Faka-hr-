import { useI18n } from '../lib/i18n';
import { Link } from '../lib/router';
import { ShieldCheck, FileText, Mail, Info, Lock, Activity } from 'lucide-react';

const PAGES: Record<string, { icon: typeof Info; titleFr: string; titleEn: string; bodyFr: string; bodyEn: string }> = {
  about: {
    icon: Info,
    titleFr: 'À propos de Faka',
    titleEn: 'About Faka',
    bodyFr: `Faka est une plateforme de gestion des ressources humaines de classe internationale, conçue pour les entreprises modernes du monde entier. Développée par LiAfrik, Faka digitalise le cycle complet du collaborateur : contrats, paie multicanal, congés, présence, recrutement, formation et conformité.\n\nNotre mission : rendre la gestion RH simple, accessible et conforme aux normes internationales — paiements mobiles, multi-devises, bilingue FR/EN, isolation multi-tenant stricte.`,
    bodyEn: `Faka is a world-class human resources management platform built for modern enterprises worldwide. Developed by LiAfrik, Faka digitizes the complete employee lifecycle: contracts, multi-channel payroll, leave, attendance, recruitment, training and compliance.\n\nOur mission: make HR management simple, accessible and compliant with international standards — mobile payments, multi-currency, bilingual FR/EN, strict multi-tenant isolation.`,
  },
  contact: {
    icon: Mail,
    titleFr: 'Contactez-nous',
    titleEn: 'Contact us',
    bodyFr: `LiAfrik\nEmail : contact@faka-hr.com\nDouala, Cameroun\n\nPour le support technique : support@faka-hr.com\nPour les partenariats : partners@faka-hr.com`,
    bodyEn: `LiAfrik\nEmail: contact@faka-hr.com\nDouala, Cameroon\n\nTechnical support: support@faka-hr.com\nPartnerships: partners@faka-hr.com`,
  },
  privacy: {
    icon: Lock,
    titleFr: 'Politique de confidentialité',
    titleEn: 'Privacy Policy',
    bodyFr: `Faka s'engage à protéger vos données personnelles et celles de vos employés. Toutes les données sont stockées de manière chiffrée et isolées par tenant via Row Level Security (RLS) PostgreSQL.\n\nNous ne vendons jamais vos données. Vous pouvez exporter ou supprimer l'intégralité de vos données à tout moment depuis votre espace paramètres.\n\nConformité RGPD et lois locales de protection des données.`,
    bodyEn: `Faka is committed to protecting your personal data and that of your employees. All data is stored encrypted and isolated per tenant via PostgreSQL Row Level Security (RLS).\n\nWe never sell your data. You can export or delete all of your data at any time from your settings.\n\nGDPR compliant and aligned with local data protection laws.`,
  },
  terms: {
    icon: FileText,
    titleFr: "Conditions d'utilisation",
    titleEn: 'Terms of Service',
    bodyFr: `En utilisant Faka, vous acceptez les conditions suivantes :\n\n1. Vous êtes responsable de l'exactitude des données saisies.\n2. Faka est un outil de gestion RH — les décisions juridiques restent les vôtres.\n3. L'essai gratuit dure 7 jours. Après cette période, un abonnement actif est requis.\n4. Les paiements sont traités via Stripe ou les méthodes mobiles supportées.\n5. LiAfrik se réserve le droit de suspendre un compte en cas d'usage abusif.\n\nPour toute question : legal@faka-hr.com`,
    bodyEn: `By using Faka, you agree to the following terms:\n\n1. You are responsible for the accuracy of entered data.\n2. Faka is an HR management tool — legal decisions remain yours.\n3. The free trial lasts 7 days. After this period, an active subscription is required.\n4. Payments are processed via Stripe or supported mobile methods.\n5. LiAfrik reserves the right to suspend an account in case of abusive use.\n\nFor any question: legal@faka-hr.com`,
  },
  security: {
    icon: ShieldCheck,
    titleFr: 'Sécurité',
    titleEn: 'Security',
    bodyFr: `Sécurité technique :\n• Chiffrement des données en transit (TLS) et au repos\n• Isolation multi-tenant via Row Level Security PostgreSQL\n• Authentification Supabase avec sessions persistantes\n• Edge Functions avec service-role isolé\n• Audits de sécurité réguliers\n\nSignaler une vulnérabilité : security@faka-hr.com`,
    bodyEn: `Technical security:\n• Data encryption in transit (TLS) and at rest\n• Multi-tenant isolation via PostgreSQL Row Level Security\n• Supabase authentication with persistent sessions\n• Edge Functions with isolated service-role\n• Regular security audits\n\nReport a vulnerability: security@faka-hr.com`,
  },
  status: {
    icon: Activity,
    titleFr: "État du service",
    titleEn: 'Service Status',
    bodyFr: `Tous les systèmes sont opérationnels.\n\n• Application web : Opérationnel\n• Base de données : Opérationnel\n• Edge Functions : Opérationnel\n• Paiements Stripe : Opérationnel\n\nDernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}`,
    bodyEn: `All systems are operational.\n\n• Web Application: Operational\n• Database: Operational\n• Edge Functions: Operational\n• Stripe Payments: Operational\n\nLast updated: ${new Date().toLocaleDateString('en-US')}`,
  },
  cookies: {
    icon: Lock,
    titleFr: 'Politique de cookies',
    titleEn: 'Cookie Policy',
    bodyFr: `Faka utilise un nombre limité de cookies et de stockage local :\n\n• Cookies essentiels : session de connexion, préférence de langue, préférence de thème (clair/sombre) — nécessaires au fonctionnement du site, toujours actifs.\n• Cookies de mesure d'audience : aucun à ce jour.\n• Cookies publicitaires : aucun — Faka n'affiche aucune publicité et ne partage aucune donnée avec des régies publicitaires.\n\nVous pouvez gérer votre consentement via le bandeau affiché lors de votre première visite, ou en effaçant les données de votre navigateur pour ce site à tout moment.\n\nPour toute question : privacy@faka-hr.com`,
    bodyEn: `Faka uses a limited number of cookies and local storage entries:\n\n• Essential cookies: login session, language preference, theme preference (light/dark) — required for the site to function, always active.\n• Audience-measurement cookies: none at this time.\n• Advertising cookies: none — Faka does not display ads and does not share data with ad networks.\n\nYou can manage your consent via the banner shown on your first visit, or by clearing your browser data for this site at any time.\n\nFor any question: privacy@faka-hr.com`,
  },
  refund: {
    icon: FileText,
    titleFr: 'Politique de remboursement',
    titleEn: 'Refund Policy',
    bodyFr: `• Essai gratuit : 7 jours, sans carte bancaire requise, sans engagement.\n• Abonnements mensuels : vous pouvez annuler à tout moment depuis Abonnement ; l'accès reste actif jusqu'à la fin de la période déjà payée, sans remboursement au prorata de la période en cours.\n• Abonnements annuels : en cas d'annulation en cours d'année, aucun remboursement automatique n'est effectué pour la période restante, sauf accord exprès de LiAfrik.\n• Erreur de facturation ou double paiement : contactez-nous sous 30 jours, un remboursement complet sera effectué après vérification.\n• Les remboursements approuvés sont crédités sur le moyen de paiement d'origine (carte, Mobile Money) sous 5 à 10 jours ouvrés selon votre fournisseur de paiement.\n\nPour toute demande : billing@faka-hr.com`,
    bodyEn: `• Free trial: 7 days, no card required, no commitment.\n• Monthly subscriptions: cancel any time from Subscription; access remains active until the end of the period already paid for, with no prorated refund for the current period.\n• Annual subscriptions: cancelling mid-year does not trigger an automatic refund for the remaining period, unless expressly agreed by LiAfrik.\n• Billing error or duplicate charge: contact us within 30 days, a full refund will be issued after verification.\n• Approved refunds are credited to the original payment method (card, Mobile Money) within 5–10 business days depending on your payment provider.\n\nFor any request: billing@faka-hr.com`,
  },
  legal: {
    icon: Info,
    titleFr: 'Mentions légales',
    titleEn: 'Legal Notice',
    bodyFr: `Éditeur du site\nFaka est édité par LiAfrik, basée à Douala, Cameroun.\nContact : contact@faka-hr.com\n\nHébergement\nLes données applicatives sont hébergées par Supabase (infrastructure cloud). Les paiements sont traités par des prestataires tiers certifiés (Stripe, PayUnit).\n\nPropriété intellectuelle\nLa marque Faka, son logo et l'ensemble des contenus de ce site sont la propriété de LiAfrik, sauf mention contraire.\n\nNote : les informations d'immatriculation légale complètes (SIRET/RCCM, forme juridique, capital social) seront ajoutées à cette page dès communication par LiAfrik.`,
    bodyEn: `Publisher\nFaka is published by LiAfrik, based in Douala, Cameroon.\nContact: contact@faka-hr.com\n\nHosting\nApplication data is hosted by Supabase (cloud infrastructure). Payments are processed by certified third-party providers (Stripe, PayUnit).\n\nIntellectual property\nThe Faka trademark, its logo, and all content on this site are the property of LiAfrik, unless otherwise stated.\n\nNote: full legal registration details (business registry number, legal form, share capital) will be added to this page once provided by LiAfrik.`,
  },
};

export default function SimplePage() {
  const { t, lang } = useI18n();
  const slug = window.location.hash.replace(/^#\/page\//, '').split('?')[0];
  const page = PAGES[slug];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
      <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-ink-800/60 backdrop-blur-xl flex items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="Faka" className="w-8 h-8 rounded-lg shadow-glow" />
          <span className="font-display text-lg font-bold text-slate-900 dark:text-white">Faka</span>
        </Link>
        <Link to="/" className="btn-ghost text-sm">← {t('nav.home')}</Link>
      </header>
      <div className="section py-12 max-w-2xl">
        {page ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-coral-100 dark:bg-coral-500/10 border border-coral-200 dark:border-coral-500/30 flex items-center justify-center text-coral-600 dark:text-coral-300 mb-5">
              <page.icon size={24} />
            </div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-6">
              {lang === 'fr' ? page.titleFr : page.titleEn}
            </h1>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {(lang === 'fr' ? page.bodyFr : page.bodyEn).split('\n\n').map((para, i) => (
                <p key={i} className="text-slate-600 dark:text-white/70 leading-relaxed mb-4 whitespace-pre-line">{para}</p>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-3">404</h1>
            <p className="text-slate-500 dark:text-white/50 mb-6">Page introuvable.</p>
            <Link to="/" className="btn-primary">← {t('nav.home')}</Link>
          </div>
        )}
      </div>
      <footer className="border-t border-slate-200 dark:border-white/10">
        <div className="section py-5 text-sm text-slate-500 dark:text-white/50 text-center">
          {t('footer.tagline')}
        </div>
      </footer>
    </div>
  );
}
