const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(toTrimmedString(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
};

const apiBaseUrl =
  toTrimmedString(import.meta.env.VITE_API_BASE_URL) || "http://localhost:8000";
const adminAuthHeader = toTrimmedString(import.meta.env.VITE_ADMIN_AUTH_HEADER);
const adminApiKey = toTrimmedString(import.meta.env.VITE_ADMIN_API_KEY);

export const appEnv = {
  apiBaseUrl,
  authHeader: adminAuthHeader || "Authorization",
  adminApiKey,
  auditLookupLimit: toPositiveInteger(
    import.meta.env.VITE_AUDIT_LOOKUP_LIMIT ?? import.meta.env.VITE_AUTH_AUDIT_LOOKUP_LIMIT,
    300,
  ),
  enableMockFallback: toBoolean(import.meta.env.VITE_ENABLE_MOCK_FALLBACK, false),
} as const;
