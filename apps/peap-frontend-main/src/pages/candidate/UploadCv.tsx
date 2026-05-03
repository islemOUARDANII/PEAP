import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Loader2, RefreshCw, SearchCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { ApiServiceError } from "@/services/api/client";
import { gatewayApi, type CandidateCvParseResult, type CandidateCvRecord } from "@/services/api/gateway";
import { queryKeys } from "@/services/api/queryKeys";
import { appEnv } from "@/config/env";
import { readStoredSession } from "@/services/auth/sessionStorage";

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
};

const formatBytes = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiServiceError) {
    return `${fallback}: ${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
};

const formatStatusLabel = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "Non renseigné";
  }

  const labels: Record<string, string> = {
    uploaded: "Importé",
    pending: "En attente",
    processing: "Analyse en cours",
    parsed: "Analysé",
    search_ready: "Prêt pour le matching",
    failed: "Échec",
    active: "Actif",
    current: "Actuel",
  };

  return labels[normalized] ?? value ?? "Non renseigné";
};

async function openAuthenticatedFile(path: string): Promise<void> {
  const token = readStoredSession()?.token;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${appEnv.apiBaseUrl.replace(/\/+$/, "")}${path}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`La requête a échoué avec le statut ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export default function UploadCv() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeParseId, setActiveParseId] = useState<string | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [activeOpenCurrent, setActiveOpenCurrent] = useState(false);
  const [latestParseResult, setLatestParseResult] = useState<CandidateCvParseResult | null>(null);

  const bundleQuery = useQuery({
    queryKey: queryKeys.candidate.bundle(),
    queryFn: () => gatewayApi.candidate.getBundle(),
  });

  const records = bundleQuery.data?.cvRecords ?? [];
  const currentCv = bundleQuery.data?.currentCv ?? null;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.bundle() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.profile() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.cvRecords() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.matches() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.jobOffers() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.recommendations() }),
      queryClient.invalidateQueries({ queryKey: ["search", "offers"] }),
    ]);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const record = await gatewayApi.candidate.uploadCv(file);
      await refreshAll();
      toast.success(`CV importé : ${record.originalFilename ?? record.blobName}`);
      setLatestParseResult(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Échec de l'import du CV"));
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleParse = async (record: CandidateCvRecord) => {
    setActiveParseId(record.id);
    try {
      const result = await gatewayApi.candidate.parseCv(record.id);
      setLatestParseResult(result);
      await refreshAll();
      toast.success(`Analyse lancée pour ${record.originalFilename ?? record.blobName}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Échec de l'analyse du CV"));
    } finally {
      setActiveParseId(null);
    }
  };

  const handleDelete = async (record: CandidateCvRecord) => {
    setActiveDeleteId(record.id);
    try {
      await gatewayApi.candidate.deleteCv(record.id);
      if (latestParseResult?.cvRecordId === record.id) {
        setLatestParseResult(null);
      }
      await refreshAll();
      toast.success(`CV supprimé : ${record.originalFilename ?? record.blobName}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de supprimer ce CV"));
    } finally {
      setActiveDeleteId(null);
    }
  };

  const handleOpenCurrent = async () => {
    setActiveOpenCurrent(true);
    try {
      await openAuthenticatedFile(gatewayApi.candidate.getCurrentCvViewUrl());
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'ouvrir le CV actuel"));
    } finally {
      setActiveOpenCurrent(false);
    }
  };

  if (bundleQuery.isLoading) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des CV...
        </div>
      </div>
    );
  }

  if (bundleQuery.isError) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        {bundleQuery.error instanceof Error
          ? bundleQuery.error.message
          : "Impossible de charger les CV."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import et analyse du CV"
        description="Importez un CV, lancez son analyse, puis consultez les données renvoyées par l'API."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
              disabled={bundleQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${bundleQuery.isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {isUploading ? "Import..." : "Importer un CV"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,1fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-border bg-surface-muted px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">CV importés</h2>
            <p className="text-xs text-muted-foreground">
              Les actions d'analyse appellent{" "}
              <code>/candidates/me/cv/&lbrace;cv_record_id&rbrace;/parse</code> avec le vrai identifiant du CV.
            </p>
          </div>

          {records.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Aucun CV n'est encore enregistré. Importez un fichier pour créer le premier enregistrement.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Fichier</th>
                    <th className="px-2 py-3 text-left font-medium">Identifiant du CV</th>
                    <th className="px-2 py-3 text-left font-medium">Statut</th>
                    <th className="px-2 py-3 text-left font-medium">Analyse</th>
                    <th className="px-2 py-3 text-left font-medium">Importé le</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => {
                    const isParsing = activeParseId === record.id;
                    const isDeleting = activeDeleteId === record.id;
                    return (
                      <tr key={record.id} className="hover:bg-surface-muted">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-foreground">
                            {record.originalFilename ?? record.blobName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {record.mimeType} • {formatBytes(record.fileSizeBytes)}
                          </p>
                          {record.isCurrent ? (
                            <div className="mt-2">
                              <StatusPill label="CV actuel" tone="accent" dot={false} />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 align-top text-[11px] font-mono text-muted-foreground">
                          {record.id}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <StatusPill
                            label={formatStatusLabel(record.status)}
                            tone={statusToTone(record.status)}
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <StatusPill
                            label={formatStatusLabel(record.parsingStatus)}
                            tone={statusToTone(record.parsingStatus)}
                          />
                        </td>
                        <td className="px-2 py-3 align-top text-xs text-muted-foreground">
                          {formatDate(record.uploadedAt)}
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleParse(record)}
                              disabled={isParsing || isDeleting}
                            >
                              {isParsing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SearchCheck className="h-4 w-4" />
                              )}
                              {isParsing ? "Analyse..." : "Analyser"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDelete(record)}
                              disabled={isParsing || isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {isDeleting ? "Suppression..." : "Supprimer"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">CV actuel</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              L'aperçu du CV actuel est chargé via l'API Gateway authentifiée.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nom du fichier</p>
                <p className="mt-1 font-medium text-foreground">
                  {currentCv?.originalFilename ?? "Aucun CV actuel"}
                </p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Statut d'analyse actuel</p>
                <p className="mt-1 font-medium text-foreground">
                  {currentCv ? formatStatusLabel(currentCv.parsingStatus) : "Aucun enregistrement"}
                </p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Endpoint d'aperçu</p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">
                  {currentCv ? `${appEnv.apiBaseUrl}/candidates/me/cv/current/view` : "-"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenCurrent()}
                disabled={!currentCv || activeOpenCurrent}
              >
                {activeOpenCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {activeOpenCurrent ? "Ouverture..." : "Ouvrir le CV actuel"}
              </Button>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Dernier résultat d'analyse</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Le payload parsé, le payload mappé, les avertissements et le patch profil sont affichés tels que renvoyés par le backend.
            </p>

            {!latestParseResult ? (
              <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                Lancez l'analyse d'un CV pour consulter la dernière réponse du backend.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-surface-muted p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Identifiant du CV</p>
                    <p className="mt-1 break-all font-mono text-xs text-foreground">
                      {latestParseResult.cvRecordId}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-muted p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Statut d'analyse</p>
                    <div className="mt-2">
                      <StatusPill
                        label={formatStatusLabel(latestParseResult.parsingStatus)}
                        tone={statusToTone(latestParseResult.parsingStatus)}
                      />
                    </div>
                  </div>
                </div>

                <JsonPanel title="Avertissements" value={latestParseResult.warnings} />
                <JsonPanel title="Payload parsé" value={latestParseResult.parsedPayload} />
                <JsonPanel title="Payload mappé" value={latestParseResult.mappedPayload} />
                <JsonPanel
                  title="Patch profil extrait"
                  value={latestParseResult.extractedProfilePatch}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
