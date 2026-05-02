import { appEnv } from "@/config/env";
import { readStoredSession } from "@/services/auth/sessionStorage";
import { writeStoredCandidateCvToken } from "@/services/candidate/cvSessionStorage";
import {
    getCandidateProfileCompletion,
    getCandidateProfileInitials,
    getCandidateProfileSections,
    getCandidateYearsExperience,
    readLocalCandidateProfile,
    writeLocalCandidateProfile,
} from "@/services/candidate/localCandidateProfile";
import { apiRequest, ApiServiceError } from "./client";
import * as mock from "./mockData";
import type {
    AdvisorDashboardData,
    AuditLog,
    Candidate,
    CandidateExperience,
    CandidateCvUploadResult,
    CandidateDashboardData,
    CandidateProfile,
    CandidateProfileUpdate,
    CandidateRecommendationsData,
    CatalogOptions,
    AdminCreateProviderPayload,
    AdminCreateProviderResponse,
    CreateJobOfferPayload,
    DataExplorerDataset,
    Job,
    OfferParsedOutput,
    OfferParsePayload,
    PipelineItem,
    PipelineItemDetail,
    PipelineSummary,
    PlatformUser,
    ProviderRegistrationRequestRecord,
    ProviderDashboardData,
    ProviderOfferDetail,
    Role,
    RoleOption,
    RoleProfile,
    TaxonomyNode,
    TaxonomyNodeDetail,
    TaxonomySummary,
    TaxonomyType,
    UnresolvedCode,
} from "@/models";

export interface TaxonomyQueryParams {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    domain?: string;
    includeDeprecated?: boolean;
}

export interface UnresolvedCodesQueryParams {
    limit?: number;
    offset?: number;
    search?: string;
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
    traceId?: string;
    entityType?: string;
    action?: string;
    resultCode?: number;
    resultStatus?: string;
}

export interface PipelineItemsQueryParams {
    limit?: number;
    offset?: number;
    search?: string;
    entityType?: string;
    status?: string;
}

export interface ListResponse<T> {
    count: number;
    total?: number;
    limit: number;
    offset?: number;
    items: T[];
}

interface TaxonomyCodeApiItem {
    id: string;
    code: string;
    model_name: string;
    model_version: string;
    domain: string;
    node_type?: string;
    taxonomy_name: string;
    parent_code: string | null;
    preferred_label?: string | null;
    is_leaf: boolean;
    is_deprecated: boolean;
    label_fr: string | null;
    label_en: string | null;
    status?: string;
    updated_at?: string;
    alias_count?: number;
    relation_count?: number;
    aliases?: string[];
    raw?: Record<string, unknown>;
}

interface AuditLogApiItem {
    id: string;
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    trace_id: string;
    result_code: number;
    occurred_at: string;
    actor_email: string | null;
    actor_role: string | null;
}

interface UserApiItem {
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
}

interface ProviderRegistrationRequestApiItem {
    id: string;
    contact_name: string;
    job_title: string;
    company_name: string;
    email: string;
    phone: string;
    website?: string | null;
    company_size: string;
    hiring_needs: string;
    status: string;
    team_message_id?: string | null;
    confirmation_message_id?: string | null;
    created_at: string;
    updated_at?: string | null;
}

interface DocumentApiItem {
    run_id: string;
    entity_type: string;
    source_id: string;
    trace_id: string;
    status: string;
    canonical_entity_id: string | null;
    source_blob_name?: string | null;
    source_blob_url?: string | null;
    source_storage_key?: string | null;
    created_at: string;
    updated_at?: string;
    stored_at?: string | null;
    parsed_at?: string | null;
    canonicalized_at?: string | null;
    search_ready_at?: string | null;
    failed_at?: string | null;
}

interface TaxonomyDomainApiItem {
    model_name: string;
    model_version: string;
    id: string;
    domain: string;
    name: string;
    code_count: number;
    leaf_code_count: number;
    deprecated_code_count: number;
}

interface PipelineSummaryApiResponse {
    overall: Record<string, number>;
    by_entity_type: Record<string, Record<string, number>>;
    cards?: PipelineSummary["cards"];
    status_distribution?: PipelineSummary["status_distribution"];
    events_over_time?: PipelineSummary["events_over_time"];
    failures_by_stage?: PipelineSummary["failures_by_stage"];
    entity_type_distribution?: PipelineSummary["entity_type_distribution"];
}

interface PipelineRunApiItem {
    run_id?: string;
    trace_id: string;
    entity_type: string;
    source_id?: string;
    entity_id?: string;
    status?: string;
    current_status?: string;
    canonical_entity_id?: string | null;
    error_stage?: string | null;
    error_message?: string | null;
    last_error?: string | null;
    ingestion_event_id?: string | null;
    parsed_event_id?: string | null;
    source_container?: string | null;
    source_blob_name?: string | null;
    source_blob_url?: string | null;
    source_storage_key?: string | null;
    created_at?: string;
    updated_at?: string;
    received_at?: string;
    stored_at?: string | null;
    parsed_at?: string | null;
    canonicalized_at?: string | null;
    search_ready_at?: string | null;
    failed_at?: string | null;
}

interface DebugWrappedResponse<T> {
    upstream_status: number;
    body: T;
}

interface CvResultEnvelope {
    trace_id: string;
    status: string;
    data: {
        cv_id: string;
        candidate_id: string;
        candidate: {
            status: string;
            primary_lang: string | null;
            location: string | null;
            created_at: string;
            updated_at: string;
        };
        skills: Array<{
            code: string;
            level: string | null;
            years_experience: number | null;
            evidence: string | null;
        }>;
        languages: Array<{
            code: string;
            level: string | null;
            years_experience: number | null;
            evidence: string | null;
        }>;
        coding_skills?: string[] | null;
        experience?: ParsedResumeExperienceApiItem[];
        job_experiences?: ParsedResumeExperienceApiItem[];
        internship_experiences?: ParsedResumeExperienceApiItem[];
        occupations: Array<{
            code: string;
            description: string | null;
        }>;
        education: Array<{
            code: string;
            level: string | null;
            institution: string | null;
            graduation_year: number | null;
        }>;
        certifications: Array<{
            code: string;
            issuer: string | null;
            obtained_date: string | null;
            expiry_date: string | null;
        }>;
    };
}

interface OfferResultEnvelope {
    trace_id: string;
    status: string;
    data: {
        offer_id: string;
        canonical_offer_id: string;
        offer: {
            status: string;
            title: string;
            description: string | null;
            location: string | null;
            contract_type: string | null;
            created_at: string;
            updated_at: string;
        };
        company: {
            company_id: string;
            name: string;
            industry: string | null;
            country: string | null;
        };
        occupations: Array<{ code: string }>;
        requirements: {
            skills: Array<{ code: string | null; is_mandatory: boolean }>;
            education: Array<{ code: string | null; is_mandatory: boolean }>;
            certifications: Array<{ code: string | null; is_mandatory: boolean }>;
            experience: Array<{ code: string | null; is_mandatory: boolean }>;
            languages: Array<{ code: string | null; is_mandatory: boolean }>;
        };
    };
}

interface ProviderOfferApiItem {
    source_id: string;
    trace_id: string;
    pipeline_status: string;
    error_stage?: string | null;
    error_message?: string | null;
    canonical_entity_id?: string | null;
    created_at: string;
    updated_at?: string;
    stored_at?: string | null;
    parsed_at?: string | null;
    canonicalized_at?: string | null;
    search_ready_at?: string | null;
    failed_at?: string | null;
    offer_id?: string | null;
    offer_status?: string | null;
    title?: string | null;
    description?: string | null;
    location?: string | null;
    contract_type?: string | null;
    offer_created_at?: string | null;
    offer_updated_at?: string | null;
    company_name?: string | null;
    company_industry?: string | null;
    company_country?: string | null;
    mandatory_skills?: string[];
    optional_skills?: string[];
    occupations?: string[];
    matched_count?: number;
    applicants_count?: number;
}

interface ProviderOfferDetailApiResponse {
    offer: ProviderOfferApiItem & {
        matched_count?: number;
        applicants_count?: number;
    };
    candidates: ProviderCandidateApiItem[];
    limited?: boolean;
    limited_reason?: string | null;
}

interface ProviderCandidateApiItem {
    id: string;
    display_name: string;
    status: string;
    email?: string | null;
    phone?: string | null;
    primary_lang?: string | null;
    location?: string | null;
    created_at: string;
    updated_at: string;
    top_skills?: string[];
    experience_years?: number;
    occupation?: string;
    offer_id?: string | null;
    offer_title?: string | null;
    company_name?: string | null;
    rank?: number | null;
    match_score?: number | null;
    documents?: CandidateDocumentApiItem[];
}

interface ProviderCandidatesResponse extends ListResponse<ProviderCandidateApiItem> {
    limited?: boolean;
    limited_reason?: string;
}

interface CandidateSkillApiItem {
    id?: string | null;
    code: string;
    label: string;
    level?: string | null;
    years?: number | null;
    evidence?: string | null;
    is_language?: boolean;
}

interface CandidateExperienceApiItem {
    id?: string | null;
    occupation: string;
    occupation_code?: string | null;
    industry?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
}

interface ParsedResumeExperienceApiItem {
    title?: string | null;
    job_title?: string | null;
    company?: string | null;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
    description?: string | null;
    responsibilities?: string[];
    technologies?: string[];
    projects?: Array<Record<string, unknown>>;
}

interface CandidateEducationApiItem {
    id?: string | null;
    degree: string;
    education_code?: string | null;
    level?: string | null;
    institution?: string | null;
    graduation_year?: number | null;
}

interface CandidateDocumentApiItem {
    id: string;
    doc_type: string;
    mime_type?: string | null;
    blob_name?: string | null;
    access_url?: string | null;
    uploaded_at?: string | null;
}

