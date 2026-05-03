import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  MapPin,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiServiceError } from '@/services/api/client';
import { gatewayApi } from '@/services/api/gateway';
import { queryKeys } from '@/services/api/queryKeys';
import {
  getAllPublishedOffers,
  getInterestingOffers,
  getRecommendedOffers,
  MATCHING_UNAVAILABLE_MESSAGE,
  SEARCH_UNAVAILABLE_MESSAGE,
  type CandidateRecommendedOfferSummary,
  type CandidateSearchOfferSummary,
} from '@/services/candidate/candidateOffers';
import {
  cleanText,
  formatDate,
  normalizePercent,
} from '@/services/candidate/candidateOfferUtils';

type OfferTab = 'all' | 'interesting' | 'recommended';
type SelectedOffer = CandidateSearchOfferSummary | CandidateRecommendedOfferSummary;

const DEFAULT_TAB: OfferTab = 'recommended';
const OFFER_TABS: OfferTab[] = ['all', 'interesting', 'recommended'];

const isOfferTab = (value: string | null): value is OfferTab =>
  value != null && OFFER_TABS.includes(value as OfferTab);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => cleanText(item))
        .filter((item): item is string => Boolean(item))
    : [];

const formatSearchRelevance = (value: number | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return value % 1 === 0 ? `${value}` : value.toFixed(1);
};

const getTabTitle = (tab: OfferTab): string => {
  switch (tab) {
    case 'all':
      return 'Toutes les offres';
    case 'interesting':
      return 'Offres qui peuvent vous intéresser';
    case 'recommended':
    default:
      return 'Offres recommandées';
  }
};

const getTabDescription = (tab: OfferTab): string => {
  switch (tab) {
    case 'all':
      return 'Explorez toutes les offres publiées et actives.';
    case 'interesting':
      return 'Résultats de recherche construits à partir de vos centres d’intérêt.';
    case 'recommended':
    default:
      return 'Offres réellement matchées avec votre profil candidat.';
  }
};

const getOfferDescription = (offer: CandidateSearchOfferSummary): string | null =>
  cleanText(offer.description) ??
  cleanText(offer.raw.summary) ??
  cleanText(offer.raw.snippet) ??
  null;

