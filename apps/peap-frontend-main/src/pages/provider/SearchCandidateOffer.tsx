import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Download,
  Grid3x3,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import SearchCandidateCard from '@/components/common/SearchCandidateCard';
import SearchCandidateRow from '@/components/common/SearchCandidateRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { gatewayApi, type EmployerOffer } from '@/services/api/gateway';
import { useSearchParams } from 'react-router-dom';

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

const offerRequiredSkills = (offer: EmployerOffer | undefined): string[] =>
  (offer?.requirements ?? [])
    .filter((item) => item.isMust)
    .map((item) => item.nodeLabel ?? item.rawValue ?? '')
    .filter(Boolean);

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
  selectedSkills,
  toggleSkill,
  minExp,
  setMinExp,
  location,
  setLocation,
  minScore,
  setMinScore,
  availableSkills,
  onReset,
}: {
  query: string;
  setQuery: (value: string) => void;
  selectedSkills: string[];
  toggleSkill: (value: string) => void;
  minExp: number;
  setMinExp: (value: number) => void;
  location: string;
  setLocation: (value: string) => void;
  minScore: number;
  setMinScore: (value: number) => void;
  availableSkills: string[];
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

      {/* <div>
        <Label className="stat-label">Skills</Label>
        <div className="mt-2 flex flex-wrap gap-1">
          {availableSkills.slice(0, 16).map((skill) => {
            const active = selectedSkills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-secondary text-secondary-foreground hover:border-accent/40'
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div> */}

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

export default function SearchCandidateOffer() {
  const [query, setQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [minExp, setMinExp] = useState(0);
  const [location, setLocation] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shortlisted, setShortlisted] = useState<string[]>([]);
  const [activeOfferId, setActiveOfferId] = useState('');

  const [searchParams] = useSearchParams();
  const offerIdFromUrl = searchParams.get('offerId') ?? '';

  const offersQuery = useQuery({
    queryKey: ['provider', 'offers', 'search-context'],
    queryFn: () => gatewayApi.employer.listOffers(),
    staleTime: 30_000,
  });

  const offers = offersQuery.data ?? [];

  useEffect(() => {
    if (offerIdFromUrl && offers.some((offer) => offer.id === offerIdFromUrl)) {
      setActiveOfferId(offerIdFromUrl);
    }
  }, [offerIdFromUrl, offers]);

  const activeOffer =
    offers.find((offer) => offer.id === activeOfferId) ?? offers[0];
  const required = offerRequiredSkills(activeOffer);
  const availableSkills = useMemo(
    () =>
      Array.from(new Set([...(required ?? []), ...selectedSkills])).filter(
        Boolean,
      ),
    [required, selectedSkills],
  );

  const candidatesQuery = useQuery({
    queryKey: [
      'search',
      'candidates',
      {
        query,
        offerId: activeOffer?.id ?? '',
        location,
        minExp,
        minScore,
        selectedSkills,
      },
    ],
    queryFn: () =>
      gatewayApi.search.candidates({
        filters: {
          query: [activeOffer?.title, query].filter(Boolean).join(' ').trim(),
          skills: Array.from(new Set([...required, ...selectedSkills])).filter(
            Boolean,
          ),
          location: location.trim() || undefined,
          years_experience: minExp || undefined,
          size: 20,
        },
      }),
    enabled: Boolean(activeOffer),
    staleTime: 30_000,
  });

  // const candidates = useMemo(() => {
  //   const results = candidatesQuery.data?.results ?? [];
  //   return results
  //     .map(mapCandidate)
  //     .filter((candidate) => candidate.score >= minScore);
  // }, [candidatesQuery.data?.results, minScore]);

  const candidates = useMemo(() => {
    const results = candidatesQuery.data?.results ?? [];
    return results
      .map((result) => mapCandidate(result as Record<string, unknown>))
      .filter((candidate) => candidate.score >= minScore);
  }, [candidatesQuery.data?.results, minScore]);

  const toggleSkill = (value: string) => {
    setSelectedSkills((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const reset = () => {
    setQuery('');
    setSelectedSkills([]);
    setMinExp(0);
    setLocation('');
    setMinScore(0);
  };

  const filtersPanel = (
    <FiltersPanel
      query={query}
      setQuery={setQuery}
      selectedSkills={selectedSkills}
      toggleSkill={toggleSkill}
      minExp={minExp}
      setMinExp={setMinExp}
      location={location}
      setLocation={setLocation}
      minScore={minScore}
      setMinScore={setMinScore}
      availableSkills={availableSkills}
      onReset={reset}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find the Right Candidates"
        description="Search the real candidate index through `/search/candidates`, scoped by one of your real employer offers."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={shortlisted.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exporter la sélection ({shortlisted.length})
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
          <div className="panel p-3 flex flex-wrap items-center gap-2 card-border-top-blue-aneti">
            <div className="relative flex-1 min-w-[220px]">
              <Select
                value={activeOfferId || activeOffer?.id || ''}
                onValueChange={setActiveOfferId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select an employer offer" />
                </SelectTrigger>
                <SelectContent>
                  {offers.map((offer) => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex overflow-hidden rounded-md border border-border">
              <button
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
          </div>

          <div className="panel p-4 text-sm text-muted-foreground">
            {activeOffer ? (
              <>
                Correspondance avec{' '}
                <span className="font-semibold text-foreground">
                  {activeOffer.title}
                </span>
                . Compétences requises :{' '}
                <span className="font-medium text-foreground">
                  {required.length > 0
                    ? required.join(', ')
                    : 'No explicit skill requirements'}
                </span>
                .
              </>
            ) : (
              'Create or load an employer offer first to scope the candidate search.'
            )}
          </div>

          {offersQuery.isLoading ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Chargement des offres employeur...
                </p>
              </div>
            </div>
          ) : offersQuery.isError ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
              <Ban className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-sm text-destructive">
                  {offersQuery.error instanceof Error
                    ? offersQuery.error.message
                    : 'Impossible de charger les offres employeur.'}
                </p>
              </div>
            </div>
          ) : !activeOffer ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Aucune offre disponible. Créez d’abord une offre, puis revenez
                  à la recherche candidats.
                </p>
              </div>
            </div>
          ) : candidatesQuery.isLoading ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Recherche des candidats indexés...
                </p>
              </div>
            </div>
          ) : candidatesQuery.isError ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
              <Ban className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-sm text-destructive">
                  {candidatesQuery.error instanceof Error
                    ? candidatesQuery.error.message
                    : 'Impossible de rechercher les candidats.'}
                </p>
              </div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel flex gap-2 items-center justify-center p-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Aucun candidat trouvé pour cette offre.
                </p>
              </div>
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
    </div>
  );
}
