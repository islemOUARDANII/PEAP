import {
  UserCog,
  Briefcase,
  SlidersHorizontal,
  Wrench,
  Building2,
  type LucideIcon,
} from 'lucide-react';

export type PortalRoleId =
  | 'conseiller'
  | 'office-manager'
  | 'functional-admin'
  | 'technical-admin'
  | 'executive';

export interface PortalRole {
  id: PortalRoleId;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  /** Dashboard route to land on after login */
  dashboard: string;
}

export const portalRoles: PortalRole[] = [
  {
    id: 'conseiller',
    label: 'Conseiller',
    subtitle: 'Conseiller ANETI',
    description: 'Guide candidates, review matches and curate recommendations.',
    icon: UserCog,
    dashboard: '/advisor',
  },
  {
    id: 'office-manager',
    label: 'Chef de bureau',
    subtitle: 'BETI - Chef de bureau',
    description: "Oversee your team's pipeline, workload and performance.",
    icon: Briefcase,
    dashboard: '/advisor',
  },
  {
    id: 'functional-admin',
    label: 'Admin Fonctionnel',
    subtitle: 'Configuration metie ',
    description: 'Manage taxonomy, matching models, criteria weights and business rules.',
    icon: SlidersHorizontal,
    dashboard: '/advisor/matching-config',
  },
  {
    id: 'technical-admin',
    label: 'Admin Technique',
    subtitle: 'Operations de Platform',
    description: 'Monitor pipelines, audit logs and system integrations.',
    icon: Wrench,
    dashboard: '/advisor/pipeline',
  },
  {
    id: 'executive',
    label: 'Candidate',
    subtitle: 'Chercheur d\'emploi',
    description: 'Accédez à votre profil, et gérez votre recherche d\'emploi.',
    icon: Building2,
    dashboard: '/advisor',
  },
];

export const getPortalRole = (id: string): PortalRole | undefined =>
  portalRoles.find((r) => r.id === id);
