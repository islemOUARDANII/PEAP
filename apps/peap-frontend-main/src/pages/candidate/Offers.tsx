import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  Loader2,
  MapPin,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import ErrorCard from '@/components/common/ErrorCard';
import LoadingCard from '@/components/common/LoadingCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { gatewayApi, type MatchingResultDetailRecord } from '@/services/api/gateway';
import { queryKeys } from '@/services/api/queryKeys';
import {
  candidateMatchingUnavailableMessage,
  getCandidateMatchingOffers,
} from '@/services/candidate/candidateMatchingOffers';
import { getStoredCandidateMinimumOfferScore } from '@/services/candidate/candidatePortalPreferences';

const cleanText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (
    /^(non specifie|non spécifié|not specified|null|undefined|n\/a)$/i.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
};

const formatDate = (value: string | null | undefined): string | null => {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('fr-FR');
};

const formatScore = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${value <= 1 ? Math.round(value * 100) : Math.round(value)}%`;
};

const formatCriterionLabel = (
  label: string | null | undefined,
  code: string | null | undefined,
): string => {
  const normalizedLabel = cleanText(label);
  if (normalizedLabel) {
    return normalizedLabel;
  }

  const normalizedCode = cleanText(code);
  if (!normalizedCode) {
    return 'Critère de matching';
  }

  return normalizedCode
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (part) => part.toUpperCase());
};

const formatListLabel = (values: string[], fallback: string): string =>
  values.length > 0 ? values.join(' • ') : fallback;

function OfferEmptyState() {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center card-border-top">
      <Sparkles className="h-8 w-8 text-accent" />
      <div>
        <p className="text-lg font-semibold text-foreground">
          Aucune offre compatible pour le moment.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Complétez votre profil pour améliorer vos recommandations.
        </p>
      </div>
    </div>
  );
}

function MatchingUnavailableState() {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center card-border-top">
      <Sparkles className="h-8 w-8 text-accent" />
      <div>
        <p className="text-lg font-semibold text-foreground">
          {candidateMatchingUnavailableMessage}
        </p>
      </div>
    </div>
  );
}

export default function CandidateOffers() {
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [appliedOfferIds, setAppliedOfferIds] = useState<string[]>([]);
  const minimumScore = useMemo(
    () => getStoredCandidateMinimumOfferScore(),
    [],
  );

  const bundleQuery = useQuery({
    queryKey: queryKeys.candidate.bundle(),
    queryFn: () => gatewayApi.candidate.getBundle(),
  });

  const matchingOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), bundleQuery.data?.id ?? 'none'],
    queryFn: () => getCandidateMatchingOffers(bundleQuery.data!.id),
    enabled: Boolean(bundleQuery.data?.id),
    staleTime: 5 * 60_000,
  });

  const matchingData = matchingOffersQuery.data;
  const matchingUnavailable =
    matchingData?.matchingAvailable === false || matchingOffersQuery.isError;

  const compatibleOffers = useMemo(
    () =>
      (matchingData?.offers ?? [])
        .filter((offer) => offer.scoreGlobal >= minimumScore)
        .sort((left, right) => right.scoreGlobal - left.scoreGlobal),
    [matchingData?.offers, minimumScore],
  );

  const selectedOffer =
    compatibleOffers.find((offer) => offer.matchingResultId === selectedOfferId) ??
    null;

  const offerDetailQuery = useQuery({
    queryKey: [
      ...queryKeys.candidate.match(selectedOfferId ?? undefined),
      'details',
    ],
    queryFn: () => gatewayApi.matching.getResult(selectedOfferId as string),
    enabled: Boolean(selectedOfferId),
    staleTime: 5 * 60_000,
  });

  const handleApply = () => {
    if (!selectedOfferId) {
      return;
    }

    setAppliedOfferIds((current) =>
      current.includes(selectedOfferId) ? current : [...current, selectedOfferId],
    );
    toast.success('Votre candidature a été enregistrée.');
  };

  if (bundleQuery.isLoading) {
    return <LoadingCard text="Chargement des offres compatibles..." />;
  }

  if (bundleQuery.isError) {
    return (
      <ErrorCard
        queryResult={bundleQuery}
        text="Impossible de charger les offres compatibles."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres compatibles"
        description="Consultez les offres qui correspondent à votre profil."
      />

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 card-border-top">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Seuil minimum actuel : {minimumScore}%
          </p>
          <p className="text-sm text-muted-foreground">
            {matchingUnavailable
              ? "Les offres seront affichées dès que le moteur de matching sera disponible."
              : `${compatibleOffers.length} offre(s) affichée(s) avec un score supérieur ou égal à votre seuil.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label={`${minimumScore}% minimum`} />
          <StatusChip
            label={
              matchingData?.activeOffersCount == null
                ? 'Total des offres actives indisponible'
                : `${matchingData.activeOffersCount} offres actives`
            }
          />
        </div>
      </div>

      {matchingOffersQuery.isLoading ? (
        <LoadingCard text="Chargement des offres compatibles..." />
      ) : matchingUnavailable ? (
        <MatchingUnavailableState />
      ) : compatibleOffers.length === 0 ? (
        <OfferEmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {compatibleOffers.map((offer) => {
            const publishedAt = formatDate(offer.publishedAt);
            const applied = appliedOfferIds.includes(offer.matchingResultId);

            return (
              <button
                key={offer.matchingResultId}
                type="button"
                onClick={() => setSelectedOfferId(offer.matchingResultId)}
                className="panel flex h-full flex-col p-5 text-left transition-colors hover:border-accent/40 hover:bg-surface-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {offer.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {offer.companyName}
                    </p>
                  </div>
                  <ScoreBadge score={offer.scoreGlobal} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {offer.location}
                  </span>
                  {offer.contractType ? <StatusChip label={offer.contractType} /> : null}
                  {offer.workMode ? <StatusChip label={offer.workMode} /> : null}
                </div>

                <p className="mt-4 line-clamp-4 text-sm leading-6 text-foreground/90">
                  {cleanText(offer.description) ??
                    'Aucune description disponible pour le moment.'}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {offer.skills.length > 0 ? (
                    offer.skills.slice(0, 6).map((skill) => (
                      <SkillTag
                        key={`${offer.matchingResultId}-${skill}`}
                        label={skill}
                        variant="matched"
                      />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aucune compétence renseignée.
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span>
                    {publishedAt ? `Publiée le ${publishedAt}` : 'Offre active'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-accent">
                    {applied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Candidature enregistrée
                      </>
                    ) : (
                      'Voir le détail'
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedOfferId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOfferId(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          {selectedOffer ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selectedOffer.title}</DialogTitle>
                <DialogDescription>{selectedOffer.companyName}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <DetailField
                  icon={MapPin}
                  label="Localisation"
                  value={selectedOffer.location}
                />
                <DetailField
                  icon={Briefcase}
                  label="Type de contrat"
                  value={selectedOffer.contractType ?? 'Non renseigné'}
                />
                <DetailField
                  icon={Sparkles}
                  label="Score de compatibilité"
                  value={`${selectedOffer.scoreGlobal}%`}
                />
                <DetailField
                  icon={Building2}
                  label="Entreprise"
                  value={selectedOffer.companyName}
                />
                {selectedOffer.workMode ? (
                  <DetailField
                    icon={Briefcase}
                    label="Mode de travail"
                    value={selectedOffer.workMode}
                  />
                ) : null}
                {selectedOffer.educationRequirements.length > 0 ? (
                  <DetailField
                    icon={GraduationCap}
                    label="Niveau d'éducation"
                    value={formatListLabel(
                      selectedOffer.educationRequirements,
                      'Non renseigné',
                    )}
                  />
                ) : null}
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                  {cleanText(selectedOffer.description) ??
                    'Aucune description disponible pour le moment.'}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Compétences demandées
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedOffer.skills.length > 0 ? (
                    selectedOffer.skills.map((skill) => (
                      <SkillTag
                        key={`${selectedOffer.matchingResultId}-${skill}`}
                        label={skill}
                        variant="matched"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune compétence détaillée pour le moment.
                    </p>
                  )}
                </div>
              </section>

              {selectedOffer.languages.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Langues demandées
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedOffer.languages.map((language) => (
                      <SkillTag
                        key={`${selectedOffer.matchingResultId}-${language}`}
                        label={language}
                        variant="outline"
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedOffer.educationRequirements.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Niveau d'éducation
                  </h3>
                  <p className="text-sm text-foreground/90">
                    {selectedOffer.educationRequirements.join(' • ')}
                  </p>
                </section>
              ) : null}

              {selectedOffer.experienceRequirements.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Expérience demandée
                  </h3>
                  <p className="text-sm text-foreground/90">
                    {selectedOffer.experienceRequirements.join(' • ')}
                  </p>
                </section>
              ) : null}

              {selectedOffer.companyDetails.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Informations sur l'entreprise
                  </h3>
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {selectedOffer.companyDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Pourquoi cette offre vous correspond
                  </h3>
                </div>

                {selectedOffer.explanationShort ? (
                  <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 text-sm text-foreground/90">
                    {selectedOffer.explanationShort}
                  </div>
                ) : null}

                {offerDetailQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des explications de matching...
                  </div>
                ) : offerDetailQuery.isError ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                    Les explications détaillées de matching sont indisponibles pour
                    le moment.
                  </div>
                ) : offerDetailQuery.data?.details.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {offerDetailQuery.data.details.slice(0, 6).map((detail) => (
                      <MatchingExplanationCard
                        key={detail.id}
                        detail={detail}
                      />
                    ))}
                  </div>
                ) : !selectedOffer.explanationShort ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                    Aucune explication complémentaire n'est disponible pour le
                    moment.
                  </div>
                ) : null}
              </section>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedOfferId(null)}
                >
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={
                    !selectedOfferId || appliedOfferIds.includes(selectedOfferId)
                  }
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {selectedOfferId && appliedOfferIds.includes(selectedOfferId)
                    ? 'Candidature enregistrée'
                    : 'Postuler'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 text-sm text-muted-foreground">
              Impossible de charger le détail de cette offre pour le moment.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-accent" />
        {value}
      </p>
    </div>
  );
}

function MatchingExplanationCard({
  detail,
}: {
  detail: MatchingResultDetailRecord;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {formatCriterionLabel(detail.criterionLabel, detail.criterionCode)}
        </p>
        <div className="flex flex-wrap gap-2">
          {detail.matched === true ? <StatusChip label="Correspondance" /> : null}
          {detail.isGap ? <StatusChip label="Point à améliorer" /> : null}
          {formatScore(detail.score) ? (
            <StatusChip label={`Score ${formatScore(detail.score)}`} />
          ) : null}
        </div>
      </div>

      {detail.gapMessage ? (
        <p className="mt-3 text-sm text-foreground/90">{detail.gapMessage}</p>
      ) : null}

      {detail.recommendation ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Recommandation : {detail.recommendation}
        </p>
      ) : null}
    </div>
  );
}
