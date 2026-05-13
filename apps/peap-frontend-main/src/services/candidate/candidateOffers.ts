import {
  gatewayApi,
  type CandidateMatchedOfferRecord,
  type JobSeekerKeywordRecord,
  type SearchOfferResult,
} from '@/services/api/gateway';
import {
  type CandidateOfferSearchMode,
  cleanText,
  extractOfferSkills,
  extractTextList,
  formatContractType,
  formatLocation,
  formatWorkMode,
  normalizePercent,
} from './candidateOfferUtils';
import { getStoredCandidateMinimumOfferScore } from './candidatePortalPreferences';

export const SEARCH_UNAVAILABLE_MESSAGE =
  'Le service de recherche est indisponible pour le moment.';
export const MATCHING_UNAVAILABLE_MESSAGE = 'Matching indisponible pour le moment.';
export const MISSING_KEYWORDS_MESSAGE =
  'Ajoutez des centres d’intérêt pour obtenir des offres pertinentes.';

export interface CandidateSearchOfferSummary {
  kind: 'search';
  offerId: string | null;
  title: string;
  companyName: string | null;
  location: string | null;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  skills: string[];
  publishedAt: string | null;
  status: string | null;
  searchScore: number | null;
  raw: Record<string, unknown>;
}

export interface CandidateRecommendedOfferSummary {
  kind: 'matching';
  matchingResultId: string;
  offerId: string;
  title: string;
  companyName: string;
  location: string | null;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  skills: string[];
  languages: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  publishedAt: string | null;
  status: string | null;
  score: number;
  explanationShort: string | null;
  explanationJson: Record<string, unknown>;
}

export interface CandidateAllPublishedOffersData {
  total: number;
  offers: CandidateSearchOfferSummary[];
  message: string | null;
}

export interface CandidateInterestingOffersData {
  total: number;
  offers: CandidateSearchOfferSummary[];
  keywords: JobSeekerKeywordRecord[];
  query: string;
  message: string | null;
}

export interface CandidateRecommendedOffersData {
  total: number;
  offers: CandidateRecommendedOfferSummary[];
  message: string | null;
}

export interface CandidateSearchOffersData {
  total: number;
  offers: CandidateSearchOfferSummary[];
  query: string;
  mode: CandidateOfferSearchMode;
  message: string | null;
}

export interface CandidateOfferSearchParams {
  query: string;
  size?: number;
  mode?: CandidateOfferSearchMode;
  filters?: Record<string, unknown>;
}

const DEFAULT_SEARCH_SIZE = 100;

const uniqueKeywordRecords = (
  keywords: JobSeekerKeywordRecord[],
): JobSeekerKeywordRecord[] => {
  const seen = new Set<string>();

  return keywords.filter((item) => {
    const keyword = cleanText(item.keyword)?.toLowerCase();

    if (!keyword || seen.has(keyword)) {
      return false;
    }

    seen.add(keyword);
    return true;
  });
};

const extractSearchCompanyName = (offer: SearchOfferResult): string | null => {
  const raw = offer.raw ?? {};

  return (
    cleanText(offer.companyName) ??
    cleanText(raw.employer_name) ??
    cleanText(raw.company_name) ??
    cleanText(raw.company) ??
    cleanText(raw.organization) ??
    cleanText(raw.employer) ??
    null
  );
};

const extractSearchDescription = (offer: SearchOfferResult): string | null => {
  const raw = offer.raw ?? {};

  return (
    cleanText(offer.description) ??
    cleanText(raw.summary) ??
    cleanText(raw.snippet) ??
    cleanText(raw.profile) ??
    null
  );
};

const mapSearchOffer = (offer: SearchOfferResult): CandidateSearchOfferSummary => {
  const raw = offer.raw ?? {};

  return {
    kind: 'search',
    offerId: cleanText(offer.offerId) ?? cleanText(raw.offer_id) ?? cleanText(raw.id),
    title: cleanText(offer.title) ?? 'Offre non renseignée',
    companyName: extractSearchCompanyName(offer),
    location: formatLocation(
      offer.location,
      raw.location_label,
      raw.delegation_label,
      raw.governorate_label,
      raw.country,
    ),
    contractType: formatContractType(offer.contractType ?? raw.contract_type),
    workMode: formatWorkMode(offer.workMode ?? raw.work_mode),
    description: extractSearchDescription(offer),
    skills: extractOfferSkills(offer),
    publishedAt:
      cleanText(offer.publishedAt) ??
      cleanText(raw.published_at) ??
      cleanText(offer.createdAt),
    status: cleanText(offer.status) ?? cleanText(raw.status),
    searchScore: (() => {
      if (typeof offer.searchScore === 'number' && Number.isFinite(offer.searchScore)) {
        return offer.searchScore;
      }

      const rawScore = raw.score == null ? NaN : Number(raw.score);
      return Number.isFinite(rawScore) ? rawScore : null;
    })(),
    raw,
  };
};

