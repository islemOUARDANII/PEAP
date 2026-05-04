import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "./queryKeys";
import type {
  AuditLogsQueryParams,
  PipelineItemsQueryParams,
  ProviderRegistrationRequestsQueryParams,
  TaxonomyQueryParams,
  UnresolvedCodesQueryParams,
  UsersQueryParams,
} from "./queryKeys";
import {
  gatewayApi,
  humanizeContractType,
  inferCandidateDisplayName,
  inferCandidateLocation,
  inferLanguageLabel,
  inferSkillLabel,
  type CandidateCvRecord,
  type CandidateLanguageRecord,
  type CandidateProfileBundle,
  type CandidateSkillRecord,
  type EmployerOffer,
  type MatchingResultRecord,
  type SearchCandidateResult,
  type SearchOfferResult,
  type TaxonomyNodeRecord,
} from "./gateway";
import type {
  AdminCreateProviderPayload,
  Candidate,
  CandidateDashboardData,
  CandidateDocument,
  CandidateProfile,
  CandidateProfileUpdate,
  CandidateRecommendationsData,
  CreateJobOfferPayload,
  DataExplorerDataset,
  Job,
  OfferParsedOutput,
  OfferParsePayload,
  PipelineItem,
  PipelineItemDetail,
  PipelineRun,
  PipelineSummary,
  ProviderDashboardData,
  ProviderOfferDetail,
  ProviderRegistrationRequestRecord,
  Role,
  RoleOption,
  RoleProfile,
  TaxonomyNode,
  TaxonomyNodeDetail,
  TaxonomySummary,
  Training,
  UnresolvedCode,
} from "@/models";
import {
  getCandidateMatchingOffers,
  type CandidateMatchedOfferSummary,
} from "@/services/candidate/candidateMatchingOffers";

const candidateQueryOptions = {
  retry: false,
  staleTime: 30_000,
  refetchOnWindowFocus: false,
};

const roleOptions: RoleOption[] = [
  {
    id: "candidate",
    label: "Candidate",
    description: "Access your candidate profile, CV workflow, and indexed offers.",
  },
  {
    id: "provider",
    label: "Employer",
    description: "Manage your employer profile, offers, and candidate search.",
  },
  {
    id: "advisor",
    label: "Advisor / Admin",
    description: "Review operations, matching configuration, and platform diagnostics.",
  },
];

const emptyRecommendations: CandidateRecommendationsData = {
  trainings: [],
  relatedRoles: [],
  skillsToImprove: [],
  actions: [],
  learningPath: [],
  limited: true,
  limitedReason: "Recommendation endpoints are not exposed in the API Gateway yet.",
};

const toArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const toStringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);

const toNullableString = (value: unknown): string | null => {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : null;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeScore = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const startCase = (value: string | null | undefined): string => {
  const normalized = toStringValue(value).trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
};

const initialsFromName = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("") || "NA";

const daysSince = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
};

