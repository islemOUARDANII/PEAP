import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { gatewayApi } from "@/services/api/gateway";

export default function Segments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ["segments"],
    queryFn: () => gatewayApi.segments.list(),
    staleTime: 30_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => gatewayApi.segments.deactivate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment désactivé.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de désactiver le segment.");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segments cibles"
        description="Gérez les groupes de ciblage et leurs règles de qualification."
        actions={
          <Button onClick={() => navigate("/advisor/segments/new")}>
            <Plus className="h-4 w-4" />
            Ajouter un segment
          </Button>
        }
      />

      {isLoading ? (
        <div className="panel p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      ) : segments.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Aucun segment défini. Cliquez sur "Ajouter un segment" pour commencer.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted sticky top-0 z-10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Macro-segment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Priorité</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {segments.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-surface-muted/50 transition-colors"
                    onClick={() => navigate(`/advisor/segments/${s.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{s.code}</td>
                    <td className="px-4 py-3 text-foreground">{s.label}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.macroSegment ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.priority}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={s.active ? "Actif" : "Inactif"}
                        tone={s.active ? "success" : "warning"}
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
                          onClick={() => navigate(`/advisor/segments/${s.id}`)}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Gérer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deactivateMutation.mutate(s.id)}
                          disabled={deactivateMutation.isPending}
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
