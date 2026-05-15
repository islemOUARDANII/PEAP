import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  GitBranch,
  Layers3,
  Link2,
  Network,
  Search,
  ShieldCheck,
  Tags,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { gatewayApi } from "@/services/api/gateway";
import {
  useTaxonomyModelsQuery,
  useTaxonomyNodeDetailQuery,
  useTaxonomyNodesQuery,
  useTaxonomySummaryQuery,
  useTaxonomyCrosswalkReviewQuery,
  useValidateCrosswalkMutation,
  useRejectCrosswalkMutation,
} from "@/services/api/queries";
import type { TaxonomyCrosswalkReviewItem, TaxonomyModel } from "@/models/taxonomy";
import { ReferencesTab } from "./taxonomy/ReferencesTab";

// ─── constants ───────────────────────────────────────────────────────────────

const NODE_PAGE_SIZE = 40;
const CW_PAGE_SIZE = 20;

// ─── helpers ─────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toISOString().slice(0, 16).replace("T", " ");
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

function nodeTypeTone(nodeType: string): string {
  switch (nodeType.toUpperCase()) {
    case "OCCUPATION": return "bg-info-soft text-info border-info/20";
    case "SKILL":      return "bg-accent-soft text-accent border-accent/20";
    case "TECHNOLOGY": return "bg-primary-muted text-primary border-primary/20";
    case "TOOL":       return "bg-warning-soft text-warning border-warning/20";
    case "KNOWLEDGE":  return "bg-success-soft text-success border-success/20";
    case "ABILITY":    return "bg-destructive-soft text-destructive border-destructive/20";
    default:           return "bg-muted text-muted-foreground border-border";
  }
}

function confidenceDisplay(value: number | null): { label: string; className: string } {
  if (value == null) return { label: "—", className: "text-muted-foreground" };
  const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
  if (pct >= 90) return { label: `${pct}%`, className: "text-success font-medium" };
  if (pct >= 70) return { label: `${pct}%`, className: "text-warning font-medium" };
  return { label: `${pct}%`, className: "text-destructive font-medium" };
}

// ─── tiny UI helpers ──────────────────────────────────────────────────────────

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{k}</span>
      <span className={cn("text-sm text-foreground text-right break-all min-w-0", mono && "font-mono")}>
        {v}
      </span>
    </div>
  );
}

function InlineSkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-border">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-25" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function QueryError({ error, label }: { error: unknown; label: string }) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {label}: {msg}
    </div>
  );
}

// ─── ModelCard ────────────────────────────────────────────────────────────────

function ModelCard({ model }: { model: TaxonomyModel }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-2.5 hover:bg-surface-muted transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold font-mono text-foreground">{model.code}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{model.label}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill label={model.is_active ? "Active" : "Inactive"} tone={model.is_active ? "success" : "warning"} />
          {model.is_default && <StatusPill label="Default" tone="info" />}
        </div>
      </div>
      {model.version && (
        <p className="text-[10px] font-mono text-muted-foreground">v{model.version}</p>
      )}
      {model.source && (
        <p className="text-[10px] text-muted-foreground">Source: {model.source}</p>
      )}
      {model.released_at && (
        <p className="text-[10px] text-muted-foreground">Released: {formatDate(model.released_at)}</p>
      )}
    </div>
  );
}

// ─── NodeDetailPanel ──────────────────────────────────────────────────────────

