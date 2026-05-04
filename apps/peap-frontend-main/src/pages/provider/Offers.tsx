import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus, Search } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { InlineTableSkeleton } from '@/components/common/PageSkeletons';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearchParamState } from '@/hooks/use-search-param-state';
import { useProviderOffersQuery } from '@/services/api/queries';

export default function Offers() {
  const {
    data: jobs = [],
    isLoading,
    isError,
    error,
  } = useProviderOffersQuery();
  const [search, setSearch] = useSearchParamState();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('recent');

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        job.anetiIdentifier,
        job.id,
        job.title,
        job.location,
        job.contract,
        job.company,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });

    const sorted = [...filtered];
    if (sortMode === 'recent') {
      sorted.sort((a, b) => a.postedDays - b.postedDays);
    } else if (sortMode === 'matches') {
      sorted.sort((a, b) => b.matched - a.matched);
    } else if (sortMode === 'applicants') {
      sorted.sort((a, b) => b.applicants - a.applicants);
    }

    return sorted;
  }, [jobs, search, statusFilter, sortMode]);

  const formatPosted = (postedDays: number) => {
    if (postedDays === 0) return 'Today';
    if (postedDays === 1) return '1 day ago';
    return `${postedDays} days ago`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Offers"
        description={`${jobs.length} offers across your organization`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/provider/offers/search">
                <Search className="mr-1.5 h-4 w-4" />
                Search candidates
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Link to="/provider/offers/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New offer
              </Link>
            </Button>
          </div>
        }
      />

      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search offers..."
            className="h-9 bg-primary pl-9 text-muted input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Paused">Paused</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortMode} onValueChange={setSortMode}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Les plus récents</SelectItem>
            <SelectItem value="matches">Les mieux identifiés</SelectItem>
            <SelectItem value="applicants">Le plus de candidatures</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {isLoading && <InlineTableSkeleton columns={9} rows={7} />}
        {isError && (
          <div className="px-4 py-4 text-sm text-destructive">
            Failed to load offers:{' '}
            {error instanceof Error ? error.message : 'unknown error'}
          </div>
        )}
        {!isLoading && !isError && filteredJobs.length === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            No offers match the selected filters.
          </div>
        )}
        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                  <th className="px-2 py-2 text-left font-medium">
                    Identifiant ANETI
                  </th>
                  <th className="px-4 py-3 text-left font-medium ">Offer</th>
                  <th className="px-2 py-3 text-left font-medium">Status</th>
                  <th className="px-2 py-3 text-left font-medium">Posted</th>
                  <th className="px-2 py-3 text-left font-medium">Location</th>
                  <th className="px-2 py-3 text-left font-medium">Contract</th>
                  <th className="px-2 py-3 text-right font-medium">Matched</th>
                  <th className="px-2 py-3 text-right font-medium">
                    Applicants
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-muted">
                    <td className="px-2 align-center text-[11px] font-mono text-muted-foreground">
                      {job.anetiIdentifier ?? '-'}
                    </td>
                    <td className="px-2 py-3 align-center ">
                      <Link
                        to={`/provider/offers/${job.id}`}
                        className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.company}
                      </p>
                    </td>

                    <td className="px-2 py-3 align-center">
                      <StatusPill
                        label={job.status}
                        tone={statusToTone(job.status)}
                      />
                    </td>
                    <td className="px-2 py-3 align-center text-xs text-muted-foreground">
                      {formatPosted(job.postedDays)}
                    </td>
                    <td className="px-2 py-3 align-center text-xs text-muted-foreground">
                      {job.location}
                    </td>
                    <td className="px-2 py-3 align-center text-xs text-foreground">
                      {job.contract}
                    </td>
                    <td className="px-2 py-3 align-center text-right text-sm font-mono text-foreground">
                      {job.matched}
                    </td>
                    <td className="px-2 py-3 align-center text-right text-sm font-mono text-muted-foreground">
                      {job.applicants}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/provider/offers/${job.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
