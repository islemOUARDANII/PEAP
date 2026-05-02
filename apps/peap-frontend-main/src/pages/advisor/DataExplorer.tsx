import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Loader2,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  gatewayApi,
  type CandidateListItem,
  type EmployerOffer,
  type MatchingModelRecord,
  type MatchingModelVersionRecord,
  type MatchingResultDetailRecord,
  type MatchingResultRecord,
  type MatchingRunRecord,
} from "@/services/api/gateway";

type JourneyKey = "offer" | "candidate";
type DecisionStatus = "PENDING" | "RETAINED" | "REJECTED";

const matchingJourneys = {
  offer: {
    key: "offer",
    direction: "OFFER_TO_CANDIDATES",
    sourceEntityType: "OFFER" as const,
    title: "Partir d'une offre",
    description: "Lancer un matching pour trouver les candidats les plus pertinents pour une offre.",
    sourceLabel: "Offre a analyser",
    sourcePlaceholder: "Choisir une offre",
  },
  candidate: {
    key: "candidate",
    direction: "CANDIDATE_TO_OFFERS",
    sourceEntityType: "CANDIDATE" as const,
    title: "Partir d'un candidat",
    description: "Lancer un matching pour trouver les offres les plus adaptees a un candidat.",
    sourceLabel: "Candidat a analyser",
    sourcePlaceholder: "Choisir un candidat",
  },
} satisfies Record<
  JourneyKey,
  {
    key: JourneyKey;
    direction: string;
    sourceEntityType: "OFFER" | "CANDIDATE";
    title: string;
    description: string;
    sourceLabel: string;
    sourcePlaceholder: string;
  }
>;

const decisionOptions: Array<{ value: DecisionStatus; label: string }> = [
  { value: "PENDING", label: "En attente" },
  { value: "RETAINED", label: "A retenir" },
  { value: "REJECTED", label: "A ecarter" },
];

const FINAL_RUN_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

const friendlyStatusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  CANCELLED: "Annule",
  COMPLETED: "Termine",
  ELIGIBLE: "Compatible",
  FAILED: "En erreur",
  OFFER: "Offre",
  CANDIDATE: "Candidat",
  PENDING: "En attente",
  PUBLISHED: "Publie",
  REJECTED: "A ecarter",
  RETAINED: "A retenir",
  RUNNING: "En cours",
};

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Non renseigne";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-TN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function friendlyLabel(value?: string | null): string {
  if (!value) {
    return "Non renseigne";
  }

  const exact = friendlyStatusLabels[value.toUpperCase()];
  if (exact) {
    return exact;
  }

  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreToPercent(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function formatScore(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Non calcule";
  }

  return `${scoreToPercent(value)}%`;
}

