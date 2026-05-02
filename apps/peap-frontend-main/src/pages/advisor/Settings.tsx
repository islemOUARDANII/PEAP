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
import { gatewayApi } from "@/services/api/gateway";

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

  const selectedModel = (modelsQuery.data ?? []).find((item) => item.id === selectedModelId) ?? null;
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
          Loading matching configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching Configuration"
        description="Manage criteria, models, versions, version criteria, and hard filters through the real matching-config endpoints."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Criteria</h2>
          <div className="mt-4 space-y-3">
            <TextField label="Code" value={criterionForm.code} onChange={(value) => setCriterionForm((current) => ({ ...current, code: value }))} />
            <TextField label="Label" value={criterionForm.label} onChange={(value) => setCriterionForm((current) => ({ ...current, label: value }))} />
            <SelectField
              label="Data type"
              value={criterionForm.dataType}
              onValueChange={(value) => setCriterionForm((current) => ({ ...current, dataType: value }))}
              options={criterionDataTypes.map((item) => ({ value: item, label: item }))}
            />
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={criterionForm.description}
                onChange={(event) => setCriterionForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="mt-1.5"
              />
            </div>
            <SwitchField
              label="Active"
              checked={criterionForm.active}
              onCheckedChange={(checked) => setCriterionForm((current) => ({ ...current, active: checked }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => criterionMutation.mutate()} disabled={criterionMutation.isPending}>
                <Save className="h-4 w-4" />
                {criterionMutation.isPending ? "Saving..." : criterionForm.id ? "Update criterion" : "Create criterion"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCriterionForm(emptyCriterionForm)}>
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {(criteriaQuery.data ?? []).map((criterion) => (
              <ListItem
                key={criterion.id}
                title={`${criterion.code} - ${criterion.label}`}
                subtitle={criterion.dataType}
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
                      Edit
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
                <StatusPill label={criterion.active ? "Active" : "Inactive"} tone={criterion.active ? "success" : "warning"} />
              </ListItem>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Models & versions</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <TextField label="Code" value={modelForm.code} onChange={(value) => setModelForm((current) => ({ ...current, code: value }))} />
              <TextField label="Label" value={modelForm.label} onChange={(value) => setModelForm((current) => ({ ...current, label: value }))} />
              <SelectField
                label="Direction"
                value={modelForm.direction}
                onValueChange={(value) => setModelForm((current) => ({ ...current, direction: value }))}
                options={modelDirections.map((item) => ({ value: item, label: item }))}
              />
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={modelForm.description}
                  onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <SwitchField
                label="Active"
                checked={modelForm.active}
                onCheckedChange={(checked) => setModelForm((current) => ({ ...current, active: checked }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => modelMutation.mutate()} disabled={modelMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {modelMutation.isPending ? "Saving..." : modelForm.id ? "Update model" : "Create model"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setModelForm(emptyModelForm)}>
                  Reset
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <SelectField
                label="Selected model"
                value={selectedModelId}
                onValueChange={setSelectedModelId}
                options={(modelsQuery.data ?? []).map((model) => ({
                  value: model.id,
                  label: `${model.code} - ${model.label}`,
                }))}
                placeholder="Select a model"
              />
              <TextField
                label="Version number"
                value={versionForm.versionNumber}
                onChange={(value) => setVersionForm({ versionNumber: value })}
                type="number"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => versionMutation.mutate()}
                  disabled={versionMutation.isPending || !selectedModelId}
                >
                  <Save className="h-4 w-4" />
                  {versionMutation.isPending ? "Saving..." : selectedVersionId ? "Update version" : "Create version"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => publishVersionMutation.mutate()}
                  disabled={publishVersionMutation.isPending || !selectedVersionId}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => archiveVersionMutation.mutate()}
                  disabled={archiveVersionMutation.isPending || !selectedVersionId}
                >
                  Archive
                </Button>
              </div>
              {selectedVersion ? (
                <div className="rounded-md bg-surface-muted p-3 text-sm">
                  <p className="font-medium text-foreground">
                    v{selectedVersion.versionNumber}
                  </p>
                  <div className="mt-2">
                    <StatusPill label={selectedVersion.status} tone={statusToTone(selectedVersion.status)} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {(modelsQuery.data ?? []).map((model) => (
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
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteModelMutation.mutate(model.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <StatusPill label={model.active ? "Active" : "Inactive"} tone={model.active ? "success" : "warning"} />
              </ListItem>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Model criteria</h2>
          <div className="mt-4 space-y-3">
            <SelectField
              label="Criterion"
              value={modelCriterionForm.criterionId}
              onValueChange={(value) => setModelCriterionForm((current) => ({ ...current, criterionId: value }))}
              options={criteriaOptions}
              placeholder="Select a criterion"
              disabled={!selectedVersionId}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <TextField
                label="Weight"
                value={modelCriterionForm.weight}
                onChange={(value) => setModelCriterionForm((current) => ({ ...current, weight: value }))}
                type="number"
              />
              <TextField
                label="Min threshold"
                value={modelCriterionForm.minThreshold}
                onChange={(value) => setModelCriterionForm((current) => ({ ...current, minThreshold: value }))}
                type="number"
              />
              <SelectField
                label="Logic operator"
                value={modelCriterionForm.logicOperator}
                onValueChange={(value) => setModelCriterionForm((current) => ({ ...current, logicOperator: value }))}
                options={logicOperators.map((item) => ({ value: item, label: item }))}
              />
            </div>
            <SwitchField
              label="Is must"
              checked={modelCriterionForm.isMust}
              onCheckedChange={(checked) => setModelCriterionForm((current) => ({ ...current, isMust: checked }))}
            />
            <Button
              type="button"
              onClick={() => modelCriterionMutation.mutate()}
              disabled={modelCriterionMutation.isPending || !selectedVersionId}
            >
              <Save className="h-4 w-4" />
              {modelCriterionMutation.isPending ? "Saving..." : modelCriterionForm.id ? "Update model criterion" : "Add model criterion"}
            </Button>
          </div>

          <div className="mt-6 space-y-2">
            {(modelCriteriaQuery.data ?? []).map((item) => (
              <ListItem
                key={item.id}
                title={`${item.criterionCode} - ${item.criterionLabel}`}
                subtitle={`weight ${item.weight} | ${item.logicOperator}`}
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
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteModelCriterionMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <StatusPill label={item.isMust ? "Must" : "Optional"} tone={item.isMust ? "accent" : "neutral"} />
              </ListItem>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Hard filters</h2>
          <div className="mt-4 space-y-3">
            <SelectField
              label="Criterion"
              value={hardFilterForm.criterionId}
              onValueChange={(value) => setHardFilterForm((current) => ({ ...current, criterionId: value }))}
              options={criteriaOptions}
              placeholder="Select a criterion"
              disabled={!selectedVersionId}
            />
            <SelectField
              label="Rule operator"
              value={hardFilterForm.ruleOperator}
              onValueChange={(value) => setHardFilterForm((current) => ({ ...current, ruleOperator: value }))}
              options={ruleOperators.map((item) => ({ value: item, label: item }))}
            />
            <TextField
              label="Rule value"
              value={hardFilterForm.ruleValue}
              onChange={(value) => setHardFilterForm((current) => ({ ...current, ruleValue: value }))}
            />
            <div>
              <Label className="text-xs">Rejection reason</Label>
              <Textarea
                value={hardFilterForm.rejectionReason}
                onChange={(event) => setHardFilterForm((current) => ({ ...current, rejectionReason: event.target.value }))}
                rows={3}
                className="mt-1.5"
              />
            </div>
            <Button
              type="button"
              onClick={() => hardFilterMutation.mutate()}
              disabled={hardFilterMutation.isPending || !selectedVersionId}
            >
              <Save className="h-4 w-4" />
              {hardFilterMutation.isPending ? "Saving..." : hardFilterForm.id ? "Update hard filter" : "Add hard filter"}
            </Button>
          </div>

          <div className="mt-6 space-y-2">
            {(hardFiltersQuery.data ?? []).map((item) => (
              <ListItem
                key={item.id}
                title={`${item.criterionCode} - ${item.ruleOperator}`}
                subtitle={item.ruleValue}
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
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteHardFilterMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <span className="text-xs text-muted-foreground">{item.rejectionReason || "No rejection reason"}</span>
              </ListItem>
            ))}
          </div>
        </section>
      </div>
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