interface CandidateProfileApiResponse {
    candidate: {
        id: string;
        status: string;
        primary_lang?: string | null;
        location?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
    };
    skills: CandidateSkillApiItem[];
    languages: CandidateSkillApiItem[];
    experiences: CandidateExperienceApiItem[];
    job_experiences?: ParsedResumeExperienceApiItem[];
    internship_experiences?: ParsedResumeExperienceApiItem[];
    coding_skills?: string[] | null;
    education: CandidateEducationApiItem[];
    documents: CandidateDocumentApiItem[];
}

interface CandidatePipelineApiResponse {
    current?: Record<string, unknown> | null;
    last_upload_at?: string | null;
    steps: Array<{
        label: string;
        status: string;
        timestamp?: string | null;
    }>;
}

interface CandidateMatchApiItem {
    id: string;
    match_id: string;
    title: string;
    company: string;
    location: string;
    contract: string;
    level?: string;
    posted_days: number;
    status: Job["status"] | string;
    score: number;
    rank?: number | null;
    matched_at?: string | null;
    required: string[];
    preferred: string[];
    matched_skills: string[];
    missing_skills: string[];
    score_breakdown?: Array<{
        code: string;
        label: string;
        score: number;
        matched: boolean;
        explanation?: unknown;
    }>;
}

type CandidateMatchesApiResponse = ListResponse<CandidateMatchApiItem>;

interface CandidateDashboardApiResponse {
    profile_name: string;
    open_offers: number;
    profile_completion: number;
    profile_sections: Array<{ label: string; value: number }>;
    matched_jobs: number;
    average_match_score: number;
    recommendation_count: number;
    top_matches: CandidateMatchApiItem[];
    matching_activity: CandidateDashboardData["matchingActivity"];
    detected_skills: string[];
    missing_skills: string[];
    activity_timeline: CandidateDashboardData["activityTimeline"];
    pipeline_status: CandidatePipelineApiResponse;
}

interface CandidateTrainingApiItem {
    id: string;
    recommendation_id?: string | null;
    title: string;
    provider?: string | null;
    duration_hours?: number | null;
    level?: string | null;
    relevance: number;
    reason?: string | null;
    url?: string | null;
    skills: string[];
}

interface CandidateRecommendationsApiResponse {
    trainings: CandidateTrainingApiItem[];
    related_roles: CandidateMatchApiItem[];
    skills_to_improve: string[];
    actions: Array<{
        id: string;
        reason: string;
        priority: number;
        created_at?: string | null;
    }>;
    learning_path: Array<{
        id: string;
        period: string;
        title: string;
        description: string;
        status: string;
    }>;
    limited?: boolean;
    limited_reason?: string | null;
}

interface CandidateCvUploadApiResponse {
    cv_id?: string;
    trace_id?: string | null;
    status?: string;
    linked_candidate_id?: string | null;
    pipeline?: CandidatePipelineApiResponse | null;
    success?: boolean;
    message?: string | null;
    token?: string | null;
    resume_id?: string | null;
    redirect_to?: string | null;
    parsing?: {
        cv_id?: string | null;
        trace_id?: string | null;
        status?: string | null;
    } | null;
}

interface DocumentAccessApiResponse {
    document_id: string;
    access_type: "signed_url";
    url: string;
    expires_at: string;
    filename?: string | null;
    mime_type?: string | null;
}

interface DocumentAccessResult {
    documentId: string;
    url: string;
    expiresAt: string;
    filename?: string;
    mimeType?: string;
}

interface ProviderCandidateDetailApiResponse {
    candidate: {
        id: string;
        display_name: string;
        email?: string | null;
        phone?: string | null;
        status: string;
        primary_lang?: string | null;
        location?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
        match_score?: number | null;
        offer_match_count?: number;
    };
    offers: Array<{
        offer_id: string;
        offer_title: string;
        company_name: string;
        match_score?: number | null;
        rank?: number | null;
    }>;
    skills: Array<{
        label: string;
        level?: string | null;
        years?: number | null;
        is_language?: boolean;
    }>;
    experiences: Array<{
        occupation: string;
        start_date?: string | null;
        end_date?: string | null;
        description?: string | null;
    }>;
    job_experiences?: ParsedResumeExperienceApiItem[];
    internship_experiences?: ParsedResumeExperienceApiItem[];
    coding_skills?: string[] | null;
    education: Array<{
        degree: string;
        level?: string | null;
        institution?: string | null;
        graduation_year?: number | null;
    }>;
    documents: CandidateDocumentApiItem[];
    limited?: boolean;
    limited_reason?: string | null;
}

interface OfferParseApiResponse {
    status: "parsed";
    data: OfferParsedOutput;
}

interface OfferSubmitApiResponse {
    trace_id: string;
    status: "accepted";
    offer_id: string;
}

const ROLE_OPTIONS: RoleOption[] = [
    { id: "candidate", label: "Candidate", description: "Find roles matched to your profile and skills." },
    { id: "provider", label: "Job Provider", description: "Post offers and discover qualified candidates." },
    { id: "advisor", label: "Advisor / Backoffice", description: "Govern taxonomy, monitor pipelines and audits." },
];

const toDisplayNameFromEmail = (email: string): string => {
    const [localPart] = email.split("@");
    if (!localPart) {
        return email;
    }

    return localPart
        .split(/[._-]/g)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
};

const toInitials = (name: string): string =>
    name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

const roleFromBackendRole = (backendRole: string | null | undefined): Role | null => {
    const normalized = (backendRole ?? "").trim().toLowerCase();

    if (normalized === "candidate") {
        return "candidate";
    }

    if (normalized === "employer") {
        return "provider";
    }

    if (normalized === "advisor" || normalized === "admin") {
        return "advisor";
    }

    return null;
};

const platformRoleFromBackendRole = (backendRole: string | null | undefined): PlatformUser["role"] => {
    const normalized = (backendRole ?? "").trim().toLowerCase();

    if (normalized === "candidate") {
        return "Candidate";
    }

    if (normalized === "employer") {
        return "Provider";
    }

    return "Advisor";
};

const normalizeTimestamp = (isoTimestamp: string): string => {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }

    return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
};

const formatShortDate = (isoTimestamp: string | null | undefined): string => {
    if (!isoTimestamp) {
        return "-";
    }

    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }

    return parsed.toISOString().slice(0, 10);
};

const humanizeBackendLabel = (value: string): string =>
    value
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\w\S*/g, (segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase());

const countPipelineRuns = (summary: PipelineSummaryApiResponse): number =>
    Object.values(summary.overall || {}).reduce((total, value) => total + Number(value || 0), 0);

const buildBackendActivity = (
    auditItems: AuditLogApiItem[],
    documents: DocumentApiItem[],
) => {
    const dayKeys = Array.from({ length: 14 }).map((_, index) => {
        const day = new Date();
        day.setDate(day.getDate() - (13 - index));
        return day.toISOString().slice(0, 10);
    });

    const buckets = new Map(dayKeys.map((day) => [day, { day: day.slice(5), matches: 0, applications: 0 }]));

    auditItems.forEach((item) => {
        const key = formatShortDate(item.occurred_at);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.matches += 1;
        }
    });

    documents.forEach((item) => {
        const key = formatShortDate(item.created_at);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.applications += 1;
        }
    });

    return Array.from(buckets.values());
};

const buildProviderActivity = (offers: Job[]) => {
    const dayKeys = Array.from({ length: 14 }).map((_, index) => {
        const day = new Date();
        day.setDate(day.getDate() - (13 - index));
        return day.toISOString().slice(5, 10);
    });

    return dayKeys.map((day, index) => ({
        day,
        matches: index === dayKeys.length - 1 ? offers.reduce((total, offer) => total + offer.matched, 0) : 0,
        applications: index === dayKeys.length - 1 ? offers.reduce((total, offer) => total + offer.applicants, 0) : 0,
    }));
};

const mapResultCodeToAuditStatus = (resultCode: number): AuditLog["status"] => {
    if (resultCode >= 400) {
        return "error";
    }

    if (resultCode >= 300) {
        return "warning";
    }

    return "success";
};

const mapPipelineStatusToJobStatus = (status: string): Job["status"] => {
    const normalized = status.trim().toLowerCase();

    if (["search_ready", "canonicalized", "active", "published", "open"].includes(normalized)) {
        return "Active";
    }

    if (["archived", "closed"].includes(normalized)) {
        return "Archived";
    }

    if (normalized === "failed") {
        return "Paused";
    }

    return "Draft";
};

const mapDomainToTaxonomyType = (domain: string): TaxonomyType => {
    const normalized = domain.trim().toLowerCase();

    if (normalized.includes("occupation")) return "Occupation";
    if (normalized.includes("skill")) return "Skill";
    if (normalized.includes("technology")) return "Technology";
    if (normalized.includes("tool")) return "Tool";
    if (normalized.includes("knowledge")) return "Knowledge";
    if (normalized.includes("ability")) return "Ability";
    if (normalized.includes("work") || normalized.includes("activity")) return "Work Activity";
    return "Task";
};

const mapModelToSource = (modelName: string): TaxonomyNode["source"] => {
    const normalized = modelName.trim().toLowerCase();
    if (normalized.includes("esco")) {
        return "ESCO";
    }

    if (normalized.includes("o*net") || normalized.includes("onet")) {
        return "O*NET";
    }

    return "Internal";
};

const isRecoverableDebugError = (error: unknown): boolean => {
    return error instanceof ApiServiceError && [404, 409].includes(error.status);
};

const requireSession = () => {
    const session = readStoredSession();
    if (!session) {
        throw new ApiServiceError("You must be authenticated to call this endpoint", 401);
    }

    return session;
};

const fetchAuditItems = async (limit: number): Promise<AuditLogApiItem[]> => {
    const payload = await apiRequest<ListResponse<AuditLogApiItem>>(
        "/logs/audit",
        { method: "GET" },
        {
            query: {
                limit,
            },
        },
    );

    return payload.items ?? [];
};

