import { PageHeader } from "@/components/common/PageHeader";
import { AdvisorDashboardSkeleton } from "@/components/common/PageSkeletons";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { useAdvisorDashboardQuery } from "@/services/api/queries";
import { Users, FileText, Network, Activity, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--accent))", "hsl(var(--primary))", "hsl(var(--info))",
  "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--muted-foreground))",
];

export default function AdvisorDashboard() {
  const { data: dashboard, isLoading, isError, error } = useAdvisorDashboardQuery();
  const stats = dashboard?.stats;
  const matchingActivity = dashboard?.matchingActivity ?? [];
  const taxonomyDistribution = dashboard?.taxonomyDistribution ?? [];
  const pipelineStatuses = dashboard?.pipelineStatuses ?? [];
  const scoreDistribution = dashboard?.scoreDistribution ?? [];
  const recentWarnings = dashboard?.recentWarnings ?? [];

  if (isLoading) {
    return <AdvisorDashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load backend dashboard: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Overview"
        description="Operational health from the admin API: documents, taxonomy, pipeline and audit activity."
        actions={(
          <Button asChild size="sm" variant="outline">
            <Link to="/advisor/provider-requests">Provider requests</Link>
          </Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="CV documents" value={stats?.candidateDocuments ?? 0} icon={Users} />
        <StatCard label="Offer documents" value={stats?.offerDocuments ?? 0} icon={FileText} />
        <StatCard label="Taxonomy nodes" value={(stats?.taxonomyNodes ?? 0).toLocaleString()} icon={Network} />
        <StatCard label="Pipeline tracked" value={(stats?.pipelineRuns ?? 0).toLocaleString()} icon={Activity} />
        <StatCard label="Errors loaded" value={stats?.errorCount ?? 0} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 panel p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Backend activity</h2>
          <p className="text-xs text-muted-foreground mb-4">Audit events and document intake over the last 14 days</p>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={matchingActivity} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line name="Audit events" type="monotone" dataKey="matches" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line name="Documents" type="monotone" dataKey="applications" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Taxonomy distribution</h2>
          <p className="text-xs text-muted-foreground mb-4">By backend taxonomy domain</p>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={taxonomyDistribution} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} strokeWidth={2} stroke="hsl(var(--card))">
                  {taxonomyDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {taxonomyDistribution.map((t, i) => (
              <li key={t.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {t.name}
                </span>
                <span className="font-mono text-muted-foreground">{t.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {taxonomyDistribution.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">No taxonomy domains were returned by the backend.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Pipeline statuses</h2>
          <p className="text-xs text-muted-foreground mb-4">Current status counts from /pipeline/summary</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={pipelineStatuses} margin={{ left: -16, right: 8, top: 8, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={92} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Match score distribution</h2>
          <p className="text-xs text-muted-foreground mb-4">Waiting for a backend match-score listing endpoint</p>
          {scoreDistribution.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={scoreDistribution} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 items-center rounded-md border border-dashed border-border bg-surface-muted px-4 text-sm text-muted-foreground">
              TODO(frontend): connect this chart when the backend exposes aggregate match scores.
            </div>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent backend warnings</h2>
        <ul className="divide-y divide-border">
          {recentWarnings.map((warning) => (
            <li key={warning.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="text-foreground">{warning.text}</span>
              <span className="shrink-0 text-muted-foreground font-mono">{warning.time}</span>
            </li>
          ))}
        </ul>
        {recentWarnings.length === 0 && (
          <p className="text-sm text-muted-foreground">No backend warnings were returned by the loaded audit and pipeline endpoints.</p>
        )}
      </div>
    </div>
  );
}
