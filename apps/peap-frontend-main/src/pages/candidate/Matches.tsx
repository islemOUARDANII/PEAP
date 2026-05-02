import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { CandidateOnboardingEmptyState } from "@/components/common/CandidateOnboardingEmptyState";
import { CardListPageSkeleton } from "@/components/common/PageSkeletons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { StatusPill } from "@/components/common/StatusPill";
import { SkillTag } from "@/components/common/SkillTag";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { isMissingCandidateProfileError } from "@/services/api/errors";
import { useCandidateMatchesQuery } from "@/services/api/queries";
import { MapPin, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Matches() {
  const {
    data: jobs = [],
    isLoading,
    isError,
    error,
  } = useCandidateMatchesQuery();
  const [search, setSearch] = useSearchParamState();
  const [location, setLocation] = useState("all");
  const [contract, setContract] = useState("all");
  const [minScore, setMinScore] = useState("any");

  const locations = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.location).filter(Boolean))).sort(),
    [jobs],
  );
  const contractTypes = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.contract).filter(Boolean))).sort(),
    [jobs],
  );

  const sorted = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const scoreFloor = minScore === "any" ? 0 : Number(minScore);

    return jobs
      .filter((job) => {
        const searchable = [
          job.title,
          job.company,
          job.location,
          ...(job.required ?? []),
          ...(job.preferred ?? []),
          ...(job.matchedSkills ?? []),
        ].join(" ").toLowerCase();

        return (
          (!normalizedSearch || searchable.includes(normalizedSearch)) &&
          (location === "all" || job.location === location) &&
          (contract === "all" || job.contract === contract) &&
          (job.score ?? 0) >= scoreFloor
        );
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [contract, jobs, location, minScore, search]);

  if (isLoading) {
    return <CardListPageSkeleton controls={3} cards={6} />;
  }

  if (isError) {
    if (isMissingCandidateProfileError(error)) {
      return <CandidateOnboardingEmptyState />;
    }

    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load candidate matches: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy Matches"
        description={`${sorted.length} canonical match result${sorted.length !== 1 ? "s" : ""} stored for your candidate profile`}
      />

      <div className="panel p-4 text-sm text-muted-foreground">
        Legacy Matches reads persisted `match_result` records already saved in the platform database. Use this page when you want the stable historical match view rather than the live CV-session scoring view.
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
        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Min score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any score</SelectItem>
            <SelectItem value="60">60% or more</SelectItem>
            <SelectItem value="75">75% or more</SelectItem>
            <SelectItem value="90">90% or more</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <div className="panel p-6 text-sm text-muted-foreground">
          No legacy matches are available for the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.slice(0, 24).map((job) => (
            <div key={job.id} className="panel p-5 flex flex-col group hover:border-accent/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary text-xs font-semibold">
                    {job.company.split(" ").map((segment) => segment[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{job.company}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{job.id}</p>
                  </div>
                </div>
                <ScoreBadge score={job.score ?? 0} />
              </div>

              <h3 className="text-sm font-semibold text-foreground leading-snug">{job.title}</h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                <StatusPill label={job.contract} tone="neutral" dot={false} />
                <span>{job.level}</span>
              </div>

              <div className="mt-4">
                <p className="stat-label mb-1.5">Matched skills</p>
                <div className="flex flex-wrap gap-1">
                  {job.matchedSkills?.slice(0, 4).map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)}
                  {(job.matchedSkills ?? []).length === 0 && <p className="text-xs text-muted-foreground">No matched skill labels available.</p>}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Posted {job.postedDays}d ago</span>
                <Link
                  to={`/candidate/matches/${job.id}`}
                  className="inline-flex items-center gap-1 font-medium text-accent group-hover:underline"
                >
                  View match <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
