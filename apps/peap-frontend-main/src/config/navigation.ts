import type { Role } from '@/models';
import {
  Activity,
  Briefcase,
  FilePlus2,
  FileText,
  Layers,
  LayoutDashboard,
  Search,
  SlidersHorizontal,
  UserCog,
  UserPlus,
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
          { to: '/candidate', label: 'Tableau de bord', icon: LayoutDashboard },
          { to: '/candidate/profile', label: 'Mon profil', icon: FileText },
          { to: '/candidate/offers', label: 'Offres', icon: Briefcase },
        ],
      },
      {
        label: 'Outils',
        items: [
          { to: '/candidate/search/offers', label: 'Recherche offres', icon: Search },
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
        label: 'Recherche',
        items: [
          { to: '/provider/search/offers', label: 'Recherche offres', icon: Search },
          { to: '/provider/search/candidates', label: 'Recherche candidats', icon: Search },
        ],
      },
      {
        label: 'Recrutement',
        items: [
          {
            label: 'Offre',
            icon: FilePlus2,
            children: [
              { to: '/provider/offers/new', label: 'Créer une offre' },
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
        items: [
          { to: '/advisor', label: 'Tableau de bord', icon: LayoutDashboard },
          { to: '/advisor/account', label: 'Mon compte', icon: UserCog },
          { to: '/advisor/activity', label: 'Activité récente', icon: Activity },
        ],
      },
      {
        label: 'Outils',
        items: [
          { to: '/advisor/search', label: 'Recherche', icon: Search },
          { to: '/advisor/matching', label: 'Matching', icon: FileText },
        ],
      },
      {
        label: 'Actions',
        items: [
          { to: '/advisor/create-candidate', label: 'Créer un candidat', icon: UserPlus },
          { to: '/advisor/create-offer', label: 'Créer une offre', icon: Briefcase },
        ],
      },
    ],
  },

  functionalAdmin: {
    brand: 'Admin fonctionnel',
    groups: [
      {
        label: 'Recherche',
        items: [
          { to: '/advisor/search/offers', label: 'Recherche offres', icon: Search },
          { to: '/advisor/search/candidates', label: 'Recherche candidats', icon: Search },
        ],
      },
      {
        label: 'Configuration',
        items: [
          {
            to: '/advisor/functional-admin',
            label: 'Modèles de matching',
            icon: SlidersHorizontal,
          },
          {
            to: '/advisor/matching-config',
            label: 'Critères de scoring',
            icon: FileText,
          },
          {
            to: '/advisor/segments',
            label: 'Segments cibles',
            icon: Layers,
          },
        ],
      },
      {
        label: 'Suivi',
        items: [
          { to: '/advisor/activity', label: 'Activité récente', icon: Activity },
        ],
      },
    ],
  },

  techAdmin: {
    brand: 'Admin technique',
    groups: [
      {
        label: 'Surveillance',
        items: [
          {
            to: '/advisor/technical-admin',
            label: 'Santé du système',
            icon: LayoutDashboard,
          },
          {
            to: '/advisor/pipeline',
            label: 'Pipelines de données',
            icon: Activity,
          },
          {
            to: '/advisor/audit',
            label: 'Logs & audit',
            icon: FileText,
          },
        ],
      },
    ],
  },
};

export const searchTargetsByRole: Record<Role, SearchTarget[]> = {
  candidate: [
    {
      to: '/candidate/profile',
      label: 'Mon profil',
      description: 'Consulter et mettre a jour votre profil candidat.',
      keywords: ['profil', 'cv', 'competences', 'langues', 'experience'],
    },
    {
      to: '/candidate/offers',
      label: 'Offres',
      description: 'Consulter les offres compatibles avec votre profil.',
      keywords: ['offres', 'matching', 'score', 'competences', 'localisation'],
    },
  ],
  provider: [
    {
      to: '/provider/offers',
      label: 'Mes offres',
      description:
        'Consulter les offres stockees dans la vraie base employeur.',
      keywords: ['offer', 'job', 'list', 'db', 'backend'],
    },
    {
      to: '/provider/offers/new',
      label: 'Creer une offre',
      description: 'Parser une offre avec le backend reel puis la soumettre.',
      keywords: ['job', 'offer', 'parser', 'create', 'backend', 'requirements'],
    },
    {
      to: '/provider/offers/search',
      label: 'Recherche candidats',
      description:
        'Rechercher de vrais candidats a partir de vos vraies offres.',
      keywords: ['candidate', 'search', 'matching', 'skills', 'location'],
    },
  ],
  advisor: [
    {
      to: '/advisor/search',
      label: 'Moteur de recherche',
      description:
        'Rechercher des candidats ou des offres via le search-service.',
      keywords: ['search', 'recherche', 'candidat', 'offre', 'index'],
    },
    {
      to: '/advisor/matching',
      label: 'Moteur de matching',
      description:
        'Lancer un matching réel, choisir le modèle et consulter les résultats.',
      keywords: ['matching', 'score', 'model', 'criteria', 'poids'],
    },
    {
      to: '/advisor/account',
      label: 'Gestion du compte',
      description: 'Consulter les paramètres du compte conseiller.',
      keywords: ['compte', 'profil', 'advisor'],
    },
    {
      to: '/advisor/activity',
      label: "Sommaire d'activité",
      description: 'Consulter les dernières actions du conseiller.',
      keywords: ['activité', 'audit', 'historique', 'logs'],
    },
  ],
  functionalAdmin: [
    {
      to: '/advisor/functional-admin',
      label: 'Configuration moteurs',
      description:
        'Créer, modifier ou consulter les modèles de matching et les règles métier.',
      keywords: ['configuration', 'moteur', 'matching', 'critères', 'poids'],
    },
    {
      to: '/advisor/matching-config',
      label: 'Critères & poids',
      description:
        'Gérer les critères, les poids et les versions des modèles de matching.',
      keywords: ['critères', 'poids', 'modèle', 'version', 'matching'],
    },
    {
      to: '/advisor/segments',
      label: 'Groupes cibles',
      description: 'Créer et gérer les segments de ciblage et leurs règles de qualification.',
      keywords: ['segment', 'groupe', 'cible', 'règle', 'ciblage', 'target'],
    },
    {
      to: '/advisor/activity',
      label: "Sommaire d'activité",
      description: "Consulter l'activité fonctionnelle récente.",
      keywords: ['activité', 'historique', 'audit'],
    },
  ],

  techAdmin: [
    {
      to: '/advisor/technical-admin',
      label: 'Santé système',
      description:
        'Superviser la disponibilité des services et composants techniques.',
      keywords: ['monitoring', 'service', 'health', 'santé', 'technique'],
    },
    {
      to: '/advisor/pipeline',
      label: 'Pipelines',
      description: 'Surveiller les pipelines techniques de la plateforme.',
      keywords: ['pipeline', 'kafka', 'sync', 'indexation'],
    },
    {
      to: '/advisor/audit',
      label: 'Logs & audit',
      description: 'Consulter les logs et événements techniques.',
      keywords: ['logs', 'audit', 'erreur', 'trace'],
    },
  ],
};
