import { SkillTag } from './SkillTag';
import { ScoreBadge } from './ScoreBadge';
import { Briefcase, Building2, MapPin, Sparkles } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { MatchRing } from './MatchScore';

const OfferCardCandidat = ({ offer }) => {
  return (
    <article
      key={offer.id}
      className="panel flex flex-col p-5 transition-colors hover:border-accent transition-colors card-border-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {offer.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> {offer.company}
          </p>
        </div>
        <ScoreBadge score={offer.estimatedMatchScore} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {offer.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" />
          {offer.contractType}
        </span>
        <StatusPill label={offer.workMode} dot={false} />
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground/90 line-clamp-2">
        {offer.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(offer.requiredSkills ?? []).map((skill) => (
          <SkillTag
            key={`${offer.id}-${skill}`}
            label={skill}
            variant="matched"
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface-muted px-4 py-3 border-color-aneti-blue">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            Compatibilité estimée
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            {offer.estimatedMatchScore}%
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Score basé sur les compétences, le niveau, l'expérience et la
          localisation disponibles pour la démonstration.
        </p>
      </div>
    </article>
  );
};

export default OfferCardCandidat;
