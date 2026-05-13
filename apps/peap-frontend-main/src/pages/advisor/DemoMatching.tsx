import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Eye,
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


const educationOptions: DemoEducationLevel[] = ['Bac', 'Licence', 'Master'];

const normalizeRankedResults = (results: DemoMatchingResult[]) =>
  [...results]
    .sort((left, right) => right.score - left.score)
    .map((result, index) => ({ ...result, rank: index + 1 }));

const parseConfiguredIds = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function DemoMatching() {
  const [searchParams] = useSearchParams();
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [educationLevel, setEducationLevel] = useState<DemoEducationLevel>('Bac');
  const [minExperienceYears, setMinExperienceYears] = useState(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState(150);
  const [minScore, setMinScore] = useState(0);
  const [baseResults, setBaseResults] = useState<DemoMatchingResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<DemoMatchingResult | null>(null);
  const [executionNotice, setExecutionNotice] = useState('');
  const [executionDemoMode, setExecutionDemoMode] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  const configuredScenario = useMemo(() => {
    const queryCandidateIds = parseConfiguredIds(
      searchParams.get('candidateIds') ?? searchParams.get('candidates'),
    );
    return {
      offerId: searchParams.get('offerId')?.trim() || realDemoMatchingScenario.offerId?.trim() || '',
      modelVersionId: searchParams.get('modelVersionId')?.trim() || realDemoMatchingScenario.modelVersionId?.trim() || '',
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
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? models[0];
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;

  // Set defaults once data loads
  useEffect(() => {
    if (!selectedModelId && models[0]) {
      const configured = models.find((m) => m.versionId === configuredScenario.modelVersionId) ?? models[0];
      setSelectedModelId(configured.id);
    }
  }, [configuredScenario.modelVersionId, models, selectedModelId]);

  useEffect(() => {
    if (!selectedOfferId && offers[0]) {
      const configured = offers.find((o) => o.id === configuredScenario.offerId) ?? offers[0];
      setSelectedOfferId(configured.id);
    }
  }, [configuredScenario.offerId, offers, selectedOfferId]);

  const initialDemoMode = Boolean(modelsQuery.data?.demoMode || offersQuery.data?.demoMode);

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOffer || !selectedModel) {
        throw new Error('Sélectionnez une offre et un modèle avant de lancer le matching.');
      }

      const createResult = await createMatchingRunSafe({
        run_type: 'MANUAL',
        direction: selectedModel.direction,
        model_version_id: selectedModel.versionId,
        source_entity_type: 'OFFER',
        source_entity_id: selectedOffer.id,
        parameters_json: {
          education_level: educationLevel,
          min_experience_years: minExperienceYears,
          max_distance_km: maxDistanceKm,
          min_score: minScore,
          ...(configuredScenario.candidateIds.length > 0
            ? { candidate_ids: configuredScenario.candidateIds }
            : {}),
        },
      });

      const executeResult = await executeMatchingRunSafe(createResult.data.id);
      const resultsResult = await getMatchingResultsSafe(createResult.data.id, { offer: selectedOffer });

      return { createResult, executeResult, resultsResult };
    },
    onSuccess: ({ createResult, executeResult, resultsResult }) => {
      setBaseResults(normalizeRankedResults(resultsResult.data));
      setExecutionDemoMode(createResult.demoMode || executeResult.demoMode || resultsResult.demoMode);

      const notices = [createResult.errorMessage, executeResult.errorMessage, resultsResult.errorMessage].filter(Boolean);
      setExecutionNotice(
        createResult.demoMode || executeResult.demoMode || resultsResult.demoMode
          ? 'Mode démonstration utilisé pour cette exécution'
          : (notices[0] ?? ''),
      );

      toast.success('Matching lancé avec succès.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Impossible de lancer le matching.';
      setExecutionNotice(message);
      toast.error(message);
    },
  });

  const filteredResults = useMemo(() => {
    if (!selectedOffer) return [];

    return normalizeRankedResults(
      baseResults.filter((result) => {
        if (!isCandidateWithinEducationThreshold(resultToCandidate(result), educationLevel)) return false;
        if (result.yearsExperience < minExperienceYears) return false;
        if (result.score < minScore) return false;
        if (getDistanceForOffer(resultToCandidate(result), selectedOffer) > maxDistanceKm) return false;
        return true;
      }),
    );
  }, [baseResults, educationLevel, minExperienceYears, minScore, maxDistanceKm, selectedOffer]);

  const scenarioNotice = useMemo(() => {
    const parts: string[] = [];
    if (configuredScenario.offerId) parts.push(`offre ciblée ${configuredScenario.offerId}`);
    if (configuredScenario.modelVersionId) parts.push(`modèle ${configuredScenario.modelVersionId}`);
    if (configuredScenario.candidateIds.length > 0) parts.push(`${configuredScenario.candidateIds.length} candidat(s) imposé(s)`);
    return parts.length > 0 ? `Scénario de démo ciblé: ${parts.join(' · ')}` : '';
  }, [configuredScenario]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching"
        description="Sélectionnez une offre et un modèle, ajustez les filtres et lancez le matching."
        actions={
          <>
            {initialDemoMode ? <StatusPill label="Mode démo" tone="accent" /> : null}
            {executionDemoMode ? <StatusPill label="Exécution démo" tone="warning" /> : null}
          </>
        }
      />

      {modelsQuery.data?.errorMessage || offersQuery.data?.errorMessage || executionNotice || scenarioNotice ? (
        <section className="panel border-warning/30 bg-warning-soft/40 p-4">
          <div className="flex flex-col gap-2 text-sm text-foreground">
            {modelsQuery.data?.errorMessage ? <p>{modelsQuery.data.errorMessage}</p> : null}
            {offersQuery.data?.errorMessage ? <p>{offersQuery.data.errorMessage}</p> : null}
            {scenarioNotice ? <p>{scenarioNotice}</p> : null}
            {executionNotice ? <p className="font-medium">{executionNotice}</p> : null}
          </div>
        </section>
      ) : null}

      {/* Step 1 — Offer + Model selection */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* Offers — left */}
        <section className="panel p-5 card-border-top">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="stat-label">Offres à matcher</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Choix de l'offre</h2>
            </div>
            <StatusPill label={`${offers.length} offre(s)`} tone="info" dot={false} />
          </div>

          {offersQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des offres...
            </div>
          ) : (
            <ScrollArea className="mt-4 h-full max-h-[500px]">
              <div className="space-y-1 pr-2">
                {offers.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => {
                      setSelectedOfferId(offer.id);
                      setBaseResults([]);
                      setSelectedResult(null);
                      setExecutionNotice('');
                      setExecutionDemoMode(false);
                    }}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all',
                      selectedOffer?.id === offer.id
                        ? 'border-accent bg-accent-soft/30 shadow-sm card-border-left-orange'
                        : 'border-border bg-background hover:border-accent/40 hover:bg-accent-soft/10',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">{offer.title}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {offer.company} · {offer.location}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {offer.contractType} · {offer.workMode}
                        </p>
                      </div>
                      <StatusPill label={offer.status} tone={statusToTone(offer.status)} />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        {/* Models — right */}
        <section className="panel p-5 card-border-top">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="stat-label">Modèles disponibles</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Sélection du modèle</h2>
            </div>
            <StatusPill label={`${models.length} modèle(s)`} tone="info" dot={false} />
          </div>

          {modelsQuery.isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des modèles...
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {models.map((model) => (
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
                    <StatusPill label={model.status} tone={statusToTone(model.status)} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{model.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {model.direction === 'OFFER_TO_CANDIDATES' ? 'Offre vers candidats' : model.direction}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Version {model.version}</span>
                    <span>{model.criteriaWeights.length} critères</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {model.criteriaWeights.map((criterion) => (
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
      </div>

      {/* Step 2 — Advanced filters + Launch */}
      <section className="panel overflow-hidden">
        <div className="border-b border-border bg-surface-muted px-5 py-4">
          <p className="stat-label">Filtres avancés</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Paramètres du matching</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedOffer
              ? `Offre sélectionnée : ${selectedOffer.title}`
              : 'Sélectionnez une offre dans la liste ci-dessus.'}
          </p>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* Education */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Niveau d'étude minimum</Label>
            <Select value={educationLevel} onValueChange={(v) => setEducationLevel(v as DemoEducationLevel)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {educationOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Experience */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Expérience minimum</Label>
            <Select
              value={String(minExperienceYears)}
              onValueChange={(v) => setMinExperienceYears(Number.parseInt(v, 10))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['0', '1', '2', '3', '4', '5'].map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt} an(s)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Distance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Distance maximum</Label>
              <span className="rounded-full bg-primary-muted px-2.5 py-0.5 text-xs font-semibold text-primary">
                {maxDistanceKm} km
              </span>
            </div>
            <Slider
              defaultValue={[150]}
              min={20}
              max={150}
              step={5}
              onValueChange={(v) => setMaxDistanceKm(v[0])}
            />
          </div>

          {/* Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Score minimum</Label>
              <ScoreBadge score={minScore} size="sm" />
            </div>
            <Slider
              defaultValue={[0]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setMinScore(v[0])}
            />
          </div>
        </div>

        <div className="flex justify-end px-5 pb-5">
          <Button
            type="button"
            onClick={() => launchMutation.mutate()}
            disabled={!selectedOffer || !selectedModel || launchMutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {launchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {launchMutation.isPending ? 'Matching en cours...' : 'Lancer le matching'}
          </Button>
        </div>
      </section>

      {/* Step 3 — Results */}
      <section className="panel overflow-hidden">
        <div className="border-b border-border bg-surface-muted px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-label">Résultats</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Candidats classés</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Score global, compétences alignées et écarts à traiter.
              </p>
            </div>
            {filteredResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Résultats" value={String(filteredResults.length)} />
                <MetricCard
                  label="Score moyen"
                  value={`${Math.round(filteredResults.reduce((t, r) => t + r.score, 0) / filteredResults.length)}%`}
                />
                <MetricCard label="Top score" value={`${filteredResults[0]?.score ?? 0}%`} />
              </div>
            ) : null}
          </div>
        </div>

        {launchMutation.isPending ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...
            </div>
          </div>
        ) : baseResults.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Lancez un matching pour afficher le classement des candidats.
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Aucun candidat ne correspond aux filtres courants. Essayez d'augmenter la distance ou de réduire le score minimum.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rang</TableHead>
                <TableHead>Candidat</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Compétences matchées</TableHead>
                <TableHead>Écarts</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium text-foreground">#{result.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{result.candidateName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{result.title}</TableCell>
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
                      {result.matchedSkills.slice(0, 3).map((skill) => (
                        <SkillTag key={`${result.id}-matched-${skill}`} label={skill} variant="matched" />
                      ))}
                      {result.matchedSkills.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Aucune</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {result.gaps.slice(0, 2).map((gap) => (
                        <SkillTag key={`${result.id}-gap-${gap}`} label={gap} variant="missing" />
                      ))}
                      {result.gaps.length === 0 ? (
                        <span className="text-xs text-success">Aucun écart majeur</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={result.status}
                      tone={result.score >= 80 ? 'success' : result.score >= 65 ? 'accent' : 'warning'}
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
            <DialogTitle>{selectedResult?.candidateName ?? 'Détail candidat'}</DialogTitle>
            <DialogDescription>Lecture détaillée du score, des points forts et des écarts.</DialogDescription>
          </DialogHeader>

          {selectedResult ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DetailStat label="Score global" value={`${selectedResult.score}%`} />
                <DetailStat label="Profil" value={selectedResult.title} />
                <DetailStat label="Distance" value={`${selectedResult.distanceKm} km`} />
                <DetailStat label="Statut" value={selectedResult.status} />
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <section className="rounded-3xl border border-border bg-surface-muted p-4">
                  <p className="text-sm font-semibold text-foreground">Critères détaillés</p>
                  <div className="mt-4 space-y-3">
                    {selectedResult.criteria.map((criterion) => (
                      <div
                        key={`${selectedResult.id}-${criterion.label}`}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">{criterion.label}</p>
                          <ScoreBadge score={criterion.score} size="sm" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{criterion.details}</p>
                        <div className="mt-3">
                          <StatusPill
                            label={criterion.matched ? 'Critère validé' : 'Point à traiter'}
                            tone={criterion.matched ? 'success' : 'warning'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-3xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Éléments matchés</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedResult.matchedItems.map((item) => (
                        <SkillTag key={`${selectedResult.id}-ok-${item}`} label={item} variant="matched" />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Éléments manquants</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedResult.missingItems.map((item) => (
                        <SkillTag key={`${selectedResult.id}-missing-${item}`} label={item} variant="missing" />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-primary-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Recommandation</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/90">{selectedResult.recommendation}</p>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
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