const fetchRecentDocuments = async (entityType: "cv" | "offer", limit: number): Promise<DocumentApiItem[]> => {
    const payload = await apiRequest<ListResponse<DocumentApiItem>>(
        "/documents/recent",
        { method: "GET" },
        {
            query: {
                limit,
                entity_type: entityType,
            },
        },
    );

    return payload.items ?? [];
};

const fetchUploadedDocuments = async (
    entityType: "cv" | "offer",
    limit: number,
): Promise<ListResponse<DocumentApiItem>> => {
    return apiRequest<ListResponse<DocumentApiItem>>(
        entityType === "cv" ? "/documents/cvs" : "/documents/offers",
        { method: "GET" },
        {
            query: {
                limit,
            },
        },
    );
};

const fetchPipelineRecent = async (limit: number): Promise<PipelineRunApiItem[]> => {
    const payload = await apiRequest<ListResponse<PipelineRunApiItem>>(
        "/pipeline/recent",
        { method: "GET" },
        {
            query: {
                limit,
            },
        },
    );

    return payload.items ?? [];
};

const fetchPipelineErrors = async (limit: number): Promise<PipelineRunApiItem[]> => {
    const payload = await apiRequest<ListResponse<PipelineRunApiItem>>(
        "/pipeline/errors",
        { method: "GET" },
        {
            query: {
                limit,
            },
        },
    );

    return payload.items ?? [];
};

const fetchOfferResult = async (offerSourceId: string): Promise<OfferResultEnvelope | null> => {
    try {
        const wrapped = await apiRequest<DebugWrappedResponse<OfferResultEnvelope>>(
            `/debug/parsing/offers/${encodeURIComponent(offerSourceId)}/result`,
            { method: "GET" },
        );
        return wrapped.body;
    } catch (error) {
        if (isRecoverableDebugError(error)) {
            return null;
        }

        throw error;
    }
};

const fetchCvResult = async (cvSourceId: string): Promise<CvResultEnvelope | null> => {
    try {
        const wrapped = await apiRequest<DebugWrappedResponse<CvResultEnvelope>>(
            `/debug/parsing/cv/${encodeURIComponent(cvSourceId)}/result`,
            { method: "GET" },
        );
        return wrapped.body;
    } catch (error) {
        if (isRecoverableDebugError(error)) {
            return null;
        }

        throw error;
    }
};

const buildOfferFromBackendData = (document: DocumentApiItem, result: OfferResultEnvelope | null): Job => {
    const offerData = result?.data.offer;
    const company = result?.data.company;

    const required = (result?.data.requirements.skills ?? [])
        .filter((item) => !!item.code && item.is_mandatory)
        .map((item) => item.code as string);

    const preferred = (result?.data.requirements.skills ?? [])
        .filter((item) => !!item.code && !item.is_mandatory)
        .map((item) => item.code as string);

    const scoreHeuristic = Math.min(99, 55 + required.length * 4 + preferred.length * 2);

    return {
        id: document.source_id,
        title: offerData?.title || `Offer ${document.source_id}`,
        company: company?.name || "Unknown company",
        location: offerData?.location || "Unknown location",
        contract: offerData?.contract_type || "N/A",
        level: "N/A",
        postedDays: Math.max(
            0,
            Math.floor((Date.now() - Date.parse(document.created_at || new Date().toISOString())) / (1000 * 60 * 60 * 24)),
        ),
        applicants: 0,
        matched: 0,
        status: mapPipelineStatusToJobStatus(offerData?.status || document.status),
        required,
        preferred,
        score: scoreHeuristic,
        matchedSkills: required.slice(0, 3),
        missingSkills: [],
    };
};

const deriveCandidateStatus = (rawStatus: string): Candidate["status"] => {
    const normalized = rawStatus.trim().toLowerCase();

    if (normalized === "active" || normalized === "search_ready") {
        return "Shortlisted";
    }

    if (normalized === "failed" || normalized === "disabled") {
        return "Rejected";
    }

    if (normalized === "canonicalized") {
        return "Reviewed";
    }

    return "New";
};

const buildCandidateFromBackendData = (
    document: DocumentApiItem,
    result: CvResultEnvelope | null,
    candidateActorByCanonicalId: Map<string, string>,
): Candidate => {
    const candidateId = result?.data.candidate_id || document.canonical_entity_id || document.source_id;
    const actorEmail = candidateActorByCanonicalId.get(candidateId) || "";
    const inferredName = actorEmail ? toDisplayNameFromEmail(actorEmail) : `Candidate ${candidateId.slice(0, 8)}`;
    const skills = result?.data.skills ?? [];
    const codingSkills = result?.data.coding_skills ?? null;
    const occupations = result?.data.occupations ?? [];

    const topSkills = (codingSkills && codingSkills.length > 0
        ? codingSkills
        : skills.map((item) => item.code).filter(Boolean)
    ).slice(0, 4);
    const bestYears = skills.reduce<number>((max, item) => Math.max(max, item.years_experience ?? 0), 0);

    const score = Math.min(98, 50 + topSkills.length * 8 + Math.round(bestYears * 2));

    return {
        id: candidateId,
        name: inferredName,
        initials: toInitials(inferredName),
        occupation: occupations[0]?.code || "Unspecified occupation",
        location: result?.data.candidate.location || "Unknown location",
        experienceYears: Math.max(0, Math.round(bestYears)),
        score,
        topSkills,
        missing: [],
        summary: `${topSkills.length} extracted skills and ${occupations.length} occupation signals from backend parsing output.`,
        status: deriveCandidateStatus(result?.status || document.status),
    };
};

const resolveEntityIdsForUser = async (
    email: string,
    validEntityTypes: string[],
): Promise<Set<string>> => {
    const logs = await fetchAuditItems(appEnv.auditLookupLimit);
    const normalizedEmail = email.trim().toLowerCase();

    const result = new Set<string>();
    logs
        .filter((log) => (log.actor_email ?? "").trim().toLowerCase() === normalizedEmail)
        .filter((log) => validEntityTypes.includes((log.entity_type ?? "").trim().toLowerCase()))
        .forEach((log) => {
            if (log.entity_id) {
                result.add(log.entity_id);
            }
        });

    return result;
};

const resolveProviderOffersFromBackend = async (): Promise<Job[]> => {
    const session = requireSession();
    const documents = await fetchRecentDocuments("offer", 120);

    let scopedDocuments = documents;
    if (session.user.role === "provider") {
        const userOfferIds = await resolveEntityIdsForUser(session.user.email, ["job_offer", "offer"]);
        if (userOfferIds.size > 0) {
            scopedDocuments = documents.filter((item) => item.canonical_entity_id && userOfferIds.has(item.canonical_entity_id));
        }
    }

    const candidates = scopedDocuments.slice(0, 24);
    const withResults = await Promise.all(
        candidates.map(async (document) => ({
            document,
            result: await fetchOfferResult(document.source_id),
        })),
    );

    return withResults.map(({ document, result }) => buildOfferFromBackendData(document, result));
};

const resolveProviderCandidatesFromBackend = async (): Promise<Candidate[]> => {
    const documents = await fetchRecentDocuments("cv", 80);
    const auditItems = await fetchAuditItems(appEnv.auditLookupLimit);

    const candidateActorByCanonicalId = new Map<string, string>();
    auditItems.forEach((item) => {
        if ((item.entity_type ?? "").trim().toLowerCase() !== "candidate") {
            return;
        }

        if (!item.entity_id || !item.actor_email) {
            return;
        }

        if (!candidateActorByCanonicalId.has(item.entity_id)) {
            candidateActorByCanonicalId.set(item.entity_id, item.actor_email);
        }
    });

    const rows = await Promise.all(
        documents.slice(0, 24).map(async (document) => ({
            document,
            result: await fetchCvResult(document.source_id),
        })),
    );

    return rows.map(({ document, result }) =>
        buildCandidateFromBackendData(document, result, candidateActorByCanonicalId),
    );
};

const resolvePlatformUsersFromAudit = async (): Promise<PlatformUser[]> => {
    const items = await fetchAuditItems(appEnv.auditLookupLimit);
    const userMap = new Map<string, PlatformUser>();

    const sorted = [...items].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));

    sorted.forEach((item) => {
        const email = (item.actor_email ?? "").trim().toLowerCase();
        if (!email) {
            return;
        }

        const role = platformRoleFromBackendRole(item.actor_role);

        userMap.set(email, {
            id: item.id,
            name: toDisplayNameFromEmail(email),
            email,
            role,
            status: "Active",
            created: normalizeTimestamp(item.occurred_at),
            createdAt: item.occurred_at,
        });
    });

    return Array.from(userMap.values()).sort((a, b) => a.email.localeCompare(b.email));
};