const extractExplanationList = (
  explanation: Record<string, unknown>,
  keys: string[],
): string[] => extractTextList(explanation, keys);

const mapRecommendedOffer = (
  offer: CandidateMatchedOfferRecord,
): CandidateRecommendedOfferSummary => {
  const explanation = offer.explanationJson ?? {};

  return {
    kind: 'matching',
    matchingResultId: offer.resultId,
    offerId: offer.offerId,
    title: cleanText(offer.title) ?? 'Offre non renseignée',
    companyName: cleanText(offer.employerName) ?? 'Entreprise non renseignée',
    location: formatLocation(
      offer.delegationLabel,
      offer.governorateLabel,
      offer.country,
    ),
    contractType: formatContractType(offer.contractType),
    workMode: formatWorkMode(offer.workMode),
    description: cleanText(offer.description),
    skills: extractExplanationList(explanation, [
      'skills',
      'required_skills',
      'offer_skills',
    ]),
    languages: extractExplanationList(explanation, [
      'languages',
      'required_languages',
      'language_requirements',
    ]),
    educationRequirements: extractExplanationList(explanation, [
      'education',
      'education_level',
      'required_education',
      'diploma',
    ]),
    experienceRequirements: extractExplanationList(explanation, [
      'required_experience',
      'experience_required',
      'years_experience',
    ]),
    publishedAt: cleanText(offer.publishedAt),
    status: cleanText(offer.status),
    score:
      normalizePercent(offer.scorePercent) ??
      normalizePercent(offer.scoreGlobal) ??
      0,
    explanationShort: cleanText(offer.explanationShort),
    explanationJson: explanation,
  };
};

const sortRecommendedOffers = (
  left: CandidateRecommendedOfferSummary,
  right: CandidateRecommendedOfferSummary,
) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.title.localeCompare(right.title, 'fr');
};

const resolveSearchTotal = (
  reportedTotal: number,
  offers: CandidateSearchOfferSummary[],
): number => (reportedTotal > 0 ? reportedTotal : offers.length);

const buildOfferSearchPayload = ({
  query,
  size = DEFAULT_SEARCH_SIZE,
  mode = 'keyword',
  filters,
}: CandidateOfferSearchParams): Record<string, unknown> => {
  const normalizedQuery = query.trim();

  return {
    query: normalizedQuery,
    size,
    ...(mode === 'company' && normalizedQuery
      ? { company_name: normalizedQuery }
      : {}),
    ...(mode === 'location' && normalizedQuery
      ? { governorate: normalizedQuery }
      : {}),
    ...(filters ? { filters } : {}),
  };
};

export async function searchCandidateOffers({
  query,
  size = DEFAULT_SEARCH_SIZE,
  mode = 'keyword',
  filters,
}: CandidateOfferSearchParams): Promise<CandidateSearchOffersData> {
  const response = await gatewayApi.search.offers(
    buildOfferSearchPayload({ query, size, mode, filters }),
  );
  const offers = response.results.map(mapSearchOffer);

  return {
    total: resolveSearchTotal(response.total, offers),
    offers,
    query: query.trim(),
    mode,
    message: null,
  };
}

export async function getAllPublishedOffers(): Promise<CandidateAllPublishedOffersData> {
  const response = await searchCandidateOffers({
    query: '',
    size: DEFAULT_SEARCH_SIZE,
  });

  return {
    total: response.total,
    offers: response.offers,
    message: null,
  };
}

export async function getInterestingOffers(): Promise<CandidateInterestingOffersData> {
  const keywords = uniqueKeywordRecords(await gatewayApi.candidate.getKeywords());
  const query = keywords
    .map((item) => cleanText(item.keyword))
    .filter((item): item is string => Boolean(item))
    .join(' ')
    .trim();

  if (!query) {
    return {
      total: 0,
      offers: [],
      keywords,
      query: '',
      message: MISSING_KEYWORDS_MESSAGE,
    };
  }

  const response = await searchCandidateOffers({
    query,
    size: DEFAULT_SEARCH_SIZE,
  });

  return {
    total: response.total,
    offers: response.offers,
    keywords,
    query,
    message: null,
  };
}

export async function getRecommendedOffers(): Promise<CandidateRecommendedOffersData> {
  const payload = await gatewayApi.candidate.getMatchedOffers(
    getStoredCandidateMinimumOfferScore(),
  );
  const offers = payload.offers.map(mapRecommendedOffer).sort(sortRecommendedOffers);

  return {
    total: payload.matchedCount > 0 ? payload.matchedCount : offers.length,
    offers,
    message: null,
  };
}