const safeJson = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const searchRawString = (raw: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const candidate = toNullableString(raw[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const extractRequirementLabel = (value: Record<string, unknown>): string => {
  const label =
    toNullableString(value.raw_value) ??
    toNullableString(value.node_label) ??
    toNullableString(value.label) ??
    toNullableString(value.value);
  return label ?? "Requirement";
};

const inferRequirementMust = (value: Record<string, unknown>, fallback = false): boolean => {
  if (typeof value.is_must === "boolean") {
    return value.is_must;
  }

  const normalized = toStringValue(value.importance ?? value.kind).toLowerCase();
  if (normalized.includes("must") || normalized.includes("required")) {
    return true;
  }
  if (normalized.includes("optional") || normalized.includes("nice")) {
    return false;
  }
  return fallback;
};

const requirementTypeMatches = (
  value: Record<string, unknown>,
  ...expectedTypes: string[]
): boolean => {
  const normalizedType = toStringValue(value.criterion_type || value.type).toUpperCase().trim();
  return expectedTypes.some((expectedType) => normalizedType === expectedType.toUpperCase());
};

const mapOfferStatus = (value: string): Job["status"] => {
  const normalized = value.trim().toUpperCase();
  if (["ACTIVE", "OPEN", "PUBLISHED", "VALIDATED", "SUBMITTED"].includes(normalized)) {
    return "Active";
  }
  if (["DRAFT", "PENDING_VALIDATION", "PENDING_REVIEW"].includes(normalized)) {
    return "Draft";
  }
  if (["ARCHIVED", "CLOSED", "REJECTED", "DELETED"].includes(normalized)) {
    return "Archived";
  }
  return "Paused";
};

const mapCvRecordToDocument = (record: CandidateCvRecord): CandidateDocument => ({
  id: record.id,
  docType: record.isCurrent ? "Current CV" : "CV",
  filename: record.originalFilename ?? record.blobName,
  mimeType: record.mimeType,
  uploadedAt: record.uploadedAt,
});

const mapBundleToCandidateProfile = (bundle: CandidateProfileBundle): CandidateProfile => {
  const displayName = inferCandidateDisplayName(bundle);
  const topSkills = bundle.skills.map(inferSkillLabel);
  const codingSkills = topSkills.filter((skill) =>
    /(python|java|react|sql|typescript|javascript|docker|node|spark|kafka)/i.test(skill),
  );

  return {
    name: displayName,
    initials: initialsFromName(displayName),
    headline:
      bundle.experience[0]?.jobTitleRaw ??
      bundle.education[0]?.diplomaLabel ??
      "Candidate profile",
    location: inferCandidateLocation(bundle),
    email: bundle.contact?.email ?? "",
    phone: bundle.contact?.phone ?? "",
    primaryLang: bundle.primaryLanguage ?? undefined,
    occupation: bundle.experience[0]?.jobTitleRaw ?? "Candidate",
    occupationConfidence: 0,
    yearsExperience: Math.max(
      0,
      Math.round(
        bundle.experience.reduce(
          (total, item) => total + Math.max(0, (item.durationMonths ?? 0) / 12),
          0,
        ),
      ),
    ),
    skillsCount: topSkills.length,
    coreSkills: topSkills.slice(0, 8),
    secondarySkills: topSkills.slice(8, 16),
    suggestedSkills: [],
    experiences: bundle.experience.map((item) => ({
      company: item.companyName ?? "Company not specified",
      role: item.jobTitleRaw ?? "Experience entry",
      years: [item.startDate, item.endDate].filter(Boolean).join(" - "),
      description: item.description ?? "",
    })),
    jobExperiences: bundle.experience.map((item) => ({
      company: item.companyName ?? "Company not specified",
      role: item.jobTitleRaw ?? "Experience entry",
      years: [item.startDate, item.endDate].filter(Boolean).join(" - "),
      description: item.description ?? "",
    })),
    internshipExperiences: [],
    codingSkills,
    education: bundle.education.map((item) => ({
      school: item.institution ?? "Institution not specified",
      degree: item.diplomaLabel ?? item.levelLabel ?? item.levelCode ?? "Education entry",
      years: item.graduationYear ? String(item.graduationYear) : "",
    })),
    languages: bundle.languages.map((language) => ({
      label: inferLanguageLabel(language),
      level: language.level ?? "",
    })),
    documents: bundle.cvRecords.map(mapCvRecordToDocument),
  };
};

const mapBundleToCandidateCard = (
  bundle: CandidateProfileBundle,
  extras: Partial<Candidate> = {},
): Candidate => {
  const displayName = inferCandidateDisplayName(bundle);
  const skills = bundle.skills.map(inferSkillLabel);

  return {
    id: bundle.id,
    name: displayName,
    initials: initialsFromName(displayName),
    occupation: bundle.experience[0]?.jobTitleRaw ?? "Candidate",
    location: inferCandidateLocation(bundle) || "Location not specified",
    experienceYears: Math.max(
      0,
      Math.round(
        bundle.experience.reduce(
          (total, item) => total + Math.max(0, (item.durationMonths ?? 0) / 12),
          0,
        ),
      ),
    ),
    score: extras.score ?? 0,
    topSkills: skills,
    missing: extras.missing ?? [],
    summary:
      bundle.experience[0]?.description ??
      bundle.education[0]?.diplomaLabel ??
      "Candidate record loaded from the API Gateway.",
    status: extras.status ?? "Reviewed",
    email: bundle.contact?.email ?? undefined,
    phone: bundle.contact?.phone ?? undefined,
    documents: bundle.cvRecords.map(mapCvRecordToDocument),
    experiences: bundle.experience.map((item) => ({
      company: item.companyName ?? "Company not specified",
      role: item.jobTitleRaw ?? "Experience entry",
      years: [item.startDate, item.endDate].filter(Boolean).join(" - "),
      description: item.description ?? "",
    })),
    jobExperiences: bundle.experience.map((item) => ({
      company: item.companyName ?? "Company not specified",
      role: item.jobTitleRaw ?? "Experience entry",
      years: [item.startDate, item.endDate].filter(Boolean).join(" - "),
      description: item.description ?? "",
    })),
    internshipExperiences: [],
    codingSkills: skills.filter((skill) =>
      /(python|java|react|sql|typescript|javascript|docker|node|spark|kafka)/i.test(skill),
    ),
    education: bundle.education.map((item) => ({
      school: item.institution ?? "Institution not specified",
      degree: item.diplomaLabel ?? item.levelLabel ?? item.levelCode ?? "Education entry",
      years: item.graduationYear ? String(item.graduationYear) : "",
    })),
    languages: bundle.languages.map((language) => ({
      label: inferLanguageLabel(language),
      level: language.level ?? "",
    })),
    ...extras,
  };
};

const mapSearchOfferToJob = (offer: SearchOfferResult): Job => {
  const raw = safeJson(offer.raw);
  const company =
    searchRawString(raw, ["employer_name", "company_name", "company", "organization"]) ??
    offer.companyId ??
    "Employer";
  const matchedSkills = offer.skills.slice(0, Math.min(4, offer.skills.length));

  return {
    id: offer.offerId,
    title: offer.title,
    company,
    location: offer.location ?? "Location not specified",
    contract: humanizeContractType(offer.contractType),
    level: startCase(offer.workMode) || "Not specified",
    postedDays: daysSince(offer.createdAt),
    applicants: toNumberValue(raw.applicants ?? raw.application_count),
    matched: toNumberValue(raw.match_count ?? raw.results_count),
    status: mapOfferStatus(offer.status ?? "ACTIVE"),
    required: offer.skills,
    preferred: [],
    score: normalizeScore(offer.score),
    matchedSkills,
    missingSkills: [],
    scoreBreakdown: [],
  };
};

const mapEmployerOfferToJob = (offer: EmployerOffer): Job => {
  const required = offer.requirements
    .filter((item) => item.isMust)
    .map((item) => item.nodeLabel ?? item.rawValue ?? item.criterionType);
  const preferred = offer.requirements
    .filter((item) => !item.isMust)
    .map((item) => item.nodeLabel ?? item.rawValue ?? item.criterionType);

  return {
    id: offer.id,
    anetiIdentifier: offer.anetiIdentifier ?? null,
    title: offer.title,
    company: offer.companyName ?? offer.employerName ?? "Employer",
    location: offer.locationLabel || "Location not specified",
    contract: humanizeContractType(offer.contractType),
    level: startCase(offer.workMode) || "Not specified",
    postedDays: daysSince(offer.publishedAt ?? offer.createdAt),
    applicants: 0,
    matched: 0,
    status: mapOfferStatus(offer.status),
    required,
    preferred,
  };
};

const mapMatchedOfferToJob = (offer: CandidateMatchedOfferSummary): Job => ({
  id: offer.offerId,
  title: offer.title,
  company: offer.companyName,
  location: offer.location,
  contract: offer.contractType ?? "Not specified",
  level: offer.workMode ?? "Not specified",
  postedDays: daysSince(offer.publishedAt),
  applicants: 0,
  matched: 0,
  status: mapOfferStatus(offer.status ?? "ACTIVE"),
  required: offer.skills,
  preferred: offer.languages,
  score: offer.scoreGlobal,
  matchedSkills: offer.skills.slice(0, Math.min(4, offer.skills.length)),
  missingSkills: [],
  scoreBreakdown: [],
});

const getCandidateMatchingJobs = async (): Promise<{
  bundle: CandidateProfileBundle;
  activeOffersCount: number;
  jobs: Job[];
}> => {
  const bundle = await gatewayApi.candidate.getBundle();

  if (!bundle.id) {
    return {
      bundle,
      activeOffersCount: 0,
      jobs: [],
    };
  }

  const matchingData = await getCandidateMatchingOffers(bundle.id).catch(() => ({
    matchingAvailable: false,
    activeOffersCount: null,
    offers: [] as CandidateMatchedOfferSummary[],
    unavailableMessage: null,
  }));

  return {
    bundle,
    activeOffersCount: matchingData.activeOffersCount ?? 0,
    jobs: matchingData.offers.map(mapMatchedOfferToJob),
  };
};

const mapSearchCandidateToCandidate = (
  result: SearchCandidateResult,
  extras: Partial<Candidate> = {},
): Candidate => {
  const raw = safeJson(result.raw);
  const name =
    searchRawString(raw, ["full_name", "candidate_label", "name", "label"]) ??
    `Candidate ${result.candidateId.slice(0, 8)}`;
  const summary =
    searchRawString(raw, ["summary", "headline", "profile_summary"]) ??
    (result.skills.length
      ? `Indexed skills: ${result.skills.slice(0, 6).join(", ")}`
      : "Indexed candidate profile from the search service.");

  const score = normalizeScore(result.score);
  const status: Candidate["status"] =
    score >= 80 ? "Shortlisted" : score >= 50 ? "Reviewed" : "New";

  return {
    id: result.candidateId,
    name,
    initials: initialsFromName(name),
    occupation:
      searchRawString(raw, ["occupation", "occupation_label", "headline"]) ??
      result.education ??
      "Indexed candidate",
    location: result.location ?? "Location not specified",
    experienceYears: result.yearsExperience,
    score,
    topSkills: result.skills,
    missing: extras.missing ?? [],
    summary,
    status: extras.status ?? status,
    email: searchRawString(raw, ["email"]),
    phone: searchRawString(raw, ["phone"]),
    education: result.education
      ? [{ school: "Not specified", degree: result.education, years: "" }]
      : [],
    languages: result.primaryLang
      ? [{ label: result.primaryLang, level: "" }]
      : [],
    codingSkills: result.skills.filter((skill) =>
      /(python|java|react|sql|typescript|javascript|docker|node|spark|kafka)/i.test(skill),
    ),
    ...extras,
  };
};

const mapMatchingResultToJob = (result: MatchingResultRecord): Job => ({
  id: result.offerId ?? result.id,
  title: result.offerTitle ?? "Matched offer",
  company: "API Gateway",
  location: "Not specified",
  contract: "Not specified",
  level: "Not specified",
  postedDays: 0,
  applicants: 0,
  matched: 1,
  status: "Active",
  required: [],
  preferred: [],
  score: normalizeScore(result.scoreGlobal),
  matchedSkills: [],
  missingSkills: [],
  scoreBreakdown: [],
});

const mapTaxonomyType = (value: string): TaxonomyNode["type"] => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "OCCUPATION") return "Occupation";
  if (normalized === "SKILL") return "Skill";
  if (normalized === "TECHNOLOGY") return "Technology";
  if (normalized === "TOOL") return "Tool";
  if (normalized === "KNOWLEDGE") return "Knowledge";
  if (normalized === "ABILITY") return "Ability";
  if (normalized === "WORK_ACTIVITY") return "Work Activity";
  return "Task";
};

const mapTaxonomyNodeRecord = (node: TaxonomyNodeRecord): TaxonomyNode => {
  const raw = safeJson(node.extraJson);
  const aliases = toArray(raw.aliases as string[] | undefined);
  const relations = toArray(raw.relations as string[] | undefined);
  const source = toStringValue(node.source || raw.source || "Internal");
  const sourceLabel =
    source.toUpperCase().includes("ESCO")
      ? "ESCO"
      : source.toUpperCase().includes("O*NET") || source.toUpperCase().includes("ONET")
        ? "O*NET"
        : "Internal";

  return {
    id: node.id,
    code: node.sourceCode ?? toStringValue(raw.code || node.id),
    label: node.label,
    type: mapTaxonomyType(node.nodeType),
    aliases,
    aliasCount: aliases.length,
    relationCount: relations.length,
    source: sourceLabel,
    related: relations,
    description:
      toStringValue(raw.description || raw.summary || raw.definition) ||
      "Taxonomy node loaded from /taxonomy/nodes.",
    updated: toStringValue(raw.updated_at || raw.updated || raw.created_at),
    domain: toNullableString(raw.domain) ?? undefined,
    taxonomyName: toNullableString(raw.taxonomy_name) ?? undefined,
    modelName: toNullableString(raw.model_name) ?? undefined,
    modelVersion: toNullableString(raw.model_version) ?? undefined,
    parentCode: toNullableString(raw.parent_code) ?? undefined,
    labelFr: toNullableString(raw.label_fr) ?? undefined,
    labelEn: toNullableString(raw.label_en) ?? undefined,
    status: node.active ? "Active" : "Inactive",
    isLeaf: Boolean(raw.is_leaf),
    isDeprecated: node.active === false,
    raw,
  };
};

const buildTaxonomySummary = (nodes: TaxonomyNode[]): TaxonomySummary => {
  const byType = new Map<string, number>();
  const byModel = new Map<string, number>();

  for (const node of nodes) {
    byType.set(node.type, (byType.get(node.type) ?? 0) + 1);
    byModel.set(node.modelName ?? node.source, (byModel.get(node.modelName ?? node.source) ?? 0) + 1);
  }

  return {
    metrics: {
      total_nodes: nodes.length,
      total_labels: nodes.length,
      total_aliases: nodes.reduce((total, node) => total + (node.aliasCount ?? 0), 0),
      total_relations: nodes.reduce((total, node) => total + (node.relationCount ?? 0), 0),
      unresolved_codes: 0,
      taxonomy_models: byModel.size,
    },
    node_type_distribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    taxonomy_distribution: Array.from(byModel.entries()).map(([name, value]) => ({ name, value })),
    occupation_breakdown: Array.from(byType.entries())
      .filter(([name]) => name === "Occupation")
      .map(([name, value]) => ({ name, value })),
  };
};

const groupByDay = (values: string[]): Array<{ day: string; matches: number; applications: number }> => {
  const counts = new Map<string, number>();
  for (const value of values) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    const day = new Date(parsed).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([day, count]) => ({ day, matches: count, applications: count }));
};

