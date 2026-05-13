import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
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
import { gatewayApi } from "@/services/api/gateway";

const TARGET_TYPES = ["JOB_SEEKER", "EMPLOYER", "JOB_OFFER"];
const OPERATORS = [
  "EQ", "NEQ", "IN", "NOT_IN", "GT", "GTE", "LT", "LTE",
  "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS",
];
const LOGICS = ["AND", "OR"];

const emptySegmentForm = { code: "", label: "", macroSegment: "", priority: "100", active: true };
const emptyRuleForm = { id: "", targetType: "JOB_SEEKER", attributePath: "", operator: "EQ", value: "", logic: "AND" };

export default function SegmentDetail() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const isNew = segmentId === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [segmentForm, setSegmentForm] = useState(emptySegmentForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);

  const segmentsQuery = useQuery({
    queryKey: ["segments"],
    queryFn: () => gatewayApi.segments.list(),
    enabled: !isNew,
    staleTime: 30_000,
  });

  const rulesQuery = useQuery({
    queryKey: ["segments", segmentId, "rules"],
    queryFn: () => gatewayApi.segments.listRules(segmentId!),
    enabled: !isNew && Boolean(segmentId),
    staleTime: 30_000,
  });

  const segmentData = !isNew ? (segmentsQuery.data ?? []).find((s) => s.id === segmentId) : null;

  useEffect(() => {
    if (segmentData) {
      setSegmentForm({
        code: segmentData.code,
        label: segmentData.label,
        macroSegment: segmentData.macroSegment ?? "",
        priority: String(segmentData.priority),
        active: segmentData.active,
      });
    }
  }, [segmentData]);

  const segmentMutation = useMutation({
    mutationFn: () =>
      isNew
        ? gatewayApi.segments.create({
            code: segmentForm.code,
            label: segmentForm.label,
            macro_segment: segmentForm.macroSegment || null,
            priority: Number(segmentForm.priority),
            active: segmentForm.active,
          })
        : gatewayApi.segments.update(segmentId!, {
            code: segmentForm.code,
            label: segmentForm.label,
            macro_segment: segmentForm.macroSegment || null,
            priority: Number(segmentForm.priority),
            active: segmentForm.active,
          }),
    onSuccess: async (segment) => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success(isNew ? "Segment créé." : "Segment modifié.");
      if (isNew) navigate(`/advisor/segments/${segment.id}`, { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le segment.");
    },
  });

  const ruleMutation = useMutation({
    mutationFn: () =>
      ruleForm.id
        ? gatewayApi.segments.updateRule(segmentId!, ruleForm.id, {
            target_type: ruleForm.targetType,
            attribute_path: ruleForm.attributePath,
            operator: ruleForm.operator,
            value: ruleForm.value,
            logic: ruleForm.logic,
          })
        : gatewayApi.segments.createRule(segmentId!, {
            target_type: ruleForm.targetType,
            attribute_path: ruleForm.attributePath,
            operator: ruleForm.operator,
            value: ruleForm.value,
            logic: ruleForm.logic,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["segments", segmentId, "rules"] });
      setRuleForm(emptyRuleForm);
      toast.success("Règle enregistrée.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la règle.");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => gatewayApi.segments.deleteRule(segmentId!, ruleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["segments", segmentId, "rules"] });
      toast.success("Règle supprimée.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer la règle.");
    },
  });

  if (!isNew && segmentsQuery.isLoading) {
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
        title={isNew ? "Nouveau segment" : segmentData ? `${segmentData.code} — ${segmentData.label}` : "Segment"}
        description={isNew ? "Créez un nouveau groupe cible." : "Modifiez ce segment et gérez ses règles de qualification."}
        actions={
          <Button variant="outline" onClick={() => navigate("/advisor/segments")}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux segments
          </Button>
        }
      />

      {/* ── Informations du segment ── */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">Informations du segment</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Code</Label>
            <Input
              value={segmentForm.code}
              onChange={(e) => setSegmentForm((f) => ({ ...f, code: e.target.value }))}
              className="mt-1.5"
              placeholder="Ex : JEUNE_DIPLOME"
            />
          </div>
          <div>
            <Label className="text-xs">Libellé</Label>
            <Input
              value={segmentForm.label}
              onChange={(e) => setSegmentForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1.5"
              placeholder="Ex : Jeune diplômé"
            />
          </div>
          <div>
            <Label className="text-xs">Macro-segment (optionnel)</Label>
            <Input
              value={segmentForm.macroSegment}
              onChange={(e) => setSegmentForm((f) => ({ ...f, macroSegment: e.target.value }))}
              className="mt-1.5"
              placeholder="Ex : JEUNES"
            />
          </div>
          <div>
            <Label className="text-xs">Priorité</Label>
            <Input
              type="number"
              value={segmentForm.priority}
              onChange={(e) => setSegmentForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-muted p-3 text-sm">
              <span>Actif</span>
              <Switch
                checked={segmentForm.active}
                onCheckedChange={(v) => setSegmentForm((f) => ({ ...f, active: v }))}
              />
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() => segmentMutation.mutate()}
            disabled={segmentMutation.isPending || !segmentForm.code || !segmentForm.label}
          >
            <Save className="h-4 w-4" />
            {segmentMutation.isPending
              ? "Enregistrement..."
              : isNew
                ? "Créer le segment"
                : "Enregistrer les modifications"}
          </Button>
        </div>
      </section>

      {/* ── Règles — only after segment exists ── */}
      {!isNew && (
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Règles de qualification</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Un candidat/employeur/offre appartient à ce segment s'il satisfait toutes les règles.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* LEFT — form */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Type de cible</Label>
                <Select
                  value={ruleForm.targetType}
                  onValueChange={(v) => setRuleForm((f) => ({ ...f, targetType: v }))}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Chemin de l'attribut</Label>
                <Input
                  value={ruleForm.attributePath}
                  onChange={(e) => setRuleForm((f) => ({ ...f, attributePath: e.target.value }))}
                  className="mt-1.5"
                  placeholder="Ex : profile.occupation_code"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Opérateur</Label>
                  <Select
                    value={ruleForm.operator}
                    onValueChange={(v) => setRuleForm((f) => ({ ...f, operator: v }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Logique</Label>
                  <Select
                    value={ruleForm.logic}
                    onValueChange={(v) => setRuleForm((f) => ({ ...f, logic: v }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOGICS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Valeur</Label>
                <Input
                  value={ruleForm.value}
                  onChange={(e) => setRuleForm((f) => ({ ...f, value: e.target.value }))}
                  className="mt-1.5"
                  placeholder="Ex : ACTIVE ou [val1, val2]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => ruleMutation.mutate()}
                  disabled={ruleMutation.isPending || !ruleForm.attributePath}
                >
                  <Save className="h-4 w-4" />
                  {ruleMutation.isPending ? "..." : ruleForm.id ? "Modifier" : "Ajouter la règle"}
                </Button>
                {ruleForm.id && (
                  <Button variant="outline" onClick={() => setRuleForm(emptyRuleForm)}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>

            {/* RIGHT — rules list */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Règles actives ({(rulesQuery.data ?? []).length})
              </p>
              {rulesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement...
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                  {(rulesQuery.data ?? []).length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Aucune règle définie.</p>
                  ) : (
                    (rulesQuery.data ?? []).map((rule) => (
                      <div
                        key={rule.id}
                        className={`rounded-md border bg-background p-3 transition-colors ${
                          rule.id === ruleForm.id ? "border-accent/60 ring-1 ring-accent/30" : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground font-mono">
                              {rule.attributePath}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-mono">{rule.operator}</span> "{rule.value}"
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Cible : {rule.targetType} · Logique : {rule.logic}
                            </p>
                          </div>
                          <StatusPill label={rule.logic} tone="neutral" />
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              setRuleForm({
                                id: rule.id,
                                targetType: rule.targetType,
                                attributePath: rule.attributePath,
                                operator: rule.operator,
                                value: rule.value,
                                logic: rule.logic,
                              })
                            }
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
