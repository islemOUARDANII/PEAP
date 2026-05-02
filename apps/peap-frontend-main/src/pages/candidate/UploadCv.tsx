import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Loader2, RefreshCw, SearchCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { ApiServiceError } from "@/services/api/client";
import { gatewayApi, type CandidateCvParseResult, type CandidateCvRecord } from "@/services/api/gateway";
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
    throw new Error(`Request failed with status ${response.status}`);
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
    queryKey: ["candidate", "bundle"],
    queryFn: () => gatewayApi.candidate.getBundle(),
  });

  const records = bundleQuery.data?.cvRecords ?? [];
  const currentCv = bundleQuery.data?.currentCv ?? null;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["candidate", "bundle"] }),
      queryClient.invalidateQueries({ queryKey: ["candidate", "cv-records"] }),
      queryClient.invalidateQueries({ queryKey: ["candidate", "dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["candidate", "matches"] }),
      queryClient.invalidateQueries({ queryKey: ["candidate", "job-offers"] }),
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
      toast.success(`Uploaded ${record.originalFilename ?? record.blobName}`);
      setLatestParseResult(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, "CV upload failed"));
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
      toast.success(`Parse request sent for ${record.originalFilename ?? record.blobName}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "CV parse failed"));
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
      toast.success(`Deleted ${record.originalFilename ?? record.blobName}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to delete this CV"));
    } finally {
      setActiveDeleteId(null);
    }
  };

  const handleOpenCurrent = async () => {
    setActiveOpenCurrent(true);
    try {
      await openAuthenticatedFile(gatewayApi.candidate.getCurrentCvViewUrl());
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to open the current CV"));
    } finally {
      setActiveOpenCurrent(false);
    }
  };

  if (bundleQuery.isLoading) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading CV records...
        </div>
      </div>
    );
  }

  if (bundleQuery.isError) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        {bundleQuery.error instanceof Error
          ? bundleQuery.error.message
          : "Unable to load CV records."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CV Upload & Parsing"
        description="Upload CV files to the API Gateway, parse them by CV record id, and inspect the returned debug payloads."
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
              Refresh
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
              {isUploading ? "Uploading..." : "Upload CV"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,1fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-border bg-surface-muted px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Uploaded CV records</h2>
            <p className="text-xs text-muted-foreground">
              Parse actions call{" "}
              <code>/candidates/me/cv/&lbrace;cv_record_id&rbrace;/parse</code> using the real record id.
            </p>
          </div>

          {records.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No CV records are stored yet. Upload a file to create the first record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">File</th>
                    <th className="px-2 py-3 text-left font-medium">CV Record ID</th>
                    <th className="px-2 py-3 text-left font-medium">Status</th>
                    <th className="px-2 py-3 text-left font-medium">Parsing</th>
                    <th className="px-2 py-3 text-left font-medium">Uploaded</th>
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
                              <StatusPill label="Current" tone="accent" dot={false} />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 align-top text-[11px] font-mono text-muted-foreground">
                          {record.id}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <StatusPill label={record.status} tone={statusToTone(record.status)} />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <StatusPill
                            label={record.parsingStatus}
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
                              {isParsing ? "Parsing..." : "Analyze"}
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
                              {isDeleting ? "Deleting..." : "Delete"}
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
            <h2 className="text-sm font-semibold text-foreground">Current CV</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The current CV view endpoint is loaded through the authenticated API Gateway.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Filename</p>
                <p className="mt-1 font-medium text-foreground">
                  {currentCv?.originalFilename ?? "No current CV"}
                </p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current parsing status</p>
                <p className="mt-1 font-medium text-foreground">
                  {currentCv?.parsingStatus ?? "No record"}
                </p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">View endpoint</p>
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
                {activeOpenCurrent ? "Opening..." : "Open current CV"}
              </Button>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Latest parse result</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Parsed payload, mapped payload, warnings, and extracted profile patch are shown exactly as returned by the backend.
            </p>

            {!latestParseResult ? (
              <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                Run Analyze on one CV record to inspect the latest backend parse response.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-surface-muted p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">CV record id</p>
                    <p className="mt-1 break-all font-mono text-xs text-foreground">
                      {latestParseResult.cvRecordId}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-muted p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parsing status</p>
                    <div className="mt-2">
                      <StatusPill
                        label={latestParseResult.parsingStatus}
                        tone={statusToTone(latestParseResult.parsingStatus)}
                      />
                    </div>
                  </div>
                </div>

                <JsonPanel title="Warnings" value={latestParseResult.warnings} />
                <JsonPanel title="Parsed payload" value={latestParseResult.parsedPayload} />
                <JsonPanel title="Mapped payload" value={latestParseResult.mappedPayload} />
                <JsonPanel
                  title="Extracted profile patch"
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
