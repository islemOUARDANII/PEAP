import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Search, UserRound } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';

function SearchChoiceCard({
  title,
  description,
  icon: Icon,
  to,
}: {
  title: string;
  description: string;
  icon: typeof Search;
  to: string;
}) {
  return (
    <Link to={to} className="block">
      <div className="panel h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md card-border-left-orange border-color-aneti-orange">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-muted">
              <Icon className="h-5 w-5 text-accent" />
            </div>

            <div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>

          {/* <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /> */}
        </div>
      </div>
    </Link>
  );
}

export default function AdvisorSearchHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Moteur de recherche"
        description="Rechercher des candidats ou des offres via le search-service."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SearchChoiceCard
          title="Recherche candidats"
          description="Afficher tous les candidats indexés et rechercher par compétence, métier, localisation ou mot-clé."
          icon={UserRound}
          to="/advisor/search/candidates"
        />

        <SearchChoiceCard
          title="Recherche offres"
          description="Afficher toutes les offres publiées et rechercher par métier, compétence, localisation ou contrat."
          icon={Briefcase}
          to="/advisor/search/offers"
        />
      </div>
    </div>
  );
}