export function useRolesQuery() {
  return useQuery({
    queryKey: queryKeys.roles(),
    queryFn: async () => roleOptions,
    staleTime: Infinity,
  });
}

export function useRoleProfileQuery(role: Role) {
  return useQuery({
    queryKey: queryKeys.roleProfile(role),
    queryFn: async (): Promise<RoleProfile> => ({
      role,
      name: startCase(role),
      email: `${role}@localhost`,
      initials: role.slice(0, 2).toUpperCase(),
    }),
    staleTime: Infinity,
  });
}

export function useCatalogOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.catalog(),
    queryFn: async () => ({
      contractTypes: await gatewayApi.referentials.contractTypes(),
      governorates: await gatewayApi.referentials.governorates(),
    }),
    staleTime: 5 * 60_000,
  });
}

export function useCandidateDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.candidate.dashboard(),
    queryFn: async (): Promise<CandidateDashboardData> => {
      const { bundle, activeOffersCount, jobs } = await getCandidateMatchingJobs();
      const profile = mapBundleToCandidateProfile(bundle);
      const topMatches = jobs.slice(0, 4);

      return {
        profileName: profile.name,
        openOffers: activeOffersCount,
        profileCompletion:
          (bundle.identity ? 25 : 0) +
          (bundle.contact ? 25 : 0) +
          (bundle.skills.length > 0 ? 25 : 0) +
          (bundle.currentCv ? 25 : 0),
        profileSections: [
          { label: "Identity", value: bundle.identity ? 100 : 0 },
          { label: "Contact", value: bundle.contact ? 100 : 0 },
          { label: "Skills", value: bundle.skills.length > 0 ? 100 : 0 },
          { label: "CV", value: bundle.currentCv ? 100 : 0 },
        ],
        matchedJobs: topMatches.length,
        averageMatchScore:
          topMatches.length > 0
            ? Math.round(
              topMatches.reduce((total, item) => total + (item.score ?? 0), 0) /
              topMatches.length,
            )
            : 0,
        recommendationCount: 0,
        topMatches,
        matchingActivity: groupByDay([bundle.currentCv?.uploadedAt ?? "", ...topMatches.map(() => new Date().toISOString())]),
        detectedSkills: bundle.skills.map(inferSkillLabel),
        missingSkills: [],
        activityTimeline: bundle.cvRecords.slice(0, 4).map((record) => ({
          id: record.id,
          text: `${record.originalFilename ?? record.blobName} (${record.parsingStatus})`,
          time: record.uploadedAt,
        })),
        pipelineStatus: {
          current: bundle.currentCv ? { parsing_status: bundle.currentCv.parsingStatus } : null,
          lastUploadAt: bundle.currentCv?.uploadedAt ?? null,
          steps: [
            {
              label: "CV uploaded",
              status: bundle.currentCv ? "complete" : "pending",
              timestamp: bundle.currentCv?.uploadedAt ?? null,
            },
            {
              label: "CV parsed",
              status:
                bundle.currentCv?.parsingStatus === "PARSED" ? "complete" : "pending",
              timestamp: bundle.currentCv?.updatedAt ?? null,
            },
          ],
        },
      };
    },
    ...candidateQueryOptions,
  });
}

