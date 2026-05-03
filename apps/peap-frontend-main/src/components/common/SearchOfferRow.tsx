import { Building2, Eye, EyeIcon, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { CountBadge } from './CountBadge';

const SearchOfferRow = ({ offer, matchedCount, onClick }) => {
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
        </div>
        <p className="text-xs text-muted-foreground truncate">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {offer.location}
          </span>
        </p>
      </div>
      {matchedCount && <CountBadge score={matchedCount} />}

      <div className="flex gap-1.5">
        {/* <Button asChild variant="outline" size="sm" onClick={onClick}>
          <Eye className="h-3 w-3 " /> Voir le détail
        </Button> */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClick}
        >
          <Eye className="h-4 w-4" />
          Voir détails
        </Button>
      </div>
    </div>
  );
};

export default SearchOfferRow;
