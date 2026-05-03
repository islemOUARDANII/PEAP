import type { Role } from "@/models";

export interface TaxonomyQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  type?: string;
}

export interface UnresolvedCodesQueryParams {
  limit?: number;
  offset?: number;
  aggregateType?: string;
  resolved?: boolean;
}

export interface UsersQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface ProviderRegistrationRequestsQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
}

export interface AuditLogsQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  action?: string;
  entityType?: string;
  resultStatus?: string;
}

export interface PipelineItemsQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  entityType?: string;
  status?: string;
}

export const queryKeys = {
  roles: () => ["roles"] as const,
  roleProfile: (role: Role) => ["roles", role, "profile"] as const,
  catalog: () => ["catalog"] as const,
  candidate: {
    dashboard: () => ["candidate", "dashboard"] as const,
    profile: () => ["candidate", "profile"] as const,
    keywords: () => ["candidate", "profile", "keywords"] as const,
    offerThreshold: () => ["candidate", "profile", "offer-threshold"] as const,
    bundle: () => ["candidate", "bundle"] as const,
    matches: () => ["candidate", "matches"] as const,
    match: (id?: string) => ["candidate", "matches", id ?? "default"] as const,
    jobOffers: () => ["candidate", "job-offers"] as const,
    recommendations: () => ["candidate", "recommendations"] as const,
    cvUploadStatus: (cvId?: string) => ["candidate", "cv-upload", cvId ?? "default"] as const,
    cvRecords: () => ["candidate", "cv-records"] as const,
  },
  provider: {
    dashboard: () => ["provider", "dashboard"] as const,
    offers: () => ["provider", "offers"] as const,
    offer: (id?: string) => ["provider", "offers", id ?? "default"] as const,
    candidates: () => ["provider", "candidates"] as const,
    candidate: (id?: string) => ["provider", "candidates", id ?? "default"] as const,
  },
  advisor: {
    dashboard: () => ["advisor", "dashboard"] as const,
    taxonomySummary: () => ["advisor", "taxonomy", "summary"] as const,
    taxonomy: (params: TaxonomyQueryParams = {}) => ["advisor", "taxonomy", params] as const,
    taxonomyDetail: (nodeId?: string) => ["advisor", "taxonomy", "detail", nodeId ?? "none"] as const,
    unresolvedCodes: (params: UnresolvedCodesQueryParams = {}) =>
      ["advisor", "taxonomy", "unresolved-codes", params] as const,
    users: (params: UsersQueryParams = {}) => ["advisor", "users", params] as const,
    providerRegistrationRequests: (params: ProviderRegistrationRequestsQueryParams = {}) =>
      ["advisor", "provider-registration-requests", params] as const,
    auditLogs: (params: AuditLogsQueryParams = {}) => ["advisor", "audit-logs", params] as const,
    pipelineSummary: () => ["advisor", "pipeline", "summary"] as const,
    pipelineItems: (params: PipelineItemsQueryParams = {}) =>
      ["advisor", "pipeline", "items", params] as const,
    pipelineDetail: (entityType?: string, sourceId?: string) =>
      ["advisor", "pipeline", "detail", entityType ?? "none", sourceId ?? "none"] as const,
    dataExplorer: () => ["advisor", "data-explorer"] as const,
  },
};
