import { useRef, type ReactNode } from 'react';
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
  useProviderApplicationsQuery,
  useProviderOfferQuery,
} from '@/services/api/queries';
import { queryKeys } from '@/services/api/queryKeys';
import {
  ArrowLeft,
  Brain,
  Download,
  MapPin,
  Trash2,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PdfContent from '@/components/common/PdfContent';

type RawRequirement = {
  criterionType?: string | null;
  rawValue?: string | null;
  nodeLabel?: string | null;
  minYears?: number | null;
  minLevel?: string | null;
  isMust?: boolean;
};

type RawProviderOffer = {
  id?: string;
  companyName?: string | null;
  employerName?: string | null;
  title?: string | null;
  description?: string | null;
  numberOfPositions?: number | null;
  contractType?: string | null;
  workMode?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  country?: string | null;
  locationLabel?: string | null;
  governorateLabel?: string | null;
  delegationLabel?: string | null;
  publishedAt?: string | null;
  deadlineAt?: string | null;
  requirements?: RawRequirement[];
};

function formatPublishedAgo(days?: number | null) {
  if (days == null || Number.isNaN(days)) return 'Non précisée';
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Non précisée';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Non précisée';

  return parsed.toLocaleDateString('fr-FR');
}

function formatSalary(min?: number | null, max?: number | null) {
  if (min == null && max == null) return 'Non précisé';
  if (min != null && max != null) return `${min} - ${max} TND`;
  if (min != null) return `À partir de ${min} TND`;
  return `Jusqu’à ${max} TND`;
}

function isNumericText(value: string) {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function cleanSkillList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isNumericText(value))
    .filter((value) => value.toLowerCase() !== 'offre sans titre');
}

function getExperienceYears(
  offer: RawProviderOffer | undefined,
  required: string[],
  preferred: string[],
) {
  const requirements = offer?.requirements ?? [];

  const fromRequirement = requirements.find((requirement) => {
    const type = String(requirement.criterionType ?? '').toUpperCase();
    return type.includes('EXPERIENCE') || requirement.minYears != null;
  });

  if (fromRequirement?.minYears != null) {
    return fromRequirement.minYears;
  }

  const numericValue = [...required, ...preferred].find((value) =>
    isNumericText(value),
  );

  if (numericValue) {
    return Number(numericValue);
  }

  return null;
}

function normalizeWorkMode(value?: string | null) {
  switch (String(value ?? '').toUpperCase()) {
    case 'ONSITE':
      return 'Sur site';
    case 'REMOTE':
      return 'À distance';
    case 'HYBRID':
      return 'Hybride';
    case 'MOBILE':
      return 'Mobile';
    case 'UNKNOWN':
    case '':
      return 'Non précisé';
    default:
      return value ?? 'Non précisé';
  }
}

function normalizeContract(value?: string | null) {
  if (!value) return 'Non précisé';
  return value.toUpperCase();
}

function getApplicationDisplayName(application: {
  candidateName?: string | null;
  candidateEmail?: string | null;
  jobSeekerId: string;
}) {
  const name = application.candidateName?.trim();

  if (name) return name;

  if (application.candidateEmail?.trim()) {
    return application.candidateEmail.trim();
  }

  return `Candidat ${application.jobSeekerId.slice(0, 8)}`;
}

