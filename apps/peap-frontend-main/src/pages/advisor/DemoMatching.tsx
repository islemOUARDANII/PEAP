import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Eye,
  Filter,
  Loader2,
  MapPin,
  PlayCircle,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  createMatchingRunSafe,
  executeMatchingRunSafe,
  getAdvisorOffersSafe,
  getDistanceForOffer,
  getMatchedSkillsForOffer,
  getMatchingModelsSafe,
  getMatchingResultsSafe,
  isCandidateWithinEducationThreshold,
  isCandidateWithinLanguageThreshold,
} from '@/services/api/demoGateway';
import {
  extractLanguageLevel,
  realDemoMatchingScenario,
  type DemoEducationLevel,
  type DemoLanguageLevel,
  type DemoMatchingModel,
  type DemoMatchingResult,
  type DemoOffer,
} from '@/demo/demoData';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MatchingFilters {
  educationLevel: DemoEducationLevel;
  minExperienceYears: number;
  maxDistanceKm: number;
  requiredSkills: Record<string, boolean>;
  languageLevel: DemoLanguageLevel;
  minScore: number;
}

const educationOptions: DemoEducationLevel[] = ['Bac', 'Licence', 'Master'];
const languageOptions: DemoLanguageLevel[] = ['A2', 'B1', 'B2', 'C1'];

const buildFiltersFromOffer = (offer: DemoOffer): MatchingFilters => ({
  educationLevel: offer.educationLevel,
  minExperienceYears: offer.minExperienceYears,
  maxDistanceKm: offer.maxDistanceKm,
  requiredSkills: Object.fromEntries(
    offer.requiredSkills.map((skill) => [skill, true]),
  ),
  languageLevel: offer.languageLevel,
  minScore: offer.minScore,
});

const getBestLanguageLevelFromResult = (
  result: DemoMatchingResult,
): DemoLanguageLevel =>
  result.languages.reduce<DemoLanguageLevel>((current, language) => {
    const nextLevel = extractLanguageLevel(language);
    return ['A2', 'B1', 'B2', 'C1'].indexOf(nextLevel) >
      ['A2', 'B1', 'B2', 'C1'].indexOf(current)
      ? nextLevel
      : current;
  }, 'A2');

const normalizeRankedResults = (results: DemoMatchingResult[]) =>
  [...results]
    .sort((left, right) => right.score - left.score)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));

