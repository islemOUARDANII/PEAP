import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileText,
  Layers3,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ErrorCard from '@/components/common/ErrorCard';
import LoadingCard from '@/components/common/LoadingCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill } from '@/components/common/StatusPill';
import { queryKeys } from '@/services/api/queryKeys';
import {
  gatewayApi,
  inferCandidateDisplayName,
  inferCandidateLocation,
  inferSkillLabel,
  type CandidateProfileBundle,
} from '@/services/api/gateway';
import {
  getAllPublishedOffers,
  getInterestingOffers,
  getRecommendedOffers,
  MATCHING_UNAVAILABLE_MESSAGE,
  SEARCH_UNAVAILABLE_MESSAGE,
} from '@/services/candidate/candidateOffers';
import {
  cleanText,
  formatDate,
} from '@/services/candidate/candidateOfferUtils';

const PROFILE_COMPLETION_SECTION_ID = 'completion-profil';

const unique = (values: string[]): string[] => Array.from(new Set(values));

type ProfileCompletionItem = {
  label: string;
  completed: boolean;
  missing: string[];
};

const buildProfileCompletionItems = (
  bundle: CandidateProfileBundle | undefined,
): ProfileCompletionItem[] => {
  if (!bundle) {
    return [];
  }

  const identityMissing = [
    !cleanText(bundle.identity?.first_name) ? 'Prénom' : null,
    !cleanText(bundle.identity?.last_name) ? 'Nom' : null,
    !cleanText(bundle.identity?.birth_date) ? 'Date de naissance' : null,
    !cleanText(bundle.identity?.nationality) ? 'Nationalité' : null,
  ].filter(Boolean) as string[];

  const contactMissing = [
    !cleanText(bundle.contact?.email) ? 'Adresse e-mail' : null,
    !cleanText(bundle.contact?.phone) ? 'Téléphone' : null,
    !cleanText(inferCandidateLocation(bundle)) ? 'Localisation' : null,
  ].filter(Boolean) as string[];

  return [
    {
      label: 'Informations personnelles',
      completed: identityMissing.length === 0,
      missing: identityMissing,
    },
    {
      label: 'Coordonnées',
      completed: contactMissing.length === 0,
      missing: contactMissing,
    },
    {
      label: 'Formation',
      completed: bundle.education.length > 0,
      missing: bundle.education.length > 0 ? [] : ['Au moins une formation'],
    },
    {
      label: 'Expérience',
      completed: bundle.experience.length > 0,
      missing: bundle.experience.length > 0 ? [] : ['Au moins une expérience'],
    },
    {
      label: 'Compétences',
      completed: bundle.skills.length > 0,
      missing: bundle.skills.length > 0 ? [] : ['Au moins une compétence'],
    },
    {
      label: 'Langues',
      completed: bundle.languages.length > 0,
      missing: bundle.languages.length > 0 ? [] : ['Au moins une langue'],
    },
    {
      label: 'CV',
      completed: Boolean(bundle.currentCv),
      missing: bundle.currentCv ? [] : ['CV non importé'],
    },
  ];
};

