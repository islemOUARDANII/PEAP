export const candidateInterestKeywords = [
  'Intelligence artificielle',
  'Data Science',
  'Développement web',
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
const LEGACY_CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY =
  'candidate_offer_score_threshold';
const CANDIDATE_INTEREST_KEYWORDS_STORAGE_KEY =
  'peap:candidate:interest-keywords';
const CANDIDATE_PORTAL_PREFERENCES_EVENT_NAME =
  'peap:candidate:preferences-changed';

export const defaultCandidateMinimumOfferScore = 50;

const canUseWindow = (): boolean => typeof window !== 'undefined';

const emitCandidatePortalPreferencesChange = (): void => {
  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(new Event(CANDIDATE_PORTAL_PREFERENCES_EVENT_NAME));
};

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
  if (!canUseWindow()) {
    return defaultCandidateMinimumOfferScore;
  }

  const currentValue = window.localStorage.getItem(
    CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY,
  );

  if (currentValue != null) {
    return normalizeCandidateMinimumOfferScore(currentValue);
  }

  return normalizeCandidateMinimumOfferScore(
    window.localStorage.getItem(
      LEGACY_CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY,
    ),
  );
};

export const setStoredCandidateMinimumOfferScore = (value: number): void => {
  if (!canUseWindow()) {
    return;
  }

  const normalizedValue = String(normalizeCandidateMinimumOfferScore(value));

  window.localStorage.setItem(
    CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY,
    normalizedValue,
  );
  window.localStorage.setItem(
    LEGACY_CANDIDATE_MINIMUM_OFFER_SCORE_STORAGE_KEY,
    normalizedValue,
  );
  emitCandidatePortalPreferencesChange();
};

const normalizeKeyword = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
};

export const getStoredCandidateInterestKeywords = (): string[] => {
  if (!canUseWindow()) {
    return [...candidateInterestKeywords];
  }

  try {
    const raw = window.localStorage.getItem(
      CANDIDATE_INTEREST_KEYWORDS_STORAGE_KEY,
    );

    if (!raw) {
      return [...candidateInterestKeywords];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...candidateInterestKeywords];
    }

    const keywords = Array.from(
      new Set(
        parsed
          .map(normalizeKeyword)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return keywords.length > 0 ? keywords : [...candidateInterestKeywords];
  } catch {
    return [...candidateInterestKeywords];
  }
};

export const setStoredCandidateInterestKeywords = (
  keywords: string[],
): void => {
  if (!canUseWindow()) {
    return;
  }

  const normalizedKeywords = Array.from(
    new Set(
      keywords
        .map(normalizeKeyword)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  window.localStorage.setItem(
    CANDIDATE_INTEREST_KEYWORDS_STORAGE_KEY,
    JSON.stringify(
      normalizedKeywords.length > 0
        ? normalizedKeywords
        : candidateInterestKeywords,
    ),
  );
  emitCandidatePortalPreferencesChange();
};

export const candidatePortalPreferencesEventName = (): string =>
  CANDIDATE_PORTAL_PREFERENCES_EVENT_NAME;
