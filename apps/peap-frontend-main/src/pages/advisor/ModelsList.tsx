import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { gatewayApi } from "@/services/api/gateway";

export default function ModelsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["matching", "models"],
    queryFn: () => gatewayApi.matchingConfig.listModels(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gatewayApi.matchingConfig.deleteModel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "models"] });
      toast.success("Modèle supprimé.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer le modèle.");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modèles de matching"
        description="Gérez les modèles de scoring, leurs versions, critères et filtres éliminatoires."
        actions={
          <Button onClick={() => navigate("/advisor/functional-admin/new")}>
            <Plus className="h-4 w-4" />
            Ajouter un modèle
          </Button>
        }
      />

      {isLoading ? (
        <div className="panel p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      ) : models.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Aucun modèle défini. Cliquez sur "Ajouter un modèle" pour commencer.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted sticky top-0 z-10">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Libellé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((m) => (
                <tr
                  key={m.id}
                  className="cursor-pointer hover:bg-surface-muted/50 transition-colors"
                  onClick={() => navigate(`/advisor/functional-admin/${m.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{m.code}</td>
                  <td className="px-4 py-3 text-foreground">{m.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.direction}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      label={m.active ? "Actif" : "Inactif"}
                      tone={m.active ? "success" : "warning"}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/advisor/functional-admin/${m.id}`)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                        Ouvrir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(m.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
