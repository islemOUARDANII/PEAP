export const candidateInterestKeywords = [
  'Intelligence artificielle',
  'Data Science',
  'Développement Web',
  'Cloud',
  'Cybersécurité',
  'Mobile',
  'DevOps',
];

export const candidateOfferScoreOptions = [
  40,
  45,
  50,
  55,
  60,
  65,
  70,
  75,
  80,
  85,
  90,
  95,
  100,
];

const CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY =
  'peap:candidate:minimum-offer-score';

export const defaultCandidateMinimumOfferScore = 50;

const normalizeCandidateMinimumOfferScore = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultCandidateMinimumOfferScore;
  }

  return candidateOfferScoreOptions.includes(parsed)
    ? parsed
    : defaultCandidateMinimumOfferScore;
};

export const getStoredCandidateMinimumOfferScore = (): number => {
  if (typeof window === 'undefined') {
    return defaultCandidateMinimumOfferScore;
  }

  return normalizeCandidateMinimumOfferScore(
    window.localStorage.getItem(CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY),
  );
};

export const setStoredCandidateMinimumOfferScore = (value: number): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY,
    String(normalizeCandidateMinimumOfferScore(value)),
  );
};