const buildAdvisorDashboardFromBackend = async (): Promise<AdvisorDashboardData> => {
    const [
        pipelineSummary,
        taxonomyDomains,
        cvDocuments,
        offerDocuments,
        recentDocuments,
        auditItems,
        pipelineErrors,
    ] = await Promise.all([
        apiRequest<PipelineSummaryApiResponse>("/pipeline/summary", { method: "GET" }),
        apiRequest<ListResponse<TaxonomyDomainApiItem>>(
            "/taxonomy/domains",
            { method: "GET" },
            {
                query: {
                    limit: 200,
                },
            },
        ),
        fetchUploadedDocuments("cv", 500),
        fetchUploadedDocuments("offer", 500),
        apiRequest<ListResponse<DocumentApiItem>>(
            "/documents/recent",
            { method: "GET" },
            {
                query: {
                    limit: 500,
                },
            },
        ),
        fetchAuditItems(appEnv.auditLookupLimit),
        fetchPipelineErrors(20),
    ]);

    const pipelineStatuses = Object.entries(pipelineSummary.overall || {}).map(([name, value]) => ({
        name: humanizeBackendLabel(name),
        value,
    }));

    const taxonomyDistribution = (taxonomyDomains.items || []).map((item) => ({
        name: humanizeBackendLabel(item.domain),
        value: Number(item.code_count || 0),
    }));

    const auditWarnings = auditItems
        .filter((item) => Number(item.result_code || 0) >= 400)
        .slice(0, 5)
        .map((item) => ({
            id: item.id,
            time: normalizeTimestamp(item.occurred_at),
            text: `${item.action} on ${item.entity_type}${item.entity_id ? `/${item.entity_id}` : ""} returned ${item.result_code}`,
        }));

    const pipelineWarnings = pipelineErrors.slice(0, 5).map((item) => ({
        id: item.run_id || item.trace_id,
        time: normalizeTimestamp(item.failed_at || item.updated_at || item.created_at || ""),
        text: `${item.entity_type}/${item.source_id || item.entity_id || "-"} failed${item.error_stage ? ` at ${item.error_stage}` : ""}${item.error_message ? `: ${item.error_message}` : ""}`,
    }));

    return {
        stats: {
            candidateDocuments: cvDocuments.count,
            offerDocuments: offerDocuments.count,
            taxonomyNodes: taxonomyDistribution.reduce((total, item) => total + item.value, 0),
            pipelineRuns: countPipelineRuns(pipelineSummary),
            errorCount: pipelineErrors.length + auditWarnings.length,
        },
        matchingActivity: buildBackendActivity(auditItems, recentDocuments.items || []),
        pipelineStatuses,
        taxonomyDistribution,
        scoreDistribution: [],
        recentWarnings: [...pipelineWarnings, ...auditWarnings].slice(0, 6),
    };
};

const mapProviderOffer = (item: ProviderOfferApiItem): Job => {
    const required = item.mandatory_skills ?? [];
    const preferred = item.optional_skills ?? [];
    const createdAt = item.offer_created_at || item.created_at || new Date().toISOString();

    return {
        id: item.source_id,
        title: item.title || `Offer ${item.source_id}`,
        company: item.company_name || "Pending company",
        location: item.location || "Unspecified location",
        contract: item.contract_type || "N/A",
        level: "N/A",
        postedDays: Math.max(
            0,
            Math.floor((Date.now() - Date.parse(createdAt)) / (1000 * 60 * 60 * 24)),
        ),
        applicants: Number(item.applicants_count ?? 0),
        matched: Number(item.matched_count ?? 0),
        status: mapPipelineStatusToJobStatus(item.offer_status || item.pipeline_status),
        required,
        preferred,
        score: Math.min(99, 50 + required.length * 5 + preferred.length * 2),
        matchedSkills: required.slice(0, 4),
        missingSkills: [],
    };
};

const mapProviderCandidate = (item: ProviderCandidateApiItem): Candidate => {
    const topSkills = item.top_skills ?? [];
    const name = item.display_name || `Candidate ${item.id.slice(0, 8)}`;
    const experienceYears = Math.max(0, Math.round(Number(item.experience_years || 0)));
    const score = Math.max(0, Math.min(100, Math.round(Number(item.match_score ?? 0))));

    return {
        id: item.id,
        name,
        initials: toInitials(name),
        occupation: item.occupation || "Unspecified occupation",
        location: item.location || "Unknown location",
        experienceYears,
        score,
        topSkills,
        missing: [],
        summary: item.offer_title
            ? `Matched to ${item.offer_title}${item.company_name ? ` at ${item.company_name}` : ""}.`
            : `${topSkills.length} parsed skills from the canonical candidate profile.`,
        status: deriveCandidateStatus(item.status),
        email: item.email || undefined,
        phone: item.phone || undefined,
        offerId: item.offer_id || undefined,
        offerTitle: item.offer_title || undefined,
        company: item.company_name || undefined,
        rank: item.rank ?? undefined,
        documents: (item.documents ?? []).map(mapCandidateDocument),
    };
};

const formatDateRange = (start?: string | null, end?: string | null): string => {
    const startYear = start ? start.slice(0, 4) : "";
    const endYear = end ? end.slice(0, 4) : "";

    if (startYear && endYear) {
        return `${startYear} - ${endYear}`;
    }
    if (startYear) {
        return `${startYear} - Present`;
    }
    if (endYear) {
        return endYear;
    }
    return "";
};

const mapParsedResumeExperience = (item: ParsedResumeExperienceApiItem, index: number): CandidateExperience => ({
    company: item.company || "Organization not specified",
    role: item.title || item.job_title || `Experience ${index + 1}`,
    years: formatDateRange(item.start_date, item.end_date),
    description: item.description || "No description was extracted for this experience.",
});

const mapCandidateMatch = (item: CandidateMatchApiItem): Job => ({
    id: item.id,
    title: item.title || "Untitled offer",
    company: item.company || "Unknown company",
    location: item.location || "Unknown location",
    contract: item.contract || "N/A",
    level: item.level || "N/A",
    postedDays: Number(item.posted_days || 0),
    applicants: 0,
    matched: 0,
    status: mapPipelineStatusToJobStatus(item.status),
    required: item.required ?? [],
    preferred: item.preferred ?? [],
    score: Math.max(0, Math.min(100, Math.round(Number(item.score || 0)))),
    matchedSkills: item.matched_skills ?? [],
    missingSkills: item.missing_skills ?? [],
    scoreBreakdown: (item.score_breakdown ?? []).map((entry) => ({
        code: entry.code,
        label: entry.label,
        score: Math.max(0, Math.min(100, Math.round(Number(entry.score || 0)))),
        matched: Boolean(entry.matched),
        explanation: entry.explanation,
    })),
});

const mapCandidatePipelineStatus = (payload: CandidatePipelineApiResponse): CandidateDashboardData["pipelineStatus"] => ({
    current: payload.current ?? null,
    lastUploadAt: payload.last_upload_at ?? null,
    steps: (payload.steps ?? []).map((step) => ({
        label: step.label,
        status: step.status,
        timestamp: step.timestamp,
    })),
});

const mapCandidateDocument = (item: CandidateDocumentApiItem) => ({
    id: item.id,
    docType: item.doc_type,
    filename: item.blob_name || `${item.doc_type} document`,
    mimeType: item.mime_type || undefined,
    uploadedAt: item.uploaded_at || undefined,
    accessUrl: item.access_url || `/documents/${encodeURIComponent(item.id)}/access`,
});

const mapCandidateCvUpload = (payload: CandidateCvUploadApiResponse): CandidateCvUploadResult => ({
    cvId: payload.cv_id || payload.parsing?.cv_id || payload.resume_id || "",
    traceId: payload.trace_id || payload.parsing?.trace_id || "",
    status: payload.status || payload.parsing?.status || (payload.success ? "accepted" : "unknown"),
    linkedCandidateId: payload.linked_candidate_id || undefined,
    sessionToken: payload.token || undefined,
    resumeId: payload.resume_id || undefined,
    message: payload.message || undefined,
    redirectTo: payload.redirect_to || undefined,
    pipeline: payload.pipeline ? mapCandidatePipelineStatus(payload.pipeline) : null,
});

const mapDocumentAccess = (payload: DocumentAccessApiResponse): DocumentAccessResult => ({
    documentId: payload.document_id,
    url: payload.url,
    expiresAt: payload.expires_at,
    filename: payload.filename || undefined,
    mimeType: payload.mime_type || undefined,
});

const mapCandidateProfile = (payload: CandidateProfileApiResponse): CandidateProfile => {
    const session = readStoredSession();
    const name = payload.candidate.full_name || session?.user.name || toDisplayNameFromEmail(payload.candidate.email || "");
    const skills = payload.skills ?? [];
    const languages = payload.languages ?? [];
    const experiences = payload.experiences ?? [];
    const jobExperiences = (payload.job_experiences ?? []).map(mapParsedResumeExperience);
    const internshipExperiences = (payload.internship_experiences ?? []).map(mapParsedResumeExperience);
    const combinedParsedExperiences = [...jobExperiences, ...internshipExperiences];
    const education = payload.education ?? [];
    const documents = payload.documents ?? [];
    const occupation = jobExperiences[0]?.role || internshipExperiences[0]?.role || experiences[0]?.occupation || skills[0]?.label || "Candidate profile";
    const yearsExperience = Math.max(0, Math.round(
        skills.reduce((max, item) => Math.max(max, Number(item.years || 0)), 0),
    ));

    return {
        name,
        initials: toInitials(name),
        headline: occupation,
        location: payload.candidate.location || "Location not specified",
        email: payload.candidate.email || session?.user.email || "",
        phone: payload.candidate.phone || "",
        primaryLang: payload.candidate.primary_lang || undefined,
        occupation,
        occupationConfidence: combinedParsedExperiences.length > 0 || experiences.length > 0 ? 100 : 0,
        yearsExperience,
        skillsCount: skills.length,
        coreSkills: skills.map((item) => item.label).slice(0, 10),
        secondarySkills: skills.map((item) => item.label).slice(10, 22),
        suggestedSkills: [],
        experiences: combinedParsedExperiences.length > 0
            ? combinedParsedExperiences
            : experiences.map((item, index) => ({
                company: item.industry || "Parsed experience",
                role: item.occupation || `Experience ${index + 1}`,
                years: formatDateRange(item.start_date, item.end_date),
                description: item.description || "No description was extracted for this experience.",
            })),
        jobExperiences,
        internshipExperiences,
        codingSkills: payload.coding_skills ?? null,
        education: education.map((item) => ({
            school: item.institution || "Institution not specified",
            degree: item.degree || item.level || "Education",
            years: item.graduation_year ? String(item.graduation_year) : "",
        })),
        languages: [
            ...languages.map((item) => ({
                label: item.label || item.code,
                level: item.level || "",
            })),
            ...(payload.candidate.primary_lang && !languages.some((item) => item.code === payload.candidate.primary_lang)
                ? [{ label: payload.candidate.primary_lang, level: "Primary" }]
                : []),
        ],
        documents: documents.map(mapCandidateDocument),
    };
};