export function useCandidateProfileQuery() {
  return useQuery({
    queryKey: queryKeys.candidate.profile(),
    queryFn: async () => mapBundleToCandidateProfile(await gatewayApi.candidate.getBundle()),
    ...candidateQueryOptions,
  });
}

export function useCandidateMatchesQuery() {
  return useQuery({
    queryKey: queryKeys.candidate.matches(),
    queryFn: async () => {
      const { jobs } = await getCandidateMatchingJobs();
      return jobs.slice(0, 12);
    },
    ...candidateQueryOptions,
  });
}

export function useCandidateMatchQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.candidate.match(id),
    queryFn: async () => {
      const { jobs } = await getCandidateMatchingJobs();
      const offer = jobs.find(
        (item) => item.id === id,
      );

      if (!offer) {
        throw new Error("Offer not found");
      }

      return offer;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCandidateJobOffersQuery() {
  return useQuery({
    queryKey: queryKeys.candidate.jobOffers(),
    queryFn: async () => {
      const { jobs } = await getCandidateMatchingJobs();
      return jobs.slice(0, 24);
    },
    ...candidateQueryOptions,
  });
}

export function useCandidateRecommendationsQuery() {
  return useQuery({
    queryKey: queryKeys.candidate.recommendations(),
    queryFn: async (): Promise<CandidateRecommendationsData> => emptyRecommendations,
    ...candidateQueryOptions,
  });
}

export function useCandidateCvUploadStatusQuery(cvId?: string) {
  return useQuery({
    queryKey: queryKeys.candidate.cvUploadStatus(cvId),
    queryFn: async () => {
      const records = await gatewayApi.candidate.listCvRecords();
      const record = records.find((item) => item.id === cvId || item.cvId === cvId);
      return record
        ? {
          cvId: record.id,
          traceId: record.storageKey,
          status: record.parsingStatus,
          linkedCandidateId: record.cvId,
          pipeline: {
            current: { parsing_status: record.parsingStatus },
            lastUploadAt: record.uploadedAt,
            steps: [
              { label: "Uploaded", status: "complete", timestamp: record.uploadedAt },
              {
                label: "Parsed",
                status: record.parsingStatus === "PARSED" ? "complete" : "pending",
                timestamp: record.updatedAt,
              },
            ],
          },
        }
        : null;
    },
    enabled: Boolean(cvId),
    retry: false,
  });
}

export function useUpdateCandidateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CandidateProfileUpdate) => {
      await gatewayApi.candidate.updateProfile({
        primary_language: payload.primaryLang ?? null,
      });
      await gatewayApi.candidate.updateContact({
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.location ?? null,
      });
      return gatewayApi.candidate.getBundle();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.bundle() });
    },
  });
}

export function useUploadCandidateCvMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => gatewayApi.candidate.uploadCv(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.bundle() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.cvRecords() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.matches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.jobOffers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidate.recommendations() });
    },
  });
}

