import { appEnv } from "@/config/env";
import { clearStoredSession } from "@/services/auth/sessionStorage";
import { readStoredSession } from "@/services/auth/sessionStorage";

type QueryValue = string | number | boolean | null | undefined;

interface ApiRequestOptions {
  query?: Record<string, QueryValue>;
  baseUrl?: string;
  skipAuth?: boolean;
  authToken?: string;
  authHeader?: string;
  disable401Redirect?: boolean;
}

export const apiUnauthorizedEventName = "matchcore:api-unauthorized";

export class ApiServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown,
    public readonly headers: Record<string, string> = {},
    public readonly rawResponse?: unknown,
  ) {
    super(message);
    this.name = "ApiServiceError";
  }
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizePath = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
};

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const headersToRecord = (headers: Headers): Record<string, string> =>
  Object.fromEntries(headers.entries());

const buildUrl = (
  path: string,
  baseUrl: string,
  query?: Record<string, QueryValue>,
): string => {
  const normalizedPath = normalizePath(path);
  const resolvedBase = trimTrailingSlash(baseUrl || appEnv.apiBaseUrl);

  const combined = isAbsoluteUrl(normalizedPath)
    ? normalizedPath
    : `${resolvedBase}${normalizedPath}`;

  const url = new URL(combined, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const detail = record.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const issue = item as Record<string, unknown>;
        const loc = Array.isArray(issue.loc)
          ? issue.loc.filter((part) => part !== "body").join(".")
          : "field";
        const msg = typeof issue.msg === "string" ? issue.msg : "Invalid value";
        return `${loc || "field"}: ${msg}`;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  if (detail && typeof detail === "object") {
    const nestedRecord = detail as Record<string, unknown>;
    const nestedDetail = nestedRecord.detail;
    if (typeof nestedDetail === "string") {
      return nestedDetail;
    }
    const upstreamBody = nestedRecord.upstream_body;
    if (upstreamBody && typeof upstreamBody === "object") {
      const upstreamDetail = (upstreamBody as Record<string, unknown>).detail;
      if (typeof upstreamDetail === "string") {
        return upstreamDetail;
      }
    }
    if (typeof nestedRecord.message === "string") {
      return nestedRecord.message;
    }
  }

  return fallback;
};

const parseResponse = async (
  response: Response,
): Promise<{ payload: unknown; rawText: string | null }> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return { payload: await response.json(), rawText: null };
    } catch {
      return { payload: null, rawText: null };
    }
  }

  const raw = await response.text();
  return { payload: raw === "" ? null : raw, rawText: raw === "" ? null : raw };
};

const emitUnauthorized = (status: number, path: string) => {
  clearStoredSession();

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(apiUnauthorizedEventName, {
      detail: { status, path },
    }),
  );
};

export interface ApiResponseEnvelope<T> {
  status: number;
  headers: Record<string, string>;
  data: T;
  rawResponse: unknown;
}

export async function apiRequestDetailed<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<ApiResponseEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const resolvedAuthHeader = options.authHeader || appEnv.authHeader;
  const resolvedSession = readStoredSession();
  const resolvedToken =
    options.authToken ||
    (!options.skipAuth ? resolvedSession?.token : "") ||
    (!options.skipAuth ? appEnv.adminApiKey : "");

  if (resolvedToken) {
    if (resolvedAuthHeader.toLowerCase() === "authorization") {
      headers.set(resolvedAuthHeader, `Bearer ${resolvedToken}`);
    } else {
      headers.set(resolvedAuthHeader, resolvedToken);
    }
  }

  const url = buildUrl(path, options.baseUrl || appEnv.apiBaseUrl, options.query);
  const response = await fetch(url, { ...init, headers });
  const { payload, rawText } = await parseResponse(response);

  if (response.status === 401 && !options.skipAuth && !options.disable401Redirect) {
    emitUnauthorized(response.status, path);
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload, `Request failed with status ${response.status}`);
    throw new ApiServiceError(
      message,
      response.status,
      payload,
      headersToRecord(response.headers),
      rawText ?? payload,
    );
  }

  return {
    status: response.status,
    headers: headersToRecord(response.headers),
    data: payload as T,
    rawResponse: rawText ?? payload,
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiRequestDetailed<T>(path, init, options);
  return response.data;
}

export async function apiJsonRequest<T>(
  path: string,
  method: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}
