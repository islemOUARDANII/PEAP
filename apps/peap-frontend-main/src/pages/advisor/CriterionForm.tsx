import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
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

const DATA_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "CODE", "CODE_LIST", "GEO", "JSON"];

const emptyForm = { code: "", label: "", description: "", dataType: "TEXT", active: true };

export default function CriterionForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const criteriaQuery = useQuery({
    queryKey: ["matching", "criteria"],
    queryFn: () => gatewayApi.matchingConfig.listCriteria(),
    enabled: isEdit,
    staleTime: 30_000,
  });

  const criterion = isEdit ? (criteriaQuery.data ?? []).find((c) => c.id === id) : null;

  useEffect(() => {
    if (criterion) {
      setForm({
        code: criterion.code,
        label: criterion.label,
        description: criterion.description ?? "",
        dataType: criterion.dataType,
        active: criterion.active,
      });
    }
  }, [criterion]);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit && id
        ? gatewayApi.matchingConfig.updateCriterion(id, {
            code: form.code,
            label: form.label,
            description: form.description || null,
            data_type: form.dataType,
            active: form.active,
          })
        : gatewayApi.matchingConfig.createCriterion({
            code: form.code,
            label: form.label,
            description: form.description || null,
            data_type: form.dataType,
            active: form.active,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "criteria"] });
      toast.success(isEdit ? "Critère modifié." : "Critère créé.");
      navigate("/advisor/matching-config");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le critère.");
    },
  });

  if (isEdit && criteriaQuery.isLoading) {
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
        title={isEdit && criterion ? `Modifier — ${criterion.code}` : "Nouveau critère"}
        description="Définissez une dimension de scoring pour les modèles de matching."
        actions={
          <Button variant="outline" onClick={() => navigate("/advisor/matching-config")}>
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Button>
        }
      />

      <div className="panel p-6 max-w-lg space-y-4">
        <div>
          <Label className="text-xs">Code</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="mt-1.5"
            placeholder="Ex : EXPERIENCE_YEARS"
          />
        </div>
        <div>
          <Label className="text-xs">Libellé</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="mt-1.5"
            placeholder="Ex : Années d'expérience"
          />
        </div>
        <div>
          <Label className="text-xs">Type de donnée</Label>
          <Select value={form.dataType} onValueChange={(v) => setForm((f) => ({ ...f, dataType: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3 text-sm">
          <span>Actif</span>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
          />
        </label>

        <div className="flex gap-3 pt-2">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.code || !form.label}>
            <Save className="h-4 w-4" />
            {mutation.isPending
              ? "Enregistrement..."
              : isEdit
                ? "Enregistrer les modifications"
                : "Créer le critère"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/advisor/matching-config")}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
