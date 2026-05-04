import { useMemo, useState } from 'react';
import {
  Briefcase,
  Download,
  Eye,
  Grid3x3,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useSearchCandidatesQuery } from '@/services/api/queries';

interface SearchCandidateViewModel {
  id: string;
  name: string;
  initials: string;
  occupation: string;
  location: string;
  experienceYears: number;
  score: number;
  topSkills: string[];
  summary: string;
  status: 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected';
}

const normalizeScore = (value: number | null | undefined): number =>
  typeof value === 'number'
    ? value <= 1
      ? Math.round(value * 100)
      : Math.round(value)
    : 0;

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value);

const searchRawString = (
  raw: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = toStringValue(raw[key]).trim();
    if (value) {
      return value;
    }
  }
  return '';
};

const initialsFromName = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('') || 'NA';

const mapCandidate = (
  result: Record<string, unknown>,
): SearchCandidateViewModel => {
  const raw = (result.raw as Record<string, unknown> | undefined) ?? {};
  const name =
    searchRawString(raw, ['full_name', 'candidate_label', 'name', 'label']) ||
    `Candidate ${toStringValue(result.candidateId).slice(0, 8)}`;
  const score = normalizeScore(result.score as number | undefined);

  return {
    id: toStringValue(result.candidateId),
    name,
    initials: initialsFromName(name),
    occupation:
      searchRawString(raw, ['occupation', 'occupation_label', 'headline']) ||
      toStringValue(result.education) ||
      'Indexed candidate',
    location: toStringValue(result.location) || 'Location not specified',
    experienceYears: Number(result.yearsExperience ?? 0) || 0,
    score,
    topSkills: Array.isArray(result.skills) ? (result.skills as string[]) : [],
    summary:
      searchRawString(raw, ['summary', 'profile_summary', 'headline']) ||
      'Candidate profile loaded from the search index.',
    status: score >= 80 ? 'Shortlisted' : score >= 50 ? 'Reviewed' : 'New',
  };
};

function FiltersPanel({
  query,
  setQuery,
  minExp,
  setMinExp,
  location,
  setLocation,
  minScore,
  setMinScore,
  onReset,
}: {
  query: string;
  setQuery: (value: string) => void;
  minExp: number;
  setMinExp: (value: number) => void;
  location: string;
  setLocation: (value: string) => void;
  minScore: number;
  setMinScore: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="stat-label">Keyword</Label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, role, or skill..."
            className="h-9 bg-surface-muted pl-9"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="stat-label">Min experience</Label>
          <span className="text-xs font-mono text-foreground">
            {minExp}+ yrs
          </span>
        </div>
        <Slider
          value={[minExp]}
          onValueChange={(value) => setMinExp(value[0] ?? 0)}
          min={0}
          max={15}
          step={1}
          className="mt-3"
        />
      </div>

      <div>
        <Label className="stat-label">Location</Label>
        <Input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Sousse, Tunis, Remote..."
          className="mt-1.5 h-9 bg-surface-muted"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="stat-label">Minimum match</Label>
          <span className="text-xs font-mono text-foreground">{minScore}%</span>
        </div>
        <Slider
          value={[minScore]}
          onValueChange={(value) => setMinScore(value[0] ?? 0)}
          min={0}
          max={100}
          step={5}
          className="mt-3"
        />
      </div>

      <div className="flex gap-2 border-t border-border pt-2">
        <Button type="button" size="sm" className="flex-1" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </div>
  );
}

