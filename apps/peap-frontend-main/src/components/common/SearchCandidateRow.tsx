import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { ScoreBadge } from './ScoreBadge';
import { StatusPill, statusToTone } from './StatusPill';
import { MapPin, Star } from 'lucide-react';

const SearchCandidateRow = ({
  candidate,
  matched,
  missing,
  required,
  isShort,
}) => {
  return (
    <div
      key={candidate.id}
      className="flex items-center gap-4 p-4 row-border-left"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {candidate.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {candidate.name}
          </p>
          <StatusPill
            label={candidate.status}
            tone={statusToTone(candidate.status)}
            dot={false}
          />
        </div>
        <p className="inline-flex text-xs text-muted-foreground truncate items-center justify-center">
          {candidate.occupation} · {candidate.experienceYears}y ·{' '}
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {candidate.location}
          </span>
        </p>
      </div>
      <div className="hidden md:block text-xs text-muted-foreground min-w-[160px]">
        {matched.length}/{required.length} required
        {missing.length > 0 && (
          <span className="text-destructive"> · missing {missing.length}</span>
        )}
      </div>
      <ScoreBadge score={candidate.score} />
      <div className="flex gap-1.5">
        <Button asChild variant="outline" size="sm">
          <Link to={`/provider/candidates/${candidate.id}`}>View</Link>
        </Button>
        <Button
          variant={isShort ? 'default' : 'outline'}
          size="sm"
          //   onClick={() =>
          //     setShortlisted(
          //       isShort
          //         ? shortlisted.filter((x) => x !== candidate.id)
          //         : [...shortlisted, candidate.id],
          //     )
          //   }
        >
          <Star className={`h-3.5 w-3.5 ${isShort ? 'fill-current' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

export default SearchCandidateRow;
