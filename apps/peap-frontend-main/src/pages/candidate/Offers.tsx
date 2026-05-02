import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, Loader2, MapPin, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill } from '@/components/common/StatusPill';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { gatewayApi } from '@/services/api/gateway';
import LoadingCard from '@/components/common/LoadingCard';
import ErrorCard from '@/components/common/ErrorCard';

const normalizeScore = (value: number): number =>
  value <= 1 ? Math.round(value * 100) : Math.round(value);

export default function CandidateOffers() {
  const [query, setQuery] = useState('');
  const [contractType, setContractType] = useState('all');
  const [workMode, setWorkMode] = useState('all');
  const [governorate, setGovernorate] = useState('');

  const searchQuery = useQuery({
    queryKey: [
      'search',
      'offers',
      { query, contractType, workMode, governorate },
    ],
    queryFn: () =>
      gatewayApi.search.offers({
        query,
        size: 24,
        contract_type: contractType === 'all' ? undefined : contractType,
        work_mode: workMode === 'all' ? undefined : workMode,
        governorate: governorate || undefined,
      }),
    staleTime: 30_000,
  });

  const offers = searchQuery.data?.results ?? [];
  const contractOptions = useMemo(
    () =>
      Array.from(
        new Set(offers.map((offer) => offer.contractType).filter(Boolean)),
      ) as string[],
    [offers],
  );
  const workModeOptions = useMemo(
    () =>
      Array.from(
        new Set(offers.map((offer) => offer.workMode).filter(Boolean)),
      ) as string[],
    [offers],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indexed Offers"
        description="Search the real offer index through `/search/offers` on the API Gateway."
      />

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, description, or skill..."
            className="h-9 bg-surface-muted pl-9"
          />
        </div>
        <Input
          value={governorate}
          onChange={(event) => setGovernorate(event.target.value)}
          placeholder="Governorate"
          className="h-9 w-[160px] bg-surface-muted"
        />
        <Select value={contractType} onValueChange={setContractType}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contracts</SelectItem>
            {contractOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workMode} onValueChange={setWorkMode}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All work modes</SelectItem>
            {workModeOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {searchQuery.isLoading ? (
        <LoadingCard text="Loading indexed offers..." />
      ) : searchQuery.isError ? (
        <ErrorCard
          queryResult={searchQuery}
          text="Unable to load indexed offers."
        />
      ) : offers.length === 0 ? (
        <div className="panel p-6 text-sm text-muted-foreground card-border-20 flex gap-2 items-center justify-center">
          No indexed results. Try syncing the search index first.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => {
            const score = normalizeScore(offer.score);
            return (
              <article
                key={offer.offerId}
                className="panel group flex flex-col p-5 transition-colors hover:border-accent/40"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {offer.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[offer.location, offer.contractType, offer.workMode]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  <ScoreBadge score={score} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {offer.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {offer.location}
                    </span>
                  ) : null}
                  {offer.status ? (
                    <StatusPill label={offer.status} dot={false} />
                  ) : null}
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-foreground/90">
                  {offer.description ||
                    'No indexed description is available for this offer yet.'}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {offer.skills.slice(0, 6).map((skill) => (
                    <SkillTag key={skill} label={skill} variant="matched" />
                  ))}
                  {offer.skills.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No indexed skill labels available.
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {offer.offerId}
                  </span>
                  <Link
                    to={`/candidate/offers/${offer.offerId}`}
                    className="inline-flex items-center gap-1 font-medium text-accent group-hover:underline"
                  >
                    Details <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
