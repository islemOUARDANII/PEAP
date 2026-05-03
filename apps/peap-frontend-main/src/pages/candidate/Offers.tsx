import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Ban,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  CircleSlash,
  GraduationCap,
  Grid3x3,
  Lightbulb,
  List,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import CandidateProfileOnboardingCard from '@/components/common/CandidateProfileOnboardingCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiServiceError } from '@/services/api/client';
import { gatewayApi } from '@/services/api/gateway';
import { queryKeys } from '@/services/api/queryKeys';
import {
  getAllPublishedOffers,
  getInterestingOffers,
  getRecommendedOffers,
  MATCHING_UNAVAILABLE_MESSAGE,
  SEARCH_UNAVAILABLE_MESSAGE,
  searchCandidateOffers,
  type CandidateRecommendedOfferSummary,
  type CandidateSearchOfferSummary,
} from '@/services/candidate/candidateOffers';
import {
  type CandidateOfferSearchMode,
  cleanText,
  formatDate,
  matchesOfferSearch,
  normalizePercent,
} from '@/services/candidate/candidateOfferUtils';
import {
  isJobSeekerProfileNotFoundError,
  shouldRetryCandidateProfileQuery,
} from '@/services/candidate/candidateProfileOnboarding';
import { Job } from '@/models';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import SearchOfferRow from '@/components/common/SearchOfferRow';

type OfferTab = 'all' | 'interesting' | 'recommended';
type SelectedOffer =
  | CandidateSearchOfferSummary
  | CandidateRecommendedOfferSummary;

const DEFAULT_TAB: OfferTab = 'recommended';
const OFFER_TABS: OfferTab[] = ['all', 'interesting', 'recommended'];
const DEFAULT_SEARCH_MODE: CandidateOfferSearchMode = 'keyword';
const SEARCH_MODE_OPTIONS: Array<{
  value: CandidateOfferSearchMode;
  label: string;
}> = [
  { value: 'keyword', label: 'Mot cle' },
  { value: 'skill', label: 'Competence' },
  { value: 'company', label: 'Entreprise' },
  { value: 'location', label: 'Localisation' },
];

const isOfferTab = (value: string | null): value is OfferTab =>
  value != null && OFFER_TABS.includes(value as OfferTab);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => cleanText(item))
        .filter((item): item is string => Boolean(item))
    : [];

const formatSearchRelevance = (value: number | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return value % 1 === 0 ? `${value}` : value.toFixed(1);
};

const getTabTitle = (tab: OfferTab): string => {
  switch (tab) {
    case 'all':
      return 'Toutes les offres';
    case 'interesting':
      return 'Offres qui peuvent vous intéresser';
    case 'recommended':
    default:
      return 'Offres recommandées';
  }
};

const getTabDescription = (tab: OfferTab): string => {
  switch (tab) {
    case 'all':
      return 'Explorez toutes les offres publiées et actives.';
    case 'interesting':
      return 'Résultats de recherche construits à partir de vos centres d’intérêt.';
    case 'recommended':
    default:
      return 'Offres réellement matchées avec votre profil candidat.';
  }
};

const getOfferDescription = (
  offer: CandidateSearchOfferSummary,
): string | null =>
  cleanText(offer.description) ??
  cleanText(offer.raw.summary) ??
  cleanText(offer.raw.snippet) ??
  null;

