import {
  UserCog,
  BriefcaseBusiness,
  SlidersHorizontal,
  Wrench,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export type PortalRoleId =
  | 'advisor'
  | 'provider'
  | 'functional-admin'
  | 'technical-admin'
  | 'candidate';

export interface PortalRole {
  id: PortalRoleId;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  dashboard: string;
}

export const portalRoles: PortalRole[] = [
  {
    id: 'advisor',
    label: 'Conseiller ANETI',
    subtitle: 'Accompagnement et orientation',
    description:
      'Consulter les candidats, rechercher des offres, lancer des matchings et analyser les recommandations.',
    icon: UserCog,
    dashboard: '/advisor',
  },
  {
    id: 'provider',
    label: 'Employeur',
    subtitle: 'Entreprise / recruteur',
    description:
      'Publier des offres, rechercher des candidats, consulter les candidatures reçues et suivre vos recrutements.',
    icon: BriefcaseBusiness,
    dashboard: '/provider',
  },
  {
    id: 'functional-admin',
    label: 'Admin fonctionnel',
    subtitle: 'Configuration métier',
    description:
      'Configurer les modèles de matching, les critères, les poids, les règles métier et les référentiels.',
    icon: SlidersHorizontal,
    dashboard: '/advisor/functional-admin',
  },
  {
    id: 'technical-admin',
    label: 'Admin technique',
    subtitle: 'Monitoring plateforme',
    description:
      'Surveiller les services, les pipelines, les intégrations, les logs techniques et la santé du système.',
    icon: Wrench,
    dashboard: '/advisor/technical-admin',
  },
  {
    id: 'candidate',
    label: 'Candidat',
    subtitle: "Chercheur d'emploi",
    description:
      "Accéder à votre profil, consulter les offres, postuler et suivre vos recommandations d'emploi.",
    icon: UserRound,
    dashboard: '/candidate',
  },
];

export const getPortalRole = (id: string): PortalRole | undefined =>
  portalRoles.find((role) => role.id === id);