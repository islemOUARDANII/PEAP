import { apiRequest, ApiServiceError } from "@/services/api/client";
import {
  clearStoredCandidateCvToken,
  readStoredCandidateCvToken,
  writeStoredCandidateCvToken,
} from "./cvSessionStorage";

interface CandidateCvUploadApiResponse {
  success: boolean;
  message: string;
  token: string;
  resume_id: string;
  redirect_to: string;
}

interface CandidateCvSessionRestoreApiResponse {
  linked: boolean;
  token?: string | null;
  resume_id?: string | null;
}

interface CandidateSessionProfileApiResponse {
  resume_id: string;
  profile: string;
  experience_years?: number | null;
  experience_warnings?: string[];
  personal_info?: Record<string, unknown>;
  summary?: string;
  education?: CandidateSessionEducation[];
  experience?: CandidateSessionExperience[];
  job_experiences?: CandidateSessionExperience[];
  internship_experiences?: CandidateSessionExperience[];
  skills?: CandidateSessionSkillGroup[];
  coding_skills?: string[] | null;
  languages?: CandidateSessionLanguage[];
  certifications?: CandidateSessionCertification[];
  projects?: CandidateSessionProject[];
  interests?: Array<Record<string, unknown>>;
  volunteer?: Array<Record<string, unknown>>;
  associations?: Array<Record<string, unknown>>;
  additional_info?: Array<Record<string, unknown>>;
  other_sections?: Array<Record<string, unknown>>;
  awards?: Array<Record<string, unknown>>;
  matching_refresh?: {
    status: string;
    results_count?: number;
    detail?: string;
  };
}

interface CandidateMatchingApiResponse {
  resume_id: string;
  results: CandidateSessionOfferApiItem[];
}

interface CandidateSessionOfferApiItem {
  id: string;
  offer_id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type?: string;
  seniority_level?: string;
  experience_years_min?: number | null;
  education?: string;
  mandatory_skills?: string[];
  optional_skills?: string[];
  languages?: string[];
  status: string;
  profile: string;
  profile_type?: string;
  main_score: number;
  final_rule_score: number;
  semantic_score?: number | null;
  final_score: number;
  final_hybrid_formula?: string;
  subscores?: Record<string, number>;
  rejection_reasons?: string[];
  requirements?: Record<string, unknown>;
  matching_result?: CandidateSessionOfferMatchingResultApi;
}

interface CandidateSessionOfferMatchingResultApi {
  status: string;
  final_score: number;
  final_rule_score: number;
  semantic_score?: number | null;
  profile_type?: string;
  hard_filters?: Record<string, unknown>;
  rejection_reasons?: string[];
  formula?: string;
  subscores?: Record<string, number>;
}

export interface CandidateCvUploadResult {
  success: boolean;
  message: string;
  token: string;
  resumeId: string;
  redirectTo: string;
}

export interface CandidateSessionSkillItem {
  name: string;
  level?: string | null;
  code?: string | null;
  normalized_name?: string | null;
  matched_label?: string | null;
  confidence?: number | null;
  match_type?: string | null;
}

export interface CandidateSessionSkillGroup {
  category?: string | null;
  items: CandidateSessionSkillItem[];
}

export interface CandidateSessionExperience {
  company?: string | null;
  job_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  code?: string | null;
  confidence?: number | null;
}

export interface CandidateSessionEducation {
  institution?: string | null;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  date?: string | null;
  code?: string | null;
  confidence?: number | null;
}

export interface CandidateSessionLanguage {
  name?: string | null;
  level?: string | null;
  code?: string | null;
  confidence?: number | null;
}

export interface CandidateSessionCertification {
  name?: string | null;
  issuer?: string | null;
  date?: string | null;
  code?: string | null;
  confidence?: number | null;
}

export interface CandidateSessionProject {
  name?: string | null;
  description?: string | null;
  technologies?: string[] | null;
  role?: string | null;
  date?: string | null;
}

export interface CandidateSessionProfile {
  resumeId: string;
  profile: string;
  experienceYears?: number | null;
  experienceWarnings: string[];
  personalInfo: Record<string, unknown>;
  summary: string;
  education: CandidateSessionEducation[];
  experience: CandidateSessionExperience[];
  jobExperiences: CandidateSessionExperience[];
  internshipExperiences: CandidateSessionExperience[];
  skills: CandidateSessionSkillGroup[];
  codingSkills: string[] | null;
  languages: CandidateSessionLanguage[];
  certifications: CandidateSessionCertification[];
  projects: CandidateSessionProject[];
  interests: Array<Record<string, unknown>>;
  volunteer: Array<Record<string, unknown>>;
  associations: Array<Record<string, unknown>>;
  additionalInfo: Array<Record<string, unknown>>;
  otherSections: Array<Record<string, unknown>>;
  awards: Array<Record<string, unknown>>;
  matchingRefresh?: {
    status: string;
    resultsCount?: number;
    detail?: string;
  };
}

