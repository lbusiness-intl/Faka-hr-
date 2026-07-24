import type { ReactNode } from 'react';
import { useAuth, type AppRole } from './auth';

export const PERMISSION_DEFAULTS: Record<string, AppRole[]> = {
  'employees.view':       ['admin','hr_manager','hr_assistant','manager','team_lead'],
  'employees.create':     ['admin','hr_manager'],
  'employees.edit':       ['admin','hr_manager'],
  'employees.delete':     ['admin'],
  'payroll.view':         ['admin','payroll_officer','finance'],
  'payroll.run':          ['admin','payroll_officer'],
  'payroll.approve':      ['admin','finance'],
  'leaves.view':          ['admin','hr_manager','hr_assistant','manager','team_lead'],
  'leaves.approve':       ['admin','hr_manager','manager'],
  'recruitment.view':     ['admin','hr_manager','recruiter'],
  'recruitment.manage':   ['admin','hr_manager','recruiter'],
  'documents.view_all':   ['admin','hr_manager'],
  'documents.upload':     ['admin','hr_manager','hr_assistant'],
  'comms.send':           ['admin','hr_manager','hr_assistant','manager'],
  'comms.view_all':       ['admin','hr_manager'],
  'settings.branches':    ['admin'],
  'settings.departments': ['admin','hr_manager'],
  'settings.roles':       ['admin'],
  'finance.view':         ['admin','finance'],
  'finance.export':       ['admin','finance'],
  'attendance.view':      ['admin','hr_manager','hr_assistant','manager','team_lead'],
  'overtime.approve':     ['admin','hr_manager','manager'],
  'advances.approve':     ['admin','hr_manager','payroll_officer','finance'],
  'claims.approve':       ['admin','hr_manager','finance'],
  'assets.manage':        ['admin','hr_manager'],
  'recruitment.interview':['admin','hr_manager','recruiter','manager'],
};

export function usePermission(key: string): boolean {
  const { activeRole, activeMembership } = useAuth();
  if (!activeRole) return false;
  if (activeRole === 'super_admin' || activeRole === 'admin') return true;
  const customPerms = activeMembership?.custom_role?.permissions ?? [];
  if (customPerms.length > 0) return customPerms.includes(key);
  return PERMISSION_DEFAULTS[key]?.includes(activeRole) ?? false;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export const ROLE_COLORS: Record<string, string> = {
  super_admin:     '#dc2626',
  admin:           '#f97316',
  hr_manager:      '#8b5cf6',
  hr_assistant:    '#a78bfa',
  recruiter:       '#06b6d4',
  payroll_officer: '#10b981',
  finance:         '#3b82f6',
  manager:         '#f59e0b',
  team_lead:       '#84cc16',
  employee:        '#6b7280',
};

export const ALL_STANDARD_ROLES: AppRole[] = [
  'admin','hr_manager','hr_assistant','recruiter',
  'payroll_officer','finance','manager','team_lead','employee',
];