export function useProviderDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.provider.dashboard(),
    queryFn: async (): Promise<ProviderDashboardData> => {
      const [offers, applications, candidateSearch] = await Promise.all([
        gatewayApi.employer.listOffers(),

        gatewayApi.employer.listApplications().catch(() => []),

        gatewayApi.search.candidates({ filters: { size: 8 } }).catch(() => ({
          total: 0,
          filtersApplied: {},
          results: [] as SearchCandidateResult[],
          raw: {},
        })),
      ]);

      const activeOffersRaw = offers.filter(
        (offer) => mapOfferStatus(offer.status) === "Active",
      );

      const activeOffers = activeOffersRaw.map(mapEmployerOfferToJob);
      const topOffers = offers.slice(0, 5).map(mapEmployerOfferToJob);

      const recentCandidates = candidateSearch.results.map((result) =>
        mapSearchCandidateToCandidate(result),
      );

      const scores = recentCandidates
        .map((candidate) => candidate.score)
        .filter((score) => score > 0);

      const applicationsByOffer = new Map<string, number>();

      for (const application of applications) {
        applicationsByOffer.set(
          application.offerId,
          (applicationsByOffer.get(application.offerId) ?? 0) + 1,
        );
      }

      const offersForChart = activeOffersRaw.slice(0, 8);

      const matchedCountsByOffer = await Promise.all(
        offersForChart.map(async (offer) => {
          const skills = offer.requirements
            .map((item) => item.nodeLabel ?? item.rawValue ?? "")
            .filter(Boolean)
            .slice(0, 5);

          const response = await gatewayApi.search
            .candidates({
              filters: {
                query: [offer.title, ...skills].join(" ").trim(),
                skills,
                location: offer.governorateLabel ?? undefined,
                size: 50,
              },
            })
            .catch(() => ({
              total: 0,
              filtersApplied: {},
              results: [] as SearchCandidateResult[],
              raw: {},
            }));

          return {
            offer,
            matchedCount: response.total || response.results.length,
            applicationsCount: applicationsByOffer.get(offer.id) ?? 0,
          };
        }),
      );

      const matchingActivity = matchedCountsByOffer.map((item) => {
        const shortTitle =
          item.offer.title.length > 18
            ? `${item.offer.title.slice(0, 18)}...`
            : item.offer.title;

        return {
          // On garde "day" pour ne pas casser le type existant MatchingActivityPoint
          // mais ici la valeur représente le nom de l'offre.
          day: item.offer.anetiIdentifier
            ? `${item.offer.anetiIdentifier}`
            : shortTitle,
          matches: item.matchedCount,
          applications: item.applicationsCount,
        };
      });

      return {
        activeOffers,
        topOffers,
        recentCandidates,
        matchingActivity,

        matchedCandidates: matchedCountsByOffer.reduce(
          (total, item) => total + item.matchedCount,
          0,
        ),

        newApplications: applications.filter((application) => {
          const appliedAt = Date.parse(application.appliedAt);
          if (!Number.isFinite(appliedAt)) return false;

          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return appliedAt >= sevenDaysAgo;
        }).length,

        averageMatchQuality:
          scores.length > 0
            ? Math.round(
              scores.reduce((total, value) => total + value, 0) /
              scores.length,
            )
            : 0,
      };
    },
    staleTime: 30_000,
  });
}

export function useProviderOffersQuery() {
  return useQuery({
    queryKey: queryKeys.provider.offers(),
    queryFn: async () => (await gatewayApi.employer.listOffers()).map(mapEmployerOfferToJob),
    staleTime: 30_000,
  });
}

export function useProviderApplicationsQuery() {
  return useQuery({
    queryKey: ['provider', 'applications'],
    queryFn: () => gatewayApi.employer.listApplications(),
    staleTime: 30_000,
  });
}

export function useProviderOfferQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.provider.offer(id),
    queryFn: async (): Promise<ProviderOfferDetail> => {
      const offer = await gatewayApi.employer.getOffer(id as string);
      const skills = offer.requirements
        .map((item) => item.nodeLabel ?? item.rawValue ?? "")
        .filter(Boolean)
        .slice(0, 5);

      const candidatesResponse = await gatewayApi.search
        .candidates({
          filters: {
            query: [offer.title, ...skills].join(" ").trim(),
            skills,
            location: offer.governorateLabel ?? undefined,
            size: 10,
          },
        })
        .catch(() => ({
          total: 0,
          filtersApplied: {},
          results: [] as SearchCandidateResult[],
          raw: {},
        }));

      const candidates = candidatesResponse.results.map((result, index) =>
        mapSearchCandidateToCandidate(result, {
          offerId: offer.id,
          offerTitle: offer.title,
          company: offer.employerName ?? "Employer",
          rank: index + 1,
        }),
      );

      return {
        offer: mapEmployerOfferToJob(offer),
        candidates,
        raw: offer,
      };
    },
    enabled: Boolean(id),
  });
}

export function useDeleteProviderOfferMutation() {
  return useMutation({
    mutationFn: (id: string) => gatewayApi.employer.deleteOffer(id),
  });
}

export function useCreateOfferMutation() {
  return useMutation({
    mutationFn: async (payload: CreateJobOfferPayload) =>
      gatewayApi.employer.createOffer({
        title: payload.title,
        description: payload.rawText,
        number_of_positions: payload.numberOfPositions ?? 1,
        contract_type: payload.contract || null,
        work_mode: payload.workMode ?? "UNKNOWN",
        salary_min: payload.salaryMin ?? null,
        salary_max: payload.salaryMax ?? null,
        country: "TN",
        company_name: payload.company_name ?? payload.companyName ?? null,
        governorate_code: payload.governorate_code ?? payload.governorateCode ?? null,
        delegation_code: payload.delegation_code ?? payload.delegationCode ?? null,
        deadline_at: payload.deadlineAt ?? null,
        requirements: [
          ...toArray(payload.targetOccupations).map((occupation) => ({
            criterion_type: "OCCUPATION",
            raw_value: occupation,
            is_must: false,
            weight: 40,
          })),
          ...payload.requiredSkills.map((skill) => ({
            criterion_type: "SKILL",
            raw_value: skill,
            is_must: true,
            weight: 100,
          })),
          ...payload.preferredSkills.map((skill) => ({
            criterion_type: "SKILL",
            raw_value: skill,
            is_must: false,
            weight: 50,
          })),
          ...(typeof payload.minYearsExperience === "number"
            ? [
              {
                criterion_type: "EXPERIENCE_YEARS",
                raw_value: String(payload.minYearsExperience),
                min_years: payload.minYearsExperience,
                is_must: true,
              },
            ]
            : []),
          ...(payload.educationMin
            ? [
              {
                criterion_type: "DIPLOMA",
                raw_value: payload.educationMin,
                is_must: false,
                weight: 60,
              },
            ]
            : []),
          ...toArray(payload.certificationsPreferred).map((certification) => ({
            criterion_type: "CERTIFICATION",
            raw_value: certification,
            is_must: false,
            weight: 40,
          })),
          ...toArray(payload.languages).map((language) => ({
            criterion_type: "LANGUAGE",
            raw_value: language,
            is_must: false,
            weight: 30,
          })),
          ...(payload.location
            ? [
              {
                criterion_type: "LOCATION",
                raw_value: payload.location,
                is_must: false,
                weight: 30,
              },
            ]
            : []),
        ],
      }),
  });
}

