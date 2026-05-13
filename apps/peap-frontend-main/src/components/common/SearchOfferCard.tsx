import {
  ArrowRight,
  Building2,
  CheckCircle,
  Eye,
  MapPin,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { StatusPill } from './StatusPill';

const SearchOfferCard = ({ offer, isSaved }) => {
  return (
    <article
      key={offer.id}
      className="panel p-5 flex flex-col group hover:border-accent transition-colors card-border-left"
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary text-xs font-semibold">
            {offer.company
              .split(' ')
              .map((s) => s[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug truncate">
              {offer.title}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3" /> {offer.company}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <span
            className={`p-1.5 rounded-md border transition-colors inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-success-soft text-success border-success/30`}
            aria-label="Save job"
          >
            <CheckCircle
              className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`}
            />
            Publiee
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {offer.location}
        </span>
        <StatusPill label={offer.contract} tone="neutral" dot={false} />
        <StatusPill label={offer.level} tone="info" dot={false} />
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 mb-3">
        Join {offer.company} as a {offer.title}. Build resilient systems,
        collaborate with cross-functional teams, and ship at scale.
      </p>

      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Posted {offer.postedDays}d ago · {offer.applicants} applicants
        </span>
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link to={`/candidate/matches/${offer.id}`}>
              <Users className="h-3 w-3 ml-1" /> Profils
            </Link>
          </Button>
          <Button size="sm">
            <Eye className="h-3 w-3 ml-1" /> Details
          </Button>
        </div>
      </div>
    </article>
  );
};

export default SearchOfferCard;
