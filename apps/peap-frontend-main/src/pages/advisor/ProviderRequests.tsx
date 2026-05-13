import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { TablePageSkeleton } from "@/components/common/PageSkeletons";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { useAdvisorProviderRegistrationRequestsQuery } from "@/services/api/queries";

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export default function ProviderRequests() {
  const [search, setSearch] = useSearchParamState();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, status]);

  const { data, isLoading, isError, error, isFetching } = useAdvisorProviderRegistrationRequestsQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch,
    status: status === "all" ? undefined : status,
  });

  const requests = data?.items ?? [];
  const total = data?.total ?? data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return <TablePageSkeleton controls={2} columns={6} rows={8} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Registration Requests"
        description={`${total.toLocaleString()} requests from audit.provider_registration_request`}
        actions={(
          <Button asChild size="sm" variant="outline">
            <Link to="/advisor/users">Back to users</Link>
          </Button>
        )}
      />

      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company, contact, email, phone or request id..."
            className="h-9 pl-9 bg-surface-muted"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {isError && (
          <div className="px-4 py-4 text-sm text-destructive">
            Failed to load provider requests: {error instanceof Error ? error.message : "unknown error"}
          </div>
        )}
        {!isLoading && !isError && requests.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground">No provider registration requests match the selected filters.</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                <th className="text-left font-medium px-4 py-3">Request</th>
                <th className="text-left font-medium px-2 py-3">Company</th>
                <th className="text-left font-medium px-2 py-3">Contact</th>
                <th className="text-left font-medium px-2 py-3">Hiring needs</th>
                <th className="text-left font-medium px-2 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-surface-muted align-top">
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-muted-foreground">{request.id}</p>
                    <p className="mt-1 text-sm text-foreground">{request.email}</p>
                    <p className="text-xs text-muted-foreground">{request.phone}</p>
                  </td>
                  <td className="px-2 py-3">
                    <p className="text-sm font-medium text-foreground">{request.companyName}</p>
                    <p className="text-xs text-muted-foreground">{request.companySize}</p>
                    {request.website && <p className="text-xs text-muted-foreground">{request.website}</p>}
                  </td>
                  <td className="px-2 py-3">
                    <p className="text-sm text-foreground">{request.contactName}</p>
                    <p className="text-xs text-muted-foreground">{request.jobTitle}</p>
                  </td>
                  <td className="px-2 py-3">
                    <p className="line-clamp-3 max-w-md text-sm text-foreground">{request.hiringNeeds}</p>
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill label={request.status} tone={requestStatusTone(request.status)} dot={false} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{formatDate(request.createdAt)}</td>
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
    </div>
  );
}

function requestStatusTone(status: string): "info" | "accent" | "warning" | "destructive" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") return "accent";
  if (normalized === "rejected") return "destructive";
  if (normalized === "reviewed") return "info";
  if (normalized === "pending") return "warning";
  return "neutral";
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
}
