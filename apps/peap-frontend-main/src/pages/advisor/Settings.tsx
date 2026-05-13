import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { gatewayApi, type MatchingModelRecord, type MatchingModelVersionRecord } from "@/services/api/gateway";

const criterionDataTypes = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "CODE", "CODE_LIST", "GEO", "JSON"];
const modelDirections = ["OFFER_TO_CANDIDATE", "CANDIDATE_TO_OFFER", "CANDIDATE_TO_OCCUPATION"];
const logicOperators = ["AND", "OR"];
const ruleOperators = [
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "CONTAINS",
  "NOT_CONTAINS",
  "EXISTS",
  "NOT_EXISTS",
  "DISTANCE_LTE",
];

const emptyCriterionForm = {
  id: "",
  code: "",
  label: "",
  description: "",
  dataType: "TEXT",
  active: true,
};

const emptyModelForm = {
  id: "",
  code: "",
  label: "",
  direction: "OFFER_TO_CANDIDATE",
  description: "",
  active: true,
};

const emptyVersionForm = {
  versionNumber: "",
};

const emptyModelCriterionForm = {
  id: "",
  criterionId: "",
  weight: "1",
  isMust: false,
  minThreshold: "",
  logicOperator: "AND",
};

const emptyHardFilterForm = {
  id: "",
  criterionId: "",
  ruleOperator: "EQ",
  ruleValue: "",
  rejectionReason: "",
};

