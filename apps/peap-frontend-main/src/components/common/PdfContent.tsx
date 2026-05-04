import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import myImage from '@/assets/ANETI-RAW-LOGO.png';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CustomTooltip, CustomValueLabel } from './ReCharts';
import { useMemo } from 'react';
import { mockDataChart } from '@/mocks/mockParsedCv';
import { ScoreBadge } from './ScoreBadge';

const PdfContent = ({ offer, candidates, matched = 40, applications = 60 }) => {
  const chartData = useMemo(() => {
    return mockDataChart;
  }, []);

  const total = matched + applications;
  const recommendedPct =
    total > 0 ? Math.round((applications / total) * 100) : 0;

  const data = useMemo(
    () => [
      {
        name: 'Condidats Réelles',
        value: matched,
        color: 'hsl(var(--accent))',
      },
      {
        name: 'Condidats Correspondants',
        value: applications,
        color: 'hsl(var(--primary))',
      },
    ],
    [matched, applications],
  );

  const centerValue = `${recommendedPct}%`;
  return (
    <div className="space-y-6">
      <article className="panel-elevated overflow-hidden card-border-top">
        <header className="border-b border-border bg-surface">
          <div className="relative mx-auto max-w-7xl px-6 h-16 flex items-center justify-center">
            <div className="flex items-center gap-2.5 ">
              <div className="">
                <img
                  src={myImage}
                  alt="Logo"
                  className="h-12 w-full object-contain object-left"
                />
              </div>
            </div>
          </div>
        </header>
        <div className="border-b border-border bg-gradient-to-br from-primary/[0.06] via-background to-accent-soft/50 px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {offer.anetiIdentifier}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-4xl mb-5 max-w-md">
                {offer.title}
              </h1>
              <p className="text-xs mt-1 font-medium text-muted-foreground">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span> {offer.location}</span>
                </div>
              </p>
              {/* <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                Voluptates enim ab cum vitae sapiente, consectetur perferendis
                tempore officia quas perspiciatis magnam quaerat rerum! Autem
                cumque suscipit sed officia perspiciatis hic.
              </p> */}
            </div>
            <div className="flex flex-col gap-4 items-center justify-center rounded-2xl border border-border bg-background p-4 profile-border-left-orange">
              <span>
                <p className="text-xs uppercase text-muted-foreground font-meduim">
                  Performance Candidats (Avg)
                </p>
              </span>
              <div className="flex gap-4 items-center justify-center">
                <PercentageScore
                  color="hsl(var(--primary))"
                  score={applications}
                  size={80}
                  stroke={6}
                  label="Avg. Réelles"
                />
                <PercentageScore
                  color="hsl(var(--accent))"
                  score={matched}
                  size={80}
                  stroke={6}
                  label="Avg. Correspondants"
                />
              </div>
            </div>
          </div>
        </div>
      </article>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 panel p-5 card-border-top">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Performance des offres
              </h2>
              <p className="text-xs text-muted-foreground">
                Candidats correspondants vs candidatures réelles
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ left: -16, right: 8, top: 20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="offerId"
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
                <Bar
                  dataKey="matches"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                >
                  <LabelList
                    dataKey="matches"
                    content={<CustomValueLabel color="hsl(var(--primary))" />}
                  />
                </Bar>

                <Bar
                  dataKey="applications"
                  fill="hsl(var(--accent))"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                >
                  <LabelList
                    dataKey="applications"
                    content={<CustomValueLabel color="hsl(var(--accent))" />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={cn('panel p-5 card-border-top')}>
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-foreground">
              Répartition des candidats
            </h2>
            <p className="text-xs text-muted-foreground">
              Tous vs. postulez pour votre offre
            </p>
          </div>

          <div className="relative h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-in-out"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => {
                    const pct =
                      total > 0 ? Math.round((value / total) * 100) : 0;
                    return [`${value} (${pct}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                {centerValue}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Postulés
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-primary"
                  aria-hidden
                />
                <span className="text-foreground">Toutes les matches</span>
              </div>
              <span className="font-mono tabular-nums text-muted-foreground">
                {matched} ·{' '}
                {total > 0 ? Math.round((matched / total) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-accent"
                  aria-hidden
                />
                <span className="text-foreground">Candidats poslulés</span>
              </div>
              <span className="font-mono tabular-nums text-muted-foreground">
                {applications} · {recommendedPct}%
              </span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              {applications} candidats sur {total} ont postulé pour cette offre.
            </p>
          </div>
        </div>
      </div>
      <div className="panel overflow-hidden card-border-top-orange">
        <div className="px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Candidates linked to this offer
            </h2>
            <p className="text-xs text-muted-foreground">
              Applied candidates with their score and profile preview.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                <th className="text-left font-medium px-4 py-3">Candidate</th>
                <th className="text-left font-medium px-2 py-3">Occupation</th>
                <th className="text-left font-medium px-2 py-3">Location</th>
                <th className="text-left font-medium px-2 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates?.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {candidate.name}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {candidate.id}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-xs text-foreground">
                    {candidate.occupation}
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {candidate.location}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <ScoreBadge score={candidate.score} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface PercentageScoreProps {
  score: string;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  className?: string;
  textSize?: string;
  color?: string;
  label?: string;
}

function PercentageScore({
  score,
  size = 96,
  stroke = 8,
  showLabel = true,
  textSize = 'text-xl',
  className,
  color,
  label,
}: PercentageScoreProps) {
  const clamped = score;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="stroke-muted"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke={color}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            style={{ transition: 'stroke-dashoffset 800ms ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono font-semibold text-foreground tabular-nums ${textSize}`}
          >
            {clamped}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

export default PdfContent;