export interface CandidateSessionProfileUpdatePayload {
  profile?: string;
  summary?: string;
  experience_years?: number | null;
  experience_warnings?: string[];
  education?: CandidateSessionEducation[];
  experience?: CandidateSessionExperience[];
  job_experiences?: CandidateSessionExperience[];
  internship_experiences?: CandidateSessionExperience[];
  skills?: CandidateSessionSkillGroup[];
  coding_skills?: string[] | null;
  languages?: CandidateSessionLanguage[];
  certifications?: CandidateSessionCertification[];
  projects?: CandidateSessionProject[];
  interests?: Array<Record<string, unknown>>;
  volunteer?: Array<Record<string, unknown>>;
  associations?: Array<Record<string, unknown>>;
  additional_info?: Array<Record<string, unknown>>;
  other_sections?: Array<Record<string, unknown>>;
  awards?: Array<Record<string, unknown>>;
}

export interface CandidateSessionOfferMatchingResult {
  status: string;
  finalScore: number;
  finalRuleScore: number;
  semanticScore?: number | null;
  profileType?: string;
  hardFilters?: Record<string, unknown>;
  rejectionReasons: string[];
  formula?: string;
  subscores: Record<string, number>;
}

export interface CandidateSessionOffer {
  id: string;
  offerId: string;
  title: string;
  companyName: string;
  location: string;
  employmentType?: string;
  seniorityLevel?: string;
  experienceYearsMin?: number | null;
  education?: string;
  mandatorySkills: string[];
  optionalSkills: string[];
  languages: string[];
  status: string;
  profile: string;
  profileType?: string;
  mainScore: number;
  finalRuleScore: number;
  semanticScore?: number | null;
  finalScore: number;
  finalHybridFormula?: string;
  subscores: Record<string, number>;
  rejectionReasons: string[];
  requirements?: Record<string, unknown>;
  matchingResult?: CandidateSessionOfferMatchingResult;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toIdString = (value: unknown): string => String(value ?? "").trim();

const requireCandidateCvToken = (): string => {
  const token = readStoredCandidateCvToken();
  if (!token) {
    throw new ApiServiceError("Upload your CV to view matched offers.", 401);
  }
  return token;
};

const candidateSessionRecoveryStatuses = new Set([401, 404, 500]);

async function withRecoveredCandidateCvToken<T>(
  operation: (token: string) => Promise<T>,
): Promise<T> {
  const initialToken = requireCandidateCvToken();

  try {
    return await operation(initialToken);
  } catch (error) {
    if (!(error instanceof ApiServiceError) || !candidateSessionRecoveryStatuses.has(error.status)) {
      throw error;
    }

    let restoredToken: string | null = null;
    try {
      restoredToken = await restoreCandidateCvSessionToken();
    } catch {
      restoredToken = null;
    }

    if (!restoredToken || restoredToken === initialToken) {
      throw error;
    }

    return operation(restoredToken);
  }
}

export async function restoreCandidateCvSessionToken(): Promise<string | null> {
  try {
    const payload = await apiRequest<CandidateCvSessionRestoreApiResponse>(
      "/candidate/me/cv-session",
      {
        method: "GET",
      },
    );

    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!payload.linked || !token) {
      clearStoredCandidateCvToken();
      return null;
    }

    writeStoredCandidateCvToken(token);
    return token;
  } catch (error) {
    if (error instanceof ApiServiceError && [401, 404].includes(error.status)) {
      clearStoredCandidateCvToken();
      return null;
    }
    throw error;
  }
}