export function useParseOfferMutation() {
  return useMutation({
    mutationFn: async (payload: OfferParsePayload): Promise<OfferParsedOutput> => {
      const response = await gatewayApi.employer.parseOfferDraft({
        raw_text: payload.rawText,
        title: payload.offerId ?? null,
      });
      const draft = safeJson(response.draft);
      const requirements = toArray(
        draft.requirements as Array<Record<string, unknown>> | undefined,
      );
      const skillRequirements = requirements.filter((item) =>
        requirementTypeMatches(item, "SKILL"),
      );
      const mandatorySkillRequirements = skillRequirements.filter((item) =>
        inferRequirementMust(item, true),
      );
      const optionalSkillRequirements = skillRequirements.filter(
        (item) => !inferRequirementMust(item),
      );
      const experienceRequirement = requirements.find((item) =>
        requirementTypeMatches(item, "EXPERIENCE_YEARS"),
      );
      const educationRequirement = requirements.find((item) =>
        requirementTypeMatches(item, "DIPLOMA", "EDUCATION"),
      );
      const certificationRequirements = requirements.filter((item) =>
        requirementTypeMatches(item, "CERTIFICATION"),
      );
      const languageRequirements = requirements.filter((item) =>
        requirementTypeMatches(item, "LANGUAGE"),
      );
      const occupationRequirements = requirements.filter((item) =>
        requirementTypeMatches(item, "OCCUPATION", "APPELLATION"),
      );

      return {
        contract_version: response.parserVersion ?? "api-gateway",
        offer_id: payload.offerId ?? "",
        source: {
          filename: payload.filename ?? "offer.txt",
          mime_type: "text/plain",
        },
        parsing_metadata: {
          parser_version: response.parserVersion ?? "unknown",
          parsed_at: new Date().toISOString(),
          lang: toStringValue(response.mappedPayload.lang || draft.lang || "und"),
          confidence_overall: response.parsingStatus === "PARSED" ? 1 : 0.5,
        },
        offer: {
          title: toStringValue(draft.title),
          company_name:
            toStringValue(
              response.mappedPayload.company_name ||
              response.parsedPayload.company_name ||
              draft.company_name,
            ),
          location:
            toStringValue(
              draft.location ||
              response.parsedPayload.location ||
              response.mappedPayload.location ||
              draft.governorate_label ||
              draft.governorate_code,
            ),
          employment_type: toStringValue(
            draft.contract_type || response.mappedPayload.employment_type,
          ),
          country: toStringValue(draft.country || "TN"),
          company_domain: "",
          external_company_id: "",
          seniority_level: toStringValue(
            response.mappedPayload.seniority_level || response.parsedPayload.seniority_level,
          ),
          industry_code: toStringValue(response.mappedPayload.industry_code),
        },
        occupations_target: occupationRequirements.map((item) => ({
          code: toNullableString(item.node_id) ?? "",
          label: extractRequirementLabel(item),
          weight: toNumberValue(item.weight, 40),
        })),
        requirements: {
          mandatory_skills: mandatorySkillRequirements.map((item) => ({
            code: toNullableString(item.node_id),
            label: extractRequirementLabel(item),
            min_level: toStringValue(item.min_level),
            weight: toNumberValue(item.weight, 100),
          })),
          optional_skills: optionalSkillRequirements.map((item) => ({
            code: toNullableString(item.node_id),
            label: extractRequirementLabel(item),
            weight: toNumberValue(item.weight, 50),
          })),
          min_years_experience: experienceRequirement
            ? toNumberValue(
              experienceRequirement.min_years ??
              draft.min_years_experience ??
              response.parsedPayload.min_years_experience,
              0,
            )
            : toNumberValue(
              draft.min_years_experience ?? response.parsedPayload.min_years_experience,
              0,
            ),
          education_min: educationRequirement
            ? {
              code: toNullableString(educationRequirement.node_id) ?? "",
              label: extractRequirementLabel(educationRequirement),
            }
            : undefined,
          certifications_preferred: certificationRequirements.map((item) => ({
            code: toNullableString(item.node_id),
            label: extractRequirementLabel(item),
          })),
          languages: languageRequirements.map((item) => ({
            code: toNullableString(item.node_id) ?? "",
            label: extractRequirementLabel(item),
            min_level: toStringValue(item.min_level),
          })),
        },
      };
    },
  });
}

export function useSearchCandidatesQuery(params?: {
  filters?: {
    query?: string;
    skills?: string[];
    location?: string;
    size?: number;
  };
}) {
  return useQuery({
    queryKey: ['search', 'candidates', params],
    queryFn: () =>
      gatewayApi.search.candidates({
        filters: {
          query: params?.filters?.query,
          skills: params?.filters?.skills,
          location: params?.filters?.location,
          size: params?.filters?.size ?? 50,
        },
      }),
    staleTime: 30_000,
  });
}
export function useProviderCandidatesQuery() {
  return useQuery({
    queryKey: queryKeys.provider.candidates(),
    queryFn: async () => {
      const response = await gatewayApi.search.candidates({ filters: { size: 20 } });
      return response.results.map((result) => mapSearchCandidateToCandidate(result));
    },
  });
}

export function useSearchOffersQuery(params?: {
  query?: string;
  size?: number;
  filters?: Record<string, unknown>;
}) {
  return useQuery({
    queryKey: ['search', 'offers', params],
    queryFn: () =>
      gatewayApi.search.offers({
        query: params?.query?.trim() || undefined,
        size: params?.size ?? 50,
        filters: params?.filters ?? {},
      }),
    staleTime: 30_000,
  });
}

export function useMatchingModelsQuery() {
  return useQuery({
    queryKey: ['matching', 'models'],
    queryFn: () => gatewayApi.matchingConfig.listModels(),
    staleTime: 30_000,
  });
}

export function useMatchingModelCriteriaQuery(versionId?: string) {
  return useQuery({
    queryKey: ['matching', 'model-criteria', versionId],
    queryFn: () => gatewayApi.matchingConfig.listModelCriteria(versionId!),
    enabled: Boolean(versionId),
    staleTime: 30_000,
  });
}

export function useProviderCandidateQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.provider.candidate(id),
    queryFn: async () => {
      const response = await gatewayApi.search.candidates({
        filters: {
          query: id ?? "",
          size: 50,
        },
      });
      const exact = response.results.find((item) => item.candidateId === id) ?? response.results[0];
      return exact ? mapSearchCandidateToCandidate(exact) : null;
    },
    enabled: Boolean(id),
  });
}