const mapCandidateDashboard = (payload: CandidateDashboardApiResponse): CandidateDashboardData => ({
    profileName: payload.profile_name,
    openOffers: Number(payload.open_offers || 0),
    profileCompletion: Number(payload.profile_completion || 0),
    profileSections: payload.profile_sections ?? [],
    matchedJobs: Number(payload.matched_jobs || 0),
    averageMatchScore: Number(payload.average_match_score || 0),
    recommendationCount: Number(payload.recommendation_count || 0),
    topMatches: (payload.top_matches ?? []).map(mapCandidateMatch),
    matchingActivity: payload.matching_activity ?? [],
    detectedSkills: payload.detected_skills ?? [],
    missingSkills: payload.missing_skills ?? [],
    activityTimeline: payload.activity_timeline ?? [],
    pipelineStatus: mapCandidatePipelineStatus(payload.pipeline_status),
});

const formatTrainingDuration = (hours?: number | null): string => {
    if (!hours) {
        return "Duration not specified";
    }
    if (hours < 24) {
        return `${Math.round(hours)}h`;
    }
    return `${Math.round(hours / 8)} days`;
};

const mapCandidateRecommendations = (payload: CandidateRecommendationsApiResponse): CandidateRecommendationsData => ({
    trainings: (payload.trainings ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        provider: item.provider || "Training provider not specified",
        duration: formatTrainingDuration(item.duration_hours),
        level: item.level || "N/A",
        relevance: Number(item.relevance || 0),
    })),
    relatedRoles: (payload.related_roles ?? []).map(mapCandidateMatch),
    skillsToImprove: payload.skills_to_improve ?? [],
    actions: (payload.actions ?? []).map((item) => ({
        id: item.id,
        reason: item.reason,
        priority: item.priority,
        createdAt: item.created_at || undefined,
    })),
    learningPath: payload.learning_path ?? [],
    limited: payload.limited,
    limitedReason: payload.limited_reason || undefined,
});

const mapProviderCandidateDetail = (payload: ProviderCandidateDetailApiResponse): Candidate => {
    const candidate = payload.candidate;
    const skills = payload.skills ?? [];
    const jobExperiences = (payload.job_experiences ?? []).map(mapParsedResumeExperience);
    const internshipExperiences = (payload.internship_experiences ?? []).map(mapParsedResumeExperience);
    const combinedParsedExperiences = [...jobExperiences, ...internshipExperiences];
    const codingSkills = payload.coding_skills ?? null;
    const canonicalTopSkills = skills
        .filter((item) => !item.is_language)
        .map((item) => item.label)
        .filter(Boolean);
    const topSkills = codingSkills && codingSkills.length > 0 ? codingSkills : canonicalTopSkills;
    const languages = skills
        .filter((item) => item.is_language)
        .map((item) => ({
            label: item.label,
            level: item.level || "",
        }));
    const name = candidate.display_name || `Candidate ${candidate.id.slice(0, 8)}`;
    const experienceYears = Math.max(0, Math.round(
        skills.reduce((max, item) => Math.max(max, Number(item.years || 0)), 0),
    ));
    const occupation = jobExperiences[0]?.role || internshipExperiences[0]?.role || payload.experiences?.[0]?.occupation || topSkills[0] || "Unspecified occupation";
    const offers = (payload.offers ?? []).map((item) => ({
        id: item.offer_id,
        title: item.offer_title || "Untitled offer",
        company: item.company_name || "Unknown company",
        score: Math.max(0, Math.min(100, Math.round(Number(item.match_score || 0)))),
        rank: item.rank ?? undefined,
    }));

    return {
        id: candidate.id,
        name,
        initials: toInitials(name),
        occupation,
        location: candidate.location || "Unknown location",
        experienceYears,
        score: Math.max(0, Math.min(100, Math.round(Number(candidate.match_score || 0)))),
        topSkills,
        missing: [],
        summary: offers.length > 0
            ? `Matched against ${offers.length} provider offer${offers.length === 1 ? "" : "s"} from canonical match results.`
            : "Parsed canonical candidate profile with no scoped provider matches returned.",
        status: deriveCandidateStatus(candidate.status),
        email: candidate.email || undefined,
        phone: candidate.phone || undefined,
        documents: (payload.documents ?? []).map(mapCandidateDocument),
        offers,
        experiences: combinedParsedExperiences.length > 0
            ? combinedParsedExperiences
            : (payload.experiences ?? []).map((item, index) => ({
                company: "Parsed experience",
                role: item.occupation || `Experience ${index + 1}`,
                years: formatDateRange(item.start_date, item.end_date),
                description: item.description || "No description was extracted for this experience.",
            })),
        jobExperiences,
        internshipExperiences,
        codingSkills,
        education: (payload.education ?? []).map((item) => ({
            school: item.institution || "Institution not specified",
            degree: item.degree || item.level || "Education",
            years: item.graduation_year ? String(item.graduation_year) : "",
        })),
        languages,
    };
};

const buildDataExplorerFromBackend = async (): Promise<DataExplorerDataset> => {
    const [cvDocuments, offerDocuments, pipelineRuns, taxonomy] = await Promise.all([
        fetchRecentDocuments("cv", 40),
        fetchRecentDocuments("offer", 40),
        fetchPipelineRecent(60),
        apiRequest<ListResponse<TaxonomyCodeApiItem>>(
            "/taxonomy/codes",
            { method: "GET" },
            {
                query: {
                    limit: 40,
                },
            },
        ),
    ]);

    return {
        candidates: cvDocuments.map((item) => ({
            id: item.source_id,
            label: item.canonical_entity_id || "Candidate",
            sub: item.status,
            score: item.trace_id,
        })),
        jobs: offerDocuments.map((item) => ({
            id: item.source_id,
            label: item.canonical_entity_id || "Offer",
            sub: item.status,
            score: item.trace_id,
        })),
        pipeline: pipelineRuns.map((item) => {
            const sourceId = item.source_id || item.entity_id || "-";
            const status = item.status || item.current_status || "unknown";
            return {
                id: item.run_id || item.trace_id,
                label: `${item.entity_type}/${sourceId}`,
                sub: humanizeBackendLabel(status),
                score: formatShortDate(item.updated_at || item.created_at || item.received_at),
            };
        }),
        // TODO(frontend): no dedicated match result listing endpoint is exposed by the current backend.
        matches: [],
        taxonomy: (taxonomy.items || []).map((item) => ({
            id: item.code,
            label: item.label_en || item.label_fr || item.code,
            sub: item.domain,
            score: item.model_name,
        })),
    };
};

const mapTaxonomyApiItem = (item: TaxonomyCodeApiItem): TaxonomyNode => {
    const label = item.preferred_label || item.label_en || item.label_fr || item.code;
    const typeSource = item.node_type || item.domain;

    return {
        id: item.id,
        code: item.code,
        label,
        type: mapDomainToTaxonomyType(typeSource),
        aliases: item.aliases || [],
        aliasCount: item.alias_count ?? item.aliases?.length ?? 0,
        relationCount: item.relation_count ?? 0,
        source: mapModelToSource(item.model_name),
        related: item.parent_code ? [item.parent_code] : [],
        description: `${item.taxonomy_name} - ${item.domain}`,
        updated: normalizeTimestamp(item.updated_at || item.model_version),
        domain: item.domain,
        taxonomyName: item.taxonomy_name,
        modelName: item.model_name,
        modelVersion: item.model_version,
        parentCode: item.parent_code || undefined,
        labelFr: item.label_fr || undefined,
        labelEn: item.label_en || undefined,
        status: item.status,
        isLeaf: item.is_leaf,
        isDeprecated: item.is_deprecated,
        raw: item as unknown as Record<string, unknown>,
    };
};

const mapTaxonomyDetail = (payload: {
    node: TaxonomyCodeApiItem & Record<string, unknown>;
    labels: TaxonomyNodeDetail["labels"];
    aliases: TaxonomyNodeDetail["aliases"];
    relations: TaxonomyNodeDetail["relations"];
}): TaxonomyNodeDetail => ({
    node: mapTaxonomyApiItem(payload.node),
    labels: payload.labels ?? [],
    aliases: payload.aliases ?? [],
    relations: payload.relations ?? [],
});

const mapUserApiItem = (item: UserApiItem): PlatformUser => ({
    id: item.id,
    name: toDisplayNameFromEmail(item.email),
    email: item.email,
    role: item.role,
    status: item.status,
    created: normalizeTimestamp(item.created_at),
    createdAt: item.created_at,
});

const mapProviderRegistrationRequestApiItem = (
    item: ProviderRegistrationRequestApiItem,
): ProviderRegistrationRequestRecord => ({
    id: item.id,
    contactName: item.contact_name,
    jobTitle: item.job_title,
    companyName: item.company_name,
    email: item.email,
    phone: item.phone,
    website: item.website ?? null,
    companySize: item.company_size,
    hiringNeeds: item.hiring_needs,
    status: item.status,
    teamMessageId: item.team_message_id ?? null,
    confirmationMessageId: item.confirmation_message_id ?? null,
    created: normalizeTimestamp(item.created_at),
    createdAt: item.created_at,
    updatedAt: item.updated_at ?? null,
});

const mapAuditApiItem = (item: AuditLogApiItem): AuditLog => ({
    id: item.id,
    actorUserId: item.actor_user_id,
    actorEmail: item.actor_email,
    action: item.action,
    entityType: item.entity_type,
    entityId: item.entity_id,
    traceId: item.trace_id,
    resultCode: Number(item.result_code || 0),
    occurredAt: item.occurred_at,
    status: mapResultCodeToAuditStatus(Number(item.result_code || 0)),
    trace: item.trace_id,
    timestamp: normalizeTimestamp(item.occurred_at),
    actor: item.actor_email || item.actor_user_id || "system",
    entity: item.entity_type,
    payload: {
        actor_user_id: item.actor_user_id,
        actor_email: item.actor_email,
        actor_role: item.actor_role,
        result_code: item.result_code,
        occurred_at: item.occurred_at,
    },
});

