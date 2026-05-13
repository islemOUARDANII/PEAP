import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, MapPin, Search } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ProviderCandidatesSkeleton } from "@/components/common/PageSkeletons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { useProviderCandidatesQuery } from "@/services/api/queries";

export default function Candidates() {
  const {
    data: candidates = [],
    isLoading,
    isError,
    error,
  } = useProviderCandidatesQuery();
  const [search, setSearch] = useSearchParamState();
  const [occupationFilter, setOccupationFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("any");

  const occupationOptions = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.occupation))).filter(Boolean).slice(0, 8),
    [candidates],
  );

  const filteredCandidates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const minimumScore = scoreFilter === "any" ? 0 : Number(scoreFilter);

    return candidates.filter((candidate) => {
      if (occupationFilter !== "all" && candidate.occupation !== occupationFilter) {
        return false;
      }

      if (candidate.score < minimumScore) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        candidate.name,
        candidate.occupation,
        candidate.location,
        candidate.summary,
        candidate.offerTitle,
        candidate.company,
        ...candidate.topSkills,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [candidates, search, occupationFilter, scoreFilter]);

  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, { offerTitle: string; company?: string; candidates: typeof filteredCandidates }>();
    filteredCandidates.forEach((candidate) => {
      const key = candidate.offerId || "unscoped";
      const existing = groups.get(key);
      if (existing) {
        existing.candidates.push(candidate);
        return;
      }

      groups.set(key, {
        offerTitle: candidate.offerTitle || "Offer not specified",
        company: candidate.company,
        candidates: [candidate],
      });
    });

    return Array.from(groups.entries())
      .map(([offerId, group]) => ({
        offerId,
        ...group,
        candidates: [...group.candidates].sort((a, b) => b.score - a.score),
      }))
      .sort((a, b) => a.offerTitle.localeCompare(b.offerTitle));
  }, [filteredCandidates]);

  if (isLoading) {
    return <ProviderCandidatesSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Matched Candidates" description={`${filteredCandidates.length} candidates matched to your offers`} />

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, skill, role..."
            className="h-9 pl-9 bg-surface-muted"
          />
        </div>
        <Select value={occupationFilter} onValueChange={setOccupationFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All occupations</SelectItem>
            {occupationOptions.map((occupation) => (
              <SelectItem key={occupation} value={occupation}>{occupation}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any score</SelectItem>
            <SelectItem value="60">60% or more</SelectItem>
            <SelectItem value="80">80% or more</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <div className="panel p-4 text-sm text-destructive">
          Failed to load candidates: {error instanceof Error ? error.message : "unknown error"}
        </div>
      )}
      {!isLoading && !isError && filteredCandidates.length === 0 && (
        <div className="panel p-4 text-sm text-muted-foreground">No candidates matched to provider offers for the current filters.</div>
      )}

      {!isError && (
      <div className="space-y-4">
        {groupedCandidates.map((group) => (
          <section key={group.offerId} className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{group.offerTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  {group.company || "Company not specified"} - {group.candidates.length} candidate{group.candidates.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.candidates.slice(0, 12).map((candidate) => (
                <div key={`${candidate.id}-${candidate.offerId || "offer"}`} className="panel p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">{candidate.initials}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.occupation}</p>
                      </div>
                    </div>
                    <ScoreBadge score={candidate.score} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{candidate.location}</span>
                    <span>{candidate.experienceYears}y exp</span>
                    <StatusPill label={candidate.status} tone={statusToTone(candidate.status)} className="ml-auto" />
                  </div>
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2 mb-3">{candidate.summary}</p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {candidate.topSkills.slice(0, 4).map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)}
                    {candidate.topSkills.length === 0 && <p className="text-xs text-muted-foreground">No skill labels available.</p>}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-auto">
                    <Link to={`/provider/candidates/${candidate.id}`}><Eye className="h-4 w-4 mr-1.5" /> View profile</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      )}
    </div>
  );
}