function CandidateDetailsDialog({
  candidate,
  onClose,
}: {
  candidate: SearchCandidateViewModel | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(candidate)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-2xl">
        {!candidate ? null : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {candidate.initials}
                </span>
                <span>
                  <span className="block text-lg">{candidate.name}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {candidate.occupation}
                  </span>
                </span>
              </DialogTitle>

              <DialogDescription>
                Profil candidat provenant de l’index de recherche.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Score search</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {candidate.score}%
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Expérience</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {candidate.experienceYears} ans
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {candidate.status}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Localisation
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {candidate.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                  <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Métier / profil
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {candidate.occupation}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Résumé
                </p>
                <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                  {candidate.summary}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Compétences principales
                </p>

                {candidate.topSkills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune compétence disponible dans l’index.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {candidate.topSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">ID candidat</p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">
                  {candidate.id}
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SearchCandidate() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [location, setLocation] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shortlisted] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<SearchCandidateViewModel | null>(null);

  const candidatesQuery = useSearchCandidatesQuery({
    filters: {
      query: submittedQuery.trim() || undefined,
      location: location.trim() || undefined,
      size: 50,
    },
  });

  const candidates = useMemo(() => {
    const results = candidatesQuery.data?.results ?? [];

    return results
      .map((result) =>
        mapCandidate(result as unknown as Record<string, unknown>),
      )
      .filter((candidate) => candidate.score >= minScore)
      .filter((candidate) => candidate.experienceYears >= minExp);
  }, [candidatesQuery.data?.results, minScore, minExp]);

  const reset = () => {
    setQuery('');
    setSubmittedQuery('');
    setMinExp(0);
    setLocation('');
    setMinScore(0);
  };

  const filtersPanel = (
    <FiltersPanel
      query={query}
      setQuery={setQuery}
      minExp={minExp}
      setMinExp={setMinExp}
      location={location}
      setLocation={setLocation}
      minScore={minScore}
      setMinScore={setMinScore}
      onReset={reset}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find the Right Candidates"
        description="Rechercher tous les candidats indexés via le service de recherche."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={shortlisted.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export shortlist ({shortlisted.length})
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="panel sticky top-4 p-4 card-border-top-blue-aneti">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </p>
            </div>
            {filtersPanel}
          </div>
        </aside>

        <div className="space-y-4">
          <form
            className="panel p-3 flex flex-wrap items-center gap-2 card-border-top-blue-aneti"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query);
            }}
          >
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search candidates by name, skills, or experience..."
                className="h-9 bg-surface-muted pl-9"
              />
            </div>

            <Button type="submit" size="sm">
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>

            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`p-2 ${
                  view === 'grid'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`p-2 ${
                  view === 'list'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                {filtersPanel}
              </SheetContent>
            </Sheet>
          </form>

          {candidatesQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Loading indexed candidates...
            </div>
          ) : candidatesQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {candidatesQuery.error instanceof Error
                ? candidatesQuery.error.message
                : 'Unable to load indexed candidates.'}
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              No candidates found.
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="panel space-y-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {candidate.initials}
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground">
                          {candidate.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {candidate.occupation}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {candidate.summary}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-surface-muted p-2">
                      <p className="text-muted-foreground">Score</p>
                      <p className="font-semibold text-foreground">
                        {candidate.score}%
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-muted p-2">
                      <p className="text-muted-foreground">Exp.</p>
                      <p className="font-semibold text-foreground">
                        {candidate.experienceYears} ans
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-muted p-2">
                      <p className="text-muted-foreground">Statut</p>
                      <p className="font-semibold text-foreground">
                        {candidate.status}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.location}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {candidate.topSkills.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="divide-y divide-border">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {candidate.initials}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {candidate.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {candidate.occupation}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {candidate.location}
                        </p>
                      </div>
                    </div>

                    <div className="hidden text-sm text-muted-foreground md:block">
                      {candidate.experienceYears} ans exp.
                    </div>

                    <div className="hidden text-sm font-semibold text-foreground md:block">
                      {candidate.score}%
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* {offersQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Loading employer offers...
            </div>
          ) : offersQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {offersQuery.error instanceof Error
                ? offersQuery.error.message
                : 'Unable to load employer offers.'}
            </div>
          ) : !activeOffer ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              No employer offers are available yet. Create one first, then come
              back to candidate search.
            </div>
          ) : candidatesQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Searching indexed candidates...
            </div>
          ) : candidatesQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {candidatesQuery.error instanceof Error
                ? candidatesQuery.error.message
                : 'Unable to query indexed candidates.'}
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              No indexed results. Try syncing the search index first.
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {candidates.map((candidate, index) => {
                const matched = required.filter((skill) =>
                  candidate.topSkills.some(
                    (candidateSkill) =>
                      candidateSkill.toLowerCase() === skill.toLowerCase(),
                  ),
                );
                const missing = required.filter(
                  (skill) =>
                    !candidate.topSkills.some(
                      (candidateSkill) =>
                        candidateSkill.toLowerCase() === skill.toLowerCase(),
                    ),
                );

                return (
                  <SearchCandidateCard
                    key={candidate.id}
                    index={index}
                    candidate={candidate}
                    shortlisted={shortlisted}
                    matched={matched}
                    missing={missing}
                    required={required}
                  />
                );
              })}
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {candidates.map((candidate) => {
                const matched = required.filter((skill) =>
                  candidate.topSkills.some(
                    (candidateSkill) =>
                      candidateSkill.toLowerCase() === skill.toLowerCase(),
                  ),
                );
                const missing = required.filter(
                  (skill) =>
                    !candidate.topSkills.some(
                      (candidateSkill) =>
                        candidateSkill.toLowerCase() === skill.toLowerCase(),
                    ),
                );

                return (
                  <SearchCandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    matched={matched}
                    missing={missing}
                    required={required}
                    isShort={shortlisted.includes(candidate.id)}
                  />
                );
              })}
            </div>
          )} */}
        </div>
      </div>
      <CandidateDetailsDialog
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
}