const mapCandidateSessionProfile = (
  payload: CandidateSessionProfileApiResponse,
): CandidateSessionProfile => ({
  resumeId: toIdString(payload.resume_id),
  profile: payload.profile || "unknown",
  experienceYears:
    payload.experience_years === null || payload.experience_years === undefined
      ? payload.experience_years
      : toNumber(payload.experience_years),
  experienceWarnings: payload.experience_warnings ?? [],
  personalInfo: payload.personal_info ?? {},
  summary: payload.summary ?? "",
  education: payload.education ?? [],
  experience: payload.experience ?? [],
  jobExperiences: payload.job_experiences ?? [],
  internshipExperiences: payload.internship_experiences ?? [],
  skills: payload.skills ?? [],
  codingSkills: payload.coding_skills ?? null,
  languages: payload.languages ?? [],
  certifications: payload.certifications ?? [],
  projects: payload.projects ?? [],
  interests: payload.interests ?? [],
  volunteer: payload.volunteer ?? [],
  associations: payload.associations ?? [],
  additionalInfo: payload.additional_info ?? [],
  otherSections: payload.other_sections ?? [],
  awards: payload.awards ?? [],
  matchingRefresh: payload.matching_refresh
    ? {
        status: payload.matching_refresh.status,
        resultsCount:
          payload.matching_refresh.results_count === undefined
            ? undefined
            : toNumber(payload.matching_refresh.results_count),
        detail: payload.matching_refresh.detail,
      }
    : undefined,
});

const mapMatchingResult = (
  payload?: CandidateSessionOfferMatchingResultApi,
): CandidateSessionOfferMatchingResult | undefined => {
  if (!payload) {
    return undefined;
  }

  return {
    status: payload.status,
    finalScore: toNumber(payload.final_score),
    finalRuleScore: toNumber(payload.final_rule_score),
    semanticScore:
      payload.semantic_score === null || payload.semantic_score === undefined
        ? payload.semantic_score
        : toNumber(payload.semantic_score),
    profileType: payload.profile_type || undefined,
    hardFilters: payload.hard_filters || {},
    rejectionReasons: payload.rejection_reasons ?? [],
    formula: payload.formula || undefined,
    subscores: payload.subscores ?? {},
  };
};

const mapOffer = (payload: CandidateSessionOfferApiItem): CandidateSessionOffer => ({
  id: toIdString(payload.id),
  offerId: toIdString(payload.offer_id),
  title: payload.title,
  companyName: payload.company_name,
  location: payload.location,
  employmentType: payload.employment_type || undefined,
  seniorityLevel: payload.seniority_level || undefined,
  experienceYearsMin:
    payload.experience_years_min === null || payload.experience_years_min === undefined
      ? payload.experience_years_min
      : toNumber(payload.experience_years_min),
  education: payload.education || undefined,
  mandatorySkills: payload.mandatory_skills ?? [],
  optionalSkills: payload.optional_skills ?? [],
  languages: payload.languages ?? [],
  status: payload.status,
  profile: payload.profile,
  profileType: payload.profile_type || undefined,
  mainScore: toNumber(payload.main_score),
  finalRuleScore: toNumber(payload.final_rule_score),
  semanticScore:
    payload.semantic_score === null || payload.semantic_score === undefined
      ? payload.semantic_score
      : toNumber(payload.semantic_score),
  finalScore: toNumber(payload.final_score),
  finalHybridFormula: payload.final_hybrid_formula || undefined,
  subscores: payload.subscores ?? {},
  rejectionReasons: payload.rejection_reasons ?? [],
  requirements: payload.requirements,
  matchingResult: mapMatchingResult(payload.matching_result),
});

// ── Offer entry with optional score (used by /offers/all) ────────────────────

interface CandidateAllOffersApiResponse {
  resume_id: string;
  results: CandidateOfferEntryApi[];
}

interface CandidateOfferEntryApi {
  id: string;
  offer_id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type?: string;
  seniority_level?: string;
  experience_years_min?: number | null;
  education?: string;
  mandatory_skills?: string[];
  optional_skills?: string[];
  languages?: string[];
  score_computed: boolean;
  status: string | null;
  profile: string | null;
  main_score: number | null;
  final_rule_score: number | null;
  semantic_score?: number | null;
  final_score: number | null;
  final_hybrid_formula?: string | null;
  subscores?: Record<string, number>;
  rejection_reasons?: string[];
}

export interface CandidateOfferEntry {
  id: string;
  offerId: string;
  title: string;
  companyName: string;
  location: string;
  employmentType?: string;
  seniorityLevel?: string;
  experienceYearsMin?: number | null;
  education?: string;
  mandatorySkills: string[];
  optionalSkills: string[];
  languages: string[];
  scoreComputed: boolean;
  status: string | null;
  profile: string | null;
  mainScore: number | null;
  finalRuleScore: number | null;
  semanticScore?: number | null;
  finalScore: number | null;
  finalHybridFormula?: string | null;
  subscores: Record<string, number>;
  rejectionReasons: string[];
}

