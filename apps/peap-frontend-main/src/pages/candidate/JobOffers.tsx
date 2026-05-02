import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, MapPin, Search } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { CandidateOnboardingEmptyState } from "@/components/common/CandidateOnboardingEmptyState";
import { CardListPageSkeleton } from "@/components/common/PageSkeletons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { StatusPill } from "@/components/common/StatusPill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { isMissingCandidateProfileError } from "@/services/api/errors";
import { useCandidateJobOffersQuery } from "@/services/api/queries";

export default function JobOffers() {
  const {
    data: offers = [],
    isLoading,
    isError,
    error,
  } = useCandidateJobOffersQuery();
  const [search, setSearch] = useSearchParamState();
  const [location, setLocation] = useState("all");
  const [contract, setContract] = useState("all");

  const locations = useMemo(
    () => Array.from(new Set(offers.map((offer) => offer.location).filter(Boolean))).sort(),
    [offers],
  );
  const contractTypes = useMemo(
    () => Array.from(new Set(offers.map((offer) => offer.contract).filter(Boolean))).sort(),
    [offers],
  );

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return offers
      .filter((offer) => {
        const searchable = [
          offer.title,
          offer.company,
          offer.location,
          ...(offer.required ?? []),
          ...(offer.preferred ?? []),
        ].join(" ").toLowerCase();

        return (
          (!normalizedSearch || searchable.includes(normalizedSearch)) &&
          (location === "all" || offer.location === location) &&
          (contract === "all" || offer.contract === contract)
        );
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [contract, location, offers, search]);

  if (isLoading) {
    return <CardListPageSkeleton controls={2} cards={6} />;
  }

  if (isError) {
    if (isMissingCandidateProfileError(error)) {
      return <CandidateOnboardingEmptyState />;
    }

    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load job offers: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy Job Offers"
        description={`${filtered.length} canonical published offer${filtered.length !== 1 ? "s" : ""} visible to your candidate profile`}
      />

      <div className="panel p-4 text-sm text-muted-foreground">
        Legacy Job Offers shows the canonical offer catalog itself. When a stored legacy match exists, you will also see its saved score here; otherwise the offer is simply available without a scored match yet.
      </div>

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, company, skill..."
            className="h-9 pl-9 bg-surface-muted"
          />
        </div>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={contract} onValueChange={setContract}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Contract" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contracts</SelectItem>
            {contractTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-6 text-sm text-muted-foreground">
          No legacy job offers are available for the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.slice(0, 36).map((offer) => {
            const hasMatch = (offer.score ?? 0) > 0;
            return (
              <div key={offer.id} className="panel p-5 flex flex-col group hover:border-accent/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{offer.company}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{offer.id}</p>
                    </div>
                  </div>
                  {hasMatch ? <ScoreBadge score={offer.score ?? 0} /> : <StatusPill label="Available" tone="neutral" dot={false} />}
                </div>

                <h3 className="text-sm font-semibold text-foreground leading-snug">{offer.title}</h3>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{offer.location}</span>
                  <StatusPill label={offer.contract} tone="neutral" dot={false} />
                </div>

                <div className="mt-4">
                  <p className="stat-label mb-1.5">Required skills</p>
                  <div className="flex flex-wrap gap-1">
                    {offer.required?.slice(0, 5).map((skill) => <SkillTag key={skill} label={skill} variant={hasMatch && offer.matchedSkills?.includes(skill) ? "matched" : "outline"} />)}
                    {(offer.required ?? []).length === 0 && <p className="text-xs text-muted-foreground">No required skill labels available.</p>}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Posted {offer.postedDays}d ago</span>
                  {hasMatch ? (
                    <Link
                      to={`/candidate/matches/${offer.id}`}
                      className="inline-flex items-center gap-1 font-medium text-accent group-hover:underline"
                    >
                      View match <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="font-medium text-muted-foreground">Match pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
