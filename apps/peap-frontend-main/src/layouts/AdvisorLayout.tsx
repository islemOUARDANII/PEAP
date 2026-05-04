import { useAuth } from '@/app/auth';
import type { Role } from '@/models';
import { RoleLayout } from './RoleLayout';

function resolveAdvisorAreaRole(roles: string[] = []): Role {
  const normalizedRoles = roles.map((role) => role.trim().toUpperCase());

  if (normalizedRoles.includes('TECH_ADMIN')) {
    return 'techAdmin';
  }

  if (normalizedRoles.includes('FUNCTIONAL_ADMIN')) {
    return 'functionalAdmin';
  }

  return 'advisor';
}

export function AdvisorLayout() {
  const { session } = useAuth();

  const role = resolveAdvisorAreaRole(session?.user.roles ?? []);

  return <RoleLayout role={role} />;
}