const parseConfiguredIds = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function DemoMatching() {
  const [searchParams] = useSearchParams();
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [filters, setFilters] = useState<MatchingFilters | null>(null);
  const [baseResults, setBaseResults] = useState<DemoMatchingResult[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<DemoMatchingResult | null>(null);
  const [executionNotice, setExecutionNotice] = useState('');
  const [executionDemoMode, setExecutionDemoMode] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const configuredScenario = useMemo(() => {
    const queryCandidateIds = parseConfiguredIds(
      searchParams.get('candidateIds') ?? searchParams.get('candidates'),
    );

    return {
      offerId:
        searchParams.get('offerId')?.trim() ||
        realDemoMatchingScenario.offerId?.trim() ||
        '',
      modelVersionId:
        searchParams.get('modelVersionId')?.trim() ||
        realDemoMatchingScenario.modelVersionId?.trim() ||
        '',
      candidateIds:
        queryCandidateIds.length > 0
          ? queryCandidateIds
          : (realDemoMatchingScenario.candidateIds ?? []).filter(Boolean),
    };
  }, [searchParams]);

  const modelsQuery = useQuery({
    queryKey: ['demo', 'advisor', 'matching-models'],
    queryFn: getMatchingModelsSafe,
    staleTime: 30_000,
  });

  const offersQuery = useQuery({
    queryKey: ['demo', 'advisor', 'offers'],
    queryFn: getAdvisorOffersSafe,
    staleTime: 30_000,
  });

  const models = modelsQuery.data?.data ?? [];
  const offers = offersQuery.data?.data ?? [];
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? models[0];
  const selectedOffer =
    offers.find((offer) => offer.id === selectedOfferId) ?? offers[0];
  const scenarioNotice = useMemo(() => {
    const parts: string[] = [];
    if (configuredScenario.offerId) {
      parts.push(`offre ciblée ${configuredScenario.offerId}`);
    }
    if (configuredScenario.modelVersionId) {
      parts.push(`modèle ${configuredScenario.modelVersionId}`);
    }
    if (configuredScenario.candidateIds.length > 0) {
      parts.push(
        `${configuredScenario.candidateIds.length} candidat(s) imposé(s)`,
      );
    }
    return parts.length > 0
      ? `Scénario de démo ciblé: ${parts.join(' · ')}`
      : '';
  }, [configuredScenario]);

  useEffect(() => {
    if (!selectedModelId && models[0]) {
      const configuredModel =
        models.find(
          (model) => model.versionId === configuredScenario.modelVersionId,
        ) ?? models[0];
      setSelectedModelId(configuredModel.id);
    }
  }, [configuredScenario.modelVersionId, models, selectedModelId]);

  useEffect(() => {
    if (!selectedOfferId && offers[0]) {
      const configuredOffer =
        offers.find((offer) => offer.id === configuredScenario.offerId) ??
        offers[0];
      setSelectedOfferId(configuredOffer.id);
    }
  }, [configuredScenario.offerId, offers, selectedOfferId]);

  useEffect(() => {
    if (!selectedOffer) {
      return;
    }

    setFilters(buildFiltersFromOffer(selectedOffer));
    setBaseResults([]);
    setSelectedResult(null);
    setExecutionNotice('');
    setExecutionDemoMode(false);
  }, [selectedOffer?.id]);

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOffer || !selectedModel || !filters) {
        throw new Error('Sélection incomplète pour lancer le matching.');
      }

      const createResult = await createMatchingRunSafe({
        run_type: 'MANUAL',
        direction: selectedModel.direction,
        model_version_id: selectedModel.versionId,
        source_entity_type: 'OFFER',
        source_entity_id: selectedOffer.id,
        parameters_json: {
          education_level: filters.educationLevel,
          min_experience_years: filters.minExperienceYears,
          max_distance_km: filters.maxDistanceKm,
          min_score: filters.minScore,
          required_skills: Object.entries(filters.requiredSkills)
            .filter(([, enabled]) => enabled)
            .map(([skill]) => skill),
          language_level: filters.languageLevel,
          ...(configuredScenario.candidateIds.length > 0
            ? { candidate_ids: configuredScenario.candidateIds }
            : {}),
        },
      });

      const executeResult = await executeMatchingRunSafe(createResult.data.id);
      const resultsResult = await getMatchingResultsSafe(createResult.data.id, {
        offer: selectedOffer,
      });

      return {
        createResult,
        executeResult,
        resultsResult,
      };
    },
    onSuccess: ({ createResult, executeResult, resultsResult }) => {
      setBaseResults(normalizeRankedResults(resultsResult.data));
      setExecutionDemoMode(
        createResult.demoMode ||
          executeResult.demoMode ||
          resultsResult.demoMode,
      );

      const notices = [
        createResult.errorMessage,
        executeResult.errorMessage,
        resultsResult.errorMessage,
      ].filter(Boolean);

      setExecutionNotice(
        createResult.demoMode ||
          executeResult.demoMode ||
          resultsResult.demoMode
          ? 'Mode démonstration utilisé pour cette exécution'
          : (notices[0] ?? ''),
      );

      toast.success('Matching lancé avec succès.');
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de lancer le matching pour cette offre.';
      setExecutionNotice(message);
      toast.error(message);
    },
  });

  const filteredResults = useMemo(() => {
    if (!filters || !selectedOffer) {
      return [];
    }

    const enabledSkills = Object.entries(filters.requiredSkills)
      .filter(([, enabled]) => enabled)
      .map(([skill]) => skill);

    return normalizeRankedResults(
      (baseResults ?? []).filter((result) => {
        if (
          !isCandidateWithinEducationThreshold(
            resultToCandidate(result),
            filters.educationLevel,
          )
        ) {
          return false;
        }

        if (result.yearsExperience < filters.minExperienceYears) {
          return false;
        }

        if (result.score < filters.minScore) {
          return false;
        }

        if (
          getDistanceForOffer(resultToCandidate(result), selectedOffer) >
          filters.maxDistanceKm
        ) {
          return false;
        }

        if (
          !isCandidateWithinLanguageThreshold(
            resultToCandidate(result),
            filters.languageLevel,
          )
        ) {
          return false;
        }

        if (
          enabledSkills.length > 0 &&
          !enabledSkills.every((skill) =>
            getMatchedSkillsForOffer(
              resultToCandidate(result),
              selectedOffer,
            ).includes(skill),
          )
        ) {
          return false;
        }

        return true;
      }),
    );
  }, [baseResults, filters, selectedOffer]);

  const activeFiltersCount = useMemo(() => {
    if (!filters || !selectedOffer) {
      return 0;
    }

    return [
      filters.educationLevel !== selectedOffer.educationLevel,
      filters.minExperienceYears !== selectedOffer.minExperienceYears,
      filters.maxDistanceKm !== selectedOffer.maxDistanceKm,
      filters.languageLevel !== selectedOffer.languageLevel,
      filters.minScore !== selectedOffer.minScore,
      Object.entries(filters.requiredSkills).some(
        ([skill, enabled]) =>
          enabled !== selectedOffer.requiredSkills.includes(skill),
      ),
    ].filter(Boolean).length;
  }, [filters, selectedOffer]);

  const initialDemoMode = Boolean(
    modelsQuery.data?.demoMode || offersQuery.data?.demoMode,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching"
        description="Choisissez un modèle, sélectionnez une offre et pilotez le matching avec des filtres lisibles métier."
        actions={
          <>
            {initialDemoMode ? (
              <StatusPill label="Mode démo" tone="accent" />
            ) : null}
            {executionDemoMode ? (
              <StatusPill label="Exécution démo" tone="warning" />
            ) : null}
          </>
        }
      />

      {modelsQuery.data?.errorMessage ||
      offersQuery.data?.errorMessage ||
      executionNotice ||
      scenarioNotice ? (
        <section className="panel border-warning/30 bg-warning-soft/40 p-4">
          <div className="flex flex-col gap-2 text-sm text-foreground">
            {modelsQuery.data?.errorMessage ? (
              <p>{modelsQuery.data.errorMessage}</p>
            ) : null}
            {offersQuery.data?.errorMessage ? (
              <p>{offersQuery.data.errorMessage}</p>
            ) : null}
            {scenarioNotice ? <p>{scenarioNotice}</p> : null}
            {executionNotice ? (
              <p className="font-medium">{executionNotice}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {selectedOffer && filters ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-border bg-surface-muted px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="stat-label">Filtres métier</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  Ajustez les exigences de l'offre
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les filtres sont générés à partir des prérequis de l'offre
                  sélectionnée et mettent à jour les résultats immédiatement
                  côté frontend.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={`${activeFiltersCount} filtre(s) ajusté(s)`}
                  tone={activeFiltersCount > 0 ? 'accent' : 'neutral'}
                  dot={false}
                />
                <Button
                  type="button"
                  onClick={() => launchMutation.mutate()}
                  disabled={!selectedModel || launchMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {launchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  {launchMutation.isPending
                    ? 'Matching en cours...'
                    : 'Lancer le matching'}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="rounded-xl border border-border bg-primary/5 p-4 border-color-primary card-border-top">
                <p className="text-sm font-semibold text-foreground">
                  {selectedOffer.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedOffer.company} · {selectedOffer.location} ·{' '}
                  {selectedOffer.contractType} · {selectedOffer.workMode}
                </p>
                <p className="mt-4 text-sm leading-6 text-foreground/90">
                  {selectedOffer.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(selectedOffer.requirements ?? []).map((requirement) => (
                    <SkillTag
                      key={`${selectedOffer.id}-${requirement}`}
                      label={requirement}
                      variant="outline"
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FilterSelect
                  label="Niveau d'étude"
                  value={filters.educationLevel}
                  onValueChange={(value) =>
                    setFilters((current) =>
                      current
                        ? {
                            ...current,
                            educationLevel: value as DemoEducationLevel,
                          }
                        : current,
                    )
                  }
                  options={educationOptions}
                />

                <FilterSelect
                  label="Expérience minimum"
                  value={String(filters.minExperienceYears)}
                  onValueChange={(value) =>
                    setFilters((current) =>
                      current
                        ? {
                            ...current,
                            minExperienceYears: Number.parseInt(value, 10),
                          }
                        : current,
                    )
                  }
                  options={['0', '1', '2', '3', '4', '5']}
                  formatter={(value) => `${value} an(s)`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl  border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Distance maximum
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ajustez le rayon de recherche de 20 à 150 km.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-muted px-3 py-1 text-sm font-semibold text-primary">
                    {filters.maxDistanceKm} km
                  </span>
                </div>
                <Slider
                  value={[filters.maxDistanceKm]}
                  min={20}
                  max={150}
                  step={5}
                  className="mt-5"
                  onValueChange={([value]) =>
                    setFilters((current) =>
                      current ? { ...current, maxDistanceKm: value } : current,
                    )
                  }
                />
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Score minimum
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Les profils sous ce seuil sont exclus du classement.
                    </p>
                  </div>
                  <ScoreBadge score={filters.minScore} size="sm" />
                </div>
                <Slider
                  value={[filters.minScore]}
                  min={0}
                  max={100}
                  step={5}
                  className="mt-5"
                  onValueChange={([value]) =>
                    setFilters((current) =>
                      current ? { ...current, minScore: value } : current,
                    )
                  }
                />
              </div>

              <FilterSelect
                label="Niveau de langue minimum"
                value={filters.languageLevel}
                onValueChange={(value) =>
                  setFilters((current) =>
                    current
                      ? {
                          ...current,
                          languageLevel: value as DemoLanguageLevel,
                        }
                      : current,
                  )
                }
                options={languageOptions}
              />

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Compétences requises
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(selectedOffer.requiredSkills ?? []).map((skill) => (
                    <label
                      key={`${selectedOffer.id}-checkbox-${skill}`}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3"
                    >
                      <Checkbox
                        checked={filters.requiredSkills[skill] ?? false}
                        onCheckedChange={(checked) =>
                          setFilters((current) =>
                            current
                              ? {
                                  ...current,
                                  requiredSkills: {
                                    ...current.requiredSkills,
                                    [skill]: checked === true,
                                  },
                                }
                              : current,
                          )
                        }
                      />
                      <span className="text-sm text-foreground">{skill}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="panel p-5 card-border-top">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="stat-label">Modèles disponibles</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Sélection du modèle de matching
              </h2>
            </div>
            <StatusPill
              label={`${(models ?? []).length} modèle(s)`}
              tone="info"
              dot={false}
            />
          </div>

          {modelsQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des modèles...
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(models ?? []).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    'rounded-3xl border p-4 text-left transition-all',
                    selectedModel?.id === model.id
                      ? 'border-primary bg-primary-muted/40 shadow-sm card-border-left-active'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary-muted/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-2xl bg-primary-muted p-3 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <StatusPill
                      label={model.status}
                      tone={statusToTone(model.status)}
                    />
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {model.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {model.direction === 'OFFER_TO_CANDIDATES'
                      ? 'Offre vers candidats'
                      : model.direction}
                  </p>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Version {model.version}</span>
                    <span>{model.criteriaWeights.length} critères</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(model.criteriaWeights ?? []).map((criterion) => (
                      <SkillTag
                        key={`${model.id}-${criterion.label}`}
                        label={`${criterion.label} ${criterion.weight}%`}
                        variant={criterion.isMust ? 'matched' : 'outline'}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-5 card-border-top">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="stat-label">Offres à matcher</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Choix de l'offre
              </h2>
            </div>
            <StatusPill
              label={`${(offers ?? []).length} offre(s)`}
              tone="info"
              dot={false}
            />
          </div>

          {offersQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des offres...
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[800px] p-3">
              <div className="space-y-1">
                {(offers ?? []).map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={cn(
                      'w-full rounded-xl border p-2 text-left transition-all',
                      selectedOffer?.id === offer.id
                        ? 'border-accent bg-accent-soft/30 shadow-sm card-border-left-orange'
                        : 'border-border bg-background hover:border-accent/40 hover:bg-accent-soft/10',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {offer.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {offer.company} · {offer.location}
                        </p>
                      </div>
                      <StatusPill
                        label={offer.status}
                        tone={statusToTone(offer.status)}
                      />
                    </div>
                    {/* <div className="mt-4 flex flex-wrap gap-2">
                    {(offer.requiredSkills ?? []).map((skill) => (
                      <SkillTag
                        key={`${offer.id}-${skill}`}
                        label={skill}
                        variant="matched"
                      />
                    ))}
                  </div> */}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-border bg-surface-muted px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-label">Résultats</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Candidats classés
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Consultez le score global, les compétences alignées et les
                écarts à traiter avant prise de décision.
              </p>
            </div>

            {filteredResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <MetricCard
                  label="Résultats"
                  value={String(filteredResults.length)}
                />
                <MetricCard
                  label="Score moyen"
                  value={`${Math.round(
                    filteredResults.reduce(
                      (total, item) => total + item.score,
                      0,
                    ) / filteredResults.length,
                  )}%`}
                />
                <MetricCard
                  label="Top score"
                  value={`${filteredResults[0]?.score ?? 0}%`}
                />
              </div>
            ) : null}
          </div>
        </div>

        {launchMutation.isPending ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours...
            </div>
          </div>
        ) : baseResults.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Lancez un matching pour afficher le classement des candidats.
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Aucun candidat ne correspond aux filtres courants. Essayez par
            exemple d'augmenter la distance maximum ou de réduire le score
            minimum.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Candidat</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Compétences matchées</TableHead>
                <TableHead>Écarts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filteredResults ?? []).map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium text-foreground">
                    #{result.rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">
                        {result.candidateName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {result.title}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{result.location}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={result.score} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {(result.matchedSkills ?? []).slice(0, 3).map((skill) => (
                        <SkillTag
                          key={`${result.id}-matched-${skill}`}
                          label={skill}
                          variant="matched"
                        />
                      ))}
                      {result.matchedSkills.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Aucune
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {(result.gaps ?? []).slice(0, 2).map((gap) => (
                        <SkillTag
                          key={`${result.id}-gap-${gap}`}
                          label={gap}
                          variant="missing"
                        />
                      ))}
                      {result.gaps.length === 0 ? (
                        <span className="text-xs text-success">
                          Aucun écart majeur
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={result.status}
                      tone={
                        result.score >= 80
                          ? 'success'
                          : result.score >= 65
                            ? 'accent'
                            : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedResult(result);
                        setResultDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Voir détails
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedResult?.candidateName ?? 'Détail candidat'}
            </DialogTitle>
            <DialogDescription>
              Lecture détaillée du score, des points forts et des écarts.
            </DialogDescription>
          </DialogHeader>

          {selectedResult ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DetailStat
                  label="Score global"
                  value={`${selectedResult.score}%`}
                />
                <DetailStat label="Profil" value={selectedResult.title} />
                <DetailStat
                  label="Distance"
                  value={`${selectedResult.distanceKm} km`}
                />
                <DetailStat label="Statut" value={selectedResult.status} />
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <section className="rounded-3xl border border-border bg-surface-muted p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Critères détaillés
                  </p>
                  <div className="mt-4 space-y-3">
                    {(selectedResult.criteria ?? []).map((criterion) => (
                      <div
                        key={`${selectedResult.id}-${criterion.label}`}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">
                            {criterion.label}
                          </p>
                          <ScoreBadge score={criterion.score} size="sm" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {criterion.details}
                        </p>
                        <div className="mt-3">
                          <StatusPill
                            label={
                              criterion.matched
                                ? 'Critère validé'
                                : 'Point à traiter'
                            }
                            tone={criterion.matched ? 'success' : 'warning'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-3xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Éléments matchés
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedResult.matchedItems ?? []).map((item) => (
                        <SkillTag
                          key={`${selectedResult.id}-ok-${item}`}
                          label={item}
                          variant="matched"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Éléments manquants
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedResult.missingItems ?? []).map((item) => (
                        <SkillTag
                          key={`${selectedResult.id}-missing-${item}`}
                          label={item}
                          variant="missing"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-primary-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        Recommandation
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/90">
                      {selectedResult.recommendation}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  formatter,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  formatter?: (value: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(options ?? []).map((option) => (
            <SelectItem key={`${label}-${option}`} value={option}>
              {formatter ? formatter(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function resultToCandidate(result: DemoMatchingResult) {
  return {
    id: result.candidateId,
    name: result.candidateName,
    title: result.title,
    location: result.location,
    email: '',
    phone: '',
    educationLevel: result.educationLevel,
    yearsExperience: result.yearsExperience,
    skills: result.skills,
    languages: result.languages.map((language) => {
      const parts = language.split(' ');
      const level = parts[parts.length - 1];
      return {
        name: parts.slice(0, -1).join(' ') || parts[0] || 'Français',
        level: extractLanguageLevel(level),
      };
    }),
    distanceKm: result.distanceKm,
    summary: result.recommendation,
  };
}
