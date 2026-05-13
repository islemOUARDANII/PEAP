import { Skeleton } from "@/components/ui/skeleton";

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 gap-2">
          {range(actions).map((item) => (
            <Skeleton key={item} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCardsSkeleton({ count = 4, className = "lg:grid-cols-4" }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}>
      {range(count).map((item) => (
        <div key={item} className="panel p-5">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8" />
          </div>
          <div className="mt-5 flex items-end justify-between">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="mt-4 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function ChartPanelSkeleton({ className = "", height = "h-56" }: { className?: string; height?: string }) {
  return (
    <div aria-hidden className={`panel p-5 ${className}`}>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-48" />
      <div className={`mt-5 rounded-md border border-border bg-surface-muted/60 p-4 ${height}`}>
        <div className="flex h-full items-end gap-2">
          {range(12).map((item) => (
            <Skeleton
              key={item}
              className="flex-1 rounded-sm"
              style={{ height: `${28 + ((item * 17) % 58)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterBarSkeleton({ controls = 3 }: { controls?: number }) {
  return (
    <div aria-hidden className="panel p-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 min-w-[220px] flex-1" />
      {range(controls).map((item) => (
        <Skeleton key={item} className="h-9 w-36" />
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {range(count).map((item) => (
        <div key={item} className="panel p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-7 w-12" />
          </div>
          <Skeleton className="mt-5 h-4 w-44" />
          <Skeleton className="mt-3 h-3 w-56 max-w-full" />
          <div className="mt-5 flex flex-wrap gap-1.5">
            {range(4).map((chip) => (
              <Skeleton key={chip} className="h-6 w-16" />
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-3 flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListPanelSkeleton({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="divide-y divide-border">
        {range(rows).map((item) => (
          <div key={item} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-7 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="panel p-5">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-48" />
      <div className="mt-5 space-y-4">
        {range(rows).map((item) => (
          <div key={item}>
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ columns = 6, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div aria-hidden className="panel overflow-hidden">
      <div className="border-b border-border bg-surface-muted px-4 py-3">
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              {range(columns).map((item) => (
                <th key={item} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {range(rows).map((row) => (
              <tr key={row}>
                {range(columns).map((column) => (
                  <td key={column} className="px-4 py-3">
                    <Skeleton className={column === 0 ? "h-4 w-40" : "h-4 w-24"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InlineTableSkeleton({ columns = 6, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div aria-hidden className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            {range(columns).map((item) => (
              <th key={item} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {range(rows).map((row) => (
            <tr key={row}>
              {range(columns).map((column) => (
                <td key={column} className="px-4 py-3">
                  <Skeleton className={column === 0 ? "h-4 w-40" : "h-4 w-24"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailHeroSkeleton({ withBackLink = false }: { withBackLink?: boolean }) {
  return (
    <div aria-hidden className="space-y-4">
      {withBackLink && <Skeleton className="h-4 w-32" />}
      <div className="panel-elevated p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-6 w-72 max-w-full" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
    </div>
  );
}

function SideWidgetsSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      {range(3).map((panel) => (
        <div key={panel} className="panel p-5">
          <Skeleton className="h-4 w-28" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {range(panel === 0 ? 8 : 4).map((item) => (
              <Skeleton key={item} className="h-6 w-16" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CandidateDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <MetricCardsSkeleton count={4} className="lg:grid-cols-4" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListPanelSkeleton className="lg:col-span-2" rows={4} />
        <ProgressPanelSkeleton rows={5} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartPanelSkeleton className="lg:col-span-2" height="h-56" />
        <ListPanelSkeleton rows={4} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListPanelSkeleton rows={3} />
        <ListPanelSkeleton rows={3} />
        <ListPanelSkeleton rows={4} />
      </div>
    </div>
  );
}

export function ProviderDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <MetricCardsSkeleton count={4} className="lg:grid-cols-4" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartPanelSkeleton className="lg:col-span-2" height="h-64" />
        <ListPanelSkeleton rows={5} />
      </div>
      <TableSkeleton columns={6} rows={5} />
    </div>
  );
}

export function AdvisorDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <MetricCardsSkeleton count={5} className="lg:grid-cols-5" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartPanelSkeleton className="lg:col-span-2" height="h-64" />
        <ChartPanelSkeleton height="h-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartPanelSkeleton height="h-56" />
        <ChartPanelSkeleton height="h-56" />
      </div>
      <ListPanelSkeleton rows={4} />
    </div>
  );
}

export function CardListPageSkeleton({ controls = 3, cards = 6 }: { controls?: number; cards?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={controls} />
      <CardGridSkeleton count={cards} />
    </div>
  );
}

export function ProviderCandidatesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={2} />
      {range(2).map((group) => (
        <section key={group} aria-hidden className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <CardGridSkeleton count={3} />
        </section>
      ))}
    </div>
  );
}

export function TablePageSkeleton({ controls = 3, columns = 6, rows = 6 }: { controls?: number; columns?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={controls} />
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}

export function CandidateProfileSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div aria-hidden className="panel p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {range(4).map((item) => (
              <Skeleton key={item} className="h-4 w-full" />
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-7 w-56" />
          </div>
        </div>
        <div aria-hidden className="panel p-5 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {range(4).map((tab) => (
              <Skeleton key={tab} className="h-9 w-24" />
            ))}
          </div>
          <div className="mt-6 space-y-5">
            {range(3).map((section) => (
              <div key={section}>
                <Skeleton className="h-3 w-28" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {range(7).map((chip) => (
                    <Skeleton key={chip} className="h-6 w-16" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="panel p-5">
        <Skeleton className="h-3 w-36" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {range(6).map((item) => (
            <div key={item}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <ListPanelSkeleton rows={3} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <DetailHeroSkeleton withBackLink />
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ProgressPanelSkeleton rows={4} />
          <ListPanelSkeleton rows={3} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListPanelSkeleton rows={2} />
            <ListPanelSkeleton rows={2} />
          </div>
        </div>
        <SideWidgetsSkeleton />
      </div>
    </div>
  );
}

export function RecommendationsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListPanelSkeleton rows={4} />
        <ListPanelSkeleton rows={4} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListPanelSkeleton rows={2} />
        <ListPanelSkeleton rows={3} />
      </div>
      <ListPanelSkeleton rows={4} />
    </div>
  );
}

export function TaxonomyPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <MetricCardsSkeleton count={6} className="xl:grid-cols-6" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartPanelSkeleton />
        <ChartPanelSkeleton />
        <ChartPanelSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div aria-hidden className="panel flex flex-col overflow-hidden xl:col-span-5">
          <div className="border-b border-border p-3 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="divide-y divide-border">
            {range(8).map((row) => (
              <div key={row} className="flex gap-3 p-3">
                <Skeleton className="h-8 w-8" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-36 max-w-full" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className="panel overflow-hidden xl:col-span-7">
          <div className="border-b border-border p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-6 w-72 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              {range(4).map((tab) => (
                <Skeleton key={tab} className="h-9 w-20" />
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {range(8).map((row) => (
                <div key={row} className="flex items-center justify-between border-b border-border pb-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <TableSkeleton columns={7} rows={5} />
    </div>
  );
}

export function PipelinePageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <MetricCardsSkeleton count={6} className="xl:grid-cols-6" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ChartPanelSkeleton />
        <ChartPanelSkeleton className="lg:col-span-2" />
        <ChartPanelSkeleton />
      </div>
      <ChartPanelSkeleton />
      <FilterBarSkeleton controls={2} />
      <TableSkeleton columns={6} rows={7} />
    </div>
  );
}

export function DataExplorerSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={0} />
      <div aria-hidden>
        <div className="flex flex-wrap gap-2">
          {range(5).map((tab) => (
            <Skeleton key={tab} className="h-9 w-32" />
          ))}
        </div>
        <div className="mt-4">
          <TableSkeleton columns={4} rows={7} />
        </div>
      </div>
    </div>
  );
}

export function InlineRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-2">
      {range(rows).map((row) => (
        <Skeleton key={row} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function InlineChipsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {range(count).map((chip) => (
        <Skeleton key={chip} className="h-6 w-16" />
      ))}
    </div>
  );
}

export { CardGridSkeleton, InlineTableSkeleton, TableSkeleton };