const normalizePipelineSummary = (payload: PipelineSummaryApiResponse): PipelineSummary => ({
    overall: payload.overall ?? {},
    by_entity_type: payload.by_entity_type ?? {},
    cards: {
        total_pipeline_items: payload.cards?.total_pipeline_items ?? countPipelineRuns(payload),
        currently_failed: payload.cards?.currently_failed ?? payload.overall?.failed ?? 0,
        parsed: payload.cards?.parsed ?? payload.overall?.parsed ?? 0,
        canonicalized: payload.cards?.canonicalized ?? payload.overall?.canonicalized ?? 0,
        search_ready: payload.cards?.search_ready ?? payload.overall?.search_ready ?? 0,
        recent_events_count: payload.cards?.recent_events_count ?? 0,
    },
    status_distribution: payload.status_distribution ?? Object.entries(payload.overall ?? {}).map(([name, value]) => ({ name, value })),
    events_over_time: payload.events_over_time ?? [],
    failures_by_stage: payload.failures_by_stage ?? [],
    entity_type_distribution: payload.entity_type_distribution ?? Object.entries(payload.by_entity_type ?? {}).map(([name, statuses]) => ({
        name,
        value: Object.values(statuses).reduce((total, value) => total + Number(value || 0), 0),
    })),
});


const buildMockCandidateProfile = (): CandidateProfile => {
    const profile = readLocalCandidateProfile();
    const fullName = profile.personalInfo.full_name || "Demo Candidate";
    const codingSkills = profile.codingSkills.length > 0 ? profile.codingSkills : null;
    return {
        name: fullName,
        initials: getCandidateProfileInitials(fullName),
        headline: profile.summary,
        location: profile.personalInfo.location || "Tunis, Tunisia",
        email: profile.personalInfo.email || "candidate@matchcore.demo",
        phone: profile.personalInfo.phone || "+216 XX XXX XXX",
        primaryLang: profile.languages[0] || "English",
        occupation: profile.jobExperiences[0]?.title || profile.internshipExperiences[0]?.title || "Software Engineering Student",
        occupationConfidence: 92,
        yearsExperience: getCandidateYearsExperience(profile),
        skillsCount: profile.skills.length + profile.codingSkills.length,
        coreSkills: profile.skills.slice(0, 8),
        secondarySkills: profile.skills.slice(8),
        suggestedSkills: ["Kafka", "OpenSearch", "Qdrant"],
        experiences: [...profile.jobExperiences, ...profile.internshipExperiences].map((item) => ({
            company: item.company,
            role: item.title,
            years: [item.start_date, item.end_date].filter(Boolean).join(" - "),
            description: item.description,
        })),
        jobExperiences: profile.jobExperiences.map((item) => ({
            company: item.company,
            role: item.title,
            years: [item.start_date, item.end_date].filter(Boolean).join(" - "),
            description: item.description,
        })),
        internshipExperiences: profile.internshipExperiences.map((item) => ({
            company: item.company,
            role: item.title,
            years: [item.start_date, item.end_date].filter(Boolean).join(" - "),
            description: item.description,
        })),
        codingSkills,
        education: profile.education.map((item) => ({
            school: item.institution,
            degree: item.degree,
            years: [item.start_date, item.end_date].filter(Boolean).join(" - "),
        })),
        languages: profile.languages.map((language) => ({ label: language, level: "Professional" })),
        documents: [],
    };
};

const buildMockCandidateDashboard = (): CandidateDashboardData => {
    const profile = readLocalCandidateProfile();
    const completion = getCandidateProfileCompletion(profile);
    const topMatches = mock.jobs.slice(0, 5);
    const avgScore = Math.round(
        topMatches.reduce((total, item) => total + (item.score ?? 0), 0) / Math.max(1, topMatches.length),
    );
    return {
        profileName: profile.personalInfo.full_name || "Demo Candidate",
        openOffers: mock.jobs.filter((job) => job.status === "Active").length,
        profileCompletion: completion,
        profileSections: getCandidateProfileSections(profile),
        matchedJobs: topMatches.length,
        averageMatchScore: avgScore,
        recommendationCount: mock.trainings.length,
        topMatches,
        matchingActivity: mock.matchingActivity,
        detectedSkills: [...profile.skills, ...profile.codingSkills].slice(0, 12),
        missingSkills: ["Kafka", "Spark", "OpenSearch"],
        activityTimeline: mock.activityTimeline,
        pipelineStatus: {
            lastUploadAt: new Date().toISOString(),
            steps: [
                { label: "CV selected", status: "complete", timestamp: new Date().toISOString() },
                { label: "Information extracted", status: "complete", timestamp: new Date().toISOString() },
                { label: "Profile ready", status: "complete", timestamp: new Date().toISOString() },
            ],
        },
    };
};

const buildMockAdvisorDashboard = (): AdvisorDashboardData => ({
    stats: {
        candidateDocuments: mock.candidates.length,
        offerDocuments: mock.jobs.length,
        taxonomyNodes: mock.taxonomyNodes.length,
        pipelineRuns: mock.pipelineStatuses.reduce((total, item) => total + item.value, 0),
        errorCount: mock.pipelineStatuses.find((item) => item.name === "Failed")?.value ?? 0,
    },
    matchingActivity: mock.matchingActivity,
    taxonomyDistribution: mock.taxonomyDistribution,
    pipelineStatuses: mock.pipelineStatuses,
    scoreDistribution: mock.scoreDistribution,
    recentWarnings: mock.activityTimeline,
});

const buildMockListResponse = <T,>(items: T[], limit = 100, offset = 0): ListResponse<T> => ({
    count: items.length,
    total: items.length,
    limit,
    offset,
    items: items.slice(offset, offset + limit),
});

