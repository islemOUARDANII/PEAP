import {
  gatewayApi,
  type CandidateMatchedOfferRecord,
} from '@/services/api/gateway';
import { getStoredCandidateMinimumOfferScore } from './candidatePortalPreferences';

const MATCHING_UNAVAILABLE_MESSAGE =
  "Le moteur de matching n'est pas encore disponible.";

export interface CandidateMatchedOfferSummary {
  matchingResultId: string;
  offerId: string;
  title: string;
  companyName: string;
  location: string;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  skills: string[];
  languages: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  companyDetails: string[];
  scoreGlobal: number;
  scoreRuleBased: number | null;
  scoreSemantic: number | null;
  rank: number;
  explanationShort: string | null;
  explanationJson: Record<string, unknown>;
  eligibilityStatus: string;
  decisionStatus: string;
  publishedAt: string | null;
  status: string | null;
}

export interface CandidateMatchingOffersData {
  matchingAvailable: boolean;
  activeOffersCount: number | null;
  offers: CandidateMatchedOfferSummary[];
  unavailableMessage: string | null;
}

const cleanText = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    /^(non specifie|non spécifié|not specified|null|undefined|n\/a)$/i.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
};

const normalizeScore = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const formatContractTypeLabel = (
  value: string | null | undefined,
): string | null => {
  const normalized = cleanText(value)?.toLowerCase();

  if (!normalized) {
    return null;
  }

  const labels: Record<string, string> = {
    cdi: 'CDI',
    cdd: 'CDD',
    freelance: 'Freelance',
    interim: 'Intérim',
    alternance: 'Alternance',
    stage: 'Stage',
    internship: 'Stage',
    part_time: 'Temps partiel',
    full_time: 'Temps plein',
  };

  return labels[normalized] ?? normalized.replace(/[_-]+/g, ' ');
};

const formatWorkModeLabel = (
  value: string | null | undefined,
): string | null => {
  const normalized = cleanText(value)?.toLowerCase();

  if (!normalized) {
    return null;
  }

  const labels: Record<string, string> = {
    remote: 'Télétravail',
    hybrid: 'Hybride',
    onsite: 'Sur site',
    on_site: 'Sur site',
    presential: 'Sur site',
  };

  return labels[normalized] ?? normalized.replace(/[_-]+/g, ' ');
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractListFromExplanation = (
  explanation: Record<string, unknown>,
  keys: string[],
): string[] => {
  const values: string[] = [];

  for (const key of keys) {
    const value = explanation[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const text = cleanText(item);
          if (text) values.push(text);
          continue;
        }

        const record = toRecord(item);
        if (record) {
          const label =
            cleanText(record.label) ??
            cleanText(record.name) ??
            cleanText(record.raw_value) ??
            cleanText(record.code);

          const level =
            cleanText(record.level_label_fr) ??
            cleanText(record.level) ??
            cleanText(record.min_level);

          if (label) {
            values.push(level ? `${label} - ${level}` : label);
          }
        }
      }

      continue;
    }

    const text = cleanText(value);
    if (text) {
      values.push(text);
    }
  }

  return uniqueStrings(values);
};

const buildLocationLabel = (offer: CandidateMatchedOfferRecord): string => {
  return (
    uniqueStrings([
      offer.delegationLabel,
      offer.governorateLabel,
      offer.country,
    ]).join(', ') || 'Non renseigné'
  );
};

const mapCandidateMatchedOffer = (
  offer: CandidateMatchedOfferRecord,
): CandidateMatchedOfferSummary => {
  const explanation = offer.explanationJson ?? {};

  return {
    matchingResultId: offer.resultId,
    offerId: offer.offerId,
    title: cleanText(offer.title) ?? 'Offre non renseignée',
    companyName: cleanText(offer.employerName) ?? 'Entreprise non renseignée',
    location: buildLocationLabel(offer),
    contractType: formatContractTypeLabel(offer.contractType),
    workMode: formatWorkModeLabel(offer.workMode),
    description: cleanText(offer.description),
    skills: extractListFromExplanation(explanation, [
      'skills',
      'required_skills',
      'offer_skills',
    ]),
    languages: extractListFromExplanation(explanation, [
      'languages',
      'required_languages',
      'language_requirements',
    ]),
    educationRequirements: extractListFromExplanation(explanation, [
      'education',
      'education_level',
      'required_education',
      'diploma',
    ]),
    experienceRequirements: extractListFromExplanation(explanation, [
      'required_experience',
      'experience_required',
      'years_experience',
    ]),
    companyDetails: extractListFromExplanation(explanation, [
      'company_details',
      'company_information',
      'company_description',
      'employer_description',
      'website_url',
    ]),
    scoreGlobal: normalizeScore(offer.scorePercent),
    scoreRuleBased: null,
    scoreSemantic: null,
    rank: offer.rank,
    explanationShort: cleanText(offer.explanationShort),
    explanationJson: explanation,
    eligibilityStatus: 'ELIGIBLE',
    decisionStatus: 'PENDING',
    publishedAt: offer.publishedAt,
    status: offer.status,
  };
};

const sortMatchedOffers = (
  left: CandidateMatchedOfferSummary,
  right: CandidateMatchedOfferSummary,
): number => {
  if (right.scoreGlobal !== left.scoreGlobal) {
    return right.scoreGlobal - left.scoreGlobal;
  }

  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  return left.title.localeCompare(right.title);
};

export async function getCandidateMatchingOffers(
  _candidateId: string,
): Promise<CandidateMatchingOffersData> {
  const minScore = getStoredCandidateMinimumOfferScore();

  try {
    const payload = await gatewayApi.candidate.getMatchedOffers(minScore);

    const offers = payload.offers
      .map(mapCandidateMatchedOffer)
      .sort(sortMatchedOffers);

    return {
      matchingAvailable: true,
      activeOffersCount: payload.activeOffersCount,
      offers,
      unavailableMessage: null,
    };
  } catch {
    try {
      const activeOffersCount = await gatewayApi.candidate.getActiveOffersCount();

      return {
        matchingAvailable: false,
        activeOffersCount,
        offers: [],
        unavailableMessage: MATCHING_UNAVAILABLE_MESSAGE,
      };
    } catch {
      return {
        matchingAvailable: false,
        activeOffersCount: null,
        offers: [],
        unavailableMessage: MATCHING_UNAVAILABLE_MESSAGE,
      };
    }
  }
}

export const candidateMatchingUnavailableMessage = MATCHING_UNAVAILABLE_MESSAGE;
