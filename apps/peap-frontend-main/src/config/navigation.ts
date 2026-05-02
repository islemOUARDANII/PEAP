import type { Role } from '@/models';
import {
  Briefcase,
  FilePlus2,
  FileText,
  LayoutDashboard,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

interface NavLeaf {
  to: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  end?: boolean;
  tooltip?: string;
}
interface NavParent {
  label: string;
  icon: LucideIcon;
  tooltip?: string;
  end?: boolean;
  children: NavLeaf[];
}

type NavItem = (NavLeaf & { icon: LucideIcon }) | NavParent;

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface RoleNavigation {
  brand: string;
  groups: NavGroup[];
}

export interface SearchTarget {
  to: string;
  label: string;
  description: string;
  keywords: string[];
}

export const navByRole: Record<Role, RoleNavigation> = {
  candidate: {
    brand: 'Espace Candidat',
    groups: [
      {
        label: 'Navigation',
        items: [
          { to: '/candidate', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/candidate/profile', label: 'Mon CV', icon: FileText },
          { to: '/candidate/demo-offers', label: 'Offres', icon: Briefcase },
        ],
      },
    ],
  },
  provider: {
    brand: 'Espace Employeur',
    groups: [
      {
        label: 'Navigation',
        items: [
          { to: '/provider', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/provider/offers', label: 'Mes offres', icon: Briefcase },
        ],
      },
      {
        label: 'Offre',
        items: [
          {
            label: 'Recrutement',
            icon: FilePlus2,
            children: [
              {
                to: '/provider/offers/new',
                label: 'Creer une offre',
              },
              {
                to: '/provider/offers/search',
                label: 'Recherche candidats',
              },
            ],
          },
        ],
      },
    ],
  },
  advisor: {
    brand: 'Espace Conseiller',
    groups: [
      {
        label: 'Navigation',
        items: [{ to: '/advisor', label: 'Dashboard', icon: LayoutDashboard }],
      },
      {
        label: 'Matching',
        items: [
          {
            to: '/advisor/matching',
            label: 'Lancer un matching',
            icon: FileText,
          },
          {
            to: '/advisor/matching-config',
            label: 'Configuration matching',
            icon: SlidersHorizontal,
          },
        ],
      },
    ],
  },
};

export const searchTargetsByRole: Record<Role, SearchTarget[]> = {
  candidate: [
    {
      to: '/candidate/demo-cv',
      label: 'Mon CV',
      description: 'Uploader un CV, relire le profil extrait et le valider.',
      keywords: ['cv', 'profil', 'upload', 'validation', 'skills', 'languages'],
    },
    {
      to: '/candidate/demo-offers',
      label: 'Offres',
      description: 'Search offers matched to your validated demo profile.',
      keywords: ['offer', 'score', 'cv', 'company', 'skill', 'location'],
    },
  ],
  provider: [
    {
      to: '/provider/offers',
      label: 'Mes offres',
      description: 'Consulter les offres stockees dans la vraie base employeur.',
      keywords: ['offer', 'job', 'list', 'db', 'backend'],
    },
    {
      to: '/provider/offers/new',
      label: 'Creer une offre',
      description: 'Parser une offre avec le backend reel puis la soumettre.',
      keywords: [
        'job',
        'offer',
        'parser',
        'create',
        'backend',
        'requirements',
      ],
    },
    {
      to: '/provider/offers/search',
      label: 'Recherche candidats',
      description: 'Rechercher de vrais candidats a partir de vos vraies offres.',
      keywords: [
        'candidate',
        'search',
        'matching',
        'skills',
        'location',
      ],
    },
  ],
  advisor: [
    {
      to: '/advisor/matching',
      label: 'Matching',
      description: 'Lancer un matching reel, suivre le run et relire les resultats.',
      keywords: ['matching', 'run', 'result', 'decision', 'score', 'model'],
    },
    {
      to: '/advisor/matching-config',
      label: 'Configuration matching',
      description: 'Creer les modeles, versions, criteres et hard filters du matching.',
      keywords: ['model', 'criteria', 'weights', 'version', 'admin', 'matching'],
    },
  ],
};
