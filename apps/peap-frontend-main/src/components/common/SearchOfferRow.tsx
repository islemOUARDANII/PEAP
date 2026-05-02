import { Building2, Eye, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { CountBadge } from './CountBadge';

const SearchOfferRow = ({ offer, matchedCount }) => {
  return (
    <div key={offer.id} className="flex items-center gap-4 p-4 row-border-left">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground  text-xs font-semibold">
        <Building2 className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {offer.title}
          </p>
          {/* <StatusPill
            label={candidate.status}
            tone={statusToTone(candidate.status)}
            dot={false}
          /> */}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {offer.location}
          </span>
        </p>
      </div>
      <CountBadge score={matchedCount} />
      <div className="flex gap-1.5">
        <Button asChild variant="outline" size="sm">
          <Link to={`/provider/candidates/${offer.id}`}>
            <Eye className="h-3 w-3 ml-1" /> Details
          </Link>
        </Button>

        {/* <Button
          variant={isSaved ? 'default' : 'outline'}
          size="sm"
          //   onClick={() =>
          //     setShortlisted(
          //       isShort
          //         ? shortlisted.filter((x) => x !== candidate.id)
          //         : [...shortlisted, candidate.id],
          //     )
          //   }
        >
          <Star className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
        </Button> */}
      </div>
    </div>
  );
};

export default SearchOfferRow;
