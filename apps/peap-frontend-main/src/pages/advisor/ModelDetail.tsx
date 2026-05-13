import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
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
import { gatewayApi } from "@/services/api/gateway";

const MODEL_DIRECTIONS = ["OFFER_TO_CANDIDATE", "CANDIDATE_TO_OFFER", "CANDIDATE_TO_OCCUPATION"];
const LOGIC_OPERATORS = ["AND", "OR"];
const RULE_OPERATORS = [
  "EQ", "NEQ", "IN", "NOT_IN", "GT", "GTE", "LT", "LTE",
  "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS", "DISTANCE_LTE",
];

const emptyModelForm = {
  code: "",
  label: "",
  direction: "OFFER_TO_CANDIDATE",
  description: "",
  active: true,
};
const emptyMcForm = {
  id: "",
  criterionId: "",
  weight: "1",
  isMust: false,
  minThreshold: "",
  logicOperator: "AND",
};
const emptyHfForm = {
  id: "",
  criterionId: "",
  ruleOperator: "EQ",
  ruleValue: "",
  rejectionReason: "",
};

export default function ModelDetail() {
  const { modelId } = useParams<{ modelId: string }>();
  const isNew = modelId === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modelForm, setModelForm] = useState(emptyModelForm);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [mcForm, setMcForm] = useState(emptyMcForm);
  const [hfForm, setHfForm] = useState(emptyHfForm);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState("");

  const modelsQuery = useQuery({
    queryKey: ["matching", "models"],
    queryFn: () => gatewayApi.matchingConfig.listModels(),
    enabled: !isNew,
    staleTime: 30_000,
  });

  const criteriaQuery = useQuery({
    queryKey: ["matching", "criteria"],
    queryFn: () => gatewayApi.matchingConfig.listCriteria(),
    staleTime: 30_000,
  });

  const versionsQuery = useQuery({
    queryKey: ["matching", "models", modelId, "versions"],
    queryFn: () => gatewayApi.matchingConfig.listVersions(modelId!),
    enabled: !isNew && Boolean(modelId),
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

  const modelData = !isNew ? (modelsQuery.data ?? []).find((m) => m.id === modelId) : null;
  const selectedVersion = (versionsQuery.data ?? []).find((v) => v.id === selectedVersionId) ?? null;

  const criteriaOptions = useMemo(
    () => (criteriaQuery.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.label}` })),
    [criteriaQuery.data],
  );

  useEffect(() => {
    if (modelData) {
      setModelForm({
        code: modelData.code,
        label: modelData.label,
        direction: modelData.direction,
        description: modelData.description ?? "",
        active: modelData.active,
      });
    }
  }, [modelData]);

  useEffect(() => {
    const first = versionsQuery.data?.[0];
    if (!selectedVersionId && first) setSelectedVersionId(first.id);
  }, [versionsQuery.data, selectedVersionId]);

  // ── Mutations ──

  const modelMutation = useMutation({
    mutationFn: () =>
      isNew
        ? gatewayApi.matchingConfig.createModel({
            code: modelForm.code,
            label: modelForm.label,
            direction: modelForm.direction,
            description: modelForm.description || null,
            active: modelForm.active,
          })
        : gatewayApi.matchingConfig.updateModel(modelId!, {
            code: modelForm.code,
            label: modelForm.label,
            direction: modelForm.direction,
            description: modelForm.description || null,
            active: modelForm.active,
          }),
    onSuccess: async (model) => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models"] });
      toast.success(isNew ? "Modèle créé." : "Modèle modifié.");
      if (isNew) navigate(`/advisor/functional-admin/${model.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le modèle.");
    },
  });

  const versionMutation = useMutation({
    mutationFn: () =>
      gatewayApi.matchingConfig.createVersion(modelId!, {
        version_number: newVersionNumber ? Number(newVersionNumber) : undefined,
      }),
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", modelId, "versions"] });
      setSelectedVersionId(version.id);
      setNewVersionNumber("");
      setShowAddVersion(false);
      toast.success("Version créée.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la version.");
    },
  });

  const publishVersionMutation = useMutation({
    mutationFn: () => gatewayApi.matchingConfig.publishVersion(modelId!, selectedVersionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", modelId, "versions"] });
      toast.success("Version publiée.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de publier.");
    },
  });

  const archiveVersionMutation = useMutation({
    mutationFn: () => gatewayApi.matchingConfig.archiveVersion(modelId!, selectedVersionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models", modelId, "versions"] });
      toast.success("Version archivée.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'archiver.");
    },
  });

  const mcMutation = useMutation({
    mutationFn: () =>
      mcForm.id
        ? gatewayApi.matchingConfig.updateModelCriterion(selectedVersionId, mcForm.id, {
            criterion_id: mcForm.criterionId,
            weight: Number(mcForm.weight),
            is_must: mcForm.isMust,
            min_threshold: mcForm.minThreshold ? Number(mcForm.minThreshold) : null,
            logic_operator: mcForm.logicOperator,
          })
        : gatewayApi.matchingConfig.createModelCriterion(selectedVersionId, {
            criterion_id: mcForm.criterionId,
            weight: Number(mcForm.weight),
            is_must: mcForm.isMust,
            min_threshold: mcForm.minThreshold ? Number(mcForm.minThreshold) : null,
            logic_operator: mcForm.logicOperator,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "criteria"] });
      setMcForm(emptyMcForm);
      toast.success("Critère enregistré.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer.");
    },
  });

  const deleteMcMutation = useMutation({
    mutationFn: (id: string) => gatewayApi.matchingConfig.deleteModelCriterion(selectedVersionId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "criteria"] });
      toast.success("Critère supprimé.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer.");
    },
  });

  const hfMutation = useMutation({
    mutationFn: () =>
      hfForm.id
        ? gatewayApi.matchingConfig.updateHardFilter(selectedVersionId, hfForm.id, {
            criterion_id: hfForm.criterionId,
            rule_operator: hfForm.ruleOperator,
            rule_value: hfForm.ruleValue,
            rejection_reason: hfForm.rejectionReason || null,
          })
        : gatewayApi.matchingConfig.createHardFilter(selectedVersionId, {
            criterion_id: hfForm.criterionId,
            rule_operator: hfForm.ruleOperator,
            rule_value: hfForm.ruleValue,
            rejection_reason: hfForm.rejectionReason || null,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "hard-filters"] });
      setHfForm(emptyHfForm);
      toast.success("Filtre enregistré.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer.");
    },
  });

  const deleteHfMutation = useMutation({
    mutationFn: (id: string) => gatewayApi.matchingConfig.deleteHardFilter(selectedVersionId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "versions", selectedVersionId, "hard-filters"] });
      toast.success("Filtre supprimé.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer.");
    },
  });

  if (!isNew && modelsQuery.isLoading) {
    return (
      <div className="panel p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "Nouveau modèle" : modelData ? `${modelData.code} — ${modelData.label}` : "Modèle"}
        description={
          isNew
            ? "Créez un nouveau modèle de scoring."
            : "Gérez ce modèle, ses versions, ses critères pondérés et ses filtres éliminatoires."
        }
        actions={
          <Button variant="outline" onClick={() => navigate("/advisor/functional-admin")}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux modèles
          </Button>
        }
      />

      {/* ── Informations du modèle ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">Informations du modèle</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Code</Label>
            <Input
              value={modelForm.code}
              onChange={(e) => setModelForm((f) => ({ ...f, code: e.target.value }))}
              className="mt-1.5"
              placeholder="Ex : STANDARD_OFFER_TO_CANDIDATE"
            />
          </div>
          <div>
            <Label className="text-xs">Libellé</Label>
            <Input
              value={modelForm.label}
              onChange={(e) => setModelForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1.5"
              placeholder="Ex : Offre vers candidats standard"
            />
          </div>
          <div>
            <Label className="text-xs">Direction</Label>
            <Select
              value={modelForm.direction}
              onValueChange={(v) => setModelForm((f) => ({ ...f, direction: v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={modelForm.description}
              onChange={(e) => setModelForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-muted p-3 text-sm">
              <span>Actif</span>
              <Switch
                checked={modelForm.active}
                onCheckedChange={(v) => setModelForm((f) => ({ ...f, active: v }))}
              />
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() => modelMutation.mutate()}
            disabled={modelMutation.isPending || !modelForm.code || !modelForm.label}
          >
            <Save className="h-4 w-4" />
            {modelMutation.isPending
              ? "Enregistrement..."
              : isNew
                ? "Créer le modèle"
                : "Enregistrer les modifications"}
          </Button>
        </div>
      </section>

      {/* ── Versions + configuration — only after model exists ── */}
      {!isNew && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">

          {/* LEFT — versions list */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Versions</h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddVersion((v) => !v)}>
                <Plus className="h-3.5 w-3.5" />
                Créer
              </Button>
            </div>

            {showAddVersion && (
              <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                <div>
                  <Label className="text-xs">Numéro (optionnel)</Label>
                  <Input
                    type="number"
                    value={newVersionNumber}
                    onChange={(e) => setNewVersionNumber(e.target.value)}
                    className="mt-1"
                    placeholder="Auto"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => versionMutation.mutate()}
                  disabled={versionMutation.isPending}
                >
                  {versionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Créer la version
                </Button>
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              {(versionsQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucune version.</p>
              ) : (
                (versionsQuery.data ?? []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                      v.id === selectedVersionId
                        ? "border border-primary/30 bg-primary/10"
                        : "border border-transparent bg-surface-muted hover:bg-surface-muted/70"
                    }`}
                    onClick={() => setSelectedVersionId(v.id)}
                  >
                    <p className="text-sm font-semibold text-foreground">v{v.versionNumber}</p>
                    <div className="mt-1">
                      <StatusPill label={v.status} tone={statusToTone(v.status)} />
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedVersionId && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishVersionMutation.mutate()}
                  disabled={publishVersionMutation.isPending || selectedVersion?.status !== "DRAFT"}
                >
                  <Check className="h-3.5 w-3.5" />
                  Publier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveVersionMutation.mutate()}
                  disabled={archiveVersionMutation.isPending || selectedVersion?.status === "ARCHIVED"}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archiver
                </Button>
              </div>
            )}
          </section>

          {/* RIGHT — version detail */}
          <div className="space-y-6">
            {!selectedVersionId ? (
              <div className="panel p-8 text-center text-sm text-muted-foreground">
                Sélectionnez une version à gauche pour configurer ses critères et filtres.
              </div>
            ) : (
              <>
                {/* Critères & poids */}
                <section className="panel p-5">
                  <h2 className="text-sm font-semibold text-foreground">
                    Critères & poids — v{selectedVersion?.versionNumber}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Définissez le poids de chaque critère pour cette version du modèle.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* Form */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Critère</Label>
                        <Select
                          value={mcForm.criterionId}
                          onValueChange={(v) => setMcForm((f) => ({ ...f, criterionId: v }))}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choisir un critère" />
                          </SelectTrigger>
                          <SelectContent>
                            {criteriaOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Poids</Label>
                          <Input
                            type="number"
                            value={mcForm.weight}
                            onChange={(e) => setMcForm((f) => ({ ...f, weight: e.target.value }))}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Seuil minimum</Label>
                          <Input
                            type="number"
                            value={mcForm.minThreshold}
                            onChange={(e) => setMcForm((f) => ({ ...f, minThreshold: e.target.value }))}
                            className="mt-1.5"
                            placeholder="Optionnel"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Opérateur logique</Label>
                        <Select
                          value={mcForm.logicOperator}
                          onValueChange={(v) => setMcForm((f) => ({ ...f, logicOperator: v }))}
                        >
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LOGIC_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op}>{op}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3 text-sm">
                        <span>Critère obligatoire (must)</span>
                        <Switch
                          checked={mcForm.isMust}
                          onCheckedChange={(v) => setMcForm((f) => ({ ...f, isMust: v }))}
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => mcMutation.mutate()}
                          disabled={mcMutation.isPending || !mcForm.criterionId}
                        >
                          <Save className="h-4 w-4" />
                          {mcMutation.isPending ? "..." : mcForm.id ? "Modifier" : "Ajouter"}
                        </Button>
                        {mcForm.id && (
                          <Button variant="outline" onClick={() => setMcForm(emptyMcForm)}>
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* List */}
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Critères assignés ({(modelCriteriaQuery.data ?? []).length})
                      </p>
                      <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                        {(modelCriteriaQuery.data ?? []).length === 0 ? (
                          <p className="text-xs italic text-muted-foreground">Aucun critère assigné.</p>
                        ) : (
                          (modelCriteriaQuery.data ?? []).map((item) => (
                            <div key={item.id} className="rounded-md border border-border bg-background p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{item.criterionCode}</p>
                                  <p className="text-xs text-muted-foreground">{item.criterionLabel}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Poids : {item.weight} · {item.logicOperator}
                                  </p>
                                </div>
                                <StatusPill
                                  label={item.isMust ? "Must" : "Opt."}
                                  tone={item.isMust ? "accent" : "neutral"}
                                />
                              </div>
                              <div className="mt-2 flex gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    setMcForm({
                                      id: item.id,
                                      criterionId: item.criterionId,
                                      weight: String(item.weight),
                                      isMust: item.isMust,
                                      minThreshold:
                                        item.minThreshold == null ? "" : String(item.minThreshold),
                                      logicOperator: item.logicOperator,
                                    })
                                  }
                                >
                                  Modifier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => deleteMcMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Filtres éliminatoires */}
                <section className="panel p-5">
                  <h2 className="text-sm font-semibold text-foreground">
                    Filtres éliminatoires — v{selectedVersion?.versionNumber}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si un candidat échoue un filtre, son score devient 0.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* Form */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Critère</Label>
                        <Select
                          value={hfForm.criterionId}
                          onValueChange={(v) => setHfForm((f) => ({ ...f, criterionId: v }))}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choisir un critère" />
                          </SelectTrigger>
                          <SelectContent>
                            {criteriaOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Opérateur</Label>
                        <Select
                          value={hfForm.ruleOperator}
                          onValueChange={(v) => setHfForm((f) => ({ ...f, ruleOperator: v }))}
                        >
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RULE_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op}>{op}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Valeur</Label>
                        <Input
                          value={hfForm.ruleValue}
                          onChange={(e) => setHfForm((f) => ({ ...f, ruleValue: e.target.value }))}
                          className="mt-1.5"
                          placeholder="Ex : ACTIVE"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Motif de rejet</Label>
                        <Textarea
                          value={hfForm.rejectionReason}
                          onChange={(e) => setHfForm((f) => ({ ...f, rejectionReason: e.target.value }))}
                          rows={2}
                          className="mt-1.5"
                          placeholder="Optionnel — affiché au candidat éliminé"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => hfMutation.mutate()}
                          disabled={hfMutation.isPending || !hfForm.criterionId}
                        >
                          <Save className="h-4 w-4" />
                          {hfMutation.isPending ? "..." : hfForm.id ? "Modifier" : "Ajouter"}
                        </Button>
                        {hfForm.id && (
                          <Button variant="outline" onClick={() => setHfForm(emptyHfForm)}>
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* List */}
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Filtres actifs ({(hardFiltersQuery.data ?? []).length})
                      </p>
                      <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                        {(hardFiltersQuery.data ?? []).length === 0 ? (
                          <p className="text-xs italic text-muted-foreground">Aucun filtre défini.</p>
                        ) : (
                          (hardFiltersQuery.data ?? []).map((item) => (
                            <div key={item.id} className="rounded-md border border-border bg-background p-3">
                              <p className="text-xs font-semibold text-foreground">
                                {item.criterionCode}{" "}
                                <span className="font-mono text-muted-foreground">{item.ruleOperator}</span>{" "}
                                {item.ruleValue}
                              </p>
                              {item.rejectionReason && (
                                <p className="mt-1 text-xs text-muted-foreground">{item.rejectionReason}</p>
                              )}
                              <div className="mt-2 flex gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    setHfForm({
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => deleteHfMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
