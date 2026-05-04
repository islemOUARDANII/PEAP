import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { InlineTableSkeleton } from '@/components/common/PageSkeletons';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/app/queryClient';
import {
  useDeleteProviderOfferMutation,
  useProviderOfferQuery,
} from '@/services/api/queries';
import { queryKeys } from '@/services/api/queryKeys';
import { ArrowLeft, Brain, MapPin, Trash2, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { mockCandidates } from '@/mocks/mockParsedCv';

export default function OfferDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useProviderOfferQuery(id);
  const deleteMutation = useDeleteProviderOfferMutation();

  const offer = data?.offer;
  // const candidates = data?.candidates ?? mockCandidates;
  //! TODO : REMOVE ME
  const candidates = data?.candidates ?? [];

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.provider.offers(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.provider.dashboard(),
      });
      toast({
        title: 'Offer deleted',
        description: 'The offer has been removed from the provider dashboard.',
      });
      navigate('/provider/offers');
    } catch (caught) {
      toast({
        title: 'Delete failed',
        description:
          caught instanceof Error
            ? caught.message
            : 'Unable to delete this offer.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <InlineTableSkeleton columns={5} rows={6} />;
  }

  if (isError || !offer) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/provider/offers">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to offers
          </Link>
        </Button>
        <div className="panel p-5 text-sm text-destructive">
          Failed to load offer:{' '}
          {error instanceof Error ? error.message : 'offer not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/provider/offers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-md border border-border px-4 py-2 light-link-md-border-right-orange"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to offers
      </Link>
      <PageHeader
        title={offer.title}
        description={`${offer.company} · ${offer.location} · ${offer.contract}`}
        actions={
          <div className="flex items-center gap-2">
            {/* <Button asChild variant="outline" size="sm">
              <Link to="/provider/offers">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Link>
            </Button> */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the offer from the provider dashboard.
                    Candidate data and match history remain stored for
                    auditability.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete offer'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 card-border-top">
          <CardHeader>
            <CardTitle className="text-sm">Offer details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Info
                label="Status"
                value={
                  <StatusPill
                    label={offer.status}
                    tone={statusToTone(offer.status)}
                  />
                }
              />
              <Info
                label="Offer ID"
                value={<span className="font-mono text-xs">{offer.anetiIdentifier ?? '—'}</span>}
              />
              <Info label="Level" value={offer.level || 'N/A'} />
              <Info label="Posted" value={`${offer.postedDays}d ago`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Required skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {offer.required.length ? (
                  offer.required.map((skill) => (
                    <SkillTag key={skill} label={skill} />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No required skills found.
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preferred skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {offer.preferred.length ? (
                  offer.preferred.map((skill) => (
                    <SkillTag key={skill} label={skill} variant="outline" />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No preferred skills found.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-border-top">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Info label="Matched candidates" value={offer.matched} />
            <Info label="Applications" value={offer.applicants} />
            <p className="text-xs text-muted-foreground">
              For now this list is built from match results. When a real
              application table is added, this page can switch to true
              applicants.
            </p>
          </CardContent>
        </Card>
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
          <Button asChild type="button" variant="outline" size="sm">
            <Link to={`/provider/offers/search/offer?offerId=${encodeURIComponent(offer.id)}`}>
              <Brain className="h-4 w-4 mr-1.5" />
              Candidats matchés
            </Link>
          </Button>
        </div>
        {candidates.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            No candidate has been linked to this offer yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border bg-surface-muted">
                  <th className="text-left font-medium px-4 py-3">Candidate</th>
                  <th className="text-left font-medium px-2 py-3">
                    Occupation
                  </th>
                  <th className="text-left font-medium px-2 py-3">Location</th>
                  <th className="text-left font-medium px-2 py-3">Score</th>
                  <th className="text-right font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((candidate) => (
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
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/provider/candidates/${candidate.id}`}>
                          View
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

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