function FiltersPanel({
  query,
  setQuery,
  minExp,
  setMinExp,
  loc,
  setLoc,
  minScore,
  setMinScore,
  onReset,
}: {
  query?: string;
  setQuery?: (v: string) => void;
  minExp?: number;
  setMinExp?: (v: number) => void;
  loc?: string;
  setLoc?: (v: string) => void;
  minScore?: number;
  setMinScore?: (v: number) => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="stat-label">Keyword</Label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, role, skill…"
            className="h-9 pl-9 bg-surface-muted"
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
          onValueChange={(v) => setMinExp(v[0])}
          min={0}
          max={15}
          step={1}
          className="mt-3"
        />
      </div>

      <div>
        <Label className="stat-label">Education level</Label>
        <div className="mt-2 flex flex-col gap-1.5">
          {/* {educationLevels.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={edu.includes(e)}
                onCheckedChange={() => toggleEdu(e)}
              />
              {e}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <Label className="stat-label">Location</Label>
        <Select value={loc} onValueChange={setLoc}>
          <SelectTrigger className="h-9 mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {/* {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))} */}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="stat-label">Availability</Label>
        <div className="mt-2 flex flex-col gap-1.5">
          {/* {availabilities.map((a) => (
            <label
              key={a}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={avail.includes(a)}
                onCheckedChange={() => toggleAvail(a)}
              />
              {a}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <Label className="stat-label">Languages</Label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {/* {languages.map((l) => (
            <label
              key={l}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={langs.includes(l)}
                onCheckedChange={() => toggleLang(l)}
              />
              {l}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="stat-label">Minimum match</Label>
          <span className="text-xs font-mono text-foreground">{minScore}%</span>
        </div>
        <Slider
          value={[minScore]}
          onValueChange={(v) => setMinScore(v[0])}
          min={0}
          max={100}
          step={5}
          className="mt-3"
        />
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button size="sm" className="flex-1">
          Apply filters
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

export default function CandidateOffers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(
    null,
  );
  const [appliedOfferIds, setAppliedOfferIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchMode, setSearchMode] =
    useState<CandidateOfferSearchMode>(DEFAULT_SEARCH_MODE);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const rawTab = searchParams.get('tab');
  const activeTab = isOfferTab(rawTab) ? rawTab : DEFAULT_TAB;
  const trimmedSearchInput = searchInput.trim();
  const hasActiveSearch = appliedSearch.length > 0;

  const profilePresenceQuery = useQuery({
    queryKey: queryKeys.candidate.profilePresence(),
    queryFn: () => gatewayApi.candidate.hasProfile(),
    retry: shouldRetryCandidateProfileQuery,
    staleTime: 30_000,
  });
  const isMissingCandidateProfile = isJobSeekerProfileNotFoundError(
    profilePresenceQuery.error,
  );
  const hasCandidateProfile = profilePresenceQuery.data === true;
  const isProfileGateLoading =
    profilePresenceQuery.isLoading || profilePresenceQuery.isFetching;

  useEffect(() => {
    if (!isOfferTab(rawTab)) {
      setSearchParams({ tab: DEFAULT_TAB }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  useEffect(() => {
    setSelectedOffer(null);
  }, [activeTab]);

  const allOffersQuery = useQuery({
    queryKey: queryKeys.candidate.offersSearch(
      'all',
      appliedSearch,
      searchMode,
    ),
    queryFn: () =>
      hasActiveSearch
        ? searchCandidateOffers({
            query: appliedSearch,
            mode: searchMode,
          })
        : getAllPublishedOffers(),
    enabled: activeTab === 'all',
    staleTime: 5 * 60_000,
  });

  const interestingOffersQuery = useQuery({
    queryKey: queryKeys.candidate.offersSearch(
      'interesting',
      appliedSearch,
      searchMode,
    ),
    queryFn: () =>
      hasActiveSearch
        ? searchCandidateOffers({
            query: appliedSearch,
            mode: searchMode,
          })
        : getInterestingOffers(),
    enabled: activeTab === 'interesting' && hasCandidateProfile,
    staleTime: 5 * 60_000,
  });

  const recommendedOffersQuery = useQuery({
    queryKey: queryKeys.candidate.offersRecommended(),
    queryFn: () => getRecommendedOffers(),
    enabled: activeTab === 'recommended' && hasCandidateProfile,
    staleTime: 5 * 60_000,
  });

  const applyMutation = useMutation({
    mutationFn: async (offer: SelectedOffer) => {
      if (!offer.offerId) {
        throw new Error("Cette offre n'est pas encore postable.");
      }

      return gatewayApi.candidate.applyToOffer({
        offer_id: offer.offerId,
        matching_result_id:
          offer.kind === 'matching' ? offer.matchingResultId : undefined,
      });
    },
    onSuccess: (_response, offer) => {
      if (!offer.offerId) {
        return;
      }

      setAppliedOfferIds((current) =>
        current.includes(offer.offerId) ? current : [...current, offer.offerId],
      );
      toast.success('Votre candidature a été enregistrée.');
    },
    onError: (error, offer) => {
      const message = error instanceof Error ? error.message : '';
      const alreadyApplied =
        error instanceof ApiServiceError
          ? error.status === 409 || /déjà|already/i.test(message)
          : /déjà|already/i.test(message);

      if (alreadyApplied && offer.offerId) {
        setAppliedOfferIds((current) =>
          current.includes(offer.offerId)
            ? current
            : [...current, offer.offerId],
        );
        toast.info('Déjà postulé');
        return;
      }

      toast.error("Impossible d'enregistrer votre candidature pour le moment.");
    },
  });

  const isAlreadyApplied = selectedOffer?.offerId
    ? appliedOfferIds.includes(selectedOffer.offerId)
    : false;
  const interestingKeywords =
    activeTab === 'interesting' &&
    interestingOffersQuery.data &&
    'keywords' in interestingOffersQuery.data
      ? interestingOffersQuery.data.keywords
      : [];
  const interestingKeywordsLabel = interestingKeywords
    .map((item) => item.keyword)
    .filter(Boolean)
    .join(', ');

  const filteredRecommendedOffers = useMemo(
    () =>
      (recommendedOffersQuery.data?.offers ?? []).filter((offer) =>
        matchesOfferSearch(offer, appliedSearch, searchMode),
      ),
    [appliedSearch, recommendedOffersQuery.data?.offers, searchMode],
  );

  const activeTabSummary = useMemo(() => {
    if (activeTab === 'all') {
      return hasActiveSearch
        ? `RÃ©sultats pour : ${appliedSearch}`
        : 'Affichage des offres disponibles.';
    }

    if (activeTab === 'interesting') {
      if (hasActiveSearch) {
        return `Recherche personnalisÃ©e : ${appliedSearch}`;
      }

      return interestingKeywordsLabel
        ? `Recherche basÃ©e sur vos centres dâ€™intÃ©rÃªt : ${interestingKeywordsLabel}`
        : 'Recherche basÃ©e sur vos centres dâ€™intÃ©rÃªt.';
    }

    return hasActiveSearch
      ? 'Filtre appliquÃ© aux offres recommandÃ©es.'
      : 'Affichage des offres recommandÃ©es.';
  }, [activeTab, appliedSearch, hasActiveSearch, interestingKeywordsLabel]);

  const handleSearchSubmit = () => {
    setAppliedSearch(trimmedSearchInput);
  };

  const handleSearchReset = () => {
    setSearchInput('');
    setAppliedSearch('');
    setSearchMode(DEFAULT_SEARCH_MODE);
  };

  const activeTabSummaryText = useMemo(() => {
    if (activeTab === 'all') {
      return hasActiveSearch
        ? `Resultats pour : ${appliedSearch}`
        : 'Affichage des offres disponibles.';
    }

    if (activeTab === 'interesting') {
      if (hasActiveSearch) {
        return `Recherche personnalisee : ${appliedSearch}`;
      }

      return interestingKeywordsLabel
        ? `Recherche basee sur vos centres d'interet : ${interestingKeywordsLabel}`
        : "Recherche basee sur vos centres d'interet.";
    }

    return hasActiveSearch
      ? 'Filtre applique aux offres recommandees.'
      : 'Affichage des offres recommandees.';
  }, [activeTab, appliedSearch, hasActiveSearch, interestingKeywordsLabel]);

  const renderGrid = (
    list: Job[],
    opts: { showMatch: boolean; reason?: (j: Job) => string | undefined },
  ) => {
    if (list.length === 0) {
      return (
        <EmptyState message="No offers found. Try adjusting your filters." />
      );
    }
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* {list.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            saved={saved.includes(j.id)}
            onToggleSave={() => onToggleSave(j.id)}
            showMatchInsight={opts.showMatch}
            recommendedReason={opts.reason?.(j)}
          />
        ))} */}
      </div>
    );
  };

  const tabCountBadge = (n: number, active: boolean) => (
    <Badge
      variant="secondary"
      className={`ml-1.5 h-5 px-1.5 text-[10px] font-mono tabular-nums ${
        active ? 'bg-accent text-accent-foreground' : ''
      }`}
    >
      {n}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres"
        description="Consultez toutes les offres, les offres liees a vos centres d'interet et vos recommandations personnalisees."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="panel p-4 sticky top-4 card-border-top-blue-aneti">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </p>
              <button
                // onClick={reset}
                className="text-xs text-accent hover:underline"
              >
                Reset
              </button>
            </div>
            <FiltersPanel />
          </div>
        </aside>
        <div className="space-y-4">
          <section className="panel space-y-4 p-5 card-border-top">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSearchSubmit();
              }}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_15rem_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Rechercher par metier, competence, entreprise ou mot-cle..."
                    className="h-10 bg-surface-muted pl-9"
                  />
                </div>

                <Select
                  value={searchMode}
                  onValueChange={(value) =>
                    setSearchMode(value as CandidateOfferSearchMode)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Mode de recherche" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEARCH_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button type="submit" className="h-10">
                  <Search className="h-4 w-4" />
                  Rechercher
                </Button>
                <div className="flex border border-border rounded-md overflow-hidden">
                  <button
                    onClick={() => setView('grid')}
                    className={`p-2 ${view === 'grid' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                    aria-label="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`p-2 ${view === 'list' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                {/* 
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={handleSearchReset}
            >
              Reinitialiser
            </Button> */}
              </div>

              {/* <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {getTabTitle(activeTab)}
            </p>
            <p className="mt-2 text-sm text-foreground">
              {activeTabSummaryText}
            </p>
            {activeTab === 'recommended' && hasActiveSearch ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Le filtrage reste local sur les recommandations deja chargees.
              </p>
            ) : null}
          </div> */}
            </form>
          </section>

          {isMissingCandidateProfile ? (
            <CandidateProfileOnboardingCard
              compact
              title="Votre profil candidat n’est pas encore créé."
              description="Uploadez votre CV pour recevoir des offres recommandées."
            />
          ) : null}

          {/* <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isOfferTab(value)) {
            setSearchParams({ tab: value });
          }
        }}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap gap-2 bg-surface-muted p-1">
          <TabsTrigger value="all">Toutes les offres</TabsTrigger>
          <TabsTrigger value="interesting">
            Offres qui peuvent vous intéresser
          </TabsTrigger>
          <TabsTrigger value="recommended">Offres recommandées</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {allOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres publiées..." />
          ) : allOffersQuery.isError ? (
            <OfferPanelMessage message={SEARCH_UNAVAILABLE_MESSAGE} />
          ) : hasActiveSearch &&
            (allOffersQuery.data?.offers ?? []).length === 0 ? (
            <OfferPanelMessage message="Aucune offre trouvee pour cette recherche." />
          ) : (allOffersQuery.data?.offers ?? []).length === 0 ? (
            <OfferPanelMessage message="Aucune offre publiée pour le moment." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(allOffersQuery.data?.offers ?? []).map((offer) => (
                <SearchOfferCard
                  key={`all-${offer.offerId ?? offer.title}`}
                  offer={offer}
                  showSearchRelevance={hasActiveSearch}
                  onSelect={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interesting" className="space-y-4">
          {isProfileGateLoading ? (
            <OfferPanelMessage message="Chargement de votre profil candidat..." />
          ) : isMissingCandidateProfile ? (
            <OfferPanelMessage message="Les offres qui peuvent vous intéresser seront disponibles dès que votre profil candidat sera créé." />
          ) : profilePresenceQuery.isError ? (
            <OfferPanelMessage message="Impossible de vérifier votre profil candidat pour le moment." />
          ) : interestingOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres basées sur vos centres d’intérêt..." />
          ) : interestingOffersQuery.isError ? (
            <OfferPanelMessage message={SEARCH_UNAVAILABLE_MESSAGE} />
          ) : (
            <>
              {!hasActiveSearch ? (
                <div className="panel flex flex-col gap-3 p-4 card-border-top">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Search className="h-4 w-4 text-accent" />
                    Recherche basée sur vos centres d’intérêt
                  </div>
                  {!hasActiveSearch && interestingKeywords.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {interestingKeywordsLabel}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ajoutez des centres d’intérêt dans votre profil pour
                      obtenir des offres pertinentes.
                    </p>
                  )}
                </div>
              ) : null}

              {!hasActiveSearch && interestingKeywords.length === 0 ? (
                <OfferPanelMessage message="Ajoutez des centres d’intérêt dans votre profil pour obtenir des offres pertinentes." />
              ) : hasActiveSearch &&
                (interestingOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage message="Aucune offre trouvee pour cette recherche." />
              ) : (interestingOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage message="Aucune offre trouvée pour vos centres d’intérêt actuels." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(interestingOffersQuery.data?.offers ?? []).map((offer) => (
                    <SearchOfferCard
                      key={`interesting-${offer.offerId ?? offer.title}`}
                      offer={offer}
                      showSearchRelevance
                      onSelect={() => setSelectedOffer(offer)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="recommended" className="space-y-4">
          {isProfileGateLoading ? (
            <OfferPanelMessage message="Chargement de votre profil candidat..." />
          ) : isMissingCandidateProfile ? (
            <OfferPanelMessage message="Votre profil candidat n’est pas encore créé. Uploadez votre CV pour recevoir des offres recommandées." />
          ) : profilePresenceQuery.isError ? (
            <OfferPanelMessage message="Impossible de vérifier votre profil candidat pour le moment." />
          ) : recommendedOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres recommandées..." />
          ) : recommendedOffersQuery.isError ? (
            <OfferPanelMessage message={MATCHING_UNAVAILABLE_MESSAGE} />
          ) : (recommendedOffersQuery.data?.offers ?? []).length === 0 ? (
            <OfferPanelMessage
              message="Aucune offre recommandée pour le moment."
              secondaryMessage="Vous pouvez baisser votre seuil minimum ou compléter votre profil."
            />
          ) : hasActiveSearch && filteredRecommendedOffers.length === 0 ? (
            <OfferPanelMessage
              message="Aucune offre trouvee pour cette recherche."
              secondaryMessage="Reinitialisez pour revoir toutes vos recommandations."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRecommendedOffers.map((offer) => (
                <RecommendedOfferCard
                  key={offer.matchingResultId}
                  offer={offer}
                  isApplied={appliedOfferIds.includes(offer.offerId)}
                  onSelect={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs> */}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (isOfferTab(value)) {
                setSearchParams({ tab: value });
              }
            }}
            className="space-y-4"
          >
            <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <TabsList className="h-auto w-full justify-start gap-1 bg-surface-muted p-1 overflow-x-auto">
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-background"
                >
                  Toutes les offres
                </TabsTrigger>
                <TabsTrigger
                  value="interesting"
                  className="data-[state=active]:bg-background"
                >
                  Offres qui peuvent vous intéresser{' '}
                  {/* {tabCountBadge(matchingList.length, tab === 'matching')} */}
                </TabsTrigger>
                <TabsTrigger
                  value="recommended"
                  className="data-[state=active]:bg-background"
                >
                  Offres recommandées{' '}
                  {/* {tabCountBadge(recommendedList.length, tab === 'recommended')} */}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="all"
              className="mt-0 animate-in fade-in-50 duration-200"
            >
              {allOffersQuery.isLoading ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Chargement des offres publiées...
                    </p>
                  </div>
                </div>
              ) : allOffersQuery.isError ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
                  <Ban className="h-6 w-6 text-destructive" />

                  <div>
                    <p className="text-sm text-destructive">
                      Impossible de vérifier votre profil candidat pour le
                      moment.
                    </p>
                  </div>
                </div>
              ) : hasActiveSearch &&
                (allOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage message="Aucune offre trouvee pour cette recherche." />
              ) : (allOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage message="Aucune offre publiée pour le moment." />
              ) : (
                <>
                  {(allOffersQuery.data?.offers ?? []).map((offer) => (
                    <>
                      {view === 'grid' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <SearchOfferCard
                            key={`all-${offer.offerId ?? offer.title}`}
                            offer={offer}
                            showSearchRelevance={hasActiveSearch}
                            onSelect={() => setSelectedOffer(offer)}
                          />
                        </div>
                      ) : (
                        <div className="panel divide-y divide-border">
                          <SearchOfferRow
                            key={`all-${offer.offerId ?? offer.title}`}
                            offer={offer}
                            onClick={() => setSelectedOffer(offer)}
                          />
                        </div>
                      )}
                    </>
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent
              value="interesting"
              className="mt-0 animate-in fade-in-50 duration-200"
            >
              {isProfileGateLoading ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Chargement de votre profil candidat...
                    </p>
                  </div>
                </div>
              ) : isMissingCandidateProfile ? (
                <OfferPanelMessage message="Votre profil candidat n’est pas encore créé. Uploadez votre CV pour recevoir des offres recommandées." />
              ) : profilePresenceQuery.isError ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
                  <Ban className="h-6 w-6 text-destructive" />

                  <div>
                    <p className="text-sm text-destructive">
                      Impossible de vérifier votre profil candidat pour le
                      moment..
                    </p>
                  </div>
                </div>
              ) : recommendedOffersQuery.isLoading ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Chargement des offres recommandées...
                    </p>
                  </div>
                </div>
              ) : recommendedOffersQuery.isError ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
                  <Ban className="h-6 w-6 text-destructive" />
                  <div>
                    <p className="text-sm text-destructive">
                      {MATCHING_UNAVAILABLE_MESSAGE}
                    </p>
                  </div>
                </div>
              ) : (recommendedOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage
                  message="Aucune offre recommandée pour le moment."
                  secondaryMessage="Vous pouvez baisser votre seuil minimum ou compléter votre profil."
                />
              ) : hasActiveSearch && filteredRecommendedOffers.length === 0 ? (
                <OfferPanelMessage
                  message="Aucune offre trouvee pour cette recherche."
                  secondaryMessage="Reinitialisez pour revoir toutes vos recommandations."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRecommendedOffers.map((offer) => (
                    <>
                      {view === 'grid' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <RecommendedOfferCard
                            key={offer.matchingResultId}
                            offer={offer}
                            isApplied={appliedOfferIds.includes(offer.offerId)}
                            onSelect={() => setSelectedOffer(offer)}
                          />
                        </div>
                      ) : (
                        <div className="panel divide-y divide-border">
                          <SearchOfferRow
                            key={`all-${offer.offerId ?? offer.title}`}
                            offer={offer}
                            matchedCount={offer.score}
                            onClick={() => setSelectedOffer(offer)}
                          />
                        </div>
                      )}
                    </>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="recommended"
              className="mt-0 animate-in fade-in-50 duration-200"
            >
              {isProfileGateLoading ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Chargement de votre profil candidat...
                    </p>
                  </div>
                </div>
              ) : isMissingCandidateProfile ? (
                <OfferPanelMessage message="Votre profil candidat n’est pas encore créé. Uploadez votre CV pour recevoir des offres recommandées." />
              ) : profilePresenceQuery.isError ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
                  <Ban className="h-6 w-6 text-destructive" />

                  <div>
                    <p className="text-sm text-destructive">
                      Impossible de vérifier votre profil candidat pour le
                      moment..
                    </p>
                  </div>
                </div>
              ) : recommendedOffersQuery.isLoading ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Chargement des offres recommandées...
                    </p>
                  </div>
                </div>
              ) : recommendedOffersQuery.isError ? (
                <div className="panel flex gap-2 items-center justify-center p-4 text-center card-border-destructive">
                  <Ban className="h-6 w-6 text-destructive" />

                  <div>
                    <p className="text-sm text-destructive">
                      {MATCHING_UNAVAILABLE_MESSAGE}
                    </p>
                  </div>
                </div>
              ) : (recommendedOffersQuery.data?.offers ?? []).length === 0 ? (
                <OfferPanelMessage
                  message="Aucune offre recommandée pour le moment."
                  secondaryMessage="Vous pouvez baisser votre seuil minimum ou compléter votre profil."
                />
              ) : hasActiveSearch && filteredRecommendedOffers.length === 0 ? (
                <OfferPanelMessage
                  message="Aucune offre trouvee pour cette recherche."
                  secondaryMessage="Reinitialisez pour revoir toutes vos recommandations."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRecommendedOffers.map((offer) => (
                    <>
                      {view === 'grid' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <RecommendedOfferCard
                            key={offer.matchingResultId}
                            offer={offer}
                            isApplied={appliedOfferIds.includes(offer.offerId)}
                            onSelect={() => setSelectedOffer(offer)}
                          />
                        </div>
                      ) : (
                        <div className="panel divide-y divide-border">
                          <SearchOfferRow
                            key={`all-${offer.offerId ?? offer.title}`}
                            offer={offer}
                            matchedCount={offer.score}
                            onClick={() => setSelectedOffer(offer)}
                          />
                        </div>
                      )}
                    </>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Dialog
        open={Boolean(selectedOffer)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOffer(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          {selectedOffer ? (
            selectedOffer.kind === 'matching' ? (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">
                    {selectedOffer.title}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedOffer.companyName}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField
                    icon={MapPin}
                    label="Localisation"
                    value={selectedOffer.location ?? 'Non renseignée'}
                  />
                  <DetailField
                    icon={Briefcase}
                    label="Type de contrat"
                    value={selectedOffer.contractType ?? 'Non renseigné'}
                  />
                  <DetailField
                    icon={Sparkles}
                    label="Score de compatibilité"
                    value={`${selectedOffer.score}%`}
                  />
                  <DetailField
                    icon={Building2}
                    label="Entreprise"
                    value={selectedOffer.companyName}
                  />
                  {selectedOffer.workMode ? (
                    <DetailField
                      icon={Briefcase}
                      label="Mode de travail"
                      value={selectedOffer.workMode}
                    />
                  ) : null}
                  {selectedOffer.publishedAt ? (
                    <DetailField
                      icon={CalendarDays}
                      label="Date de publication"
                      value={
                        formatDate(selectedOffer.publishedAt) ??
                        'Non renseignée'
                      }
                    />
                  ) : null}
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                    {selectedOffer.description ??
                      'Aucune description disponible pour le moment.'}
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Compétences demandées
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOffer.skills.length > 0 ? (
                      selectedOffer.skills.map((skill) => (
                        <SkillTag
                          key={`${selectedOffer.matchingResultId}-${skill}`}
                          label={skill}
                          variant="matched"
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune compétence détaillée pour le moment.
                      </p>
                    )}
                  </div>
                </section>

                {selectedOffer.languages.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Langues demandées
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedOffer.languages.map((language) => (
                        <SkillTag
                          key={`${selectedOffer.matchingResultId}-${language}`}
                          label={language}
                          variant="outline"
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedOffer.educationRequirements.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Formation
                    </h3>
                    <p className="text-sm text-foreground/90">
                      {selectedOffer.educationRequirements.join(' • ')}
                    </p>
                  </section>
                ) : null}

                {selectedOffer.experienceRequirements.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Expérience
                    </h3>
                    <p className="text-sm text-foreground/90">
                      {selectedOffer.experienceRequirements.join(' • ')}
                    </p>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Pourquoi cette offre vous correspond
                    </h3>
                  </div>

                  {selectedOffer.explanationShort ? (
                    <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 text-sm text-foreground/90">
                      {selectedOffer.explanationShort}
                    </div>
                  ) : null}

                  <MatchingExplanation
                    explanationJson={selectedOffer.explanationJson ?? {}}
                  />
                </section>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOffer(null)}
                  >
                    Fermer
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyMutation.mutate(selectedOffer)}
                    disabled={
                      !selectedOffer.offerId ||
                      isAlreadyApplied ||
                      applyMutation.isPending
                    }
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isAlreadyApplied ? 'Déjà postulé' : 'Postuler'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">
                    {selectedOffer.title}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedOffer.companyName ?? 'Entreprise non renseignée'}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField
                    icon={MapPin}
                    label="Localisation"
                    value={selectedOffer.location ?? 'Non renseignée'}
                  />
                  <DetailField
                    icon={Briefcase}
                    label="Type de contrat"
                    value={selectedOffer.contractType ?? 'Non renseigné'}
                  />
                  <DetailField
                    icon={Building2}
                    label="Entreprise"
                    value={selectedOffer.companyName ?? 'Non renseignée'}
                  />
                  {selectedOffer.workMode ? (
                    <DetailField
                      icon={Briefcase}
                      label="Mode de travail"
                      value={selectedOffer.workMode}
                    />
                  ) : null}
                  {selectedOffer.publishedAt ? (
                    <DetailField
                      icon={CalendarDays}
                      label="Date de publication"
                      value={
                        formatDate(selectedOffer.publishedAt) ??
                        'Non renseignée'
                      }
                    />
                  ) : null}
                  {selectedOffer.searchScore != null ? (
                    <DetailField
                      icon={Search}
                      label="Pertinence de recherche"
                      value={
                        formatSearchRelevance(selectedOffer.searchScore) ??
                        'Disponible'
                      }
                    />
                  ) : null}
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                    {getOfferDescription(selectedOffer) ??
                      'Aucune description disponible pour le moment.'}
                  </p>
                </section>

                {selectedOffer.skills.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Compétences
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedOffer.skills.map((skill) => (
                        <SkillTag
                          key={`${selectedOffer.offerId ?? selectedOffer.title}-${skill}`}
                          label={skill}
                          variant="outline"
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOffer(null)}
                  >
                    Fermer
                  </Button>
                  {selectedOffer.offerId ? (
                    <Button
                      type="button"
                      onClick={() => applyMutation.mutate(selectedOffer)}
                      disabled={isAlreadyApplied || applyMutation.isPending}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isAlreadyApplied ? 'Déjà postulé' : 'Postuler'}
                    </Button>
                  ) : null}
                </DialogFooter>
              </>
            )
          ) : (
            <div className="py-6 text-sm text-muted-foreground">
              Impossible de charger le détail de cette offre pour le moment.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferPanelMessage({
  message,
  secondaryMessage,
}: {
  message: string;
  secondaryMessage?: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center card-border-top">
      <Sparkles className="h-8 w-8 text-accent" />
      <div>
        <p className="text-lg font-semibold text-foreground">{message}</p>
        {secondaryMessage ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {secondaryMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SearchOfferCard({
  offer,
  showSearchRelevance,
  onSelect,
}: {
  offer: CandidateSearchOfferSummary;
  showSearchRelevance: boolean;
  onSelect: () => void;
}) {
  const publishedAt = formatDate(offer.publishedAt);
  const searchRelevance = formatSearchRelevance(offer.searchScore);

  return (
    <article className="panel p-5 flex flex-col group hover:border-accent transition-colors card-border-left">
      <div className="flex items-start justify-between mb-3 gap-3">
        {/* <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {offer.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {offer.companyName ?? 'Entreprise non renseignée'}
          </p>
        </div> */}

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary text-xs font-semibold">
            {offer.companyName
              .split(' ')
              .map((s) => s[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug truncate">
              {offer.title}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3" /> {offer.companyName}
            </p>
          </div>
        </div>
        {showSearchRelevance && searchRelevance ? (
          <StatusChip label={`Pertinence de recherche : ${searchRelevance}`} />
        ) : (
          <span
            className={`p-1.5 rounded-md border transition-colors inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-success-soft text-success border-success/30`}
          >
            <CheckCircle className={`h-3.5 w-3.5 fill-current`} />
            Offre publiée
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {offer.location ?? 'Localisation non renseignée'}
        </span>
        {offer.contractType ? <StatusChip label={offer.contractType} /> : null}
        {offer.workMode ? <StatusChip label={offer.workMode} /> : null}
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 mb-3">
        {getOfferDescription(offer) ??
          'Aucune description disponible pour le moment.'}
      </p>

      {offer.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.skills.slice(0, 6).map((skill) => (
            <SkillTag
              key={`${offer.offerId ?? offer.title}-${skill}`}
              label={skill}
              variant="outline"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {publishedAt ? `Publiée le ${publishedAt}` : 'Offre publiée'}
        </span>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" onClick={onSelect}>
            Voir le détail
          </Button>
        </div>
      </div>
    </article>
  );
}

function RecommendedOfferCard({
  offer,
  isApplied,
  onSelect,
}: {
  offer: CandidateRecommendedOfferSummary;
  isApplied: boolean;
  onSelect: () => void;
}) {
  const publishedAt = formatDate(offer.publishedAt);

  return (
    <article className="panel flex h-full flex-col p-5 card-border-left">
      <div className="flex items-start justify-between mb-3 gap-3">
        {/* <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {offer.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {offer.companyName}
          </p>
        </div> */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary text-xs font-semibold">
            {offer.companyName
              .split(' ')
              .map((s) => s[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug truncate">
              {offer.title}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3" /> {offer.companyName}
            </p>
          </div>
        </div>
        <ScoreBadge score={offer.score} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {offer.location ?? 'Localisation non renseignée'}
        </span>
        {offer.contractType ? <StatusChip label={offer.contractType} /> : null}
        {offer.workMode ? <StatusChip label={offer.workMode} /> : null}
      </div>

      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 mb-3">
        {offer.explanationShort ??
          offer.description ??
          'Aucune description disponible pour le moment.'}
      </p>

      {offer.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.skills.slice(0, 6).map((skill) => (
            <SkillTag
              key={`${offer.matchingResultId}-${skill}`}
              label={skill}
              variant="matched"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {publishedAt ? `Publiée le ${publishedAt}` : 'Offre recommandée'}
        </span>
        <div className="flex gap-1.5">
          {isApplied ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Déjà postulé
            </span>
          ) : null}
          <Button type="button" size="sm" onClick={onSelect}>
            Voir le détail
          </Button>
        </div>
      </div>
    </article>
  );
}

function StatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-accent" />
        {value}
      </p>
    </div>
  );
}

function MatchingExplanation({
  explanationJson,
}: {
  explanationJson: Record<string, unknown>;
}) {
  const subScores = asRecord(explanationJson.sub_scores);
  const details = asRecord(explanationJson.details);
  const weights = asRecord(explanationJson.weights);

  const languageDetails = asRecord(details.LANGUAGE_MATCH);
  const contractDetails = asRecord(details.CONTRACT_MATCH);

  const matchedLanguages = toStringList(languageDetails.matched_languages);
  const missingLanguages = toStringList(languageDetails.missing_languages);
  const hasSubScores = Object.keys(subScores).length > 0;

  if (!hasSubScores) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
        Aucune explication détaillée n'est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ScoreLine
          label="Compétences"
          score={normalizePercent(subScores.SKILLS_MATCH) ?? 0}
          weight={normalizePercent(weights.SKILLS_MATCH) ?? 0}
        />
        <ScoreLine
          label="Formation"
          score={normalizePercent(subScores.EDUCATION_MATCH) ?? 0}
          weight={normalizePercent(weights.EDUCATION_MATCH) ?? 0}
        />
        <ScoreLine
          label="Expérience"
          score={normalizePercent(subScores.EXPERIENCE_MATCH) ?? 0}
          weight={normalizePercent(weights.EXPERIENCE_MATCH) ?? 0}
        />
        <ScoreLine
          label="Langues"
          score={normalizePercent(subScores.LANGUAGE_MATCH) ?? 0}
          weight={normalizePercent(weights.LANGUAGE_MATCH) ?? 0}
        />
        <ScoreLine
          label="Localisation"
          score={normalizePercent(subScores.LOCATION_MATCH) ?? 0}
          weight={normalizePercent(weights.LOCATION_MATCH) ?? 0}
        />
        <ScoreLine
          label="Contrat"
          score={normalizePercent(subScores.CONTRACT_MATCH) ?? 0}
          weight={normalizePercent(weights.CONTRACT_MATCH) ?? 0}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-semibold text-foreground">Détails principaux</p>

        <div className="mt-2 space-y-1 text-muted-foreground">
          {matchedLanguages.length > 0 ? (
            <p>Langues validées : {matchedLanguages.join(', ')}</p>
          ) : null}

          {missingLanguages.length > 0 ? (
            <p>Langues manquantes : {missingLanguages.join(', ')}</p>
          ) : null}

          {contractDetails.match_type === 'mismatch' ? (
            <p>
              Le type de contrat ne correspond pas exactement à vos préférences.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScoreLine({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm font-semibold text-accent">{score}%</p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-accent"
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
      </div>

      {weight > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Poids dans le modèle : {weight}%
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="panel p-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
