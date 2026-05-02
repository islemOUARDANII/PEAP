import { ApiServiceError } from "./client";

const missingCandidateProfileMessage = "no canonical candidate profile is linked to this account";

const flattenErrorText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(flattenErrorText).join(" ");
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(flattenErrorText).join(" ");
  }

  return "";
};

export function isMissingCandidateProfileError(error: unknown): boolean {
  if (!(error instanceof ApiServiceError) || error.status !== 404) {
    return false;
  }

  const searchableText = `${error.message} ${flattenErrorText(error.details)}`.toLowerCase();
  return searchableText.includes(missingCandidateProfileMessage);
}