function getApplicationStatusTone(status: string) {
  switch (status.toUpperCase()) {
    case 'APPLIED':
      return 'info';
    case 'VIEWED':
      return 'neutral';
    case 'SHORTLISTED':
      return 'success';
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
      return 'destructive';
    case 'WITHDRAWN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function OfferDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useProviderOfferQuery(id);
  const applicationsQuery = useProviderApplicationsQuery();
  const deleteMutation = useDeleteProviderOfferMutation();

  const offer = data?.offer;
  const rawOffer = data?.raw as RawProviderOffer | undefined;

  const allApplications = applicationsQuery.data ?? [];
  const applications = offer
    ? allApplications.filter((application) => application.offerId === offer.id)
    : [];

  const candidates = data?.candidates ?? [];

  const requiredSkills = offer ? cleanSkillList(offer.required) : [];
  const preferredSkills = offer ? cleanSkillList(offer.preferred) : [];
  const experienceYears = offer
    ? getExperienceYears(rawOffer, offer.required, offer.preferred)
    : null;

  const applicationsCount = applicationsQuery.isSuccess
    ? applications.length
    : (offer?.applicants ?? 0);

  const matchedCount = offer?.matched ?? candidates.length;

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
        title: 'Offre supprimée',
        description: "L'offre a été retirée de l'espace employeur.",
      });

      navigate('/provider/offers');
    } catch (caught) {
      toast({
        title: 'Suppression impossible',
        description:
          caught instanceof Error
            ? caught.message
            : 'Impossible de supprimer cette offre.',
        variant: 'destructive',
      });
    }
  };

  const pdfRef = useRef();
  const handleGeneratePdf = async () => {
    if (!pdfRef.current) return;

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    // ===== Margins (mm)
    const margin = {
      top: 5,
      bottom: 5,
      left: 10,
      right: 10,
    };

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;

    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin.top;

    // First page
    pdf.addImage(
      imgData,
      'PNG',
      margin.left,
      position,
      contentWidth,
      imgHeight,
    );

    heightLeft -= contentHeight;

    // Extra pages
    while (heightLeft > 0) {
      pdf.addPage();
      position = margin.top - (imgHeight - heightLeft);

      pdf.addImage(
        imgData,
        'PNG',
        margin.left,
        position,
        contentWidth,
        imgHeight,
      );

      heightLeft -= contentHeight;
    }

    pdf.save(`rapport-${id}.pdf`);
  };

  if (isLoading) {
    return <InlineTableSkeleton columns={5} rows={6} />;
  }

  if (isError || !offer) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/provider/offers">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour aux offres
          </Link>
        </Button>

        <div className="panel p-5 text-sm text-destructive">
          Impossible de charger l’offre :{' '}
          {error instanceof Error ? error.message : 'offre introuvable'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/provider/offers"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs text-muted-foreground light-link-md-border-right-orange"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux offres
      </Link>

      <PageHeader
        title={offer.title}
        description={`${offer.company} · ${offer.location} · ${offer.contract}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGeneratePdf}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Télécharger PDF
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette offre ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action retirera l’offre du tableau de bord employeur.
                    Les candidatures et historiques de matching restent
                    conservés.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-border-top lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Détails de l’offre
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 text-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Info
                label="Statut"
                value={
                  <StatusPill
                    label={offer.status}
                    tone={statusToTone(offer.status)}
                  />
                }
              />

              <Info
                label="ID de l’offre"
                value={
                  <span className="font-mono text-sm font-bold">
                    {offer.anetiIdentifier ?? offer.id}
                  </span>
                }
              />

              <Info
                label="Entreprise"
                value={rawOffer?.companyName ?? offer.company ?? 'Non précisée'}
              />

              <Info
                label="Contrat"
                value={normalizeContract(
                  rawOffer?.contractType ?? offer.contract,
                )}
              />

              <Info
                label="Mode de travail"
                value={normalizeWorkMode(rawOffer?.workMode ?? offer.level)}
              />

              <Info
                label="Localisation"
                value={rawOffer?.locationLabel ?? offer.location}
              />

              <Info
                label="Nombre de postes"
                value={`${rawOffer?.numberOfPositions ?? 1} poste(s)`}
              />

              <Info
                label="Expérience minimale"
                value={
                  experienceYears == null
                    ? 'Non précisée'
                    : `${experienceYears} an${experienceYears > 1 ? 's' : ''}`
                }
              />

              <Info
                label="Salaire"
                value={formatSalary(rawOffer?.salaryMin, rawOffer?.salaryMax)}
              />

              <Info
                label="Publiée"
                value={formatPublishedAgo(offer.postedDays)}
              />

              <Info
                label="Date limite"
                value={formatDate(rawOffer?.deadlineAt)}
              />
            </div>

            {rawOffer?.description ? (
              <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                  {rawOffer.description}
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-bold text-foreground">
                Compétences obligatoires
              </p>

              <div className="flex flex-wrap gap-1.5">
                {requiredSkills.length ? (
                  requiredSkills.map((skill) => (
                    <SkillTag key={skill} label={skill} />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Aucune compétence obligatoire trouvée.
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-foreground">
                Compétences préférées
              </p>

              <div className="flex flex-wrap gap-1.5">
                {preferredSkills.length ? (
                  preferredSkills.map((skill) => (
                    <SkillTag key={skill} label={skill} variant="outline" />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Aucune compétence préférée trouvée.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-border-top">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="h-4 w-4" />
              Candidats
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <Info
              label="Candidats correspondants"
              value={<span className="text-xl font-black">{matchedCount}</span>}
            />

            <Info
              label="Applications"
              value={
                <span className="text-xl font-black">{applicationsCount}</span>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="panel overflow-hidden card-border-top-orange">
        <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Candidats liés à cette offre
            </h2>
            <p className="text-xs text-muted-foreground">
              Candidats ayant postulé ou candidats proposés par le matching.
            </p>
          </div>

          <Button asChild type="button" variant="outline" size="sm">
            <Link
              to={`/provider/offers/search/offer?offerId=${encodeURIComponent(offer.id)}`}
            >
              <Brain className="mr-1.5 h-4 w-4" />
              Candidats matchés
            </Link>
          </Button>
        </div>

        {applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-bold">Candidat</th>
                  <th className="px-2 py-3 text-left font-bold">Contact</th>
                  <th className="px-2 py-3 text-left font-bold">Statut</th>
                  <th className="px-2 py-3 text-left font-bold">
                    Date candidature
                  </th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {applications.map((application) => (
                  <tr key={application.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">
                        {getApplicationDisplayName(application)}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {application.jobSeekerId}
                      </p>
                    </td>

                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      <div className="space-y-1">
                        <p>
                          {application.candidateEmail ?? 'Email non précisé'}
                        </p>
                        <p>
                          {application.candidatePhone ??
                            'Téléphone non précisé'}
                        </p>
                      </div>
                    </td>

                    <td className="px-2 py-3">
                      <StatusPill
                        label={application.status}
                        tone={getApplicationStatusTone(application.status)}
                      />
                    </td>

                    <td className="px-2 py-3 text-xs font-medium text-foreground">
                      {formatDate(application.appliedAt)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to={`/provider/candidates/${application.jobSeekerId}`}
                        >
                          Voir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : candidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-bold">Candidat</th>
                  <th className="px-2 py-3 text-left font-bold">Métier</th>
                  <th className="px-2 py-3 text-left font-bold">
                    Localisation
                  </th>
                  <th className="px-2 py-3 text-left font-bold">Score</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">
                        {candidate.name}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {candidate.id}
                      </p>
                    </td>

                    <td className="px-2 py-3 text-xs font-medium text-foreground">
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
                          Voir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            Aucun candidat lié à cette offre pour le moment.
          </div>
        )}
      </div>
      <div
        ref={pdfRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '800px',
          background: 'white',
        }}
      >
        <PdfContent
          offer={offer}
          matched={offer.matched}
          applications={offer.applicants}
          candidates={candidates}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div className="mt-2 text-base font-extrabold text-foreground">
        {value}
      </div>
    </div>
  );
}