const invalidateMatchingConfig = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["matching", "criteria"] }),
    queryClient.invalidateQueries({ queryKey: ["matching", "models"] }),
  ]);
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [criterionForm, setCriterionForm] = useState(emptyCriterionForm);
  const [modelForm, setModelForm] = useState(emptyModelForm);
  const [versionForm, setVersionForm] = useState(emptyVersionForm);
  const [modelCriterionForm, setModelCriterionForm] = useState(emptyModelCriterionForm);
  const [hardFilterForm, setHardFilterForm] = useState(emptyHardFilterForm);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const criteriaQuery = useQuery({
    queryKey: ["matching", "criteria"],
    queryFn: () => gatewayApi.matchingConfig.listCriteria(),
    staleTime: 30_000,
  });
  const modelsQuery = useQuery({
    queryKey: ["matching", "models"],
    queryFn: () => gatewayApi.matchingConfig.listModels(),
    staleTime: 30_000,
  });
  const versionsQuery = useQuery({
    queryKey: ["matching", "models", selectedModelId, "versions"],
    queryFn: () => gatewayApi.matchingConfig.listVersions(selectedModelId),
    enabled: Boolean(selectedModelId),
    staleTime: 30_000,
  });
  const modelCriteriaQuery = useQuery({
    queryKey: ["matching", "versions", selectedVersionId, "criteria"],
    queryFn: () => gatewayApi.matchingConfig.listModelCriteria(selectedVersionId),
    enabled: Boolean(selectedVersionId),
    staleTime: 30_000,
  });
  const hardFiltersQuery = useQuery({
    queryKey: ["matching", "versions", selectedVersionId, "hard-filters"],
    queryFn: () => gatewayApi.matchingConfig.listHardFilters(selectedVersionId),
    enabled: Boolean(selectedVersionId),
    staleTime: 30_000,
  });

  const selectedModel = (modelsQuery.data ?? []).find((m) => m.id === selectedModelId) ?? null;
  const selectedVersion =
    (versionsQuery.data ?? []).find((item) => item.id === selectedVersionId) ?? null;

  useEffect(() => {
    const firstModel = modelsQuery.data?.[0];
    if (!selectedModelId && firstModel) {
      setSelectedModelId(firstModel.id);
    }
  }, [modelsQuery.data, selectedModelId]);

  useEffect(() => {
    const firstVersion = versionsQuery.data?.[0];
    if (!selectedVersionId && firstVersion) {
      setSelectedVersionId(firstVersion.id);
    }
  }, [selectedVersionId, versionsQuery.data]);

  const criterionMutation = useMutation({
    mutationFn: () =>
      criterionForm.id
        ? gatewayApi.matchingConfig.updateCriterion(criterionForm.id, {
            code: criterionForm.code,
            label: criterionForm.label,
            description: criterionForm.description || null,
            data_type: criterionForm.dataType,
            active: criterionForm.active,
          })
        : gatewayApi.matchingConfig.createCriterion({
            code: criterionForm.code,
            label: criterionForm.label,
            description: criterionForm.description || null,
            data_type: criterionForm.dataType,
            active: criterionForm.active,
          }),
    onSuccess: async () => {
      await invalidateMatchingConfig(queryClient);
      setCriterionForm(emptyCriterionForm);
      toast.success("Matching criterion saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the criterion.");
    },
  });

  const deleteCriterionMutation = useMutation({
    mutationFn: (criterionId: string) => gatewayApi.matchingConfig.deleteCriterion(criterionId),
    onSuccess: async () => {
      await invalidateMatchingConfig(queryClient);
      toast.success("Matching criterion deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the criterion.");
    },
  });

  const modelMutation = useMutation({
    mutationFn: () =>
      modelForm.id
        ? gatewayApi.matchingConfig.updateModel(modelForm.id, {
            code: modelForm.code,
            label: modelForm.label,
            direction: modelForm.direction,
            description: modelForm.description || null,
            active: modelForm.active,
          })
        : gatewayApi.matchingConfig.createModel({
            code: modelForm.code,
            label: modelForm.label,
            direction: modelForm.direction,
            description: modelForm.description || null,
            active: modelForm.active,
          }),
    onSuccess: async (model) => {
      await invalidateMatchingConfig(queryClient);
      setSelectedModelId(model.id);
      setModelForm(emptyModelForm);
      toast.success("Matching model saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the model.");
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: (modelId: string) => gatewayApi.matchingConfig.deleteModel(modelId),
    onSuccess: async () => {
      await invalidateMatchingConfig(queryClient);
      setSelectedModelId("");
      setSelectedVersionId("");
      toast.success("Matching model deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the model.");
    },
  });

  const versionMutation = useMutation({
    mutationFn: () =>
      selectedVersionId
        ? gatewayApi.matchingConfig.updateVersion(selectedModelId, selectedVersionId, {
            version_number: Number(versionForm.versionNumber),
          })
        : gatewayApi.matchingConfig.createVersion(selectedModelId, {
            version_number: versionForm.versionNumber
              ? Number(versionForm.versionNumber)
              : undefined,
          }),
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", selectedModelId, "versions"] });
      setSelectedVersionId(version.id);
      setVersionForm(emptyVersionForm);
      toast.success("Model version saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the version.");
    },
  });

  const publishVersionMutation = useMutation({
    mutationFn: () => gatewayApi.matchingConfig.publishVersion(selectedModelId, selectedVersionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", selectedModelId, "versions"] });
      toast.success("Version published.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to publish the version.");
    },
  });

  const archiveVersionMutation = useMutation({
    mutationFn: () => gatewayApi.matchingConfig.archiveVersion(selectedModelId, selectedVersionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", selectedModelId, "versions"] });
      toast.success("Version archived.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to archive the version.");
    },
  });

  const modelCriterionMutation = useMutation({
    mutationFn: () =>
      modelCriterionForm.id
        ? gatewayApi.matchingConfig.updateModelCriterion(selectedVersionId, modelCriterionForm.id, {
            criterion_id: modelCriterionForm.criterionId,
            weight: Number(modelCriterionForm.weight),
            is_must: modelCriterionForm.isMust,
            min_threshold: modelCriterionForm.minThreshold
              ? Number(modelCriterionForm.minThreshold)
              : null,
            logic_operator: modelCriterionForm.logicOperator,
          })
        : gatewayApi.matchingConfig.createModelCriterion(selectedVersionId, {
            criterion_id: modelCriterionForm.criterionId,
            weight: Number(modelCriterionForm.weight),
            is_must: modelCriterionForm.isMust,
            min_threshold: modelCriterionForm.minThreshold
              ? Number(modelCriterionForm.minThreshold)
              : null,
            logic_operator: modelCriterionForm.logicOperator,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "criteria"] });
      setModelCriterionForm(emptyModelCriterionForm);
      toast.success("Model criterion saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the model criterion.");
    },
  });

  const deleteModelCriterionMutation = useMutation({
    mutationFn: (criterionId: string) =>
      gatewayApi.matchingConfig.deleteModelCriterion(selectedVersionId, criterionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "criteria"] });
      toast.success("Model criterion deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the model criterion.");
    },
  });

  const hardFilterMutation = useMutation({
    mutationFn: () =>
      hardFilterForm.id
        ? gatewayApi.matchingConfig.updateHardFilter(selectedVersionId, hardFilterForm.id, {
            criterion_id: hardFilterForm.criterionId,
            rule_operator: hardFilterForm.ruleOperator,
            rule_value: hardFilterForm.ruleValue,
            rejection_reason: hardFilterForm.rejectionReason || null,
          })
        : gatewayApi.matchingConfig.createHardFilter(selectedVersionId, {
            criterion_id: hardFilterForm.criterionId,
            rule_operator: hardFilterForm.ruleOperator,
            rule_value: hardFilterForm.ruleValue,
            rejection_reason: hardFilterForm.rejectionReason || null,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "hard-filters"] });
      setHardFilterForm(emptyHardFilterForm);
      toast.success("Hard filter saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the hard filter.");
    },
  });

  const deleteHardFilterMutation = useMutation({
    mutationFn: (filterId: string) =>
      gatewayApi.matchingConfig.deleteHardFilter(selectedVersionId, filterId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "hard-filters"] });
      toast.success("Hard filter deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the hard filter.");
    },
  });

  const criteriaOptions = useMemo(
    () =>
      (criteriaQuery.data ?? []).map((criterion) => ({
        value: criterion.id,
        label: `${criterion.code} - ${criterion.label}`,
      })),
    [criteriaQuery.data],
  );

  if (criteriaQuery.isLoading || modelsQuery.isLoading) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration du matching"
        description="Gérez les critères, modèles, versions, poids et filtres éliminatoires."
      />

      {/* ── 1. CRITÈRES ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">1. Critères</h2>
        <p className="mt-1 text-xs text-muted-foreground">Définissez les dimensions de scoring (ex : compétences, expérience, diplôme).</p>

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — form */}
          <div className="space-y-3">
            <TextField label="Code" value={criterionForm.code} onChange={(value) => setCriterionForm((c) => ({ ...c, code: value }))} />
            <TextField label="Libellé" value={criterionForm.label} onChange={(value) => setCriterionForm((c) => ({ ...c, label: value }))} />
            <SelectField
              label="Type de donnée"
              value={criterionForm.dataType}
              onValueChange={(value) => setCriterionForm((c) => ({ ...c, dataType: value }))}
              options={criterionDataTypes.map((t) => ({ value: t, label: t }))}
            />
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={criterionForm.description}
                onChange={(e) => setCriterionForm((c) => ({ ...c, description: e.target.value }))}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <SwitchField
              label="Actif"
              checked={criterionForm.active}
              onCheckedChange={(checked) => setCriterionForm((c) => ({ ...c, active: checked }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => criterionMutation.mutate()} disabled={criterionMutation.isPending}>
                <Save className="h-4 w-4" />
                {criterionMutation.isPending ? "Enregistrement..." : criterionForm.id ? "Modifier" : "Créer le critère"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCriterionForm(emptyCriterionForm)}>
                Réinitialiser
              </Button>
            </div>
          </div>

          {/* RIGHT — existing criteria */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Critères existants</p>
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {(criteriaQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun critère défini.</p>
              ) : (
                (criteriaQuery.data ?? []).map((criterion) => (
                  <ListItem
                    key={criterion.id}
                    title={criterion.code}
                    subtitle={`${criterion.label} · ${criterion.dataType}`}
                    actions={
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCriterionForm({
                              id: criterion.id,
                              code: criterion.code,
                              label: criterion.label,
                              description: criterion.description ?? "",
                              dataType: criterion.dataType,
                              active: criterion.active,
                            })
                          }
                        >
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCriterionMutation.mutate(criterion.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  >
                    <StatusPill label={criterion.active ? "Actif" : "Inactif"} tone={criterion.active ? "success" : "warning"} />
                  </ListItem>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. MODÈLES & VERSIONS ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">2. Modèles & versions</h2>
        <p className="mt-1 text-xs text-muted-foreground">Créez un modèle de scoring et gérez ses versions (DRAFT → ACTIVE → ARCHIVED).</p>

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — model form + version management */}
          <div className="space-y-4">
            <div className="space-y-3">
              <TextField label="Code" value={modelForm.code} onChange={(value) => setModelForm((c) => ({ ...c, code: value }))} />
              <TextField label="Libellé" value={modelForm.label} onChange={(value) => setModelForm((c) => ({ ...c, label: value }))} />
              <SelectField
                label="Direction"
                value={modelForm.direction}
                onValueChange={(value) => setModelForm((c) => ({ ...c, direction: value }))}
                options={modelDirections.map((d) => ({ value: d, label: d }))}
              />
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={modelForm.description}
                  onChange={(e) => setModelForm((c) => ({ ...c, description: e.target.value }))}
                  rows={2}
                  className="mt-1.5"
                />
              </div>
              <SwitchField
                label="Actif"
                checked={modelForm.active}
                onCheckedChange={(checked) => setModelForm((c) => ({ ...c, active: checked }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => modelMutation.mutate()} disabled={modelMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {modelMutation.isPending ? "Enregistrement..." : modelForm.id ? "Modifier" : "Créer le modèle"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setModelForm(emptyModelForm)}>
                  Réinitialiser
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Gestion des versions</p>
              <SelectField
                label="Modèle sélectionné"
                value={selectedModelId}
                onValueChange={setSelectedModelId}
                options={(modelsQuery.data ?? []).map((m) => ({ value: m.id, label: `${m.code} - ${m.label}` }))}
                placeholder="Choisir un modèle"
              />
              <TextField
                label="Numéro de version"
                value={versionForm.versionNumber}
                onChange={(value) => setVersionForm({ versionNumber: value })}
                type="number"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => versionMutation.mutate()} disabled={versionMutation.isPending || !selectedModelId}>
                  <Save className="h-4 w-4" />
                  {versionMutation.isPending ? "Enregistrement..." : selectedVersionId ? "Modifier la version" : "Créer la version"}
                </Button>
                <Button type="button" variant="outline" onClick={() => publishVersionMutation.mutate()} disabled={publishVersionMutation.isPending || !selectedVersionId}>
                  Publier
                </Button>
                <Button type="button" variant="outline" onClick={() => archiveVersionMutation.mutate()} disabled={archiveVersionMutation.isPending || !selectedVersionId}>
                  Archiver
                </Button>
              </div>
              {selectedVersion ? (
                <div className="rounded-md bg-surface-muted p-3 text-sm flex items-center gap-3">
                  <span className="font-medium text-foreground">v{selectedVersion.versionNumber}</span>
                  <StatusPill label={selectedVersion.status} tone={statusToTone(selectedVersion.status)} />
                </div>
              ) : null}
            </div>
          </div>

          {/* RIGHT — existing models */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Modèles existants</p>
            <div className="space-y-2 overflow-y-auto max-h-[30rem] pr-1">
              {(modelsQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun modèle défini.</p>
              ) : (
                (modelsQuery.data ?? []).map((model) => (
                  <ListItem
                    key={model.id}
                    title={`${model.code} - ${model.label}`}
                    subtitle={model.direction}
                    actions={
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedModelId(model.id);
                            setModelForm({
                              id: model.id,
                              code: model.code,
                              label: model.label,
                              direction: model.direction,
                              description: model.description ?? "",
                              active: model.active,
                            });
                          }}
                        >
                          Modifier
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => deleteModelMutation.mutate(model.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  >
                    <StatusPill label={model.active ? "Actif" : "Inactif"} tone={model.active ? "success" : "warning"} />
                  </ListItem>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. CRITÈRES DU MODÈLE ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">3. Critères du modèle</h2>
        <p className="mt-1 text-xs text-muted-foreground">Assignez des poids à chaque critère pour la version sélectionnée.</p>

        <VersionContext model={selectedModel} version={selectedVersion} versions={versionsQuery.data ?? []} onVersionChange={setSelectedVersionId} />

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — form */}
          <div className="space-y-3">
            <SelectField
              label="Critère"
              value={modelCriterionForm.criterionId}
              onValueChange={(value) => setModelCriterionForm((c) => ({ ...c, criterionId: value }))}
              options={criteriaOptions}
              placeholder="Choisir un critère"
              disabled={!selectedVersionId}
            />
            <TextField
              label="Poids (weight)"
              value={modelCriterionForm.weight}
              onChange={(value) => setModelCriterionForm((c) => ({ ...c, weight: value }))}
              type="number"
            />
            <TextField
              label="Seuil minimum"
              value={modelCriterionForm.minThreshold}
              onChange={(value) => setModelCriterionForm((c) => ({ ...c, minThreshold: value }))}
              type="number"
            />
            <SelectField
              label="Opérateur logique"
              value={modelCriterionForm.logicOperator}
              onValueChange={(value) => setModelCriterionForm((c) => ({ ...c, logicOperator: value }))}
              options={logicOperators.map((op) => ({ value: op, label: op }))}
            />
            <SwitchField
              label="Critère obligatoire (must)"
              checked={modelCriterionForm.isMust}
              onCheckedChange={(checked) => setModelCriterionForm((c) => ({ ...c, isMust: checked }))}
            />
            <Button type="button" onClick={() => modelCriterionMutation.mutate()} disabled={modelCriterionMutation.isPending || !selectedVersionId}>
              <Save className="h-4 w-4" />
              {modelCriterionMutation.isPending ? "Enregistrement..." : modelCriterionForm.id ? "Modifier le critère" : "Ajouter le critère"}
            </Button>
          </div>

          {/* RIGHT — assigned criteria */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Critères assignés à la version</p>
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {!selectedVersionId ? (
                <p className="text-xs text-muted-foreground italic">Sélectionnez un modèle et une version d'abord.</p>
              ) : (modelCriteriaQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun critère assigné.</p>
              ) : (
                (modelCriteriaQuery.data ?? []).map((item) => (
                  <ListItem
                    key={item.id}
                    title={`${item.criterionCode} - ${item.criterionLabel}`}
                    subtitle={`Poids : ${item.weight} · ${item.logicOperator}`}
                    actions={
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setModelCriterionForm({
                              id: item.id,
                              criterionId: item.criterionId,
                              weight: String(item.weight),
                              isMust: item.isMust,
                              minThreshold: item.minThreshold == null ? "" : String(item.minThreshold),
                              logicOperator: item.logicOperator,
                            })
                          }
                        >
                          Modifier
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => deleteModelCriterionMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  >
                    <StatusPill label={item.isMust ? "Obligatoire" : "Optionnel"} tone={item.isMust ? "accent" : "neutral"} />
                  </ListItem>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. HARD FILTERS ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">4. Filtres éliminatoires</h2>
        <p className="mt-1 text-xs text-muted-foreground">Si un candidat échoue un filtre, son score global devient 0 automatiquement.</p>

        <VersionContext model={selectedModel} version={selectedVersion} versions={versionsQuery.data ?? []} onVersionChange={setSelectedVersionId} />

        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* LEFT — form */}
          <div className="space-y-3">
            <SelectField
              label="Critère"
              value={hardFilterForm.criterionId}
              onValueChange={(value) => setHardFilterForm((c) => ({ ...c, criterionId: value }))}
              options={criteriaOptions}
              placeholder="Choisir un critère"
              disabled={!selectedVersionId}
            />
            <SelectField
              label="Opérateur de règle"
              value={hardFilterForm.ruleOperator}
              onValueChange={(value) => setHardFilterForm((c) => ({ ...c, ruleOperator: value }))}
              options={ruleOperators.map((op) => ({ value: op, label: op }))}
            />
            <TextField
              label="Valeur de la règle"
              value={hardFilterForm.ruleValue}
              onChange={(value) => setHardFilterForm((c) => ({ ...c, ruleValue: value }))}
            />
            <div>
              <Label className="text-xs">Motif de rejet</Label>
              <Textarea
                value={hardFilterForm.rejectionReason}
                onChange={(e) => setHardFilterForm((c) => ({ ...c, rejectionReason: e.target.value }))}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <Button type="button" onClick={() => hardFilterMutation.mutate()} disabled={hardFilterMutation.isPending || !selectedVersionId}>
              <Save className="h-4 w-4" />
              {hardFilterMutation.isPending ? "Enregistrement..." : hardFilterForm.id ? "Modifier le filtre" : "Ajouter le filtre"}
            </Button>
          </div>

          {/* RIGHT — existing hard filters */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Filtres actifs sur la version</p>
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {!selectedVersionId ? (
                <p className="text-xs text-muted-foreground italic">Sélectionnez un modèle et une version d'abord.</p>
              ) : (hardFiltersQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun filtre éliminatoire défini.</p>
              ) : (
                (hardFiltersQuery.data ?? []).map((item) => (
                  <ListItem
                    key={item.id}
                    title={`${item.criterionCode} ${item.ruleOperator} ${item.ruleValue}`}
                    subtitle={item.rejectionReason || "Pas de motif de rejet"}
                    actions={
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setHardFilterForm({
                              id: item.id,
                              criterionId: item.criterionId,
                              ruleOperator: item.ruleOperator,
                              ruleValue: item.ruleValue,
                              rejectionReason: item.rejectionReason ?? "",
                            })
                          }
                        >
                          Modifier
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => deleteHardFilterMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  >
                    <span className="text-xs font-mono text-muted-foreground">{item.ruleOperator}</span>
                  </ListItem>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VersionContext({
  model,
  version,
  versions,
  onVersionChange,
}: {
  model: MatchingModelRecord | null;
  version: MatchingModelVersionRecord | null;
  versions: MatchingModelVersionRecord[];
  onVersionChange: (id: string) => void;
}) {
  if (!model) {
    return (
      <div className="mt-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
        Aucun modèle sélectionné — configurez d'abord un modèle dans la section 2.
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-muted px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Modèle :</span>
        <span className="font-semibold text-foreground">{model.code}</span>
        <span className="text-muted-foreground">—</span>
        <span className="text-foreground">{model.label}</span>
      </div>
      {versions.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Version :</span>
          <Select value={version?.id ?? ""} onValueChange={onVersionChange}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  v{v.versionNumber} — {v.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5"
      />
    </div>
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
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3 text-sm text-foreground">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function ListItem({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
      <div className="mt-3">{actions}</div>
    </div>
  );
}
