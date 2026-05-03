import { PageHeader } from '@/components/common/PageHeader';
import { ProviderDashboardSkeleton } from '@/components/common/PageSkeletons';
import { StatCard } from '@/components/common/StatCard';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { useProviderDashboardQuery } from '@/services/api/queries';
import {
  Briefcase,
  Users,
  FileText,
  TrendingUp,
  Plus,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  LabelList,
} from 'recharts';
import { CustomValueLabel } from '@/components/common/ReCharts';
import { chartsConfig } from '@/app/constants';

export default function ProviderDashboard() {
  const { data: dashboard, isLoading } = useProviderDashboardQuery();
  const active = dashboard?.activeOffers ?? [];
  const top = dashboard?.topOffers ?? [];
  const recent = dashboard?.recentCandidates ?? [];
  const matchingActivity = dashboard?.matchingActivity ?? [];

  if (isLoading) {
    return <ProviderDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Dashboard"
        description="Monitor your offers, applicant flow and match quality."
        actions={
          <Button
            asChild
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Link to="/provider/offers/new">
              <Plus className="h-4 w-4 mr-1.5" /> New offer
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active offers"
          value={active.length}
          icon={FileText}
          className="start-border-left-blue"
          iconBackground={'start-background-color-blue'}
        />
        <StatCard
          label="Matched candidates"
          value={dashboard?.matchedCandidates ?? 0}
          icon={Users}
          className="start-border-left-green"
          iconBackground={'start-background-color-green'}
        />
        <StatCard
          label="New applications"
          value={dashboard?.newApplications ?? 0}
          icon={Briefcase}
          hint="last 7 days"
          className="start-border-left-orange"
          iconBackground={'start-background-color-orange'}
        />
        <StatCard
          label="Avg. match quality"
          value={`${dashboard?.averageMatchQuality ?? 0}%`}
          icon={TrendingUp}
          className="start-border-left-teal"
          iconBackground={'start-background-color-teal'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 ">
        <div className="lg:col-span-2 panel p-5 card-border-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Matching activity
              </h2>
              <p className="text-xs text-muted-foreground">
                Matches vs. applications
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart
                data={matchingActivity}
                margin={{ left: -16, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {/* <Bar
                  dataKey="matches"
                  fill="hsl(var(--accent))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="applications"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                /> */}

                <Bar dataKey="matches" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="matches" content={<CustomValueLabel />} />
                  <Cell
                    key={`cell-matches`}
                    fill={chartsConfig.chartProvider.colors[0]}
                  />
                </Bar>
                <Bar dataKey="applications" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="applications"
                    content={<CustomValueLabel />}
                  />
                  <Cell
                    key={`cell-applications`}
                    fill={chartsConfig.chartProvider.colors[1]}
                  />
                  <Cell
                    key={`cell-applications`}
                    fill={chartsConfig.chartProvider.colors[1]}
                  />
                </Bar>

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5 card-border-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Top offers by visibility
            </h2>
            <Link
              to="/provider/offers"
              className="text-xs text-accent inline-flex items-center gap-1 rounded-md border border-border px-4 py-1 light-link-border-left-3"
            >
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {top.map((j) => (
              <li
                key={j.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <Link
                    to={`/provider/offers/${j.id}`}
                    className="text-sm font-medium text-foreground truncate hover:text-accent hover:underline block"
                  >
                    {j.title}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono">
                    {j.id} · {j.matched} matches
                  </p>
                </div>
                <StatusPill label={j.status} tone={statusToTone(j.status)} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel p-5 card-border-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Recent matched candidates
            </h2>
            <p className="text-xs text-muted-foreground">
              Across all your active offers
            </p>
          </div>
          <Link
            to="/provider/candidates"
            className="text-xs text-center text-accent inline-flex items-center gap-1 rounded-md border border-border px-4 py-1 light-link-border-left-20"
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-2.5">Candidate</th>
                <th className="text-left font-medium px-2 py-2.5">Role</th>
                <th className="text-left font-medium px-2 py-2.5">Location</th>
                <th className="text-left font-medium px-2 py-2.5">Status</th>
                <th className="text-left font-medium px-2 py-2.5">Score</th>
                <th className="text-right font-medium px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {c.initials}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {c.name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {c.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs text-foreground">
                    {c.occupation}
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {c.location}
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill
                      label={c.status}
                      tone={statusToTone(c.status)}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <ScoreBadge score={c.score} size="sm" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/provider/candidates/${c.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