export const talentApi = {
    auth: {
        listRoles: async (): Promise<RoleOption[]> => ROLE_OPTIONS,
        getRoleProfile: async (role: Role): Promise<RoleProfile> => {
            const session = readStoredSession();
            if (session && session.user.role === role) {
                return {
                    role,
                    name: session.user.name,
                    email: session.user.email,
                    initials: toInitials(session.user.name),
                };
            }

            return {
                role,
                name: role === "provider" ? "Provider" : role[0].toUpperCase() + role.slice(1),
                email: "",
                initials: role.slice(0, 2).toUpperCase(),
            };
        },
    },
    catalog: {
        // TODO(frontend): no dedicated backend endpoint for static filter catalogs yet.
        getOptions: async (): Promise<CatalogOptions> => ({
            skills: mock.skills,
            occupations: mock.occupations,
            companies: mock.companies,
            locations: mock.locations,
            contractTypes: mock.contractTypes,
            experienceLevels: mock.experienceLevels,
        }),
    },
    documents: {
        getAccess: async (documentId: string, accessPath?: string): Promise<DocumentAccessResult> => {
            if (!documentId) {
                throw new ApiServiceError("Document id is required", 400);
            }

            const path = accessPath || `/documents/${encodeURIComponent(documentId)}/access`;
            const payload = await apiRequest<DocumentAccessApiResponse>(path, { method: "GET" });
            return mapDocumentAccess(payload);
        },
    },
    candidate: {
        getDashboard: async (): Promise<CandidateDashboardData> => {
            if (appEnv.enableMockFallback) {
                return buildMockCandidateDashboard();
            }

            const payload = await apiRequest<CandidateDashboardApiResponse>("/candidate/me/dashboard", { method: "GET" });
            return mapCandidateDashboard(payload);
        },
        getProfile: async (): Promise<CandidateProfile> => {
            if (appEnv.enableMockFallback) {
                return buildMockCandidateProfile();
            }

            const payload = await apiRequest<CandidateProfileApiResponse>("/candidate/me/profile", { method: "GET" });
            return mapCandidateProfile(payload);
        },
        updateProfile: async (payload: CandidateProfileUpdate): Promise<CandidateProfile> => {
            if (appEnv.enableMockFallback) {
                const current = readLocalCandidateProfile();
                writeLocalCandidateProfile({
                    ...current,
                    personalInfo: {
                        ...current.personalInfo,
                        full_name: payload.fullName ?? current.personalInfo.full_name,
                        email: payload.email ?? current.personalInfo.email,
                        phone: payload.phone ?? current.personalInfo.phone,
                        location: payload.location ?? current.personalInfo.location,
                    },
                });
                return buildMockCandidateProfile();
            }

            const response = await apiRequest<CandidateProfileApiResponse>(
                "/candidate/me/profile",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        full_name: payload.fullName,
                        email: payload.email,
                        phone: payload.phone,
                        location: payload.location,
                        primary_lang: payload.primaryLang,
                    }),
                },
            );
            return mapCandidateProfile(response);
        },
        uploadCv: async (file: File): Promise<CandidateCvUploadResult> => {
            if (appEnv.enableMockFallback) {
                return {
                    cvId: `demo-cv-${Date.now()}`,
                    traceId: `demo-trace-${Date.now()}`,
                    status: "search_ready",
                    linkedCandidateId: "demo-candidate",
                    sessionToken: "demo-cv-session",
                    message: `Demo CV processed locally: ${file.name}`,
                    pipeline: {
                        lastUploadAt: new Date().toISOString(),
                        steps: [
                            { label: "Selected", status: "complete", timestamp: new Date().toISOString() },
                            { label: "Parsed", status: "complete", timestamp: new Date().toISOString() },
                            { label: "Ready", status: "complete", timestamp: new Date().toISOString() },
                        ],
                    },
                };
            }

            const formData = new FormData();
            formData.set("file", file);
            const payload = await apiRequest<CandidateCvUploadApiResponse>(
                "/candidate/me/cv/upload",
                {
                    method: "POST",
                    body: formData,
                },
            );
            const result = mapCandidateCvUpload(payload);
            if (result.sessionToken) {
                writeStoredCandidateCvToken(result.sessionToken);
            }
            return result;
        },
        getCvUploadStatus: async (cvId: string): Promise<CandidateCvUploadResult> => {
            if (appEnv.enableMockFallback) {
                return { cvId, traceId: "demo-trace", status: "search_ready", linkedCandidateId: "demo-candidate" };
            }

            const payload = await apiRequest<CandidateCvUploadApiResponse>(
                `/candidate/me/cv/uploads/${encodeURIComponent(cvId)}`,
                { method: "GET" },
            );
            return mapCandidateCvUpload(payload);
        },
        listMatches: async (): Promise<Job[]> => {
            if (appEnv.enableMockFallback) {
                return mock.jobs.filter((job) => job.status === "Active").slice(0, 12);
            }

            const payload = await apiRequest<CandidateMatchesApiResponse>(
                "/candidate/me/matches",
                { method: "GET" },
                {
                    query: {
                        limit: 100,
                    },
                },
            );
            return (payload.items ?? []).map(mapCandidateMatch);
        },
        listJobOffers: async (): Promise<Job[]> => {
            if (appEnv.enableMockFallback) {
                return mock.jobs;
            }

            const payload = await apiRequest<CandidateMatchesApiResponse>(
                "/candidate/me/job-offers",
                { method: "GET" },
                {
                    query: {
                        limit: 100,
                    },
                },
            );
            return (payload.items ?? []).map(mapCandidateMatch);
        },
        getMatch: async (id?: string): Promise<Job> => {
            if (!id) {
                throw new ApiServiceError("Offer id is required", 400);
            }

            if (appEnv.enableMockFallback) {
                const match = mock.jobs.find((job) => job.id === id) ?? mock.jobs[0];
                if (!match) {
                    throw new ApiServiceError("Match not found", 404);
                }
                return match;
            }

            const payload = await apiRequest<CandidateMatchesApiResponse>(
                `/candidate/me/matches/${encodeURIComponent(id)}`,
                { method: "GET" },
            );
            const match = payload.items?.[0];
            if (!match) {
                throw new ApiServiceError("Match not found", 404);
            }

            return mapCandidateMatch(match);
        },
        getRecommendations: async (): Promise<CandidateRecommendationsData> => {
            if (appEnv.enableMockFallback) {
                return {
                    trainings: mock.trainings,
                    relatedRoles: mock.jobs.slice(0, 4),
                    skillsToImprove: ["Kafka", "Spark", "OpenSearch"],
                    actions: [
                        { id: "A1", reason: "Add more technical skills", priority: 1 },
                        { id: "A2", reason: "Upload your latest CV", priority: 2 },
                    ],
                    learningPath: [],
                };
            }

            const payload = await apiRequest<CandidateRecommendationsApiResponse>("/candidate/me/recommendations", { method: "GET" });
            return mapCandidateRecommendations(payload);
        },
    },
    provider: {
        getDashboard: async (): Promise<ProviderDashboardData> => {
            const [activeOffers, recentCandidates] = await Promise.all([
                talentApi.provider.listOffers(),
                talentApi.provider.listCandidates(),
            ]);
            return {
                activeOffers,
                topOffers: [...activeOffers].slice(0, 5),
                recentCandidates: recentCandidates.slice(0, 6),
                matchingActivity: buildProviderActivity(activeOffers),
                matchedCandidates: recentCandidates.length,
                newApplications: 0,
                averageMatchQuality: 0,
            };
        },
        listOffers: async (): Promise<Job[]> => {
            if (appEnv.enableMockFallback) {
                return mock.jobs;
            }

            const payload = await apiRequest<ListResponse<ProviderOfferApiItem>>(
                "/provider/offers",
                { method: "GET" },
                {
                    query: {
                        limit: 100,
                    },
                },
            );
            return (payload.items ?? []).map(mapProviderOffer);
        },
        getOffer: async (id?: string): Promise<ProviderOfferDetail> => {
            if (!id) {
                throw new ApiServiceError("Offer id is required", 400);
            }

            if (appEnv.enableMockFallback) {
                const offer = mock.jobs.find((job) => job.id === id) ?? mock.jobs[0];
                if (!offer) {
                    throw new ApiServiceError("Offer not found", 404);
                }
                return {
                    offer,
                    candidates: mock.candidates.slice(0, 8),
                    raw: { mode: "mock" },
                };
            }

            const payload = await apiRequest<ProviderOfferDetailApiResponse>(
                "/provider/offers/" + encodeURIComponent(id),
                { method: "GET" },
            );

            return {
                offer: mapProviderOffer(payload.offer),
                candidates: (payload.candidates ?? []).map(mapProviderCandidate),
                raw: payload,
            };
        },
        deleteOffer: async (id: string): Promise<{ message: string }> => {
            if (!id) {
                throw new ApiServiceError("Offer id is required", 400);
            }

            if (appEnv.enableMockFallback) {
                return { message: `Demo offer ${id} deleted locally.` };
            }

            return apiRequest<{ message: string }>(
                "/provider/offers/" + encodeURIComponent(id),
                { method: "DELETE" },
            );
        },
        parseOfferText: async (payload: OfferParsePayload): Promise<OfferParsedOutput> => {
            if (appEnv.enableMockFallback) {
                return {
                    contract_version: "demo.v1",
                    offer_id: payload.offerId || `OFFER-DEMO-${Date.now()}`,
                    source: { filename: payload.filename || "demo-offer.txt", mime_type: "text/plain" },
                    parsing_metadata: { parser_version: "demo", parsed_at: new Date().toISOString(), lang: "en", confidence_overall: 0.94 },
                    offer: { title: "Data Engineer", company_name: "MatchCore Demo", location: "Tunis, Tunisia", employment_type: "full_time" },
                    occupations_target: [{ code: "data-engineer", label: "Data Engineer", weight: 1 }],
                    requirements: {
                        mandatory_skills: ["Python", "SQL", "PostgreSQL"].map((label) => ({ code: label.toLowerCase(), label, min_level: "intermediate", weight: 1 })),
                        optional_skills: ["Kafka", "Spark"].map((label) => ({ code: label.toLowerCase(), label, weight: 0.5 })),
                    },
                };
            }

            const response = await apiRequest<OfferParseApiResponse>(
                "/provider/offers/parse",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        raw_text: payload.rawText,
                        offer_id: payload.offerId,
                        filename: payload.filename,
                    }),
                },
            );
            return response.data;
        },
        createOffer: async (payload: CreateJobOfferPayload): Promise<Job> => {
            if (appEnv.enableMockFallback) {
                return {
                    id: `JOB-DEMO-${Date.now()}`,
                    title: payload.title || "Untitled offer",
                    company: payload.companyName || "Demo company",
                    location: payload.location,
                    contract: payload.contract,
                    level: payload.level,
                    postedDays: 0,
                    applicants: 0,
                    matched: 0,
                    status: "Draft",
                    required: payload.requiredSkills,
                    preferred: payload.preferredSkills,
                    score: 0,
                    matchedSkills: [],
                    missingSkills: [],
                };
            }

            const response = await apiRequest<OfferSubmitApiResponse>(
                "/provider/offers/submit",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        raw_text: payload.rawText,
                        offer_id: payload.parsedOffer?.offer_id,
                        parsed_offer: payload.parsedOffer,
                        structured_offer: {
                            title: payload.title,
                            company_name: payload.companyName,
                            location: payload.location,
                            employment_type: payload.contract,
                            seniority_level: payload.level,
                            target_occupations: payload.targetOccupations,
                            mandatory_skills: payload.requiredSkills,
                            optional_skills: payload.preferredSkills,
                            min_years_experience: payload.minYearsExperience,
                            education_min: payload.educationMin,
                            certifications_preferred: payload.certificationsPreferred,
                            languages: payload.languages,
                        },
                    }),
                },
            );

            return {
                id: response.offer_id,
                title: payload.title,
                company: payload.companyName || "Pending company",
                location: payload.location,
                contract: payload.contract,
                level: payload.level,
                postedDays: 0,
                applicants: 0,
                matched: 0,
                status: "Draft",
                required: payload.requiredSkills,
                preferred: payload.preferredSkills,
                score: 0,
                matchedSkills: [],
                missingSkills: [],
            };
        },
        listCandidates: async (): Promise<Candidate[]> => {
            if (appEnv.enableMockFallback) {
                return mock.candidates;
            }

            const payload = await apiRequest<ProviderCandidatesResponse>(
                "/provider/candidates",
                { method: "GET" },
                {
                    query: {
                        limit: 100,
                    },
                },
            );
            return (payload.items ?? []).map(mapProviderCandidate);
        },
        getCandidate: async (id?: string): Promise<Candidate> => {
            if (!id) {
                throw new ApiServiceError("Candidate id is required", 400);
            }

            if (appEnv.enableMockFallback) {
                const candidate = mock.candidates.find((item) => item.id === id) ?? mock.candidates[0];
                if (!candidate) {
                    throw new ApiServiceError("Candidate not found", 404);
                }
                return candidate;
            }

            const payload = await apiRequest<ProviderCandidateDetailApiResponse>(
                `/provider/candidates/${encodeURIComponent(id)}`,
                { method: "GET" },
            );
            return mapProviderCandidateDetail(payload);
        },
    },
    advisor: {
        getDashboard: async (): Promise<AdvisorDashboardData> => {
            if (appEnv.enableMockFallback) {
                return buildMockAdvisorDashboard();
            }
            return buildAdvisorDashboardFromBackend();
        },
        getTaxonomySummary: async (): Promise<TaxonomySummary> => {
            if (appEnv.enableMockFallback) {
                return {
                    metrics: {
                        total_nodes: mock.taxonomyNodes.length,
                        total_labels: mock.taxonomyNodes.length,
                        total_aliases: mock.taxonomyNodes.reduce((total, item) => total + (item.aliases?.length ?? 0), 0),
                        total_relations: mock.taxonomyNodes.reduce((total, item) => total + (item.related?.length ?? 0), 0),
                        unresolved_codes: 0,
                        taxonomy_models: 2,
                    },
                    node_type_distribution: mock.taxonomyDistribution,
                    taxonomy_distribution: mock.taxonomyDistribution,
                    occupation_breakdown: mock.taxonomyDistribution.slice(0, 4),
                };
            }
            return apiRequest<TaxonomySummary>("/taxonomy/summary", { method: "GET" });
        },
        listTaxonomyNodes: async (params: TaxonomyQueryParams = {}): Promise<ListResponse<TaxonomyNode>> => {
            if (appEnv.enableMockFallback) {
                const search = params.search?.trim().toLowerCase();
                const filtered = mock.taxonomyNodes.filter((item) => {
                    if (params.type && item.type !== params.type) return false;
                    if (!search) return true;
                    return [item.code, item.label, item.description, ...(item.aliases ?? [])].join(" ").toLowerCase().includes(search);
                });
                return buildMockListResponse(filtered, params.limit ?? 50, params.offset ?? 0);
            }
            const payload = await apiRequest<ListResponse<TaxonomyCodeApiItem>>("/taxonomy/nodes", { method: "GET" }, { query: { limit: params.limit ?? 50, offset: params.offset ?? 0, search: params.search, type: params.type, domain: params.domain, include_deprecated: params.includeDeprecated ?? false } });
            return { ...payload, items: (payload.items ?? []).map(mapTaxonomyApiItem) };
        },
        getTaxonomyNodeDetail: async (nodeId: string): Promise<TaxonomyNodeDetail> => {
            if (appEnv.enableMockFallback) {
                const node = mock.taxonomyNodes.find((item) => item.id === nodeId || item.code === nodeId) ?? mock.taxonomyNodes[0];
                if (!node) throw new ApiServiceError("Taxonomy node not found", 404);
                return {
                    node,
                    labels: [{ id: node.id + "-label", lang: "en", label: node.label, is_preferred: true }],
                    aliases: (node.aliases ?? []).map((alias, index) => ({ id: node.id + "-alias-" + index, lang: "en", alias, alias_type: "mock", is_preferred: false })),
                    relations: [],
                };
            }
            const payload = await apiRequest<{ node: TaxonomyCodeApiItem & Record<string, unknown>; labels: TaxonomyNodeDetail["labels"]; aliases: TaxonomyNodeDetail["aliases"]; relations: TaxonomyNodeDetail["relations"]; }>("/taxonomy/nodes/" + encodeURIComponent(nodeId), { method: "GET" });
            return mapTaxonomyDetail(payload);
        },
        listUnresolvedCodes: async (params: UnresolvedCodesQueryParams = {}): Promise<ListResponse<UnresolvedCode>> => {
            if (appEnv.enableMockFallback) {
                return buildMockListResponse([], params.limit ?? 25, params.offset ?? 0);
            }
            return apiRequest<ListResponse<UnresolvedCode>>("/taxonomy/unresolved-codes", { method: "GET" }, { query: { limit: params.limit ?? 25, offset: params.offset ?? 0, search: params.search, aggregate_type: params.aggregateType, resolved: params.resolved } });
        },
        listUsers: async (params: UsersQueryParams = {}): Promise<ListResponse<PlatformUser>> => {
            if (appEnv.enableMockFallback) {
                const search = params.search?.trim().toLowerCase();
                const filtered = mock.users.filter((item) => !search || [item.name, item.email, item.role, item.status].join(" ").toLowerCase().includes(search));
                return buildMockListResponse(filtered, params.limit ?? 25, params.offset ?? 0);
            }
            const payload = await apiRequest<ListResponse<UserApiItem>>("/users", { method: "GET" }, { query: { limit: params.limit ?? 25, offset: params.offset ?? 0, search: params.search, role: params.role, status: params.status } });
            return { ...payload, items: (payload.items ?? []).map(mapUserApiItem) };
        },
        listProviderRegistrationRequests: async (params: ProviderRegistrationRequestsQueryParams = {}): Promise<ListResponse<ProviderRegistrationRequestRecord>> => {
            if (appEnv.enableMockFallback) {
                return buildMockListResponse([], params.limit ?? 25, params.offset ?? 0);
            }
            const payload = await apiRequest<ListResponse<ProviderRegistrationRequestApiItem>>("/users/provider-registration-requests", { method: "GET" }, { query: { limit: params.limit ?? 25, offset: params.offset ?? 0, search: params.search, status: params.status } });
            return { ...payload, items: (payload.items ?? []).map(mapProviderRegistrationRequestApiItem) };
        },
        createProviderAccount: async (payload: AdminCreateProviderPayload): Promise<AdminCreateProviderResponse> => {
            if (appEnv.enableMockFallback) {
                return { id: "USR-DEMO-" + Date.now(), email: payload.email, role: "provider", status: "Active", company_id: "COMP-DEMO-" + Date.now(), message: "Demo provider account created locally." };
            }
            return apiRequest<AdminCreateProviderResponse>("/users/provider-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: payload.email, password: payload.password, company_name: payload.companyName, contact_name: payload.contactName || null, phone: payload.phone || null, website: payload.website || null, company_size: payload.companySize || null }) });
        },
        listAuditLogs: async (params: AuditLogsQueryParams = {}): Promise<ListResponse<AuditLog>> => {
            if (appEnv.enableMockFallback) {
                return buildMockListResponse(mock.auditLogs, params.limit ?? 100, params.offset ?? 0);
            }
            const payload = await apiRequest<ListResponse<AuditLogApiItem>>("/logs/audit", { method: "GET" }, { query: { limit: params.limit ?? 100, offset: params.offset ?? 0, search: params.search, trace_id: params.traceId, entity_type: params.entityType, action: params.action, result_code: params.resultCode, result_status: params.resultStatus } });
            return { ...payload, items: (payload.items ?? []).map(mapAuditApiItem) };
        },
        getPipelineMonitoringSummary: async (): Promise<PipelineSummary> => {
            if (appEnv.enableMockFallback) {
                return {
                    overall: Object.fromEntries(mock.pipelineStatuses.map((item) => [item.name.toLowerCase(), item.value])),
                    by_entity_type: { candidate: { search_ready: 18 }, offer: { search_ready: 24 } },
                    cards: { total_pipeline_items: 128, currently_failed: 2, parsed: 110, canonicalized: 96, search_ready: 84, recent_events_count: 12 },
                    status_distribution: mock.pipelineStatuses,
                    events_over_time: mock.matchingActivity.map((item) => ({ name: item.day, value: item.matches })),
                    failures_by_stage: [{ name: "parse", value: 1 }, { name: "canonicalize", value: 1 }],
                    entity_type_distribution: [{ name: "candidate", value: 58 }, { name: "offer", value: 70 }],
                };
            }
            const payload = await apiRequest<PipelineSummaryApiResponse>("/pipeline/summary", { method: "GET" });
            return normalizePipelineSummary(payload);
        },
        listPipelineItems: async (params: PipelineItemsQueryParams = {}): Promise<ListResponse<PipelineItem>> => {
            if (appEnv.enableMockFallback) {
                const now = new Date().toISOString();
                const items: PipelineItem[] = [...mock.jobs.slice(0, 8), ...mock.candidates.slice(0, 8)].map((item, index) => ({ trace_id: "demo-trace-" + index, entity_type: "title" in item ? "offer" : "candidate", source_id: item.id, status: "search_ready", current_status: "search_ready", error_stage: null, error_message: null, canonical_entity_id: item.id, ingestion_event_id: null, parsed_event_id: null, created_at: now, updated_at: now, stored_at: now, parsed_at: now, canonicalized_at: now, search_ready_at: now, failed_at: null }));
                return buildMockListResponse(items, params.limit ?? 25, params.offset ?? 0);
            }
            return apiRequest<ListResponse<PipelineItem>>("/pipeline/items", { method: "GET" }, { query: { limit: params.limit ?? 25, offset: params.offset ?? 0, search: params.search, entity_type: params.entityType, status: params.status } });
        },
        getPipelineItemDetail: async (entityType: string, sourceId: string): Promise<PipelineItemDetail> => {
            if (appEnv.enableMockFallback) {
                const now = new Date().toISOString();
                const current: PipelineItem = { trace_id: "demo-trace-" + sourceId, entity_type: entityType, source_id: sourceId, status: "search_ready", current_status: "search_ready", error_stage: null, error_message: null, canonical_entity_id: sourceId, ingestion_event_id: null, parsed_event_id: null, created_at: now, updated_at: now, stored_at: now, parsed_at: now, canonicalized_at: now, search_ready_at: now, failed_at: null };
                return { current, history: [{ ...current, run_id: "run-" + sourceId }] };
            }
            return apiRequest<PipelineItemDetail>("/pipeline/items/" + encodeURIComponent(entityType) + "/" + encodeURIComponent(sourceId), { method: "GET" }, { query: { history_limit: 25 } });
        },
        getDataExplorer: async (): Promise<DataExplorerDataset> => {
            if (appEnv.enableMockFallback) {
                return {
                    candidates: mock.candidates.slice(0, 8).map((item) => ({ id: item.id, label: item.name, sub: item.occupation, score: item.score + "%" })),
                    jobs: mock.jobs.slice(0, 8).map((item) => ({ id: item.id, label: item.title, sub: item.company, score: (item.score ?? 0) + "%" })),
                    pipeline: mock.pipelineStatuses.map((item) => ({ id: item.name, label: item.name, sub: "Pipeline status", score: String(item.value) })),
                    matches: mock.jobs.slice(0, 8).map((item) => ({ id: "match-" + item.id, label: item.title, sub: item.company, score: (item.score ?? 0) + "%" })),
                    taxonomy: mock.taxonomyNodes.slice(0, 8).map((item) => ({ id: item.id, label: item.label, sub: item.type, score: item.code })),
                };
            }
            return buildDataExplorerFromBackend();
        },
    },
};