const mapOfferEntry = (payload: CandidateOfferEntryApi): CandidateOfferEntry => ({
  id: toIdString(payload.id),
  offerId: toIdString(payload.offer_id),
  title: payload.title,
  companyName: payload.company_name,
  location: payload.location,
  employmentType: payload.employment_type || undefined,
  seniorityLevel: payload.seniority_level || undefined,
  experienceYearsMin:
    payload.experience_years_min === null || payload.experience_years_min === undefined
      ? payload.experience_years_min
      : toNumber(payload.experience_years_min),
  education: payload.education || undefined,
  mandatorySkills: payload.mandatory_skills ?? [],
  optionalSkills: payload.optional_skills ?? [],
  languages: payload.languages ?? [],
  scoreComputed: Boolean(payload.score_computed),
  status: payload.status ?? null,
  profile: payload.profile ?? null,
  mainScore: payload.main_score !== null && payload.main_score !== undefined ? toNumber(payload.main_score) : null,
  finalRuleScore: payload.final_rule_score !== null && payload.final_rule_score !== undefined ? toNumber(payload.final_rule_score) : null,
  semanticScore: payload.semantic_score,
  finalScore: payload.final_score !== null && payload.final_score !== undefined ? toNumber(payload.final_score) : null,
  finalHybridFormula: payload.final_hybrid_formula ?? null,
  subscores: payload.subscores ?? {},
  rejectionReasons: payload.rejection_reasons ?? [],
});

export async function listAllCandidateOffers(): Promise<CandidateOfferEntry[]> {
  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateAllOffersApiResponse>(
      "/candidate/me/offers/all",
      {
        method: "GET",
        headers: { "X-Candidate-Cv-Token": token },
      },
    ),
  );
  return (payload.results ?? []).map(mapOfferEntry);
}

export async function scoreCandidateOffer(offerId: string): Promise<CandidateOfferEntry> {
  const normalizedOfferId = toIdString(offerId);

  if (!normalizedOfferId) {
    throw new ApiServiceError("Offer id is required", 400);
  }

  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateOfferEntryApi>(
      `/candidate/me/offers/${encodeURIComponent(normalizedOfferId)}/score`,
      {
        method: "POST",
        headers: { "X-Candidate-Cv-Token": token },
      },
    ),
  );
  return mapOfferEntry(payload);
}

export async function uploadCandidateCv(file: File): Promise<CandidateCvUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const payload = await apiRequest<CandidateCvUploadApiResponse>(
    "/candidate/me/cv/upload",
    {
      method: "POST",
      body: formData,
    },
  );

  return {
    success: Boolean(payload.success),
    message: payload.message,
    token: payload.token,
    resumeId: toIdString(payload.resume_id),
    redirectTo: payload.redirect_to,
  };
}

export async function listCandidateSessionOffers(
  includeRejected = false,
): Promise<CandidateSessionOffer[]> {
  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateMatchingApiResponse>(
      "/candidate/me/offers",
      {
        method: "GET",
        headers: {
          "X-Candidate-Cv-Token": token,
        },
      },
      {
        query: {
          include_rejected: includeRejected,
        },
      },
    ),
  );

  return (payload.results ?? []).map(mapOffer);
}

export async function getCandidateSessionProfile(): Promise<CandidateSessionProfile> {
  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateSessionProfileApiResponse>(
      "/candidate/me/cv-profile",
      {
        method: "GET",
        headers: {
          "X-Candidate-Cv-Token": token,
        },
      },
    ),
  );

  return mapCandidateSessionProfile(payload);
}

export async function updateCandidateSessionProfile(
  update: CandidateSessionProfileUpdatePayload,
): Promise<CandidateSessionProfile> {
  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateSessionProfileApiResponse>(
      "/candidate/me/cv-profile",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Candidate-Cv-Token": token,
        },
        body: JSON.stringify(update),
      },
    ),
  );

  return mapCandidateSessionProfile(payload);
}

export async function getCandidateSessionOffer(
  offerId: string,
): Promise<CandidateSessionOffer> {
  const normalizedOfferId = toIdString(offerId);

  if (!normalizedOfferId) {
    throw new ApiServiceError("Offer id is required", 400);
  }

  const payload = await withRecoveredCandidateCvToken((token) =>
    apiRequest<CandidateSessionOfferApiItem>(
      `/candidate/me/offers/${encodeURIComponent(normalizedOfferId)}`,
      {
        method: "GET",
        headers: {
          "X-Candidate-Cv-Token": token,
        },
      },
    ),
  );

  return mapOffer(payload);
}
