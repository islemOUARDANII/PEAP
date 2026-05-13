import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { gatewayApi } from "@/services/api/gateway";

export default function CriteriaList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: criteria = [], isLoading } = useQuery({
    queryKey: ["matching", "criteria"],
    queryFn: () => gatewayApi.matchingConfig.listCriteria(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gatewayApi.matchingConfig.deleteCriterion(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["matching", "criteria"] });
      toast.success("Critère supprimé.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer le critère.");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Critères de matching"
        description="Définissez les dimensions de scoring utilisées dans les modèles."
        actions={
          <Button onClick={() => navigate("/advisor/matching-config/new")}>
            <Plus className="h-4 w-4" />
            Ajouter un critère
          </Button>
        }
      />

      {isLoading ? (
        <div className="panel p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      ) : criteria.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Aucun critère défini. Cliquez sur "Ajouter un critère" pour commencer.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted sticky top-0 z-10">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Libellé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{c.code}</td>
                  <td className="px-4 py-3 text-foreground">{c.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.dataType}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      label={c.active ? "Actif" : "Inactif"}
                      tone={c.active ? "success" : "warning"}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/advisor/matching-config/${c.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(c.id)}
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
