import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Database, Loader2, PlayCircle, RefreshCw, Send, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiServiceError, apiRequestDetailed } from "@/services/api/client";
import { gatewayApi } from "@/services/api/gateway";
import { readStoredSession } from "@/services/auth/sessionStorage";

type PlaygroundMethod = "GET" | "POST" | "PUT" | "DELETE";

const formatJson = (value: unknown): string => JSON.stringify(value, null, 2);

const normalizeServiceEntries = (
  services: Record<string, { service: string; status: string; detail?: string | null; url?: string | null }>,
) =>
  Object.entries(services).map(([key, service]) => ({
    key,
    name: service.service || key,
    status: service.status,
    detail: service.detail ?? null,
    url: service.url ?? null,
  }));

export default function PipelineMonitoring() {
  const [playgroundMethod, setPlaygroundMethod] = useState<PlaygroundMethod>("GET");
  const [playgroundPath, setPlaygroundPath] = useState("/auth/me");
  const [playgroundBody, setPlaygroundBody] = useState("{\n  \n}");
  const [playgroundResponse, setPlaygroundResponse] = useState<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
  } | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["tech-admin", "dashboard"],
    queryFn: () => gatewayApi.techAdmin.dashboard(),
    staleTime: 30_000,
  });
  const healthQuery = useQuery({
    queryKey: ["tech-admin", "health"],
    queryFn: () => gatewayApi.techAdmin.health(),
    staleTime: 30_000,
  });
  const servicesQuery = useQuery({
    queryKey: ["tech-admin", "services"],
    queryFn: () => gatewayApi.techAdmin.services(),
    staleTime: 30_000,
  });
  const parsingHealthQuery = useQuery({
    queryKey: ["tech-admin", "services", "parsing"],
    queryFn: () => gatewayApi.techAdmin.parsingHealth(),
    staleTime: 30_000,
  });
  const matchingHealthQuery = useQuery({
    queryKey: ["tech-admin", "services", "matching"],
    queryFn: () => gatewayApi.techAdmin.matchingHealth(),
    staleTime: 30_000,
  });
  const searchHealthQuery = useQuery({
    queryKey: ["tech-admin", "services", "search"],
    queryFn: () => gatewayApi.techAdmin.searchHealth(),
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => gatewayApi.search.sync(),
    onSuccess: () => {
      toast.success("Search sync triggered through the API Gateway.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Search sync failed.");
    },
  });

  const playgroundMutation = useMutation({
    mutationFn: async () => {
      let parsedBody: unknown = undefined;
      if (playgroundMethod !== "GET" && playgroundMethod !== "DELETE") {
        const trimmed = playgroundBody.trim();
        parsedBody = trimmed ? JSON.parse(trimmed) : undefined;
      }

      const response = await apiRequestDetailed<unknown>(
        playgroundPath,
        {
          method: playgroundMethod,
          headers:
            parsedBody === undefined
              ? undefined
              : {
                  "Content-Type": "application/json",
                },
          body: parsedBody === undefined ? undefined : JSON.stringify(parsedBody),
        },
      );

      return {
        status: response.status,
        headers: response.headers,
        body: response.data,
      };
    },
    onSuccess: (result) => {
      setPlaygroundResponse(result);
    },
    onError: (error) => {
      if (error instanceof ApiServiceError) {
        setPlaygroundResponse({
          status: error.status,
          headers: error.headers,
          body: error.rawResponse ?? error.details ?? error.message,
        });
        return;
      }

      setPlaygroundResponse({
        status: 0,
        headers: {},
        body: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const serviceEntries = useMemo(
    () => normalizeServiceEntries(servicesQuery.data ?? {}),
    [servicesQuery.data],
  );
  const upCount = serviceEntries.filter((service) => service.status.toUpperCase() === "UP").length;
  const degradedCount = serviceEntries.length - upCount;
  const jwtPresent = Boolean(readStoredSession()?.token);

  if (
    dashboardQuery.isLoading ||
    healthQuery.isLoading ||
    servicesQuery.isLoading ||
    parsingHealthQuery.isLoading ||
    matchingHealthQuery.isLoading ||
    searchHealthQuery.isLoading
  ) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tech-admin diagnostics...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tech Admin Diagnostics"
        description="Real API Gateway diagnostics, downstream service health, search sync, and an authenticated API Playground."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void dashboardQuery.refetch();
                void healthQuery.refetch();
                void servicesQuery.refetch();
                void parsingHealthQuery.refetch();
                void matchingHealthQuery.refetch();
                void searchHealthQuery.refetch();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {syncMutation.isPending ? "Syncing..." : "Sync Search Index"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Services registered" value={serviceEntries.length} icon={Wrench} />
        <StatCard label="Services up" value={upCount} icon={ShieldCheck} />
        <StatCard label="Services degraded" value={degradedCount} icon={Activity} />
        <StatCard label="JWT in session" value={jwtPresent ? "Yes" : "No"} icon={Database} />
        <StatCard
          label="Gateway status"
          value={dashboardQuery.data?.apiGateway ?? "Unknown"}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground">Service health</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Loaded from <code>/tech-admin/services</code> and the dedicated parsing, matching, and search health routes.
          </p>

          {servicesQuery.isError ? (
            <div className="mt-4 rounded-md border border-destructive/20 bg-destructive-soft p-4 text-sm text-destructive">
              {servicesQuery.error instanceof Error
                ? servicesQuery.error.message
                : "Unable to load service health."}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-2 py-2 text-left font-medium">Service</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                    <th className="px-2 py-2 text-left font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {serviceEntries.map((service) => (
                    <tr key={service.key}>
                      <td className="px-2 py-3">
                        <p className="font-medium text-foreground">{service.name}</p>
                        {service.url ? (
                          <p className="text-xs font-mono text-muted-foreground">{service.url}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill label={service.status} tone={statusToTone(service.status)} />
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {service.detail ?? "No additional detail returned."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Health summaries</h2>
            <div className="mt-4 grid gap-3">
              <ServiceCard title="Parsing service" payload={parsingHealthQuery.data} />
              <ServiceCard title="Matching service" payload={matchingHealthQuery.data} />
              <ServiceCard title="Search service" payload={searchHealthQuery.data} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Raw diagnostics payloads</h2>
            <pre className="mt-4 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
              {formatJson({
                dashboard: dashboardQuery.data,
                health: healthQuery.data,
              })}
            </pre>
          </section>
        </div>
      </div>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground">API Playground</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Requests are sent through the central API client, so the current JWT token is reused automatically.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[160px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={playgroundMethod} onValueChange={(value) => setPlaygroundMethod(value as PlaygroundMethod)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Path</Label>
            <Input
              value={playgroundPath}
              onChange={(event) => setPlaygroundPath(event.target.value)}
              placeholder="/auth/me"
              className="h-10 font-mono"
            />
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">JSON body</Label>
          <Textarea
            value={playgroundBody}
            onChange={(event) => setPlaygroundBody(event.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder='{\n  "key": "value"\n}'
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => playgroundMutation.mutate()}
            disabled={playgroundMutation.isPending || !playgroundPath.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {playgroundMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {playgroundMutation.isPending ? "Sending..." : "Send request"}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-md bg-surface-muted p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {playgroundResponse?.status ?? "-"}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Headers</p>
            <pre className="mt-2 overflow-x-auto text-xs text-foreground">
              {formatJson(playgroundResponse?.headers ?? {})}
            </pre>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Body</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
            {formatJson(playgroundResponse?.body ?? {})}
          </pre>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({
  title,
  payload,
}: {
  title: string;
  payload: { status: string; detail?: string | null; url?: string | null } | undefined;
}) {
  return (
    <div className="rounded-md bg-surface-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <StatusPill label={payload?.status ?? "Unknown"} tone={statusToTone(payload?.status ?? "Unknown")} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {payload?.detail ?? "No detail returned."}
      </p>
      {payload?.url ? (
        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
          {payload.url}
        </p>
      ) : null}
    </div>
  );
}