function NodeDetailPanel({ nodeId }: { nodeId: string }) {
  const nodeQuery   = useTaxonomyNodeDetailQuery(nodeId);
  const aliasQuery  = useQuery({
    queryKey: ["taxonomy", "aliases",   nodeId],
    queryFn:  () => gatewayApi.taxonomy.getAliases(nodeId),
    enabled:  !!nodeId,
  });
  const relQuery    = useQuery({
    queryKey: ["taxonomy", "relations", nodeId],
    queryFn:  () => gatewayApi.taxonomy.getRelations(nodeId),
    enabled:  !!nodeId,
  });

  const node      = nodeQuery.data;
  const aliases   = aliasQuery.data   ?? [];
  const relations = relQuery.data     ?? [];

  if (nodeQuery.isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
        <InlineSkeletonRows count={5} />
      </div>
    );
  }

  if (nodeQuery.isError || !node) {
    return <QueryError error={nodeQuery.error} label="Failed to load node" />;
  }

  return (
    <>
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-muted-foreground">
              {node.external_code ?? shortId(node.id)}
            </p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5 break-words">
              {node.preferred_label}
            </h2>
            {node.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{node.description}</p>
            )}
          </div>
          <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shrink-0", nodeTypeTone(node.node_type))}>
            {node.node_type}
          </span>
        </div>
      </div>

      <Tabs defaultValue="general" className="p-5">
        <TabsList className="bg-surface-muted">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="aliases">
            Aliases{aliases.length > 0 ? ` (${aliases.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="relations">
            Relations{relations.length > 0 ? ` (${relations.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-0">
          <Row k="Preferred label"  v={node.preferred_label} />
          <Row k="Normalized label" v={node.normalized_label ?? "—"} />
          <Row k="External code"    v={node.external_code   ?? "—"} mono />
          <Row k="Node type"        v={
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", nodeTypeTone(node.node_type))}>
              {node.node_type}
            </span>
          } />
          <Row k="Language"         v={node.language_code ?? "—"} mono />
          <Row k="Model ID"         v={shortId(node.model_id)} mono />
          <Row k="Parent ID"        v={node.parent_id ? shortId(node.parent_id) : "—"} mono />
          <Row k="Status"           v={<StatusPill label={node.active ? "Active" : "Inactive"} tone={node.active ? "success" : "warning"} />} />
          <Row k="Updated"          v={formatDate(node.updated_at)} mono />
        </TabsContent>

        <TabsContent value="aliases" className="mt-4">
          {aliasQuery.isFetching ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-20" />)}
            </div>
          ) : aliases.length === 0 ? (
            <p className="text-xs text-muted-foreground">No aliases for this node.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {aliases.map((alias) => (
                <span key={alias.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-mono">
                  {alias.alias}
                  {alias.language_code && (
                    <span className="text-[10px] opacity-50">{alias.language_code}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          {relQuery.isFetching ? (
            <InlineSkeletonRows count={4} />
          ) : relations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No relations for this node.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium py-2">Relation type</th>
                    <th className="text-left font-medium py-2">Source</th>
                    <th className="text-left font-medium py-2">Target</th>
                    <th className="text-right font-medium py-2">Conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {relations.map((rel) => {
                    const conf = confidenceDisplay(rel.confidence);
                    return (
                      <tr key={rel.id}>
                        <td className="py-2.5 text-xs font-mono text-foreground">{rel.relation_type}</td>
                        <td className="py-2.5 text-xs font-mono text-muted-foreground">{shortId(rel.source_node_id)}</td>
                        <td className="py-2.5 text-xs font-mono text-muted-foreground">{shortId(rel.target_node_id)}</td>
                        <td className={cn("py-2.5 text-xs text-right", conf.className)}>{conf.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <pre className="text-xs font-mono bg-surface-muted rounded-md p-3 overflow-auto max-h-72 text-foreground">
            {JSON.stringify(node, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── RejectDialog ─────────────────────────────────────────────────────────────

function RejectDialog({
  item,
  isPending,
  onClose,
  onConfirm,
}: {
  item: TaxonomyCrosswalkReviewItem;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Crosswalk</DialogTitle>
          <DialogDescription>
            Crosswalk <span className="font-mono">{shortId(item.id)}</span> will be set as inactive.
            Provide a reason before confirming.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason…"
          rows={3}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? "Rejecting…" : "Confirm Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Taxonomy() {
  // ── explorer state ──────────────────────────────────────────────────────────
  const [nodeSearch,     setNodeSearch]     = useState("");
  const [modelFilter,    setModelFilter]    = useState("all");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("all");
  const [nodePage,       setNodePage]       = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const debouncedSearch = useDebouncedValue(nodeSearch, 350);

  // ── crosswalk state ─────────────────────────────────────────────────────────
  const [cwValidated,  setCwValidated]  = useState("all");
  const [cwActive,     setCwActive]     = useState("all");
  const [cwPage,       setCwPage]       = useState(0);
  const [rejectTarget, setRejectTarget] = useState<TaxonomyCrosswalkReviewItem | null>(null);

  // ── queries ─────────────────────────────────────────────────────────────────
  const summaryQuery  = useTaxonomySummaryQuery();
  const modelsQuery   = useTaxonomyModelsQuery();
  const nodesQuery    = useTaxonomyNodesQuery({
    model_code: modelFilter === "all"    ? undefined : modelFilter,
    node_type:  nodeTypeFilter === "all" ? undefined : nodeTypeFilter,
    q:          debouncedSearch          || undefined,
    limit:      NODE_PAGE_SIZE,
    offset:     nodePage * NODE_PAGE_SIZE,
  });
  const cwQuery = useTaxonomyCrosswalkReviewQuery({
    validated: cwValidated === "all" ? undefined : cwValidated === "true",
    active:    cwActive    === "all" ? undefined : cwActive    === "true",
    limit:     CW_PAGE_SIZE,
    offset:    cwPage * CW_PAGE_SIZE,
  });

  const validateMutation = useValidateCrosswalkMutation();
  const rejectMutation   = useRejectCrosswalkMutation();

  // ── derived ─────────────────────────────────────────────────────────────────
  const models       = modelsQuery.data ?? [];
  const summary      = summaryQuery.data;
  const nodes        = nodesQuery.data?.items ?? [];
  const totalNodes   = nodesQuery.data?.total ?? 0;
  const totalNodePgs = Math.max(1, Math.ceil(totalNodes / NODE_PAGE_SIZE));
  const activeNodeId = selectedNodeId ?? nodes[0]?.id;
  const crosswalks   = cwQuery.data?.items ?? [];
  const totalCw      = cwQuery.data?.total ?? 0;
  const totalCwPgs   = Math.max(1, Math.ceil(totalCw / CW_PAGE_SIZE));

  const nodeTypeOptions = useMemo(() => {
    const seen = new Set(nodes.map((n) => n.node_type));
    return Array.from(seen).sort();
  }, [nodes]);

  // ── side effects ────────────────────────────────────────────────────────────
  useEffect(() => { setNodePage(0); setSelectedNodeId(undefined); }, [debouncedSearch, modelFilter, nodeTypeFilter]);
  useEffect(() => { setCwPage(0); }, [cwValidated, cwActive]);

  // ── handlers ────────────────────────────────────────────────────────────────
  function handleValidate(item: TaxonomyCrosswalkReviewItem) {
    validateMutation.mutate(
      { id: item.id, payload: {} },
      {
        onSuccess: () => toast.success("Crosswalk validated"),
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Validation failed"),
      },
    );
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    rejectMutation.mutate(
      { id: rejectTarget.id, payload: { reason } },
      {
        onSuccess: () => { toast.success("Crosswalk rejected"); setRejectTarget(null); },
        onError:   (err) => toast.error(err instanceof Error ? err.message : "Rejection failed"),
      },
    );
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy Management"
        description="Browse canonical taxonomy nodes, review crosswalk mappings, and manage taxonomy models."
      />

      <Tabs defaultValue="overview">
        <TabsList className="bg-surface-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="explorer">Taxonomy Explorer</TabsTrigger>
          <TabsTrigger value="crosswalk">Crosswalk Review</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════ OVERVIEW ═══════════════════════════ */}
        <TabsContent value="overview" className="mt-6 space-y-6">

          {summaryQuery.isError && (
            <QueryError error={summaryQuery.error} label="Failed to load taxonomy summary" />
          )}

          {summaryQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                  <Skeleton className="h-7 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
              <StatCard label="Total Nodes"   value={(summary?.total_nodes   ?? 0).toLocaleString()} icon={Network} />
              <StatCard label="Active Nodes"  value={(summary?.active_nodes  ?? 0).toLocaleString()} icon={CheckCircle2}  iconBackground="bg-success-soft text-success" />
              <StatCard label="Models"        value={(summary?.total_models  ?? 0).toLocaleString()} icon={Layers3} />
              <StatCard label="Active Models" value={(summary?.active_models ?? 0).toLocaleString()} icon={Database}      iconBackground="bg-accent-soft text-accent" />
              <StatCard label="Aliases"       value={(summary?.total_aliases ?? 0).toLocaleString()} icon={Tags} />
              <StatCard label="Relations"     value={(summary?.total_relations ?? 0).toLocaleString()} icon={GitBranch} />
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Registered Taxonomy Models</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Canonical taxonomy sources imported into the platform.
              </p>
            </div>

            {modelsQuery.isError && (
              <QueryError error={modelsQuery.error} label="Failed to load models" />
            )}

            {modelsQuery.isLoading ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : models.length === 0 ? (
              <EmptyState icon={Layers3} text="No taxonomy models registered yet." />
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {models.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════ EXPLORER ════════════════════════════ */}
        <TabsContent value="explorer" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

            {/* Node list panel */}
            <div className="xl:col-span-5 panel flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                    placeholder="Search label, code…"
                    className="h-9 pl-9 bg-surface-muted"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="h-9 flex-1 min-w-0">
                      <SelectValue placeholder="All models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All models</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.code}>
                          {m.code}{m.version ? ` v${m.version}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={nodeTypeFilter} onValueChange={setNodeTypeFilter}>
                    <SelectTrigger className="h-9 w-[130px] shrink-0">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {nodeTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {nodesQuery.isError && (
                <QueryError error={nodesQuery.error} label="Failed to load nodes" />
              )}

              {nodesQuery.isLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                      <div className="flex-1 space-y-1.5 py-0.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : nodes.length === 0 ? (
                <EmptyState icon={Network} text="No nodes match the current filters." />
              ) : (
                <ul className="divide-y divide-border max-h-[540px] overflow-y-auto scrollbar-thin flex-1">
                  {nodes.map((node) => (
                    <li key={node.id}>
                      <button
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          "w-full text-left flex items-start gap-3 p-3 hover:bg-surface-muted transition-colors",
                          activeNodeId === node.id && "bg-surface-muted",
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-muted text-primary shrink-0">
                          <Network className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {node.preferred_label}
                            </p>
                            <span className={cn(
                              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                              nodeTypeTone(node.node_type),
                            )}>
                              {node.node_type}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                            {node.external_code ?? shortId(node.id)}
                          </p>
                          {!node.active && (
                            <span className="text-[10px] text-warning">Inactive</span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-border p-3 flex items-center justify-between gap-2 mt-auto">
                <Button
                  variant="outline" size="sm"
                  disabled={nodePage === 0 || nodesQuery.isFetching}
                  onClick={() => setNodePage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground font-mono">
                  {nodePage + 1} / {totalNodePgs} · {totalNodes.toLocaleString()} nodes
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={nodePage + 1 >= totalNodePgs || nodesQuery.isFetching}
                  onClick={() => setNodePage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Node detail panel */}
            <div className="xl:col-span-7 panel overflow-hidden">
              {!activeNodeId ? (
                <EmptyState icon={Network} text="Select a node on the left to view its details." />
              ) : (
                <NodeDetailPanel nodeId={activeNodeId} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════ CROSSWALK ═════════════════════════════ */}
        <TabsContent value="crosswalk" className="mt-6 space-y-4">
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Crosswalk Review Queue</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalCw.toLocaleString()} crosswalk{totalCw !== 1 ? "s" : ""} — validate or reject inter-model node mappings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={cwValidated} onValueChange={setCwValidated}>
                  <SelectTrigger className="h-9 w-[155px]">
                    <SelectValue placeholder="Validation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="false">Unvalidated</SelectItem>
                    <SelectItem value="true">Validated</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cwActive} onValueChange={setCwActive}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue placeholder="Active" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cwQuery.isError && (
              <QueryError error={cwQuery.error} label="Failed to load crosswalks" />
            )}

            {cwQuery.isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-7 w-20" />
                  </div>
                ))}
              </div>
            ) : crosswalks.length === 0 ? (
              <EmptyState icon={Link2} text="No crosswalks match the current filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                      <th className="text-left font-medium px-4 py-3">Source node</th>
                      <th className="text-left font-medium px-2 py-3">Target node</th>
                      <th className="text-left font-medium px-2 py-3">Mapping type</th>
                      <th className="text-right font-medium px-2 py-3">Conf.</th>
                      <th className="text-left font-medium px-2 py-3">Method</th>
                      <th className="text-left font-medium px-2 py-3">Status</th>
                      <th className="text-right font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {crosswalks.map((item) => {
                      const conf = confidenceDisplay(item.confidence);
                      const isValidating =
                        validateMutation.isPending &&
                        (validateMutation.variables as { id: string } | undefined)?.id === item.id;

                      return (
                        <tr key={item.id} className="hover:bg-surface-muted">
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono text-foreground">
                              {shortId(item.source_node_id)}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <span className="text-xs font-mono text-foreground">
                              {shortId(item.target_node_id)}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.mapping_type ?? "—"}
                            </span>
                          </td>
                          <td className={cn("px-2 py-3 text-xs text-right", conf.className)}>
                            {conf.label}
                          </td>
                          <td className="px-2 py-3 text-xs text-muted-foreground">
                            {item.method ?? "—"}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              {item.validated ? (
                                <StatusPill label="Validated" tone="success" />
                              ) : (
                                <StatusPill label="Pending" tone="warning" />
                              )}
                              {!item.active && (
                                <StatusPill label="Inactive" tone="destructive" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {!item.validated && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 gap-1 px-2 text-xs text-success border-success/30 hover:bg-success-soft hover:text-success"
                                  disabled={isValidating}
                                  onClick={() => handleValidate(item)}
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  {isValidating ? "…" : "Validate"}
                                </Button>
                              )}
                              {item.active && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 gap-1 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive-soft hover:text-destructive"
                                  onClick={() => setRejectTarget(item)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-border p-3 flex items-center justify-between gap-2">
              <Button
                variant="outline" size="sm"
                disabled={cwPage === 0 || cwQuery.isFetching}
                onClick={() => setCwPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-mono">
                {cwPage + 1} / {totalCwPgs}
              </span>
              <Button
                variant="outline" size="sm"
                disabled={cwPage + 1 >= totalCwPgs || cwQuery.isFetching}
                onClick={() => setCwPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════ REFERENCES ════════════════════════════ */}
        <TabsContent value="references" className="mt-6">
          <ReferencesTab />
        </TabsContent>
      </Tabs>

      {/* Reject dialog — rendered outside tabs so it's always mounted when open */}
      {rejectTarget && (
        <RejectDialog
          item={rejectTarget}
          isPending={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}
