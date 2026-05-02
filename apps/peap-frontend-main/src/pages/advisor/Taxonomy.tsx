import { PageHeader } from "@/components/common/PageHeader";
import { InlineChipsSkeleton, InlineRowsSkeleton, InlineTableSkeleton, TaxonomyPageSkeleton } from "@/components/common/PageSkeletons";
import { StatCard } from "@/components/common/StatCard";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTaxonomyNodeDetailQuery,
  useTaxonomyNodesQuery,
  useTaxonomySummaryQuery,
  useUnresolvedCodesQuery,
} from "@/services/api/queries";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import type { TaxonomyNode, TaxonomyType } from "@/models";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Layers3,
  Network,
  Search,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PAGE_SIZE = 40;
const UNRESOLVED_PAGE_SIZE = 12;

const typeOptions: Array<{ label: "All" | TaxonomyType; value: string }> = [
  { label: "All", value: "all" },
  { label: "Occupation", value: "occupation" },
  { label: "Skill", value: "skill" },
  { label: "Knowledge", value: "knowledge" },
  { label: "Work Activity", value: "activity" },
  { label: "Task", value: "task" },
  { label: "Technology", value: "technology" },
  { label: "Tool", value: "tool" },
  { label: "Ability", value: "ability" },
];

const typeTone: Record<TaxonomyType, string> = {
  Occupation: "bg-info-soft text-info border-info/20",
  Skill: "bg-accent-soft text-accent border-accent/20",
  Technology: "bg-primary-muted text-primary border-primary/20",
  Tool: "bg-warning-soft text-warning border-warning/20",
  Knowledge: "bg-success-soft text-success border-success/20",
  Ability: "bg-destructive-soft text-destructive border-destructive/20",
  "Work Activity": "bg-muted text-muted-foreground border-border",
  Task: "bg-muted text-muted-foreground border-border",
};

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--muted-foreground))",
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export default function Taxonomy() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useSearchParamState();
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [unresolvedPage, setUnresolvedPage] = useState(0);
  const [unresolvedState, setUnresolvedState] = useState("open");
  const [aggregateType, setAggregateType] = useState("all");

  const debouncedSearch = useDebouncedValue(search, 350);
  const taxonomyType = typeFilter === "all" ? undefined : typeFilter;

  const summaryQuery = useTaxonomySummaryQuery();
  const nodesQuery = useTaxonomyNodesQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch,
    type: taxonomyType,
  });
  const nodes = useMemo(() => nodesQuery.data?.items ?? [], [nodesQuery.data?.items]);
  const totalNodes = nodesQuery.data?.total ?? nodesQuery.data?.count ?? 0;
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId],
  );
  const detailQuery = useTaxonomyNodeDetailQuery(selectedNode?.id);

  const unresolvedQuery = useUnresolvedCodesQuery({
    limit: UNRESOLVED_PAGE_SIZE,
    offset: unresolvedPage * UNRESOLVED_PAGE_SIZE,
    aggregateType: aggregateType === "all" ? undefined : aggregateType,
    resolved: unresolvedState === "all" ? undefined : unresolvedState === "resolved",
  });
  const unresolved = unresolvedQuery.data?.items ?? [];
  const unresolvedTotal = unresolvedQuery.data?.total ?? unresolvedQuery.data?.count ?? 0;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter]);

  useEffect(() => {
    setUnresolvedPage(0);
  }, [aggregateType, unresolvedState]);

  useEffect(() => {
    if (!selectedId && nodes.length > 0) {
      setSelectedId(nodes[0].id);
    }
  }, [nodes, selectedId]);

  const summary = summaryQuery.data;
  const metrics = summary?.metrics;
  const activeNode = detailQuery.data?.node ?? selectedNode;
  const aliases = detailQuery.data?.aliases ?? activeNode?.aliases?.map((alias, index) => ({
    id: `${activeNode.id}-${index}`,
    lang: "-",
    alias,
    alias_type: "alias",
    is_preferred: false,
  })) ?? [];
  const relations = detailQuery.data?.relations ?? [];
  const totalPages = Math.max(1, Math.ceil(totalNodes / PAGE_SIZE));
  const unresolvedPages = Math.max(1, Math.ceil(unresolvedTotal / UNRESOLVED_PAGE_SIZE));

  if (summaryQuery.isLoading || nodesQuery.isLoading) {
    return <TaxonomyPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy Manager"
        description="Fast supervision view for taxonomy coverage, unresolved codes, and lazy node review."
        actions={
          <span className="text-xs text-muted-foreground font-mono">
            {nodes.length.toLocaleString()} of {totalNodes.toLocaleString()} nodes in current query
          </span>
        }
      />

      {summaryQuery.isError && (
        <div className="panel p-4 text-sm text-destructive">
          Failed to load taxonomy summary: {summaryQuery.error instanceof Error ? summaryQuery.error.message : "unknown error"}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="Nodes" value={(metrics?.total_nodes ?? 0).toLocaleString()} icon={Network} />
        <StatCard label="Labels" value={(metrics?.total_labels ?? 0).toLocaleString()} icon={BookOpenText} />
        <StatCard label="Aliases" value={(metrics?.total_aliases ?? 0).toLocaleString()} icon={Tags} />
        <StatCard label="Relations" value={(metrics?.total_relations ?? 0).toLocaleString()} icon={GitBranch} />
        <StatCard label="Unresolved" value={(metrics?.unresolved_codes ?? 0).toLocaleString()} icon={AlertTriangle} />
        <StatCard label="Models" value={(metrics?.taxonomy_models ?? 0).toLocaleString()} icon={Layers3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title="Node Type Distribution" subtitle="Current taxonomy nodes by business domain">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={summary?.node_type_distribution ?? []}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={76}
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {(summary?.node_type_distribution ?? []).map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Taxonomy / Model Distribution" subtitle="Nodes grouped by model version">
          <ResponsiveContainer>
            <BarChart data={(summary?.taxonomy_distribution ?? []).slice(0, 8)} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Occupation Breakdown" subtitle="Occupation nodes grouped by parent family">
          <ResponsiveContainer>
            <BarChart data={summary?.occupation_breakdown ?? []} layout="vertical" margin={{ left: 16, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" width={112} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 panel flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, label or alias..."
                className="h-9 pl-9 bg-surface-muted"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {nodesQuery.isError && (
            <div className="p-4 text-sm text-destructive">
              Failed to load taxonomy nodes: {nodesQuery.error instanceof Error ? nodesQuery.error.message : "unknown error"}
            </div>
          )}
          {!nodesQuery.isLoading && !nodesQuery.isError && nodes.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No nodes match the current filters.</div>
          )}

          <ul className="divide-y divide-border max-h-[560px] overflow-y-auto scrollbar-thin">
            {nodes.map((node) => (
              <li key={node.id}>
                <button
                  onClick={() => setSelectedId(node.id)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-3 hover:bg-surface-muted transition-colors",
                    activeNode?.id === node.id && "bg-surface-muted",
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-muted text-primary shrink-0">
                    <Network className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{node.label}</p>
                      <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0", typeTone[node.type])}>
                        {node.type}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {node.code} · {node.modelName ?? node.source}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {node.aliasCount ?? 0} aliases · {node.relationCount ?? 0} relations
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-border p-3 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || nodesQuery.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              Page {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || nodesQuery.isFetching} onClick={() => setPage((current) => current + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="xl:col-span-7 panel overflow-hidden">
          {!activeNode ? (
            <div className="p-5 text-sm text-muted-foreground">Select a node to load details.</div>
          ) : (
            <>
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-muted-foreground">{activeNode.code}</p>
                    <h2 className="text-lg font-semibold text-foreground mt-0.5 break-words">{activeNode.label}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{activeNode.description}</p>
                  </div>
                  <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shrink-0", typeTone[activeNode.type])}>
                    {activeNode.type}
                  </span>
                </div>
              </div>

              {detailQuery.isError && (
                <div className="px-5 pt-4 text-sm text-destructive">
                  Failed to load node detail: {detailQuery.error instanceof Error ? detailQuery.error.message : "unknown error"}
                </div>
              )}

              <Tabs defaultValue="general" className="p-5">
                <TabsList className="bg-surface-muted">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="aliases">Aliases</TabsTrigger>
                  <TabsTrigger value="relations">Relations</TabsTrigger>
                  <TabsTrigger value="source">Source</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-3 text-sm">
                  <Row k="Preferred label" v={activeNode.label} />
                  <Row k="French label" v={activeNode.labelFr ?? "-"} />
                  <Row k="English label" v={activeNode.labelEn ?? "-"} />
                  <Row k="Domain" v={activeNode.domain ?? activeNode.type} />
                  <Row k="Model" v={activeNode.modelName ?? "-"} />
                  <Row k="Model version" v={activeNode.modelVersion ?? "-"} />
                  <Row k="Parent code" v={activeNode.parentCode ?? "-"} mono />
                  <Row k="Status" v={<StatusPill label={activeNode.isDeprecated ? "Deprecated" : activeNode.status ?? "Active"} tone={activeNode.isDeprecated ? "warning" : "success"} />} />
                  <Row k="Updated" v={activeNode.updated} mono />
                </TabsContent>

                <TabsContent value="aliases" className="mt-4">
                  {detailQuery.isFetching ? (
                    <InlineChipsSkeleton count={8} />
                  ) : aliases.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No aliases returned for this node.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {aliases.map((alias) => (
                        <span key={alias.id} className="inline-flex items-center rounded-md border border-border bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-mono">
                          {alias.alias}
                        </span>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="relations" className="mt-4">
                  {detailQuery.isFetching ? (
                    <InlineRowsSkeleton rows={4} />
                  ) : relations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No relations returned for this node.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-border">
                            <th className="text-left font-medium py-2">Direction</th>
                            <th className="text-left font-medium py-2">Relation</th>
                            <th className="text-left font-medium py-2">Source</th>
                            <th className="text-left font-medium py-2">Target</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {relations.map((relation) => (
                            <tr key={relation.id}>
                              <td className="py-2.5 text-xs text-muted-foreground">{relation.direction}</td>
                              <td className="py-2.5 text-xs font-mono text-foreground">{relation.relation_type}</td>
                              <td className="py-2.5 text-xs text-muted-foreground">{relation.src_label} <span className="font-mono">/ {relation.src_code}</span></td>
                              <td className="py-2.5 text-xs text-muted-foreground">{relation.dst_label} <span className="font-mono">/ {relation.dst_code}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="source" className="mt-4">
                  <pre className="text-xs font-mono bg-surface-muted rounded-md p-3 overflow-x-auto text-foreground">
                    {JSON.stringify(detailQuery.data ?? activeNode.raw ?? activeNode, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-border p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Unresolved Codes Review</h2>
            <p className="text-xs text-muted-foreground mt-1">Read-only queue from canonical.unresolved_code, structured for future review actions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={aggregateType} onValueChange={setAggregateType}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All aggregates</SelectItem>
                <SelectItem value="cv">CV</SelectItem>
                <SelectItem value="job_offer">Job offer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={unresolvedState} onValueChange={setUnresolvedState}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All states</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {unresolvedQuery.isError && (
          <div className="px-4 py-4 text-sm text-destructive">
            Failed to load unresolved codes: {unresolvedQuery.error instanceof Error ? unresolvedQuery.error.message : "unknown error"}
          </div>
        )}
        {!unresolvedQuery.isLoading && !unresolvedQuery.isError && unresolved.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground">No unresolved codes match this review filter.</div>
        )}

        {unresolvedQuery.isLoading ? (
          <InlineTableSkeleton columns={7} rows={5} />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                <th className="text-left font-medium px-4 py-3">Code</th>
                <th className="text-left font-medium px-2 py-3">Context</th>
                <th className="text-left font-medium px-2 py-3">Aggregate</th>
                <th className="text-left font-medium px-2 py-3">Suggestion</th>
                <th className="text-left font-medium px-2 py-3">Created</th>
                <th className="text-left font-medium px-2 py-3">Resolved</th>
                <th className="text-left font-medium px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unresolved.map((item) => (
                <tr key={item.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{item.code}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{item.context}</td>
                  <td className="px-2 py-3 text-xs">
                    <span className="text-foreground">{item.aggregate_type}</span>
                    <span className="block font-mono text-muted-foreground">{item.aggregate_id}</span>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{item.user_suggestion ?? "-"}</td>
                  <td className="px-2 py-3 text-xs">
                    <span className="font-mono text-muted-foreground">{formatDate(item.created_at)}</span>
                    <span className="block text-muted-foreground">{item.created_by}</span>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    {item.resolved_at ? (
                      <>
                        <span className="font-mono text-muted-foreground">{formatDate(item.resolved_at)}</span>
                        <span className="block text-muted-foreground">{item.resolved_by ?? "-"}</span>
                      </>
                    ) : (
                      <StatusPill label="Open" tone="warning" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">{item.resolution_note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="border-t border-border p-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={unresolvedPage === 0 || unresolvedQuery.isFetching} onClick={() => setUnresolvedPage((current) => Math.max(0, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Page {unresolvedPage + 1} / {unresolvedPages}
          </span>
          <Button variant="outline" size="sm" disabled={unresolvedPage + 1 >= unresolvedPages || unresolvedQuery.isFetching} onClick={() => setUnresolvedPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      <div className="h-56">{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={cn("text-sm text-foreground text-right break-all", mono && "font-mono")}>{v}</span>
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