export function useAdvisorDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.dashboard(),
    queryFn: async () => {
      const [dashboard, services, auditSummary, auditEvents, taxonomySample] = await Promise.all([
        gatewayApi.techAdmin.dashboard(),
        gatewayApi.techAdmin.services().catch(() => ({} as Record<string, { status: string }>)),
        gatewayApi.audit.summary().catch(() => ({
          totalEvents: 0,
          errorEvents: 0,
          latestEventTime: null,
          byCategory: [],
          bySeverity: [],
          byEventType: [],
        })),
        gatewayApi.audit.listEvents({ limit: 100 }).catch(() => []),
        gatewayApi.taxonomy.listNodes({ limit: 100 }).catch(() => []),
      ]);

      const serviceStatusCounts = new Map<string, number>();
      Object.values(services).forEach((service) => {
        const key = startCase(service.status) || "Unknown";
        serviceStatusCounts.set(key, (serviceStatusCounts.get(key) ?? 0) + 1);
      });

      const taxonomyNodes = taxonomySample.map(mapTaxonomyNodeRecord);
      const summary = buildTaxonomySummary(taxonomyNodes);
      const recentWarnings = auditEvents
        .filter((event) => ["ERROR", "WARNING"].includes(event.severity.toUpperCase()))
        .slice(0, 6)
        .map((event) => ({
          id: event.id,
          text: event.message || event.eventType,
          time: event.eventTime,
        }));

      return {
        stats: {
          candidateDocuments: auditEvents.filter((event) => event.entityType?.includes("candidate")).length,
          offerDocuments: auditEvents.filter((event) => event.entityType?.includes("offer")).length,
          taxonomyNodes: summary.metrics.total_nodes,
          pipelineRuns: auditSummary.totalEvents,
          errorCount: auditSummary.errorEvents,
        },
        matchingActivity: groupByDay(auditEvents.map((event) => event.eventTime)),
        taxonomyDistribution: summary.node_type_distribution,
        pipelineStatuses: Array.from(serviceStatusCounts.entries()).map(([name, value]) => ({
          name,
          value,
        })),
        scoreDistribution: [],
        recentWarnings:
          recentWarnings.length > 0
            ? recentWarnings
            : [
              {
                id: "dashboard-health",
                text: `API Gateway ${dashboard.apiGateway}, Parsing ${dashboard.parsingService}, Matching ${dashboard.matchingService}, Search ${dashboard.searchService}`,
                time: auditSummary.latestEventTime ?? new Date().toISOString(),
              },
            ],
      };
    },
  });
}

export function useTaxonomyNodesQuery(params: TaxonomyQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.advisor.taxonomy(params),
    queryFn: async () => {
      const nodes = await gatewayApi.taxonomy.listNodes({
        q: params.search,
        type: params.type,
        limit: params.limit ?? 40,
        offset: params.offset ?? 0,
      });

      return {
        items: nodes.map(mapTaxonomyNodeRecord),
        total: (params.offset ?? 0) + nodes.length + (nodes.length === (params.limit ?? 40) ? 1 : 0),
        count: nodes.length,
      };
    },
    placeholderData: (previous) => previous,
  });
}

export function useTaxonomySummaryQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.taxonomySummary(),
    queryFn: async () => {
      const nodes = await gatewayApi.taxonomy.listNodes({ limit: 120, offset: 0 });
      return buildTaxonomySummary(nodes.map(mapTaxonomyNodeRecord));
    },
    staleTime: 5 * 60_000,
  });
}

export function useTaxonomyNodeDetailQuery(nodeId?: string) {
  return useQuery({
    queryKey: queryKeys.advisor.taxonomyDetail(nodeId),
    queryFn: async (): Promise<TaxonomyNodeDetail> => {
      const node = mapTaxonomyNodeRecord(await gatewayApi.taxonomy.getNode(nodeId as string));
      return {
        node,
        labels: [
          {
            id: `${node.id}-label`,
            lang: "und",
            label: node.label,
            description: node.description,
            label_type: "preferred",
            is_preferred: true,
            source: node.source,
          },
        ],
        aliases: toArray(node.aliases).map((alias, index) => ({
          id: `${node.id}-alias-${index}`,
          lang: "und",
          alias,
          alias_type: "alias",
          source: node.source,
          is_preferred: false,
        })),
        relations: [],
      };
    },
    enabled: Boolean(nodeId),
  });
}

export function useUnresolvedCodesQuery(params: UnresolvedCodesQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.advisor.unresolvedCodes(params),
    queryFn: async () => ({
      items: [] as UnresolvedCode[],
      total: 0,
      count: 0,
    }),
    placeholderData: (previous) => previous,
  });
}

export function useAdvisorUsersQuery(params: UsersQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.advisor.users(params),
    queryFn: async () => {
      const allUsers = await gatewayApi.techAdmin.listUsers();
      const filtered = allUsers.filter((user) => {
        const haystack = [user.id, user.email, user.status, ...user.roles.map((role) => role.code)]
          .join(" ")
          .toLowerCase();
        const matchesSearch =
          !params.search || haystack.includes(params.search.trim().toLowerCase());
        const matchesRole =
          !params.role || user.roles.some((role) => role.code.toLowerCase().includes(params.role!.toLowerCase()));
        const matchesStatus =
          !params.status || user.status.toLowerCase() === params.status.toLowerCase();
        return matchesSearch && matchesRole && matchesStatus;
      });
      const offset = params.offset ?? 0;
      const limit = params.limit ?? filtered.length;
      const items = filtered.slice(offset, offset + limit).map((user) => ({
        id: user.id,
        name: user.email,
        email: user.email,
        role: user.roles.map((role) => role.code).join(", ") || "NO_ROLE",
        status: user.status,
        created: user.createdAt,
        createdAt: user.createdAt,
      }));

      return {
        items,
        total: filtered.length,
        count: items.length,
      };
    },
    placeholderData: (previous) => previous,
  });
}

export function useAdvisorProviderRegistrationRequestsQuery(
  params: ProviderRegistrationRequestsQueryParams = {},
) {
  return useQuery({
    queryKey: queryKeys.advisor.providerRegistrationRequests(params),
    queryFn: async () => ({
      items: [] as ProviderRegistrationRequestRecord[],
      total: 0,
      count: 0,
    }),
    placeholderData: (previous) => previous,
  });
}