export default function CandidateOffers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const [appliedOfferIds, setAppliedOfferIds] = useState<string[]>([]);

  const rawTab = searchParams.get('tab');
  const activeTab = isOfferTab(rawTab) ? rawTab : DEFAULT_TAB;

  useEffect(() => {
    if (!isOfferTab(rawTab)) {
      setSearchParams({ tab: DEFAULT_TAB }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  useEffect(() => {
    setSelectedOffer(null);
  }, [activeTab]);

  const allOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'all'],
    queryFn: () => getAllPublishedOffers(),
    enabled: activeTab === 'all',
    staleTime: 5 * 60_000,
  });

  const interestingOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'interesting'],
    queryFn: () => getInterestingOffers(),
    enabled: activeTab === 'interesting',
    staleTime: 5 * 60_000,
  });

  const recommendedOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'recommended'],
    queryFn: () => getRecommendedOffers(),
    enabled: activeTab === 'recommended',
    staleTime: 5 * 60_000,
  });

  const applyMutation = useMutation({
    mutationFn: async (offer: SelectedOffer) => {
      if (!offer.offerId) {
        throw new Error("Cette offre n'est pas encore postable.");
      }

      return gatewayApi.candidate.applyToOffer({
        offer_id: offer.offerId,
        matching_result_id:
          offer.kind === 'matching' ? offer.matchingResultId : undefined,
      });
    },
    onSuccess: (_response, offer) => {
      if (!offer.offerId) {
        return;
      }

      setAppliedOfferIds((current) =>
        current.includes(offer.offerId) ? current : [...current, offer.offerId],
      );
      toast.success('Votre candidature a été enregistrée.');
    },
    onError: (error, offer) => {
      const message = error instanceof Error ? error.message : '';
      const alreadyApplied =
        error instanceof ApiServiceError
          ? error.status === 409 || /déjà|already/i.test(message)
          : /déjà|already/i.test(message);

      if (alreadyApplied && offer.offerId) {
        setAppliedOfferIds((current) =>
          current.includes(offer.offerId) ? current : [...current, offer.offerId],
        );
        toast.info('Déjà postulé');
        return;
      }

      toast.error("Impossible d'enregistrer votre candidature pour le moment.");
    },
  });

  const pageTitle = getTabTitle(activeTab);
  const pageDescription = getTabDescription(activeTab);
  const isAlreadyApplied = selectedOffer?.offerId
    ? appliedOfferIds.includes(selectedOffer.offerId)
    : false;

  const activeSearchOffers = useMemo(() => {
    if (activeTab === 'all') {
      return allOffersQuery.data?.offers ?? [];
    }

    if (activeTab === 'interesting') {
      return interestingOffersQuery.data?.offers ?? [];
    }

    return [];
  }, [
    activeTab,
    allOffersQuery.data?.offers,
    interestingOffersQuery.data?.offers,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={pageTitle} description={pageDescription} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isOfferTab(value)) {
            setSearchParams({ tab: value });
          }
        }}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap gap-2 bg-surface-muted p-1">
          <TabsTrigger value="all">Toutes les offres</TabsTrigger>
          <TabsTrigger value="interesting">
            Offres qui peuvent vous intéresser
          </TabsTrigger>
          <TabsTrigger value="recommended">Offres recommandées</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {allOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres publiées..." />
          ) : allOffersQuery.isError ? (
            <OfferPanelMessage message={SEARCH_UNAVAILABLE_MESSAGE} />
          ) : activeSearchOffers.length === 0 ? (
            <OfferPanelMessage message="Aucune offre publiée pour le moment." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeSearchOffers.map((offer) => (
                <SearchOfferCard
                  key={`all-${offer.offerId ?? offer.title}`}
                  offer={offer}
                  showSearchRelevance={false}
                  onSelect={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interesting" className="space-y-4">
          {interestingOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres basées sur vos centres d’intérêt..." />
          ) : interestingOffersQuery.isError ? (
            <OfferPanelMessage message={SEARCH_UNAVAILABLE_MESSAGE} />
          ) : (
            <>
              <div className="panel flex flex-col gap-3 p-4 card-border-top">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Search className="h-4 w-4 text-accent" />
                  Recherche basée sur vos centres d’intérêt
                </div>
                {interestingOffersQuery.data?.keywords.length ? (
                  <p className="text-sm text-muted-foreground">
                    {interestingOffersQuery.data.keywords
                      .map((item) => item.keyword)
                      .join(', ')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ajoutez des centres d’intérêt dans votre profil pour obtenir
                    des offres pertinentes.
                  </p>
                )}
              </div>

              {interestingOffersQuery.data?.keywords.length === 0 ? (
                <OfferPanelMessage message="Ajoutez des centres d’intérêt dans votre profil pour obtenir des offres pertinentes." />
              ) : activeSearchOffers.length === 0 ? (
                <OfferPanelMessage message="Aucune offre trouvée pour vos centres d’intérêt actuels." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activeSearchOffers.map((offer) => (
                    <SearchOfferCard
                      key={`interesting-${offer.offerId ?? offer.title}`}
                      offer={offer}
                      showSearchRelevance
                      onSelect={() => setSelectedOffer(offer)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="recommended" className="space-y-4">
          {recommendedOffersQuery.isLoading ? (
            <OfferPanelMessage message="Chargement des offres recommandées..." />
          ) : recommendedOffersQuery.isError ? (
            <OfferPanelMessage message={MATCHING_UNAVAILABLE_MESSAGE} />
          ) : (recommendedOffersQuery.data?.offers ?? []).length === 0 ? (
            <OfferPanelMessage
              message="Aucune offre recommandée pour le moment."
              secondaryMessage="Vous pouvez baisser votre seuil minimum ou compléter votre profil."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(recommendedOffersQuery.data?.offers ?? []).map((offer) => (
                <RecommendedOfferCard
                  key={offer.matchingResultId}
                  offer={offer}
                  isApplied={appliedOfferIds.includes(offer.offerId)}
                  onSelect={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(selectedOffer)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOffer(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          {selectedOffer ? (
            selectedOffer.kind === 'matching' ? (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">{selectedOffer.title}</DialogTitle>
                  <DialogDescription>{selectedOffer.companyName}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField
                    icon={MapPin}
                    label="Localisation"
                    value={selectedOffer.location ?? 'Non renseignée'}
                  />
                  <DetailField
                    icon={Briefcase}
                    label="Type de contrat"
                    value={selectedOffer.contractType ?? 'Non renseigné'}
                  />
                  <DetailField
                    icon={Sparkles}
                    label="Score de compatibilité"
                    value={`${selectedOffer.score}%`}
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
                  {selectedOffer.publishedAt ? (
                    <DetailField
                      icon={CalendarDays}
                      label="Date de publication"
                      value={formatDate(selectedOffer.publishedAt) ?? 'Non renseignée'}
                    />
                  ) : null}
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                    {selectedOffer.description ??
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
                      Formation
                    </h3>
                    <p className="text-sm text-foreground/90">
                      {selectedOffer.educationRequirements.join(' • ')}
                    </p>
                  </section>
                ) : null}

                {selectedOffer.experienceRequirements.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Expérience
                    </h3>
                    <p className="text-sm text-foreground/90">
                      {selectedOffer.experienceRequirements.join(' • ')}
                    </p>
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

                  <MatchingExplanation
                    explanationJson={selectedOffer.explanationJson ?? {}}
                  />
                </section>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOffer(null)}
                  >
                    Fermer
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyMutation.mutate(selectedOffer)}
                    disabled={
                      !selectedOffer.offerId ||
                      isAlreadyApplied ||
                      applyMutation.isPending
                    }
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isAlreadyApplied ? 'Déjà postulé' : 'Postuler'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">{selectedOffer.title}</DialogTitle>
                  <DialogDescription>
                    {selectedOffer.companyName ?? 'Entreprise non renseignée'}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField
                    icon={MapPin}
                    label="Localisation"
                    value={selectedOffer.location ?? 'Non renseignée'}
                  />
                  <DetailField
                    icon={Briefcase}
                    label="Type de contrat"
                    value={selectedOffer.contractType ?? 'Non renseigné'}
                  />
                  <DetailField
                    icon={Building2}
                    label="Entreprise"
                    value={selectedOffer.companyName ?? 'Non renseignée'}
                  />
                  {selectedOffer.workMode ? (
                    <DetailField
                      icon={Briefcase}
                      label="Mode de travail"
                      value={selectedOffer.workMode}
                    />
                  ) : null}
                  {selectedOffer.publishedAt ? (
                    <DetailField
                      icon={CalendarDays}
                      label="Date de publication"
                      value={formatDate(selectedOffer.publishedAt) ?? 'Non renseignée'}
                    />
                  ) : null}
                  {selectedOffer.searchScore != null ? (
                    <DetailField
                      icon={Search}
                      label="Pertinence de recherche"
                      value={formatSearchRelevance(selectedOffer.searchScore) ?? 'Disponible'}
                    />
                  ) : null}
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                    {getOfferDescription(selectedOffer) ??
                      'Aucune description disponible pour le moment.'}
                  </p>
                </section>

                {selectedOffer.skills.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Compétences
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedOffer.skills.map((skill) => (
                        <SkillTag
                          key={`${selectedOffer.offerId ?? selectedOffer.title}-${skill}`}
                          label={skill}
                          variant="outline"
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOffer(null)}
                  >
                    Fermer
                  </Button>
                  {selectedOffer.offerId ? (
                    <Button
                      type="button"
                      onClick={() => applyMutation.mutate(selectedOffer)}
                      disabled={isAlreadyApplied || applyMutation.isPending}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isAlreadyApplied ? 'Déjà postulé' : 'Postuler'}
                    </Button>
                  ) : null}
                </DialogFooter>
              </>
            )
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

function OfferPanelMessage({
  message,
  secondaryMessage,
}: {
  message: string;
  secondaryMessage?: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 p-10 text-center card-border-top">
      <Sparkles className="h-8 w-8 text-accent" />
      <div>
        <p className="text-lg font-semibold text-foreground">{message}</p>
        {secondaryMessage ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {secondaryMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SearchOfferCard({
  offer,
  showSearchRelevance,
  onSelect,
}: {
  offer: CandidateSearchOfferSummary;
  showSearchRelevance: boolean;
  onSelect: () => void;
}) {
  const publishedAt = formatDate(offer.publishedAt);
  const searchRelevance = formatSearchRelevance(offer.searchScore);

  return (
    <article className="panel flex h-full flex-col p-5 card-border-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{offer.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {offer.companyName ?? 'Entreprise non renseignée'}
          </p>
        </div>
        {showSearchRelevance && searchRelevance ? (
          <StatusChip label={`Pertinence de recherche : ${searchRelevance}`} />
        ) : (
          <StatusChip label="Offre publiée" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {offer.location ?? 'Localisation non renseignée'}
        </span>
        {offer.contractType ? <StatusChip label={offer.contractType} /> : null}
        {offer.workMode ? <StatusChip label={offer.workMode} /> : null}
      </div>

      <p className="mt-4 line-clamp-4 text-sm leading-6 text-foreground/90">
        {getOfferDescription(offer) ?? 'Aucune description disponible pour le moment.'}
      </p>

      {offer.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.skills.slice(0, 6).map((skill) => (
            <SkillTag
              key={`${offer.offerId ?? offer.title}-${skill}`}
              label={skill}
              variant="outline"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <span>{publishedAt ? `Publiée le ${publishedAt}` : 'Offre publiée'}</span>
        <Button type="button" size="sm" onClick={onSelect}>
          Voir le détail
        </Button>
      </div>
    </article>
  );
}

function RecommendedOfferCard({
  offer,
  isApplied,
  onSelect,
}: {
  offer: CandidateRecommendedOfferSummary;
  isApplied: boolean;
  onSelect: () => void;
}) {
  const publishedAt = formatDate(offer.publishedAt);

  return (
    <article className="panel flex h-full flex-col p-5 card-border-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{offer.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{offer.companyName}</p>
        </div>
        <ScoreBadge score={offer.score} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {offer.location ?? 'Localisation non renseignée'}
        </span>
        {offer.contractType ? <StatusChip label={offer.contractType} /> : null}
        {offer.workMode ? <StatusChip label={offer.workMode} /> : null}
      </div>

      <p className="mt-4 line-clamp-4 text-sm leading-6 text-foreground/90">
        {offer.explanationShort ??
          offer.description ??
          'Aucune description disponible pour le moment.'}
      </p>

      {offer.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {offer.skills.slice(0, 6).map((skill) => (
            <SkillTag
              key={`${offer.matchingResultId}-${skill}`}
              label={skill}
              variant="matched"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <span>{publishedAt ? `Publiée le ${publishedAt}` : 'Offre recommandée'}</span>
        <div className="flex items-center gap-2">
          {isApplied ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Déjà postulé
            </span>
          ) : null}
          <Button type="button" size="sm" onClick={onSelect}>
            Voir le détail
          </Button>
        </div>
      </div>
    </article>
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

function MatchingExplanation({
  explanationJson,
}: {
  explanationJson: Record<string, unknown>;
}) {
  const subScores = asRecord(explanationJson.sub_scores);
  const details = asRecord(explanationJson.details);
  const weights = asRecord(explanationJson.weights);

  const languageDetails = asRecord(details.LANGUAGE_MATCH);
  const contractDetails = asRecord(details.CONTRACT_MATCH);

  const matchedLanguages = toStringList(languageDetails.matched_languages);
  const missingLanguages = toStringList(languageDetails.missing_languages);
  const hasSubScores = Object.keys(subScores).length > 0;

  if (!hasSubScores) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
        Aucune explication détaillée n'est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ScoreLine
          label="Compétences"
          score={normalizePercent(subScores.SKILLS_MATCH) ?? 0}
          weight={normalizePercent(weights.SKILLS_MATCH) ?? 0}
        />
        <ScoreLine
          label="Formation"
          score={normalizePercent(subScores.EDUCATION_MATCH) ?? 0}
          weight={normalizePercent(weights.EDUCATION_MATCH) ?? 0}
        />
        <ScoreLine
          label="Expérience"
          score={normalizePercent(subScores.EXPERIENCE_MATCH) ?? 0}
          weight={normalizePercent(weights.EXPERIENCE_MATCH) ?? 0}
        />
        <ScoreLine
          label="Langues"
          score={normalizePercent(subScores.LANGUAGE_MATCH) ?? 0}
          weight={normalizePercent(weights.LANGUAGE_MATCH) ?? 0}
        />
        <ScoreLine
          label="Localisation"
          score={normalizePercent(subScores.LOCATION_MATCH) ?? 0}
          weight={normalizePercent(weights.LOCATION_MATCH) ?? 0}
        />
        <ScoreLine
          label="Contrat"
          score={normalizePercent(subScores.CONTRACT_MATCH) ?? 0}
          weight={normalizePercent(weights.CONTRACT_MATCH) ?? 0}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-semibold text-foreground">Détails principaux</p>

        <div className="mt-2 space-y-1 text-muted-foreground">
          {matchedLanguages.length > 0 ? (
            <p>Langues validées : {matchedLanguages.join(', ')}</p>
          ) : null}

          {missingLanguages.length > 0 ? (
            <p>Langues manquantes : {missingLanguages.join(', ')}</p>
          ) : null}

          {contractDetails.match_type === 'mismatch' ? (
            <p>
              Le type de contrat ne correspond pas exactement à vos
              préférences.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScoreLine({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm font-semibold text-accent">{score}%</p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-accent"
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
      </div>

      {weight > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Poids dans le modèle : {weight}%
        </p>
      ) : null}
    </div>
  );
}
