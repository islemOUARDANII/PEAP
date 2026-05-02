import { PageHeader } from "@/components/common/PageHeader";
import { TablePageSkeleton } from "@/components/common/PageSkeletons";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { useAuditLogsQuery } from "@/services/api/queries";
import type { AuditLog } from "@/models";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";

const PAGE_SIZE = 30;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export default function AuditLogs() {
  const [search, setSearch] = useSearchParamState();
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedAction = useDebouncedValue(action, 350);
  const debouncedEntityType = useDebouncedValue(entityType, 350);

  useEffect(() => {
    setPage(0);
  }, [debouncedAction, debouncedEntityType, debouncedSearch, statusFilter]);

  const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch,
    action: debouncedAction || undefined,
    entityType: debouncedEntityType || undefined,
    resultStatus: statusFilter === "all" ? undefined : statusFilter,
  });

  const auditLogs = data?.items ?? [];
  const total = data?.total ?? data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return <TablePageSkeleton controls={4} columns={7} rows={8} />;
  }

  const view = (entry: AuditLog) => {
    setSelected(entry);
    setOpen(true);
  };

  const exportCsv = () => {
    const headers = ["id", "actor_user_id", "action", "entity_type", "entity_id", "trace_id", "result_code", "occurred_at"];
    const rows = auditLogs.map((entry) => [
      entry.id,
      entry.actorUserId,
      entry.action,
      entry.entityType,
      entry.entityId ?? "",
      entry.traceId,
      entry.resultCode,
      entry.occurredAt,
    ].map((value) => JSON.stringify(String(value ?? ""))).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs-page.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description={`${total.toLocaleString()} read-only rows from audit.audit_log`}
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> Export page</Button>}
      />

      <div className="panel p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search id, actor, trace or entity..."
            className="h-9 pl-9 bg-surface-muted font-mono"
          />
        </div>
        <Input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Action"
          className="h-9 bg-surface-muted font-mono"
        />
        <Input
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          placeholder="Entity type"
          className="h-9 bg-surface-muted font-mono"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success (&lt;300)</SelectItem>
            <SelectItem value="warning">Warning (3xx)</SelectItem>
            <SelectItem value="error">Error (4xx+)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {isError && (
          <div className="px-4 py-4 text-sm text-destructive">
            Failed to load audit logs: {error instanceof Error ? error.message : "unknown error"}
          </div>
        )}
        {!isLoading && !isError && auditLogs.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground">No audit logs match the selected filters.</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                <th className="text-left font-medium px-4 py-3">Occurred</th>
                <th className="text-left font-medium px-2 py-3">Actor User ID</th>
                <th className="text-left font-medium px-2 py-3">Action</th>
                <th className="text-left font-medium px-2 py-3">Entity</th>
                <th className="text-left font-medium px-2 py-3">Trace ID</th>
                <th className="text-left font-medium px-2 py-3">Result</th>
                <th className="text-right font-medium px-4 py-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditLogs.map((entry) => (
                <tr key={entry.id} onClick={() => view(entry)} className="hover:bg-surface-muted cursor-pointer">
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{formatDate(entry.occurredAt)}</td>
                  <td className="px-2 py-2.5">
                    <p className="text-xs font-mono text-foreground">{entry.actorUserId}</p>
                    {entry.actorEmail && <p className="text-[10px] text-muted-foreground">{entry.actorEmail}</p>}
                  </td>
                  <td className="px-2 py-2.5 text-xs font-mono text-foreground">{entry.action}</td>
                  <td className="px-2 py-2.5 text-xs">
                    <span className="text-foreground">{entry.entityType}</span>
                    <span className="block text-muted-foreground font-mono">{entry.entityId ?? "-"}</span>
                  </td>
                  <td className="px-2 py-2.5 text-xs font-mono text-muted-foreground">{entry.traceId}</td>
                  <td className="px-2 py-2.5"><StatusPill label={String(entry.resultCode)} tone={statusToTone(entry.status)} /></td>
                  <td className="px-4 py-2.5 text-right text-xs font-mono text-muted-foreground">{entry.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border p-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Page {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono text-base">{selected?.action}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field k="ID" v={selected.id} />
                <Field k="Actor user ID" v={selected.actorUserId} />
                <Field k="Action" v={selected.action} />
                <Field k="Entity type" v={selected.entityType} />
                <Field k="Entity ID" v={selected.entityId ?? "-"} />
                <Field k="Trace ID" v={selected.traceId} />
                <Field k="Result code" v={<StatusPill label={String(selected.resultCode)} tone={statusToTone(selected.status)} />} />
                <Field k="Occurred at" v={formatDate(selected.occurredAt)} />
              </div>
              <div>
                <p className="stat-label mb-2">Backend payload</p>
                <pre className="text-xs font-mono bg-surface-muted rounded-md p-3 overflow-x-auto text-foreground">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-muted p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="text-sm font-mono text-foreground mt-0.5 break-all">{v}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
}