export function useAuditLogsQuery(params: AuditLogsQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.advisor.auditLogs(params),
    queryFn: async () => {
      const response = await gatewayApi.audit.listEvents({
        limit: params.limit,
        offset: params.offset,
        q: params.search,
        action: params.action,
        entity_type: params.entityType,
        severity: params.resultStatus === "error" ? "ERROR" : undefined,
      });

      const filtered = response
        .filter((event) => {
          if (!params.search && !params.action && !params.entityType && !params.resultStatus) {
            return true;
          }

          const haystack = [
            event.id,
            event.actorUserId,
            event.actorEmail,
            event.action,
            event.entityType,
            event.entityId,
            event.traceId,
            event.message,
          ]
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !params.search || haystack.includes(params.search.trim().toLowerCase());
          const matchesAction =
            !params.action ||
            (event.action ?? "").toLowerCase().includes(params.action.trim().toLowerCase());
          const matchesEntity =
            !params.entityType ||
            (event.entityType ?? "").toLowerCase().includes(params.entityType.trim().toLowerCase());

          const resultStatus =
            event.severity.toUpperCase() === "ERROR"
              ? "error"
              : event.severity.toUpperCase() === "WARNING"
                ? "warning"
                : "success";

          const matchesStatus = !params.resultStatus || resultStatus === params.resultStatus;
          return matchesSearch && matchesAction && matchesEntity && matchesStatus;
        })
        .map((event) => ({
          id: event.id,
          actorUserId: event.actorUserId ?? "-",
          actorEmail: event.actorEmail ?? null,
          action: event.action ?? event.eventType,
          entityType: event.entityType ?? event.eventCategory,
          entityId: event.entityId ?? null,
          traceId: event.traceId ?? event.requestId ?? "-",
          resultCode: event.severity.toUpperCase() === "ERROR" ? 500 : 200,
          occurredAt: event.eventTime,
          status:
            event.severity.toUpperCase() === "ERROR"
              ? "error"
              : event.severity.toUpperCase() === "WARNING"
                ? "warning"
                : "success",
          payload: {
            event_type: event.eventType,
            severity: event.severity,
            message: event.message,
            metadata: event.metadata,
            request_path: event.requestPath,
            request_method: event.requestMethod,
          },
        }));

      return {
        items: filtered,
        total: filtered.length,
        count: filtered.length,
      };
    },
    placeholderData: (previous) => previous,
  });
}

export function usePipelineSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.pipelineSummary(),
    queryFn: async (): Promise<PipelineSummary> => {
      const [services, auditSummary, auditEvents] = await Promise.all([
        gatewayApi.techAdmin.services().catch(() => ({} as Record<string, { status: string }>)),
        gatewayApi.audit.summary().catch(() => ({
          totalEvents: 0,
          errorEvents: 0,
          latestEventTime: null,
          byCategory: [],
          bySeverity: [],
          byEventType: [],
        })),
        gatewayApi.audit.listEvents({ limit: 100 }).catch(() => []),
      ]);

      const serviceEntries = Object.entries(services);
      const statusDistribution = serviceEntries.map(([name, service]) => ({
        name,
        value: service.status.toUpperCase() === "UP" ? 1 : 0,
      }));
      const failures = serviceEntries
        .filter(([, service]) => service.status.toUpperCase() !== "UP")
        .map(([name]) => ({ name, value: 1 }));

      return {
        overall: Object.fromEntries(statusDistribution.map((entry) => [entry.name, entry.value])),
        by_entity_type: {},
        cards: {
          total_pipeline_items: auditSummary.totalEvents,
          currently_failed: auditSummary.errorEvents,
          parsed: auditEvents.length,
          canonicalized: 0,
          search_ready: serviceEntries.some(([name]) => name.toLowerCase().includes("search")) ? 1 : 0,
          recent_events_count: auditEvents.length,
        },
        status_distribution: statusDistribution,
        events_over_time: groupByDay(auditEvents.map((event) => event.eventTime)).map((item) => ({
          name: item.day,
          value: item.matches,
        })),
        failures_by_stage: failures,
        entity_type_distribution: auditSummary.byCategory.map((item) => ({
          name: item.key,
          value: item.count,
        })),
      };
    },
    staleTime: 60_000,
  });
}

export function usePipelineItemsQuery(params: PipelineItemsQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.advisor.pipelineItems(params),
    queryFn: async () => ({
      items: [] as PipelineItem[],
      total: 0,
      count: 0,
    }),
    placeholderData: (previous) => previous,
  });
}

export function usePipelineItemDetailQuery(entityType?: string, sourceId?: string) {
  return useQuery({
    queryKey: queryKeys.advisor.pipelineDetail(entityType, sourceId),
    queryFn: async (): Promise<PipelineItemDetail> => ({
      current: null,
      history: [] as PipelineRun[],
    }),
    enabled: Boolean(entityType && sourceId),
  });
}

export function useDataExplorerQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.dataExplorer(),
    queryFn: async (): Promise<DataExplorerDataset> => {
      const [candidates, offers, taxonomy, services] = await Promise.all([
        gatewayApi.search.candidates({ filters: { size: 8 } }).catch(() => ({
          total: 0,
          filtersApplied: {},
          results: [] as SearchCandidateResult[],
          raw: {},
        })),
        gatewayApi.search.offers({ query: "", size: 8 }).catch(() => ({
          total: 0,
          mode: null,
          query: null,
          results: [] as SearchOfferResult[],
          raw: {},
        })),
        gatewayApi.taxonomy.listNodes({ limit: 8 }).catch(() => []),
        gatewayApi.techAdmin.services().catch(() => ({} as Record<string, { status: string }>)),
      ]);

      return {
        candidates: candidates.results.map((item) => ({
          id: item.candidateId,
          label:
            searchRawString(safeJson(item.raw), ["full_name", "candidate_label", "name"]) ??
            item.candidateId,
          sub: item.location ?? "Location not specified",
          score: `${normalizeScore(item.score)}%`,
        })),
        jobs: offers.results.map((item) => ({
          id: item.offerId,
          label: item.title,
          sub: item.location ?? "Location not specified",
          score: `${normalizeScore(item.score)}%`,
        })),
        pipeline: Object.entries(services).map(([key, value]) => ({
          id: key,
          label: key,
          sub: value.detail ?? "Service health",
          score: value.status,
        })),
        matches: [] as { id: string; label: string; sub: string; score: string }[],
        taxonomy: taxonomy.map((item) => ({
          id: item.id,
          label: item.label,
          sub: startCase(item.nodeType),
          score: item.sourceCode ?? "-",
        })),
      };
    },
  });
}

export function useCreateProviderAccountMutation() {
  return useMutation({
    mutationFn: async (payload: AdminCreateProviderPayload) => {
      const user = await gatewayApi.techAdmin.createUser({
        email: payload.email,
        password: payload.password,
        phone: payload.phone ?? null,
        status: "ACTIVE",
      });
      const roles = await gatewayApi.techAdmin.listRoles();
      const employerRole = roles.find((role) => role.code === "EMPLOYER");
      if (employerRole) {
        return gatewayApi.techAdmin.assignRole(user.id, employerRole.id);
      }
      return user;
    },
  });
}