export default function CandidateDashboard() {
  const navigate = useNavigate();

  const bundleQuery = useQuery({
    queryKey: queryKeys.candidate.bundle(),
    queryFn: () => gatewayApi.candidate.getBundle(),
  });

  const keywordsQuery = useQuery({
    queryKey: [...queryKeys.candidate.profile(), 'keywords'],
    queryFn: () => gatewayApi.candidate.getKeywords(),
    staleTime: 5 * 60_000,
  });

  const interestingOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'interesting'],
    queryFn: () => getInterestingOffers(),
    staleTime: 5 * 60_000,
  });

  const recommendedOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'recommended'],
    queryFn: () => getRecommendedOffers(),
    staleTime: 5 * 60_000,
  });

  const allOffersQuery = useQuery({
    queryKey: [...queryKeys.candidate.jobOffers(), 'all'],
    queryFn: () => getAllPublishedOffers(),
    staleTime: 5 * 60_000,
  });

  const bundle = bundleQuery.data;
  const profileCompletionItems = useMemo(
    () => buildProfileCompletionItems(bundle),
    [bundle],
  );

  const profileCompletion = useMemo(() => {
    if (profileCompletionItems.length === 0) {
      return 0;
    }

    const completedCount = profileCompletionItems.filter(
      (item) => item.completed,
    ).length;

    return Math.round((completedCount / profileCompletionItems.length) * 100);
  }, [profileCompletionItems]);

  const missingProfileItems = useMemo(
    () =>
      unique(
        profileCompletionItems.flatMap((item) =>
          item.completed
            ? []
            : item.missing.map((missing) => `${item.label} : ${missing}`),
        ),
      ),
    [profileCompletionItems],
  );

  const displayName = bundle ? inferCandidateDisplayName(bundle) : 'Candidat';
  const displayLocation = bundle ? inferCandidateLocation(bundle) : '';
  const highlightedRecommendedOffers =
    recommendedOffersQuery.data?.offers.slice(0, 3) ?? [];
  const keywords = keywordsQuery.data ?? [];

  if (bundleQuery.isLoading) {
    return <LoadingCard text="Chargement du tableau de bord candidat..." />;
  }

  if (bundleQuery.isError) {
    return (
      <ErrorCard
        queryResult={bundleQuery}
        text="Impossible de charger le tableau de bord candidat."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord candidat"
        description={
          displayLocation
            ? `Bonjour ${displayName}. Suivez votre profil et vos opportunités depuis ${displayLocation}.`
            : `Bonjour ${displayName}. Suivez votre profil et vos opportunités depuis cet espace.`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardActionCard
          icon={FileText}
          title="Complétion du profil"
          value={`${profileCompletion}%`}
          hint="Voir les éléments complets et manquants"
          onClick={() =>
            document
              .getElementById(PROFILE_COMPLETION_SECTION_ID)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="start-border-left-blue"
          iconBackground="start-background-color-blue"
        />
        <DashboardActionCard
          icon={Search}
          title="Offres qui peuvent vous intéresser"
          value={
            interestingOffersQuery.isLoading
              ? '...'
              : interestingOffersQuery.isError
                ? '--'
                : (interestingOffersQuery.data?.total ?? 0)
          }
          hint={
            interestingOffersQuery.isError
              ? SEARCH_UNAVAILABLE_MESSAGE
              : (interestingOffersQuery.data?.message ??
                'Offres trouvées à partir de vos centres d’intérêt.')
          }
          onClick={() => navigate('/candidate/offers?tab=interesting')}
          className="start-border-left-green"
          iconBackground="start-background-color-green"
        />
        <DashboardActionCard
          icon={Sparkles}
          title="Offres recommandées"
          value={
            recommendedOffersQuery.isLoading
              ? '...'
              : recommendedOffersQuery.isError
                ? '--'
                : (recommendedOffersQuery.data?.total ?? 0)
          }
          hint={
            recommendedOffersQuery.isError
              ? MATCHING_UNAVAILABLE_MESSAGE
              : recommendedOffersQuery.data?.total
                ? 'Recommandations issues du matching de votre profil.'
                : 'Aucune offre recommandée pour le moment.'
          }
          onClick={() => navigate('/candidate/offers?tab=recommended')}
          className="start-border-left-orange"
          iconBackground="start-background-color-orange"
        />
        <DashboardActionCard
          icon={Layers3}
          title="Toutes les offres actives"
          value={
            allOffersQuery.isLoading
              ? '...'
              : allOffersQuery.isError
                ? '--'
                : (allOffersQuery.data?.total ?? 0)
          }
          hint={
            allOffersQuery.isError
              ? SEARCH_UNAVAILABLE_MESSAGE
              : 'Nombre total d’offres publiées et actives.'
          }
          onClick={() => navigate('/candidate/offers?tab=all')}
          className="start-border-left-teal"
          iconBackground="start-background-color-teal"
        />
      </div>

      <section
        id={PROFILE_COMPLETION_SECTION_ID}
        className="panel scroll-mt-24 p-6 card-border-top"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Complétion du profil
            </h2>
            <p className="text-sm text-muted-foreground">
              Identifiez rapidement ce qui est complet et ce qui manque pour
              améliorer vos recommandations.
            </p>
          </div>
          <StatusPill
            label={`${profileCompletionItems.filter((item) => item.completed).length}/${profileCompletionItems.length} sections complètes`}
            tone={profileCompletion === 100 ? 'success' : 'warning'}
            dot={false}
          />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {profileCompletionItems.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.completed
                      ? 'Section complète.'
                      : item.missing.join(', ')}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.completed
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <CircleAlert className="h-3.5 w-3.5" />
                  )}
                  {item.completed ? 'Complet' : 'Incomplet'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            Éléments manquants du profil
          </p>
          {missingProfileItems.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {missingProfileItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 text-warning" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Votre profil est complet pour le moment.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)]">
        <section className="panel p-6 card-border-top">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Offres recommandées à la une
              </h2>
              <p className="text-sm text-muted-foreground">
                Offres réellement recommandées par le matching de votre profil.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/candidate/offers?tab=recommended')}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent"
            >
              Voir les offres <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {recommendedOffersQuery.isLoading ? (
              <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                Chargement des offres recommandées...
              </div>
            ) : recommendedOffersQuery.isError ? (
              <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                {MATCHING_UNAVAILABLE_MESSAGE}
              </div>
            ) : highlightedRecommendedOffers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                Aucune offre recommandée pour le moment.
              </div>
            ) : (
              highlightedRecommendedOffers.map((offer) => {
                const publishedAt = formatDate(offer.publishedAt);

                return (
                  <button
                    key={offer.matchingResultId}
                    type="button"
                    onClick={() =>
                      navigate('/candidate/offers?tab=recommended')
                    }
                    className="w-full rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {offer.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            offer.companyName,
                            offer.location,
                            offer.contractType,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                        {publishedAt ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Publiée le {publishedAt}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {offer.skills.slice(0, 5).map((skill) => (
                            <SkillTag
                              key={`${offer.matchingResultId}-${skill}`}
                              label={skill}
                              variant="matched"
                            />
                          ))}
                        </div>
                      </div>
                      <ScoreBadge score={offer.score} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="panel p-6 card-border-top">
          <h2 className="text-lg font-semibold text-foreground">
            Vos centres d’intérêt
          </h2>
          <p className="text-sm text-muted-foreground">
            Ils servent à rechercher les offres qui peuvent vous intéresser.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {keywordsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Chargement de vos centres d’intérêt...
              </p>
            ) : keywordsQuery.isError ? (
              <p className="text-sm text-muted-foreground">
                Impossible de charger vos centres d’intérêt pour le moment.
              </p>
            ) : keywords.length > 0 ? (
              keywords.map((keyword) => (
                <SkillTag
                  key={keyword.id}
                  label={keyword.keyword}
                  variant="matched"
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Ajoutez des centres d’intérêt dans votre profil pour obtenir des
                offres pertinentes.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              Compétences actuellement visibles dans votre profil
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(bundle?.skills ?? []).length > 0 ? (
                bundle.skills
                  .slice(0, 8)
                  .map((skill) => (
                    <SkillTag
                      key={skill.id}
                      label={inferSkillLabel(skill)}
                      variant="outline"
                    />
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune compétence renseignée pour le moment.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardActionCard({
  icon: Icon,
  title,
  value,
  hint,
  onClick,
  className,
  iconBackground,
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  hint: string;
  onClick: () => void;
  className?: string;
  iconBackground?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`panel flex flex-col gap-3 p-5 text-left transition-colors hover:border-accent/40 hover:bg-surface-muted ${
        className || ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="stat-label">{title}</span>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-md ${
            iconBackground || 'bg-primary-muted'
          } text-primary`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="stat-value">{value}</span>
        {/* <ArrowRight className="h-4 w-4 text-accent" /> */}
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
