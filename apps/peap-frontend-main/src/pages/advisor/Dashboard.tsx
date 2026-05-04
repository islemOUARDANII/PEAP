import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Lock,
  Search,
  Settings,
  UserCog,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';

function AdvisorActionCard({
  title,
  description,
  icon: Icon,
  to,
  disabled = false,
  badge,
}: {
  title: string;
  description: string;
  icon: typeof Brain;
  to?: string;
  disabled?: boolean;
  badge?: string;
}) {
  const content = (
    <div
      className={`panel h-full p-5 transition ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-muted">
            <Icon className="h-5 w-5 text-accent" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {badge ? (
                <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {badge}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm leading-6 text-muted-foreground ">
              {description}
            </p>
          </div>
        </div>

        {disabled && (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* {disabled ? (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )} */}
      </div>
    </div>
  );

  if (disabled || !to) {
    return content;
  }

  return (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  );
}

export default function AdvisorDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace Conseiller"
        description="Pilotez la recherche, le matching et l’analyse des profils candidats et des offres."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/advisor/activity">
              <Activity className="mr-2 h-4 w-4" />
              Sommaire d’activité
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdvisorActionCard
          title="Moteur de matching"
          description="Lancer un matching offre → candidats ou candidat → offres, choisir le modèle utilisé et consulter les critères/poids."
          icon={Brain}
          to="/advisor/matching"
          badge="Score & explications"
        />

        <AdvisorActionCard
          title="Moteur de recherche"
          description="Rechercher dans l’index des candidats ou des offres via le search-service, sans lancer de calcul de matching."
          icon={Search}
          to="/advisor/search"
          badge="Search-service"
        />

        <AdvisorActionCard
          title="Gap analysis"
          description="Identifier les écarts entre un profil candidat et les exigences d’une offre, puis proposer des recommandations."
          icon={BarChart3}
          disabled
          badge="Bientôt disponible"
        />
      </div>

      {/* <div className="grid gap-4 md:grid-cols-2">
        <AdvisorActionCard
          title="Gestion de votre compte"
          description="Consulter les informations du compte conseiller, rôle, accès et paramètres personnels."
          icon={UserCog}
          to="/advisor/account"
        />

        <AdvisorActionCard
          title="Sommaire d’activité"
          description="Voir les dernières actions, recherches, matchings lancés et événements importants de l’espace conseiller."
          icon={Activity}
          to="/advisor/activity"
        />
      </div> */}

      {/* <div className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Rappel métier
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Le conseiller utilise principalement les moteurs de recherche et de
              matching. La configuration des modèles, critères et poids reste
              réservée à l’admin fonctionnel.
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
}