function shortId(value?: string | null): string {
  if (!value) {
    return "Non renseigne";
  }

  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function isDecisionStatus(value: string): value is DecisionStatus {
  return decisionOptions.some((option) => option.value === value);
}

function matchesJourney(
  direction: string,
  sourceEntityType: "OFFER" | "CANDIDATE",
): boolean {
  const normalized = direction.toUpperCase();
  return sourceEntityType === "OFFER"
    ? normalized.startsWith("OFFER_TO")
    : normalized.startsWith("CANDIDATE_TO");
}

function describeOffer(offer?: EmployerOffer): string {
  if (!offer) {
    return "";
  }

  return [offer.employerName, offer.locationLabel || friendlyLabel(offer.status)]
    .filter(Boolean)
    .join(" - ");
}

function describeCandidate(candidate?: CandidateListItem): string {
  if (!candidate) {
    return "";
  }

  return [
    candidate.governorateLabel,
    candidate.currentCvExists ? "CV disponible" : "Sans CV",
    friendlyLabel(candidate.status),
  ]
    .filter(Boolean)
    .join(" - ");
}

function getSourceText(
  sourceEntityType: string,
  sourceId: string,
  offers: Map<string, EmployerOffer>,
  candidates: Map<string, CandidateListItem>,
): { label: string; context: string } {
  if (sourceEntityType === "OFFER") {
    const offer = offers.get(sourceId);
    return {
      label: offer?.title ?? `Offre ${shortId(sourceId)}`,
      context: describeOffer(offer),
    };
  }

  const candidate = candidates.get(sourceId);
  return {
    label:
      candidate?.fullName ?? candidate?.anetiIdentifier ?? `Candidat ${shortId(sourceId)}`,
    context: describeCandidate(candidate),
  };
}

function buildRunHeadline(
  run: MatchingRunRecord,
  offers: Map<string, EmployerOffer>,
  candidates: Map<string, CandidateListItem>,
): { title: string; subtitle: string } {
  const source = getSourceText(run.sourceEntityType, run.sourceEntityId, offers, candidates);
  const titlePrefix =
    run.sourceEntityType === "OFFER"
      ? "Matching lance pour l'offre"
      : "Matching lance pour le candidat";

  return {
    title: `${titlePrefix} ${source.label}`,
    subtitle:
      source.context ||
      `Reference ${shortId(run.sourceEntityId)} utilisee pour produire ce matching.`,
  };
}

function summarizeRunAction(
  journey: (typeof matchingJourneys)[JourneyKey],
  sourceSummary: string,
  modelLabel: string,
  versionLabel: string,
): string {
  if (journey.sourceEntityType === "OFFER") {
    return `Vous allez lancer un matching pour trouver les meilleurs candidats pour ${sourceSummary} avec le modele ${modelLabel} ${versionLabel}.`;
  }

  return `Vous allez lancer un matching pour trouver les offres les plus pertinentes pour ${sourceSummary} avec le modele ${modelLabel} ${versionLabel}.`;
}

function detailTone(detail: MatchingResultDetailRecord): "success" | "warning" | "destructive" | "neutral" {
  if (detail.isGap) {
    return "destructive";
  }

  if (detail.matched === false) {
    return "warning";
  }

  if (detail.matched || (detail.score ?? 0) > 0) {
    return "success";
  }

  return "neutral";
}

export default function DataExplorer() {
  const queryClient = useQueryClient();
  const [journeyKey, setJourneyKey] = useState<JourneyKey>("offer");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [manualSourceId, setManualSourceId] = useState("");
  const [currentRunId, setCurrentRunId] = useState("");
  const [runLookupId, setRunLookupId] = useState("");
  const [selectedResultId, setSelectedResultId] = useState("");
  const [decisionStatus, setDecisionStatus] = useState<DecisionStatus>("PENDING");
  const [decisionReason, setDecisionReason] = useState("");

  const journey = matchingJourneys[journeyKey];
  const manualSourceValue = manualSourceId.trim();

  const modelsQuery = useQuery({
    queryKey: ["matching", "models"],
    queryFn: () => gatewayApi.matchingConfig.listModels(),
    staleTime: 30_000,
  });
  const modelVersionsQuery = useQuery({
    queryKey: ["matching", "models", selectedModelId, "versions"],
    queryFn: () => gatewayApi.matchingConfig.listVersions(selectedModelId),
    enabled: Boolean(selectedModelId),
    staleTime: 30_000,
  });
  const advisorOffersQuery = useQuery({
    queryKey: ["advisor", "offers", "matching-source"],
    queryFn: () => gatewayApi.advisor.listOffers(),
    staleTime: 30_000,
  });
  const advisorCandidatesQuery = useQuery({
    queryKey: ["advisor", "candidates", "matching-source"],
    queryFn: () => gatewayApi.advisor.listCandidates({ limit: 50, offset: 0 }),
    staleTime: 30_000,
  });
  const runQuery = useQuery({
    queryKey: ["matching", "runs", currentRunId],
    queryFn: () => gatewayApi.matching.getRun(currentRunId),
    enabled: Boolean(currentRunId),
    refetchInterval: (query) =>
      query.state.data && FINAL_RUN_STATUSES.has(query.state.data.status)
        ? false
        : 4_000,
  });
  const resultsQuery = useQuery({
    queryKey: ["matching", "runs", currentRunId, "results"],
    queryFn: () => gatewayApi.matching.listResults(currentRunId),
    enabled: Boolean(currentRunId),
    staleTime: 5_000,
  });
  const resultDetailQuery = useQuery({
    queryKey: ["matching", "results", selectedResultId],
    queryFn: () => gatewayApi.matching.getResult(selectedResultId),
    enabled: Boolean(selectedResultId),
  });

  const offersById = useMemo(() => {
    const map = new Map<string, EmployerOffer>();
    for (const offer of advisorOffersQuery.data ?? []) {
      map.set(offer.id, offer);
    }
    return map;
  }, [advisorOffersQuery.data]);

  const candidatesById = useMemo(() => {
    const map = new Map<string, CandidateListItem>();
    for (const candidate of advisorCandidatesQuery.data ?? []) {
      map.set(candidate.id, candidate);
    }
    return map;
  }, [advisorCandidatesQuery.data]);

  const relevantModels = useMemo(
    () =>
      (modelsQuery.data ?? []).filter((model) =>
        matchesJourney(model.direction, journey.sourceEntityType),
      ),
    [journey.sourceEntityType, modelsQuery.data],
  );

  const sourceOptions = useMemo(() => {
    if (journey.sourceEntityType === "OFFER") {
      return (advisorOffersQuery.data ?? []).map((offer) => ({
        value: offer.id,
        label: offer.employerName ? `${offer.title} - ${offer.employerName}` : offer.title,
        helper: describeOffer(offer),
      }));
    }

    return (advisorCandidatesQuery.data ?? []).map((candidate) => ({
      value: candidate.id,
      label:
        candidate.fullName ?? candidate.anetiIdentifier ?? `Candidat ${shortId(candidate.id)}`,
      helper: describeCandidate(candidate),
    }));
  }, [advisorCandidatesQuery.data, advisorOffersQuery.data, journey.sourceEntityType]);

  const selectedModel = relevantModels.find((model) => model.id === selectedModelId);
  const modelVersions =
    modelVersionsQuery.data ??
    selectedModel?.versions ??
    [];
  const selectedVersion = modelVersions.find((version) => version.id === selectedVersionId);
  const selectedSource = sourceOptions.find((option) => option.value === selectedSourceId);

  const versionCatalog = useMemo(() => {
    const catalog = new Map<
      string,
      { model: MatchingModelRecord; version: MatchingModelVersionRecord }
    >();

    for (const model of modelsQuery.data ?? []) {
      for (const version of model.versions) {
        catalog.set(version.id, { model, version });
      }
    }

    return catalog;
  }, [modelsQuery.data]);

  const activeRun = runQuery.data;
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const selectedResult = resultDetailQuery.data?.result;
  const resultDetails = useMemo(
    () => resultDetailQuery.data?.details ?? [],
    [resultDetailQuery.data?.details],
  );

  const activeRunVersion = activeRun
    ? versionCatalog.get(activeRun.modelVersionId)
    : undefined;

  const resultSummary = useMemo(
    () => ({
      total: results.length,
      retained: results.filter((result) => result.decisionStatus === "RETAINED").length,
      withGaps: results.filter((result) => result.hasGaps).length,
    }),
    [results],
  );

  const strengths = useMemo(
    () => resultDetails.filter((detail) => detailTone(detail) === "success"),
    [resultDetails],
  );
  const attentionPoints = useMemo(
    () =>
      resultDetails.filter((detail) =>
        ["warning", "destructive"].includes(detailTone(detail)),
      ),
    [resultDetails],
  );
  const neutralDetails = useMemo(
    () => resultDetails.filter((detail) => detailTone(detail) === "neutral"),
    [resultDetails],
  );

  const createRunMutation = useMutation({
    mutationFn: () =>
      gatewayApi.matching.createRun({
        run_type: "MANUAL",
        direction: journey.direction,
        model_version_id: selectedVersionId,
        source_entity_type: journey.sourceEntityType,
        source_entity_id: manualSourceValue || selectedSourceId,
        parameters_json: {},
      }),
    onSuccess: (run) => {
      setCurrentRunId(run.id);
      setRunLookupId(run.id);
      setSelectedResultId("");
      toast.success("Matching cree. Vous pouvez maintenant le demarrer.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de creer ce matching.");
    },
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      gatewayApi.matching.executeRun(currentRunId, {
        dry_run: false,
        admin_override: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["matching", "runs", currentRunId] }),
        queryClient.invalidateQueries({ queryKey: ["matching", "runs", currentRunId, "results"] }),
      ]);
      toast.success("Le matching a demarre. Les resultats vont se mettre a jour.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de demarrer ce matching.");
    },
  });

  const decisionMutation = useMutation({
    mutationFn: () =>
      gatewayApi.matching.updateDecision(selectedResultId, {
        decision_status: decisionStatus,
        decision_reason: decisionReason.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["matching", "runs", currentRunId, "results"] }),
        queryClient.invalidateQueries({ queryKey: ["matching", "results", selectedResultId] }),
      ]);
      toast.success("La decision a ete mise a jour.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Impossible de mettre a jour la decision.",
      );
    },
  });

  useEffect(() => {
    if (selectedModelId && !relevantModels.some((model) => model.id === selectedModelId)) {
      setSelectedModelId("");
      setSelectedVersionId("");
    }
  }, [relevantModels, selectedModelId]);

  useEffect(() => {
    if (selectedSourceId && !sourceOptions.some((option) => option.value === selectedSourceId)) {
      setSelectedSourceId("");
    }
  }, [selectedSourceId, sourceOptions]);

  useEffect(() => {
    if (results.length === 0) {
      setSelectedResultId("");
      return;
    }

    setSelectedResultId((current) =>
      current && results.some((result) => result.id === current) ? current : results[0].id,
    );
  }, [results]);

  useEffect(() => {
    if (!selectedResult) {
      return;
    }

    setDecisionStatus(
      isDecisionStatus(selectedResult.decisionStatus)
        ? selectedResult.decisionStatus
        : "PENDING",
    );
    setDecisionReason(selectedResult.decisionReason ?? "");
  }, [selectedResult]);

  const sourceNarrative = manualSourceValue
    ? `${journey.sourceEntityType === "OFFER" ? "l'offre" : "le candidat"} avec l'identifiant ${manualSourceValue}`
    : selectedSource
      ? selectedSource.label
      : journey.sourceEntityType === "OFFER"
        ? "une offre"
        : "un candidat";

  const launchSummary =
    selectedModel && selectedVersion
      ? summarizeRunAction(
          journey,
          sourceNarrative,
          selectedModel.label,
          `v${selectedVersion.versionNumber}`,
        )
      : "Choisissez un modele, une version et une source pour preparer votre matching.";

  const activeRunHeadline = activeRun
    ? buildRunHeadline(activeRun, offersById, candidatesById)
    : null;

  const activeRunSource = activeRun
    ? getSourceText(activeRun.sourceEntityType, activeRun.sourceEntityId, offersById, candidatesById)
    : null;

  const selectedResultCandidate =
    selectedResult?.candidateLabel ?? selectedResult?.candidateId ?? "Candidat non renseigne";
  const selectedResultOffer =
    selectedResult?.offerTitle ?? selectedResult?.offerId ?? "Offre non renseignee";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lancer un matching"
        description="Choisissez une offre ou un candidat, lancez le matching, puis relisez les resultats dans un format clair et metier."
      />

      <section className="panel-elevated overflow-hidden">
        <div className="bg-gradient-to-br from-primary/[0.08] via-background to-accent-soft/50 px-6 py-7 sm:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Etape 1
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Preparez votre matching
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Au lieu d'afficher des parametres techniques, cette page vous aide a choisir
                  simplement le point de depart, le modele, puis a lancer l'analyse.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(Object.values(matchingJourneys) as Array<(typeof matchingJourneys)[JourneyKey]>).map(
                  (item) => (
                    <JourneyCard
                      key={item.key}
                      title={item.title}
                      description={item.description}
                      icon={item.sourceEntityType === "OFFER" ? BriefcaseBusiness : UserRound}
                      selected={journeyKey === item.key}
                      onClick={() => {
                        setJourneyKey(item.key);
                        setSelectedModelId("");
                        setSelectedVersionId("");
                        setSelectedSourceId("");
                        setManualSourceId("");
                      }}
                    />
                  ),
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Modele de matching"
                  value={selectedModelId}
                  onValueChange={(value) => {
                    setSelectedModelId(value);
                    setSelectedVersionId("");
                  }}
                  placeholder="Choisir un modele"
                  options={relevantModels.map((model) => ({
                    value: model.id,
                    label: `${model.label} (${model.code})`,
                  }))}
                />

                <SelectField
                  label="Version du modele"
                  value={selectedVersionId}
                  onValueChange={setSelectedVersionId}
                  placeholder="Choisir une version"
                  options={modelVersions.map((version) => ({
                    value: version.id,
                    label: `Version ${version.versionNumber} - ${friendlyLabel(version.status)}`,
                  }))}
                  disabled={!selectedModelId}
                />

                <SelectField
                  label={journey.sourceLabel}
                  value={selectedSourceId}
                  onValueChange={setSelectedSourceId}
                  placeholder={journey.sourcePlaceholder}
                  options={sourceOptions.map((option) => ({
                    value: option.value,
                    label: option.helper ? `${option.label} - ${option.helper}` : option.label,
                  }))}
                />

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Identifiant manuel (optionnel)
                  </Label>
                  <Input
                    value={manualSourceId}
                    onChange={(event) => setManualSourceId(event.target.value)}
                    placeholder="A utiliser seulement si la source n'apparait pas dans la liste"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => createRunMutation.mutate()}
                  disabled={
                    createRunMutation.isPending ||
                    !selectedVersionId ||
                    !(manualSourceValue || selectedSourceId)
                  }
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {createRunMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {createRunMutation.isPending ? "Creation du matching..." : "Creer le matching"}
                </Button>
              </div>
            </div>

            <aside className="rounded-3xl border border-border bg-background/90 p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Resume
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                Votre prochaine action
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{launchSummary}</p>

              <div className="mt-5 space-y-3">
                <SummaryLine
                  label="Modele"
                  value={
                    selectedModel
                      ? `${selectedModel.label} (${selectedModel.code})`
                      : "Choisissez un modele"
                  }
                />
                <SummaryLine
                  label="Version"
                  value={
                    selectedVersion
                      ? `Version ${selectedVersion.versionNumber} - ${friendlyLabel(selectedVersion.status)}`
                      : "Choisissez une version"
                  }
                />
                <SummaryLine
                  label={journey.sourceEntityType === "OFFER" ? "Offre" : "Candidat"}
                  value={manualSourceValue || selectedSource?.label || "Choisissez une source"}
                />
                {selectedSource?.helper ? (
                  <p className="rounded-2xl bg-surface-muted px-4 py-3 text-xs text-muted-foreground">
                    {selectedSource.helper}
                  </p>
                ) : null}
              </div>

              {selectedVersion ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MiniMetric
                    label="Criteres"
                    value={String(selectedVersion.criteria.length)}
                  />
                  <MiniMetric
                    label="Filtres forts"
                    value={String(selectedVersion.hardFilters.length)}
                  />
                  <MiniMetric
                    label="Publication"
                    value={selectedVersion.publishedAt ? formatDateTime(selectedVersion.publishedAt) : "Brouillon"}
                  />
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Etape 2
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Suivre un matching
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Demarrez le matching que vous venez de creer ou rechargez un matching existant avec
              son identifiant.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[260px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Identifiant du matching
              </Label>
              <Input
                value={runLookupId}
                onChange={(event) => setRunLookupId(event.target.value)}
                placeholder="Collez un identifiant pour reprendre un matching"
                className="h-10"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentRunId(runLookupId.trim());
                setSelectedResultId("");
              }}
              disabled={!runLookupId.trim()}
            >
              <Search className="h-4 w-4" />
              Charger
            </Button>

            <Button
              type="button"
              onClick={() => executeMutation.mutate()}
              disabled={
                !currentRunId ||
                executeMutation.isPending ||
                activeRun?.status === "RUNNING"
              }
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {executeMutation.isPending ? "Demarrage..." : "Demarrer le matching"}
            </Button>
          </div>
        </div>

        {runQuery.isLoading ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Chargement du matching...
          </div>
        ) : runQuery.isError ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive-soft p-4 text-sm text-destructive">
            {runQuery.error instanceof Error
              ? runQuery.error.message
              : "Impossible de charger ce matching."}
          </div>
        ) : activeRun && activeRunHeadline && activeRunSource ? (
          <div className="mt-5 rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Matching en cours
                </p>
                <h3 className="text-xl font-semibold text-foreground">
                  {activeRunHeadline.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeRunHeadline.subtitle}
                </p>
                {activeRun.errorMessage ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-destructive-soft px-3 py-1 text-xs font-medium text-destructive">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {activeRun.errorMessage}
                  </div>
                ) : null}
              </div>

              <StatusPill
                label={friendlyLabel(activeRun.status)}
                tone={statusToTone(activeRun.status)}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Reference" value={shortId(activeRun.id)} />
              <InfoCard
                label={activeRun.sourceEntityType === "OFFER" ? "Offre source" : "Candidat source"}
                value={activeRunSource.label}
                supportingText={activeRunSource.context}
              />
              <InfoCard
                label="Modele"
                value={
                  activeRunVersion
                    ? `${activeRunVersion.model.label} - v${activeRunVersion.version.versionNumber}`
                    : shortId(activeRun.modelVersionId)
                }
                supportingText={
                  activeRunVersion
                    ? friendlyLabel(activeRunVersion.version.status)
                    : "Version non resolue"
                }
              />
              <InfoCard
                label="Demarre le"
                value={formatDateTime(activeRun.startedAt)}
                supportingText={
                  activeRun.finishedAt
                    ? `Termine le ${formatDateTime(activeRun.finishedAt)}`
                    : "En attente de fin"
                }
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-border bg-surface-muted px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Etape 3
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Resultats</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Consultez les propositions generees, comparez les scores et ouvrez un resultat
                  pour lire ce qui joue en sa faveur ou ce qui doit etre verifie.
                </p>
              </div>

              {results.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  <MiniMetric label="Total" value={String(resultSummary.total)} />
                  <MiniMetric label="A retenir" value={String(resultSummary.retained)} />
                  <MiniMetric label="Avec ecarts" value={String(resultSummary.withGaps)} />
                </div>
              ) : null}
            </div>
          </div>

          {resultsQuery.isLoading ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              Chargement des resultats...
            </div>
          ) : resultsQuery.isError ? (
            <div className="px-5 py-6 text-sm text-destructive">
              {resultsQuery.error instanceof Error
                ? resultsQuery.error.message
                : "Impossible de charger les resultats."}
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              Aucun resultat n'est encore disponible pour ce matching.
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  selected={selectedResultId === result.id}
                  onClick={() => setSelectedResultId(result.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel p-5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Lecture detaillee
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Resultat selectionne
          </h2>

          {!selectedResult ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Selectionnez un resultat pour voir son score, les arguments cles et la decision.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      Proposition
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-foreground">
                      {selectedResultCandidate}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pour l'offre {selectedResultOffer}
                    </p>
                  </div>

                  <div className="rounded-full bg-primary-muted px-3 py-1 text-sm font-semibold text-primary">
                    Rang #{selectedResult.rank}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div className="min-w-[84px] text-3xl font-semibold text-foreground">
                    {formatScore(selectedResult.scoreGlobal)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Progress value={scoreToPercent(selectedResult.scoreGlobal)} className="h-2.5" />
                    <p className="text-xs text-muted-foreground">
                      Score global estime par le moteur de matching.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoCard
                    label="Decision"
                    value={friendlyLabel(selectedResult.decisionStatus)}
                    supportingNode={
                      <StatusPill
                        label={friendlyLabel(selectedResult.decisionStatus)}
                        tone={statusToTone(selectedResult.decisionStatus)}
                      />
                    }
                  />
                  <InfoCard
                    label="Compatibilite"
                    value={friendlyLabel(selectedResult.eligibilityStatus)}
                    supportingNode={
                      <StatusPill
                        label={friendlyLabel(selectedResult.eligibilityStatus)}
                        tone={statusToTone(selectedResult.eligibilityStatus)}
                      />
                    }
                  />
                  <InfoCard
                    label="Score regles"
                    value={formatScore(selectedResult.scoreRuleBased)}
                  />
                  <InfoCard
                    label="Score semantique"
                    value={formatScore(selectedResult.scoreSemantic)}
                  />
                </div>

                {selectedResult.explanationShort ? (
                  <div className="mt-5 rounded-2xl bg-surface-muted p-4 text-sm leading-6 text-foreground">
                    {selectedResult.explanationShort}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Mettre a jour la decision
                </p>
                <div className="mt-4 space-y-3">
                  <SelectField
                    label="Decision"
                    value={decisionStatus}
                    onValueChange={(value) => setDecisionStatus(value as DecisionStatus)}
                    options={decisionOptions}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Commentaire
                    </Label>
                    <Textarea
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                      rows={4}
                      placeholder="Ajoutez un commentaire si vous souhaitez expliquer la decision."
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => decisionMutation.mutate()}
                    disabled={decisionMutation.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {decisionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {decisionMutation.isPending ? "Enregistrement..." : "Enregistrer la decision"}
                  </Button>
                </div>
              </div>

              <DetailGroup
                title="Points forts"
                description="Les criteres qui soutiennent le resultat."
                details={strengths}
                emptyMessage="Aucun point fort detaille n'a ete retourne."
              />

              <DetailGroup
                title="Points a verifier"
                description="Les ecarts, alertes ou points de vigilance."
                details={attentionPoints}
                emptyMessage="Aucun ecart ou point de vigilance n'a ete signale."
              />

              {neutralDetails.length > 0 ? (
                <DetailGroup
                  title="Autres signaux"
                  description="Informations complementaires renvoyees par le moteur."
                  details={neutralDetails}
                  emptyMessage=""
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function JourneyCard({
  title,
  description,
  icon: Icon,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-3xl border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary-muted/50 shadow-sm"
          : "border-border bg-background hover:border-primary/40 hover:bg-primary-muted/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        {selected ? (
          <StatusPill label="Selectionne" tone="accent" />
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              Aucune option disponible
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  supportingText,
  supportingNode,
}: {
  label: string;
  value: string;
  supportingText?: string;
  supportingNode?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      {supportingNode ? <div className="mt-2">{supportingNode}</div> : null}
      {supportingText ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{supportingText}</p>
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  selected,
  onClick,
}: {
  result: MatchingResultRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const candidateLabel =
    result.candidateLabel ?? result.candidateId ?? "Candidat non renseigne";
  const offerLabel = result.offerTitle ?? result.offerId ?? "Offre non renseignee";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border bg-background p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary-muted/30 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-primary-muted/10",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-muted px-3 py-1 text-xs font-semibold text-primary">
              Rang #{result.rank}
            </span>
            <StatusPill
              label={friendlyLabel(result.eligibilityStatus)}
              tone={statusToTone(result.eligibilityStatus)}
            />
            <StatusPill
              label={friendlyLabel(result.decisionStatus)}
              tone={statusToTone(result.decisionStatus)}
            />
          </div>

          <div className="grid gap-2 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              <span className="font-medium">{candidateLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              <span className="font-medium">{offerLabel}</span>
            </div>
          </div>
        </div>

        <div className="min-w-[180px] space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score global</span>
            <span className="font-semibold text-foreground">
              {formatScore(result.scoreGlobal)}
            </span>
          </div>
          <Progress value={scoreToPercent(result.scoreGlobal)} className="h-2.5" />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Regles {formatScore(result.scoreRuleBased)}</span>
            <span>Semantique {formatScore(result.scoreSemantic)}</span>
            {result.hasGaps ? <span>Ecarts detectes</span> : <span>Sans ecart majeur</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          {result.explanationShort || "Aucune explication courte n'a ete fournie."}
        </p>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}

function DetailGroup({
  title,
  description,
  details,
  emptyMessage,
}: {
  title: string;
  description: string;
  details: MatchingResultDetailRecord[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      {details.length === 0 ? (
        emptyMessage ? (
          <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : null
      ) : (
        <div className="mt-4 space-y-3">
          {details.map((detail) => (
            <DetailCard key={detail.id} detail={detail} />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailCard({ detail }: { detail: MatchingResultDetailRecord }) {
  const tone = detailTone(detail);
  const statusLabel =
    tone === "destructive"
      ? "Ecart a traiter"
      : tone === "warning"
        ? "A verifier"
        : tone === "success"
          ? "Point favorable"
          : "Information";

  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {detail.criterionLabel || detail.criterionCode || "Critere"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {detail.gapMessage ||
              detail.recommendation ||
              "Aucune precision complementaire n'a ete retournee pour ce critere."}
          </p>
        </div>

        <StatusPill label={statusLabel} tone={statusToTone(tone)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Score {formatScore(detail.score)}</span>
        <span>Poids {detail.weight == null ? "Non renseigne" : detail.weight}</span>
        <span>Impact {formatScore(detail.weightedScore)}</span>
        {detail.gapType ? <span>{friendlyLabel(detail.gapType)}</span> : null}
      </div>

      {detail.recommendation && detail.recommendation !== detail.gapMessage ? (
        <p className="mt-3 rounded-2xl bg-background px-4 py-3 text-sm leading-6 text-foreground">
          Conseil: {detail.recommendation}
        </p>
      ) : null}
    </div>
  );
}
