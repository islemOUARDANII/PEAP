import {
  CheckCircle2,
  Eye,
  Mail,
  MapPin,
  Star,
  Trophy,
  User,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { MatchRing } from './MatchScore';

const TOP_SCORE_MATCH = 95;

function matchTone(score: number) {
  if (score >= 80) return { label: 'Strong', tone: 'success' as const };
  if (score >= 50) return { label: 'Moderate', tone: 'warning' as const };
  return { label: 'Weak', tone: 'destructive' as const };
}

const SearchCandidateCard = ({
  index,
  candidate,
  shortlisted,
  matched,
  missing,
  required,
}) => {
  const isShort = shortlisted.includes(candidate.id);
  const mt = matchTone(candidate.score);
  const isTop = candidate.score > TOP_SCORE_MATCH;
  return (
    <article key={candidate.id} className="panel p-5 flex flex-col relative">
      {isTop && (
        <span className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-warning text-warning-foreground px-2 py-0.5 text-[10px] font-semibold">
          <Trophy className="h-3 w-3" /> Top match
        </span>
      )}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {candidate.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {candidate.occupation}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {candidate.location}
              </span>
              <span>·</span>
              <span>{candidate.experienceYears}y exp</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <MatchRing
            score={candidate.score}
            size={44}
            stroke={4}
            textSize={'text-sm'}
          />
        </div>
      </div>

      <div className="rounded-md bg-surface-muted border border-border px-2.5 py-1.5 mb-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-3 w-3" /> Matches {matched.length}/
          {required.length} required
        </span>
        {missing.length > 0 && (
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="h-3 w-3" /> Missing:{' '}
            {missing.slice(0, 2).join(', ')}
          </span>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-border flex gap-1.5">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/provider/candidates/${candidate.id}`}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Profile
          </Link>
        </Button>
        <Button
          variant={isShort ? 'default' : 'outline'}
          size="sm"
          // onClick={() =>
          //   setShortlisted(
          //     isShort
          //       ? shortlisted.filter((x) => x !== candidate.id)
          //       : [...shortlisted, candidate.id],
          //   )
          // }
        >
          <Star
            className={`h-3.5 w-3.5 mr-1.5 ${isShort ? 'fill-current' : ''}`}
          />
          {isShort ? 'Shortlisted' : 'Shortlist'}
        </Button>
        <Button variant="outline" size="sm">
          <Mail className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
};

export default SearchCandidateCard;
