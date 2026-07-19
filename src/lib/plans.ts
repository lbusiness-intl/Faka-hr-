export type PlanId = 'starter' | 'pro' | 'premium' | 'enterprise';

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  employeeLimit: number | null; // null = unlimited
  features: string[];
  modules: string[]; // module keys unlocked by this plan
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 9,
    priceYearly: 86,
    employeeLimit: 15,
    features: ['Core HR', 'Contrats', 'Paie de base', 'Portail employé', 'Support email'],
    modules: ['dashboard', 'employees', 'payroll', 'leaves', 'attendance', 'subscription'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 19,
    priceYearly: 182,
    employeeLimit: 50,
    features: ['Tout Starter', 'Recrutement + Kanban', 'Formation / LMS', 'Avances & notes de frais', 'Support prioritaire'],
    modules: ['dashboard', 'employees', 'payroll', 'leaves', 'attendance', 'recruitment', 'training', 'advances', 'claims', 'subscription'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 49,
    priceYearly: 470,
    employeeLimit: 150,
    highlight: true,
    features: ['Tout Pro', 'Conformité + lettres RH', 'Performance / OKR', 'Évaluations 360°', 'Gestion des actifs'],
    modules: ['dashboard', 'employees', 'payroll', 'leaves', 'attendance', 'recruitment', 'training', 'advances', 'claims', 'compliance', 'performance', 'goals', 'reviews', 'assets', 'events', 'subscription'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 129,
    priceYearly: 1238,
    employeeLimit: null,
    features: ['Tout Premium', 'Workflow Automation', 'Multi-sites illimité', 'SSO/SAML', 'Account manager dédié'],
    modules: [
      'dashboard', 'employees', 'payroll', 'leaves', 'attendance', 'recruitment', 'training',
      'advances', 'claims', 'compliance', 'performance', 'goals', 'reviews', 'assets',
      'events', 'communication', 'subscription', 'settings',
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function recommendPlan(employeeCount: number): Plan {
  if (employeeCount <= 15) return PLANS[0];
  if (employeeCount <= 50) return PLANS[1];
  if (employeeCount <= 150) return PLANS[2];
  return PLANS[3];
}

// All module keys that can appear in the sidebar
export const ALL_MODULES = [
  'dashboard', 'employees', 'payroll', 'leaves', 'advances', 'claims', 'attendance',
  'recruitment', 'training', 'performance', 'goals', 'reviews', 'assets',
  'compliance', 'communication', 'events', 'subscription', 'settings',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export function isModuleUnlocked(planId: PlanId, module: string): boolean {
  const plan = getPlan(planId);
  return plan.modules.includes(module);
}
