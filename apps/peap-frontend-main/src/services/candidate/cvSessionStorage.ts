const CANDIDATE_CV_TOKEN_STORAGE_KEY = "talentmesh.candidate.cv-token";
const CANDIDATE_CV_TOKEN_EVENT_NAME = "matchcore:candidate-cv-token-changed";

const canUseWindow = (): boolean => typeof window !== "undefined";

export function readStoredCandidateCvToken(): string | null {
  if (!canUseWindow()) {
    return null;
  }

  const token = window.localStorage.getItem(CANDIDATE_CV_TOKEN_STORAGE_KEY);
  return token?.trim() ? token.trim() : null;
}

export function writeStoredCandidateCvToken(token: string): void {
  if (!canUseWindow()) {
    return;
  }

  const normalized = token.trim();
  if (!normalized) {
    window.localStorage.removeItem(CANDIDATE_CV_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event(CANDIDATE_CV_TOKEN_EVENT_NAME));
    return;
  }

  window.localStorage.setItem(CANDIDATE_CV_TOKEN_STORAGE_KEY, normalized);
  window.dispatchEvent(new Event(CANDIDATE_CV_TOKEN_EVENT_NAME));
}

export function clearStoredCandidateCvToken(): void {
  if (!canUseWindow()) {
    return;
  }

  window.localStorage.removeItem(CANDIDATE_CV_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(CANDIDATE_CV_TOKEN_EVENT_NAME));
}

export function hasStoredCandidateCvToken(): boolean {
  return Boolean(readStoredCandidateCvToken());
}

export function candidateCvTokenStorageEventName(): string {
  return CANDIDATE_CV_TOKEN_EVENT_NAME;
}
