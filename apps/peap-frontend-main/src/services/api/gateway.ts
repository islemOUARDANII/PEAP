import { ApiServiceError, apiJsonRequest, apiRequest } from "./client";

const toStringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);

const toNullableString = (value: unknown): string | null => {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : null;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanValue = (value: unknown): boolean => value === true;

const asArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const joinLocation = (...parts: Array<string | null | undefined>): string =>
  parts
    .map((part) => toNullableString(part))
    .filter((part): part is string => Boolean(part))
    .join(", ");

const titleCase = (value: string | null | undefined): string => {
  const normalized = toStringValue(value).trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
};

export interface ReferentialOption {
  code: string;
  label: string;
  governorateCode?: string | null;
}

interface ReferentialResponse {
  code: string;
  label: string;
  governorate_code?: string | null;
}

interface CandidateIdentityResponse {
  id: string;
  cin?: string | null;
  passport_number?: string | null;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender_code?: string | null;
  gender_label?: string | null;
  nationality?: string | null;
  code_handicap?: string | null;
  handicap_label?: string | null;
  code_degre_handicap?: string | null;
  degre_handicap_label?: string | null;
}

interface CandidateContactResponse {
  id: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country: string;
  governorate_code?: string | null;
  governorate_label?: string | null;
  delegation_code?: string | null;
  delegation_label?: string | null;
}

export interface CandidateEducationRecord {
  id: string;
  levelCode?: string | null;
  levelLabel?: string | null;
  diplomaLabel?: string | null;
  degree?: string | null;
  specialty?: string | null;
  institution?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  graduationYear?: number | null;
  location?: string | null;
  honors?: string | null;
  gpa?: string | null;
  rtmcEducationNodeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CandidateEducationResponse {
  id: string;
  level_code?: string | null;
  level_label?: string | null;
  diploma_label?: string | null;
  degree?: string | null;
  specialty?: string | null;
  institution?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  graduation_year?: number | null;
  location?: string | null;
  honors?: string | null;
  gpa?: number | string | null;
  rtmc_education_node_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateExperienceRecord {
  id: string;
  occupationId?: string | null;
  jobTitleRaw?: string | null;
  companyName?: string | null;
  sector?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  durationMonths?: number | null;
  durationYears?: number | null;
  description?: string | null;
  responsibilities?: string[] | null;
  technologies?: string[] | null;
  projects?: Array<Record<string, unknown> | string> | null;
  entryType?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CandidateExperienceResponse {
  id: string;
  occupation_id?: string | null;
  job_title_raw?: string | null;
  company_name?: string | null;
  sector?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  duration_months?: number | null;
  duration_years?: number | string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  technologies?: string[] | null;
  projects?: Array<Record<string, unknown> | string> | null;
  entry_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateSkillRecord {
  id: string;
  skillId?: string | null;
  skillLabelRaw?: string | null;
  skillNodeLabel?: string | null;
  skillNodeType?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
  level?: string | null;
  years?: number | null;
  evidence?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CandidateSkillResponse {
  id: string;
  skill_id?: string | null;
  skill_label_raw?: string | null;
  skill_node_label?: string | null;
  skill_node_type?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
  level?: string | null;
  years?: number | string | null;
  evidence?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateLanguageRecord {
  id: string;
  languageCode: string;
  languageLabelFr?: string | null;
  languageLabelEn?: string | null;
  level?: string | null;
  levelLabelFr?: string | null;
  levelLabelEn?: string | null;
  evidence?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CandidateLanguageResponse {
  id: string;
  language_code: string;
  language_label_fr?: string | null;
  language_label_en?: string | null;
  level?: string | null;
  level_label_fr?: string | null;
  level_label_en?: string | null;
  evidence?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidatePreferenceRecord {
  id: string;
  preferredContractType?: string | null;
  preferredGovernorate?: string | null;
  preferredGovernorateLabel?: string | null;
  mobilityRadiusKm?: number | null;
  acceptsRelocation: boolean;
  desiredSalaryMin?: number | null;
  desiredSalaryMax?: number | null;
}

interface CandidatePreferenceResponse {
  id: string;
  preferred_contract_type?: string | null;
  preferred_governorate?: string | null;
  preferred_governorate_label?: string | null;
  mobility_radius_km?: number | string | null;
  accepts_relocation: boolean;
  desired_salary_min?: number | string | null;
  desired_salary_max?: number | string | null;
}

export interface CandidateCvRecord {
  id: string;
  cvId: string;
  storageProvider: string;
  containerName: string;
  blobName: string;
  storageKey: string;
  blobUrl?: string | null;
  originalFilename?: string | null;
  mimeType: string;
  fileSizeBytes?: number | null;
  status: string;
  isCurrent: boolean;
  parsedResumeId?: string | null;
  parsingStatus: string;
  uploadedByUserId?: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CandidateCvResponse {
  id: string;
  cv_id: string;
  storage_provider: string;
  container_name: string;
  blob_name: string;
  storage_key: string;
  blob_url?: string | null;
  original_filename?: string | null;
  mime_type: string;
  file_size_bytes?: number | null;
  status: string;
  is_current: boolean;
  parsed_resume_id?: string | null;
  parsing_status: string;
  uploaded_by_user_id?: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateCvParseResult {
  cvRecordId: string;
  jobSeekerId: string;
  parsingStatus: string;
  parsedPayload: Record<string, unknown>;
  mappedPayload: Record<string, unknown>;
  extractedProfilePatch: {
    identity: Record<string, unknown>;
    education: Array<Record<string, unknown>>;
    experience: Array<Record<string, unknown>>;
    stages: Array<Record<string, unknown>>;
    skills: Array<Record<string, unknown>>;
    languages: Array<Record<string, unknown>>;
    certifications: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    interests: Array<Record<string, unknown> | string>;
    preferences: Record<string, unknown>;
    geoNormalization: Record<string, unknown>;
    cvMetadata: Record<string, unknown>;
  };
  warnings: string[];
  parserVersion: string;
}

interface CandidateCvParseResponse {
  cv_record_id: string;
  job_seeker_id: string;
  parsing_status: string;
  parsed_payload?: Record<string, unknown>;
  mapped_payload?: Record<string, unknown>;
  extracted_profile_patch?: {
    identity?: Record<string, unknown>;
    education?: Array<Record<string, unknown>>;
    experience?: Array<Record<string, unknown>>;
    stages?: Array<Record<string, unknown>>;
    skills?: Array<Record<string, unknown>>;
    languages?: Array<Record<string, unknown>>;
    certifications?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    interests?: Array<Record<string, unknown> | string>;
    preferences?: Record<string, unknown>;
    geo_normalization?: Record<string, unknown>;
    cv_metadata?: Record<string, unknown>;
  };
  warnings?: string[];
  parser_version: string;
}

interface CandidateProfileResponse {
  id: string;
  user_id?: string | null;
  aneti_identifier?: string | null;
  status: string;
  registration_date?: string | null;
  primary_language?: string | null;
  identity?: CandidateIdentityResponse | null;
  contact?: CandidateContactResponse | null;
  education?: CandidateEducationResponse[];
  experience?: CandidateExperienceResponse[];
  skills?: CandidateSkillResponse[];
  languages?: CandidateLanguageResponse[];
  preference?: CandidatePreferenceResponse | null;
  current_cv?: CandidateCvResponse | null;
}

export interface CandidateProfileBundle {
  id: string;
  status: string;
  registrationDate?: string | null;
  primaryLanguage?: string | null;
  identity?: CandidateIdentityResponse | null;
  contact?: CandidateContactResponse | null;
  education: CandidateEducationRecord[];
  experience: CandidateExperienceRecord[];
  skills: CandidateSkillRecord[];
  languages: CandidateLanguageRecord[];
  preference?: CandidatePreferenceRecord | null;
  currentCv?: CandidateCvRecord | null;
  cvRecords: CandidateCvRecord[];
}

interface CandidateActiveOffersCountResponse {
  active_offers_count: number;
}

interface JobSeekerKeywordResponse {
  id?: string | null;
  keyword?: string | null;
  keyword_type?: string | null;
  keywordType?: string | null;
  source?: string | null;
  weight?: number | string | null;
  [key: string]: unknown;
}

export interface JobSeekerKeywordRecord {
  id: string;
  keyword: string;
  keywordType?: string | null;
  source?: string | null;
  weight?: number | null;
}

interface CandidateOfferThresholdResponse {
  min_threshold?: number | string | null;
  threshold?: number | string | null;
  offer_threshold?: number | string | null;
  value?: number | string | null;
}

export interface CandidateOfferThresholdRecord {
  minThreshold: number | null;
}

interface CandidateMatchedOfferResponse {
  result_id: string;
  run_id: string;
  offer_id: string;
  title?: string | null;
  employer_name?: string | null;
  description?: string | null;
  status?: string | null;
  contract_type?: string | null;
  work_mode?: string | null;
  country?: string | null;
  governorate_code?: string | null;
  governorate_label?: string | null;
  delegation_code?: string | null;
  delegation_label?: string | null;
  published_at?: string | null;
  deadline_at?: string | null;
  score_global: number;
  score_percent: number;
  rank: number;
  explanation_short?: string | null;
  explanation_json?: Record<string, unknown> | null;
  has_gaps?: boolean;
}

interface CandidateMatchedOffersResponse {
  model_code: string;
  model_version_id: string;
  run_id: string;
  min_score: number;
  active_offers_count: number;
  total_results: number;
  matched_count: number;
  offers: CandidateMatchedOfferResponse[];
}

export interface CandidateMatchedOfferRecord {
  resultId: string;
  runId: string;
  offerId: string;
  title: string;
  employerName: string;
  description: string | null;
  status: string | null;
  contractType: string | null;
  workMode: string | null;
  country: string | null;
  governorateCode: string | null;
  governorateLabel: string | null;
  delegationCode: string | null;
  delegationLabel: string | null;
  publishedAt: string | null;
  deadlineAt: string | null;
  scoreGlobal: number;
  scorePercent: number;
  rank: number;
  explanationShort: string | null;
  explanationJson: Record<string, unknown>;
  hasGaps: boolean;
}

export interface CandidateMatchedOffersRecord {
  modelCode: string;
  modelVersionId: string;
  runId: string;
  minScore: number;
  activeOffersCount: number;
  totalResults: number;
  matchedCount: number;
  offers: CandidateMatchedOfferRecord[];
}


interface EmployerProfileResponse {
  id: string;
  user_id?: string | null;
  legal_name?: string | null;
  commercial_name?: string | null;
  tax_identifier?: string | null;
  employer_type_code?: string | null;
  size_band_code?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  status: string;
  contact?: {
    id: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
  } | null;
  location?: {
    id: string;
    address_line?: string | null;
    country?: string | null;
    governorate_code?: string | null;
    governorate_label?: string | null;
    delegation_code?: string | null;
    delegation_label?: string | null;
  } | null;
}

export interface EmployerProfile {
  id: string;
  legalName?: string | null;
  commercialName?: string | null;
  taxIdentifier?: string | null;
  employerTypeCode?: string | null;
  sizeBandCode?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  status: string;
  contact?: EmployerProfileResponse["contact"];
  location?: EmployerProfileResponse["location"];
}

const mapEmployerProfile = (
  item: EmployerProfileResponse,
): EmployerProfile => ({
  id: item.id,
  legalName: item.legal_name ?? null,
  commercialName: item.commercial_name ?? null,
  taxIdentifier: item.tax_identifier ?? null,
  employerTypeCode: item.employer_type_code ?? null,
  sizeBandCode: item.size_band_code ?? null,
  websiteUrl: item.website_url ?? null,
  logoUrl: item.logo_url ?? null,
  status: item.status,
  contact: item.contact ?? null,
  location: item.location ?? null,
});

export interface EmployerOfferRequirement {
  id?: string;
  criterionType: string;
  nodeId?: string | null;
  nodeLabel?: string | null;
  nodeType?: string | null;
  rawValue?: string | null;
  minLevel?: string | null;
  minYears?: number | null;
  isMust: boolean;
  weight?: number | null;
}

interface EmployerOfferRequirementResponse {
  id: string;
  criterion_type: string;
  node_id?: string | null;
  node_label?: string | null;
  node_type?: string | null;
  raw_value?: string | null;
  min_level?: string | null;
  min_years?: number | string | null;
  is_must: boolean;
  weight?: number | null;
}

interface EmployerOfferResponse {
  id: string;
  aneti_identifier?: string | null;
  employer_id: string;
  employer_name?: string | null;
  company_name?: string | null;
  title: string;
  description?: string | null;
  number_of_positions: number;
  status: string;
  contract_type?: string | null;
  work_mode?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  country: string;
  governorate_code?: string | null;
  governorate_label?: string | null;
  delegation_code?: string | null;
  delegation_label?: string | null;
  published_at?: string | null;
  deadline_at?: string | null;
  created_by_user_id?: string | null;
  validated_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  requirements?: EmployerOfferRequirementResponse[];
  warning?: string | null;
  action_reason?: string | null;
}

export interface EmployerOffer {
  id: string;
  anetiIdentifier?: string | null;
  employerId: string;
  employerName?: string | null;
  companyName?: string | null;
  title: string;
  description?: string | null;
  numberOfPositions: number;
  status: string;
  contractType?: string | null;
  workMode?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  country: string;
  governorateCode?: string | null;
  governorateLabel?: string | null;
  delegationCode?: string | null;
  delegationLabel?: string | null;
  locationLabel: string;
  publishedAt?: string | null;
  deadlineAt?: string | null;
  createdByUserId?: string | null;
  validatedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  requirements: EmployerOfferRequirement[];
  warning?: string | null;
  actionReason?: string | null;
}

export interface EmployerApplication {
  id: string;
  jobSeekerId: string;
  offerId: string;
  offerTitle?: string | null;
  offerAnetiIdentifier?: string | null;
  candidateName?: string | null;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  matchingResultId?: string | null;
  status: string;
  coverMessage?: string | null;
  appliedAt: string;
  updatedAt: string;
}

interface EmployerApplicationResponse {
  id: string;
  job_seeker_id: string;
  offer_id: string;
  offer_title?: string | null;
  offer_aneti_identifier?: string | null;
  candidate_name?: string | null;
  candidate_email?: string | null;
  candidate_phone?: string | null;
  matching_result_id?: string | null;
  status: string;
  cover_message?: string | null;
  applied_at: string;
  updated_at: string;
}

const mapEmployerApplication = (
  item: EmployerApplicationResponse,
): EmployerApplication => ({
  id: item.id,
  jobSeekerId: item.job_seeker_id,
  offerId: item.offer_id,
  offerTitle: item.offer_title ?? null,
  offerAnetiIdentifier: item.offer_aneti_identifier ?? null,
  candidateName: item.candidate_name ?? null,
  candidateEmail: item.candidate_email ?? null,
  candidatePhone: item.candidate_phone ?? null,
  matchingResultId: item.matching_result_id ?? null,
  status: item.status,
  coverMessage: item.cover_message ?? null,
  appliedAt: item.applied_at,
  updatedAt: item.updated_at,
});

interface EmployerOfferDraftResponse {
  parsing_status: string;
  parsed_payload?: Record<string, unknown>;
  mapped_payload?: Record<string, unknown>;
  extracted_requirements?: Array<Record<string, unknown>>;
  warnings?: string[];
  parser_version?: string | null;
  draft?: Record<string, unknown>;
}

export interface EmployerOfferDraft {
  parsingStatus: string;
  parsedPayload: Record<string, unknown>;
  mappedPayload: Record<string, unknown>;
  extractedRequirements: Array<Record<string, unknown>>;
  warnings: string[];
  parserVersion?: string | null;
  draft: Record<string, unknown> & {
    requirements: Array<Record<string, unknown>>;
  };
}

export interface SearchOfferResult {
  offerId: string;
  title: string;
  description?: string | null;
  skills: string[];
  location?: string | null;
  contractType?: string | null;
  workMode?: string | null;
  status?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  searchScore?: number | null;
  publishedAt?: string | null;
  deadlineAt?: string | null;
  score: number;
  createdAt?: string | null;
  raw: Record<string, unknown>;
}

interface SearchOfferResponseItem {
  offer_id?: string | null;
  title?: string | null;
  description?: string | null;
  skills?: string[];
  location?: string | null;
  contract_type?: string | null;
  work_mode?: string | null;
  status?: string | null;
  company_id?: string | null;
  score?: number | string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface SearchOffersResponse {
  total: number;
  mode?: string | null;
  query?: string | null;
  results: SearchOfferResult[];
  raw: Record<string, unknown>;
}

export interface SearchCandidateResult {
  candidateId: string;
  location?: string | null;
  education?: string | null;
  yearsExperience: number;
  skills: string[];
  primaryLang?: string | null;
  createdAt?: string | null;
  score?: number | null;
  raw: Record<string, unknown>;
}

interface SearchCandidateResponseItem {
  candidate_id?: string | null;
  location?: string | null;
  education?: string | null;
  years_experience?: number | string | null;
  skills?: string[];
  primary_lang?: string | null;
  created_at?: string | null;
  score?: number | string | null;
  [key: string]: unknown;
}

export interface SearchCandidatesResponse {
  total: number;
  filtersApplied: Record<string, unknown>;
  results: SearchCandidateResult[];
  raw: Record<string, unknown>;
}

export interface TaxonomyNodeRecord {
  id: string;
  nodeType: string;
  source?: string | null;
  sourceCode?: string | null;
  label: string;
  active: boolean;
  extraJson?: unknown;
}

interface TaxonomyNodeResponse {
  id: string;
  node_type: string;
  source?: string | null;
  source_code?: string | null;
  label: string;
  active: boolean;
  extra_json?: unknown;
}

export interface AdvisorMeRecord {
  id: string;
  userId: string;
  email: string;
  roles: string[];
  fullName: string;
  position?: string | null;
  active: boolean;
  agency?: Record<string, unknown> | null;
}

interface AdvisorMeResponse {
  id: string;
  user_id: string;
  email: string;
  roles: string[];
  full_name: string;
  position?: string | null;
  active: boolean;
  agency?: Record<string, unknown> | null;
}

export interface CandidateListItem {
  id: string;
  anetiIdentifier?: string | null;
  fullName?: string | null;
  status: string;
  governorateCode?: string | null;
  governorateLabel?: string | null;
  delegationCode?: string | null;
  delegationLabel?: string | null;
  currentCvExists: boolean;
  updatedAt: string;
}

interface CandidateListItemResponse {
  id: string;
  aneti_identifier?: string | null;
  full_name?: string | null;
  status: string;
  governorate_code?: string | null;
  governorate_label?: string | null;
  delegation_code?: string | null;
  delegation_label?: string | null;
  current_cv_exists: boolean;
  updated_at: string;
}

export interface MatchingRunRecord {
  id: string;
  runType: string;
  direction: string;
  modelVersionId: string;
  launchedByUserId?: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  status: string;
  parametersJson: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
}

interface MatchingRunResponse {
  id: string;
  run_type: string;
  direction: string;
  model_version_id: string;
  launched_by_user_id?: string | null;
  source_entity_type: string;
  source_entity_id: string;
  status: string;
  parameters_json?: Record<string, unknown>;
  started_at: string;
  finished_at?: string | null;
  error_message?: string | null;
}

export interface MatchingExecutionRecord {
  runId: string;
  status: string;
  resultsCount: number;
  results: Array<Record<string, unknown>>;
  warnings: string[];
}

interface MatchingExecutionResponse {
  run_id: string;
  status: string;
  results_count?: number;
  results?: Array<Record<string, unknown>>;
  warnings?: string[];
}

export interface MatchingResultRecord {
  id: string;
  runId: string;
  candidateId?: string | null;
  candidateLabel?: string | null;
  offerId?: string | null;
  offerTitle?: string | null;
  occupationId?: string | null;
  scoreGlobal: number;
  scoreRuleBased?: number | null;
  scoreSemantic?: number | null;
  rank: number;
  eligibilityStatus: string;
  decisionStatus: string;
  decisionReason?: string | null;
  decisionByUserId?: string | null;
  decisionAt?: string | null;
  explanationShort?: string | null;
  explanationJson: Record<string, unknown>;
  hasGaps: boolean;
  createdAt: string;
}

interface MatchingResultResponse {
  id: string;
  run_id: string;
  candidate_id?: string | null;
  candidate_label?: string | null;
  offer_id?: string | null;
  offer_title?: string | null;
  occupation_id?: string | null;
  score_global: number | string;
  score_rule_based?: number | string | null;
  score_semantic?: number | string | null;
  rank: number;
  eligibility_status: string;
  decision_status: string;
  decision_reason?: string | null;
  decision_by_user_id?: string | null;
  decision_at?: string | null;
  explanation_short?: string | null;
  explanation_json?: Record<string, unknown>;
  has_gaps?: boolean;
  created_at: string;
}

export interface MatchingResultDetailRecord {
  id: string;
  resultId: string;
  criterionCode?: string | null;
  criterionLabel?: string | null;
  score?: number | null;
  weight?: number | null;
  weightedScore?: number | null;
  matched?: boolean | null;
  isGap: boolean;
  gapType?: string | null;
  gapMessage?: string | null;
  recommendation?: string | null;
  metadataJson: Record<string, unknown>;
  createdAt?: string | null;
  className?: string;
  iconBackground?: string;
}

interface MatchingResultDetailResponse {
  id: string;
  result_id: string;
  criterion_code?: string | null;
  criterion_label?: string | null;
  score?: number | string | null;
  weight?: number | string | null;
  weighted_score?: number | string | null;
  matched?: boolean | null;
  is_gap?: boolean;
  gap_type?: string | null;
  gap_message?: string | null;
  recommendation?: string | null;
  metadata_json?: Record<string, unknown>;
  created_at?: string | null;
}

interface MatchingResultWithDetailsResponse {
  result: MatchingResultResponse;
  details?: MatchingResultDetailResponse[];
}

export interface MatchingCriterionRecord {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  dataType: string;
  active: boolean;
}

interface MatchingCriterionResponse {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  data_type: string;
  active: boolean;
}

export interface MatchingModelCriterionRecord {
  id: string;
  criterionId: string;
  criterionCode: string;
  criterionLabel: string;
  dataType: string;
  weight: number;
  isMust: boolean;
  minThreshold?: number | null;
  logicOperator: string;
}

interface MatchingModelCriterionResponse {
  id: string;
  criterion_id: string;
  criterion_code: string;
  criterion_label: string;
  data_type: string;
  weight: number | string;
  is_must: boolean;
  min_threshold?: number | string | null;
  logic_operator: string;
}

export interface MatchingHardFilterRecord {
  id: string;
  criterionId: string;
  criterionCode: string;
  criterionLabel: string;
  ruleOperator: string;
  ruleValue: string;
  rejectionReason?: string | null;
}

interface MatchingHardFilterResponse {
  id: string;
  criterion_id: string;
  criterion_code: string;
  criterion_label: string;
  rule_operator: string;
  rule_value: string;
  rejection_reason?: string | null;
}

export interface MatchingModelVersionRecord {
  id: string;
  versionNumber: number;
  status: string;
  createdAt: string;
  publishedAt?: string | null;
  criteria: MatchingModelCriterionRecord[];
  hardFilters: MatchingHardFilterRecord[];
}

interface MatchingModelVersionResponse {
  id: string;
  version_number: number;
  status: string;
  created_at: string;
  published_at?: string | null;
  criteria?: MatchingModelCriterionResponse[];
  hard_filters?: MatchingHardFilterResponse[];
}

export interface MatchingModelRecord {
  id: string;
  code: string;
  label: string;
  direction: string;
  description?: string | null;
  active: boolean;
  versions: MatchingModelVersionRecord[];
}

interface MatchingModelResponse {
  id: string;
  code: string;
  label: string;
  direction: string;
  description?: string | null;
  active: boolean;
  versions?: MatchingModelVersionResponse[];
}

export interface SegmentRuleRecord {
  id: string;
  targetType: string;
  attributePath: string;
  operator: string;
  value: string;
  logic: string;
}

export interface SegmentRecord {
  id: string;
  code: string;
  label: string;
  macroSegment?: string | null;
  priority: number;
  active: boolean;
  rules: SegmentRuleRecord[];
}

interface SegmentRuleResponse {
  id: string;
  target_type: string;
  attribute_path: string;
  operator: string;
  value: string;
  logic: string;
}

interface SegmentResponse {
  id: string;
  code: string;
  label: string;
  macro_segment?: string | null;
  priority: number;
  active: boolean;
}

interface SegmentFullResponse extends SegmentResponse {
  rules?: SegmentRuleResponse[];
}

export interface TechAdminDashboardRecord {
  apiGateway: string;
  database: string;
  parsingService: string;
  matchingService: string;
  searchService: string;
  storageProvider: string;
  kafkaStatus: string;
}

interface TechAdminDashboardResponse {
  api_gateway: string;
  database: string;
  parsing_service: string;
  matching_service: string;
  search_service: string;
  storage_provider: string;
  kafka_status: string;
}

export interface ServiceHealthRecord {
  service: string;
  url?: string | null;
  status: string;
  detail?: string | null;
}

interface ServiceHealthResponse {
  service: string;
  url?: string | null;
  status: string;
  detail?: string | null;
}

export interface TechAdminRoleRecord {
  id: string;
  code: string;
  label: string;
}

interface TechAdminRoleResponse {
  id: string;
  code: string;
  label: string;
}

export interface TechAdminUserRecord {
  id: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  roles: TechAdminRoleRecord[];
}

interface TechAdminUserResponse {
  id: string;
  email: string;
  phone?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  roles?: TechAdminRoleResponse[];
}

export interface AuditEventRecord {
  id: string;
  eventTime: string;
  eventCategory: string;
  eventType: string;
  severity: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRoles: string[];
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  status?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  message?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
}

interface AuditEventResponse {
  id: string;
  event_time: string;
  event_category: string;
  event_type: string;
  severity: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_roles?: string[] | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  status?: string | null;
  request_id?: string | null;
  trace_id?: string | null;
  correlation_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  message?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditSummaryRecord {
  totalEvents: number;
  errorEvents: number;
  latestEventTime?: string | null;
  byCategory: Array<{ key: string; count: number }>;
  bySeverity: Array<{ key: string; count: number }>;
  byEventType: Array<{ key: string; count: number }>;
}

interface AuditSummaryResponse {
  total_events: number;
  error_events: number;
  latest_event_time?: string | null;
  by_category?: Array<{ key: string; count: number }>;
  by_severity?: Array<{ key: string; count: number }>;
  by_event_type?: Array<{ key: string; count: number }>;
}

const mapCandidateEducation = (item: CandidateEducationResponse): CandidateEducationRecord => ({
  id: item.id,
  levelCode: item.level_code ?? null,
  levelLabel: item.level_label ?? null,
  diplomaLabel: item.diploma_label ?? item.degree ?? null,
  degree: item.degree ?? item.diploma_label ?? null,
  specialty: item.specialty ?? null,
  institution: item.institution ?? null,
  startDate: item.start_date ?? null,
  endDate: item.end_date ?? null,
  graduationYear: item.graduation_year ?? null,
  location: item.location ?? null,
  honors: item.honors ?? null,
  gpa: item.gpa == null ? null : String(item.gpa),
  rtmcEducationNodeId: item.rtmc_education_node_id ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapCandidateExperience = (item: CandidateExperienceResponse): CandidateExperienceRecord => ({
  id: item.id,
  occupationId: item.occupation_id ?? null,
  jobTitleRaw: item.job_title_raw ?? null,
  companyName: item.company_name ?? null,
  sector: item.sector ?? null,
  location: item.location ?? null,
  startDate: item.start_date ?? null,
  endDate: item.end_date ?? null,
  isCurrent: item.is_current ?? false,
  durationMonths: item.duration_months ?? null,
  durationYears:
    item.duration_years == null ? null : toNumberValue(item.duration_years),
  description: item.description ?? null,
  responsibilities: asArray(item.responsibilities),
  technologies: asArray(item.technologies),
  projects: asArray(item.projects),
  entryType: item.entry_type ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapCandidateSkill = (item: CandidateSkillResponse): CandidateSkillRecord => ({
  id: item.id,
  skillId: item.skill_id ?? null,
  skillLabelRaw: item.skill_label_raw ?? null,
  skillNodeLabel: item.skill_node_label ?? null,
  skillNodeType: item.skill_node_type ?? null,
  category:
    item.category ??
    toNullableString((item.metadata as Record<string, unknown> | null)?.category) ??
    null,
  metadata: item.metadata ?? null,
  level: item.level ?? null,
  years: item.years == null ? null : toNumberValue(item.years),
  evidence: item.evidence ?? null,
  source: item.source ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapCandidateLanguage = (item: CandidateLanguageResponse): CandidateLanguageRecord => ({
  id: item.id,
  languageCode: item.language_code,
  languageLabelFr: item.language_label_fr ?? null,
  languageLabelEn: item.language_label_en ?? null,
  level: item.level ?? null,
  levelLabelFr: item.level_label_fr ?? null,
  levelLabelEn: item.level_label_en ?? null,
  evidence: item.evidence ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapCandidatePreference = (
  item: CandidatePreferenceResponse | null | undefined,
): CandidatePreferenceRecord | null => {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    preferredContractType: item.preferred_contract_type ?? null,
    preferredGovernorate: item.preferred_governorate ?? null,
    preferredGovernorateLabel: item.preferred_governorate_label ?? null,
    mobilityRadiusKm:
      item.mobility_radius_km == null ? null : toNumberValue(item.mobility_radius_km),
    acceptsRelocation: item.accepts_relocation,
    desiredSalaryMin:
      item.desired_salary_min == null ? null : toNumberValue(item.desired_salary_min),
    desiredSalaryMax:
      item.desired_salary_max == null ? null : toNumberValue(item.desired_salary_max),
  };
};

const mapCvRecord = (item: CandidateCvResponse): CandidateCvRecord => ({
  id: item.id,
  cvId: item.cv_id,
  storageProvider: item.storage_provider,
  containerName: item.container_name,
  blobName: item.blob_name,
  storageKey: item.storage_key,
  blobUrl: item.blob_url ?? null,
  originalFilename: item.original_filename ?? null,
  mimeType: item.mime_type,
  fileSizeBytes: item.file_size_bytes ?? null,
  status: item.status,
  isCurrent: item.is_current,
  parsedResumeId: item.parsed_resume_id ?? null,
  parsingStatus: item.parsing_status,
  uploadedByUserId: item.uploaded_by_user_id ?? null,
  uploadedAt: item.uploaded_at,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapEmployerOfferRequirement = (
  item: EmployerOfferRequirementResponse,
): EmployerOfferRequirement => ({
  id: item.id,
  criterionType: item.criterion_type,
  nodeId: item.node_id ?? null,
  nodeLabel: item.node_label ?? null,
  nodeType: item.node_type ?? null,
  rawValue: item.raw_value ?? null,
  minLevel: item.min_level ?? null,
  minYears: item.min_years == null ? null : toNumberValue(item.min_years),
  isMust: item.is_must,
  weight: item.weight ?? null,
});

const mapEmployerOffer = (item: EmployerOfferResponse): EmployerOffer => ({
  id: item.id,
  anetiIdentifier: item.aneti_identifier ?? null,
  employerId: item.employer_id,
  employerName: item.employer_name ?? null,
  companyName: item.company_name ?? item.employer_name ?? null,
  title: item.title,
  description: item.description ?? null,
  numberOfPositions: item.number_of_positions,
  status: item.status,
  contractType: item.contract_type ?? null,
  workMode: item.work_mode ?? null,
  salaryMin: item.salary_min == null ? null : toNumberValue(item.salary_min),
  salaryMax: item.salary_max == null ? null : toNumberValue(item.salary_max),
  country: item.country,
  governorateCode: item.governorate_code ?? null,
  governorateLabel: item.governorate_label ?? null,
  delegationCode: item.delegation_code ?? null,
  delegationLabel: item.delegation_label ?? null,
  locationLabel: joinLocation(item.delegation_label, item.governorate_label, item.country),
  publishedAt: item.published_at ?? null,
  deadlineAt: item.deadline_at ?? null,
  createdByUserId: item.created_by_user_id ?? null,
  validatedByUserId: item.validated_by_user_id ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  requirements: asArray(item.requirements).map(mapEmployerOfferRequirement),
  warning: item.warning ?? null,
  actionReason: item.action_reason ?? null,
});

const mapSearchOffer = (item: SearchOfferResponseItem): SearchOfferResult => ({
  offerId: toStringValue(item.offer_id ?? item.id),
  title: toStringValue(item.title),
  description: item.description ?? null,
  skills: asArray(item.skills).map((skill) => toStringValue(skill)).filter(Boolean),
  location:
    toNullableString(item.location) ??
    joinLocation(
      toNullableString(item.delegation_label),
      toNullableString(item.governorate_label),
      toNullableString(item.country),
    ),
  contractType: item.contract_type ?? null,
  workMode: item.work_mode ?? null,
  status: item.status ?? null,
  companyName:
    toNullableString(item.employer_name) ??
    toNullableString(item.company_name) ??
    toNullableString(item.company) ??
    toNullableString(item.organization),
  companyId: item.company_id ?? null,
  searchScore: Object.prototype.hasOwnProperty.call(item, "score")
    ? item.score == null
      ? null
      : toNumberValue(item.score)
    : null,
  publishedAt: toNullableString(item.published_at) ?? toNullableString(item.created_at),
  deadlineAt: toNullableString(item.deadline_at),
  score: item.score == null ? 0 : toNumberValue(item.score),
  createdAt: item.created_at ?? null,
  raw: item,
});

const mapJobSeekerKeyword = (
  item: JobSeekerKeywordResponse | string,
  index: number,
): JobSeekerKeywordRecord | null => {
  if (typeof item === "string") {
    const keyword = toNullableString(item);
    if (!keyword) {
      return null;
    }

    return {
      id: `keyword-${index + 1}`,
      keyword,
      keywordType: null,
      source: null,
      weight: null,
    };
  }

  const keyword =
    toNullableString(item.keyword) ??
    toNullableString(item.label) ??
    toNullableString(item.name);

  if (!keyword) {
    return null;
  }

  return {
    id: toStringValue(item.id, `keyword-${index + 1}`),
    keyword,
    keywordType: toNullableString(item.keyword_type ?? item.keywordType),
    source: toNullableString(item.source),
    weight: item.weight == null ? null : toNumberValue(item.weight),
  };
};

const mapCandidateOfferThreshold = (
  item: CandidateOfferThresholdResponse | number | string | null,
): CandidateOfferThresholdRecord | null => {
  if (item == null) {
    return null;
  }

  if (typeof item === "number" || typeof item === "string") {
    return {
      minThreshold: toNumberValue(item),
    };
  }

  const minThreshold =
    item.min_threshold ??
    item.threshold ??
    item.offer_threshold ??
    item.value;

  return {
    minThreshold: minThreshold == null ? null : toNumberValue(minThreshold),
  };
};

const normalizeKeywordPayload = (keywords: string[]): string[] =>
  Array.from(
    new Set(
      keywords
        .map((keyword) => toNullableString(keyword))
        .filter((keyword): keyword is string => Boolean(keyword)),
    ),
  );

const isUnsupportedPayloadError = (error: unknown): error is ApiServiceError =>
  error instanceof ApiServiceError && [400, 404, 405, 422].includes(error.status);

const mapSearchCandidate = (item: SearchCandidateResponseItem): SearchCandidateResult => ({
  candidateId: toStringValue(item.candidate_id),
  location: item.location ?? null,
  education: item.education ?? null,
  yearsExperience: toNumberValue(item.years_experience),
  skills: asArray(item.skills).map((skill) => toStringValue(skill)).filter(Boolean),
  primaryLang: item.primary_lang ?? null,
  createdAt: item.created_at ?? null,
  score: item.score == null ? null : toNumberValue(item.score),
  raw: item,
});

const mapTaxonomyNode = (item: TaxonomyNodeResponse): TaxonomyNodeRecord => ({
  id: item.id,
  nodeType: item.node_type,
  source: item.source ?? null,
  sourceCode: item.source_code ?? null,
  label: item.label,
  active: item.active,
  extraJson: item.extra_json,
});

const mapCandidateListItem = (item: CandidateListItemResponse): CandidateListItem => ({
  id: item.id,
  anetiIdentifier: item.aneti_identifier ?? null,
  fullName: item.full_name ?? null,
  status: item.status,
  governorateCode: item.governorate_code ?? null,
  governorateLabel: item.governorate_label ?? null,
  delegationCode: item.delegation_code ?? null,
  delegationLabel: item.delegation_label ?? null,
  currentCvExists: item.current_cv_exists,
  updatedAt: item.updated_at,
});

const mapMatchingRun = (item: MatchingRunResponse): MatchingRunRecord => ({
  id: item.id,
  runType: item.run_type,
  direction: item.direction,
  modelVersionId: item.model_version_id,
  launchedByUserId: item.launched_by_user_id ?? null,
  sourceEntityType: item.source_entity_type,
  sourceEntityId: item.source_entity_id,
  status: item.status,
  parametersJson: item.parameters_json ?? {},
  startedAt: item.started_at,
  finishedAt: item.finished_at ?? null,
  errorMessage: item.error_message ?? null,
});

const mapMatchingExecution = (
  item: MatchingExecutionResponse,
): MatchingExecutionRecord => ({
  runId: item.run_id,
  status: item.status,
  resultsCount: item.results_count ?? 0,
  results: asArray(item.results),
  warnings: asArray(item.warnings),
});

const mapMatchingResult = (item: MatchingResultResponse): MatchingResultRecord => ({
  id: item.id,
  runId: item.run_id,
  candidateId: item.candidate_id ?? null,
  candidateLabel: item.candidate_label ?? null,
  offerId: item.offer_id ?? null,
  offerTitle: item.offer_title ?? null,
  occupationId: item.occupation_id ?? null,
  scoreGlobal: toNumberValue(item.score_global),
  scoreRuleBased:
    item.score_rule_based == null ? null : toNumberValue(item.score_rule_based),
  scoreSemantic:
    item.score_semantic == null ? null : toNumberValue(item.score_semantic),
  rank: item.rank,
  eligibilityStatus: item.eligibility_status,
  decisionStatus: item.decision_status,
  decisionReason: item.decision_reason ?? null,
  decisionByUserId: item.decision_by_user_id ?? null,
  decisionAt: item.decision_at ?? null,
  explanationShort: item.explanation_short ?? null,
  explanationJson: item.explanation_json ?? {},
  hasGaps: Boolean(item.has_gaps),
  createdAt: item.created_at,
});

const mapMatchingResultDetail = (
  item: MatchingResultDetailResponse,
): MatchingResultDetailRecord => ({
  id: item.id,
  resultId: item.result_id,
  criterionCode: item.criterion_code ?? null,
  criterionLabel: item.criterion_label ?? null,
  score: item.score == null ? null : toNumberValue(item.score),
  weight: item.weight == null ? null : toNumberValue(item.weight),
  weightedScore:
    item.weighted_score == null ? null : toNumberValue(item.weighted_score),
  matched: item.matched ?? null,
  isGap: Boolean(item.is_gap),
  gapType: item.gap_type ?? null,
  gapMessage: item.gap_message ?? null,
  recommendation: item.recommendation ?? null,
  metadataJson: item.metadata_json ?? {},
  createdAt: item.created_at ?? null,
});

const mapMatchingCriterion = (
  item: MatchingCriterionResponse,
): MatchingCriterionRecord => ({
  id: item.id,
  code: item.code,
  label: item.label,
  description: item.description ?? null,
  dataType: item.data_type,
  active: item.active,
});

const mapMatchingModelCriterion = (
  item: MatchingModelCriterionResponse,
): MatchingModelCriterionRecord => ({
  id: item.id,
  criterionId: item.criterion_id,
  criterionCode: item.criterion_code,
  criterionLabel: item.criterion_label,
  dataType: item.data_type,
  weight: toNumberValue(item.weight),
  isMust: item.is_must,
  minThreshold: item.min_threshold == null ? null : toNumberValue(item.min_threshold),
  logicOperator: item.logic_operator,
});

const mapMatchingHardFilter = (
  item: MatchingHardFilterResponse,
): MatchingHardFilterRecord => ({
  id: item.id,
  criterionId: item.criterion_id,
  criterionCode: item.criterion_code,
  criterionLabel: item.criterion_label,
  ruleOperator: item.rule_operator,
  ruleValue: item.rule_value,
  rejectionReason: item.rejection_reason ?? null,
});

const mapMatchingModelVersion = (
  item: MatchingModelVersionResponse,
): MatchingModelVersionRecord => ({
  id: item.id,
  versionNumber: item.version_number,
  status: item.status,
  createdAt: item.created_at,
  publishedAt: item.published_at ?? null,
  criteria: asArray(item.criteria).map(mapMatchingModelCriterion),
  hardFilters: asArray(item.hard_filters).map(mapMatchingHardFilter),
});

const mapMatchingModel = (item: MatchingModelResponse): MatchingModelRecord => ({
  id: item.id,
  code: item.code,
  label: item.label,
  direction: item.direction,
  description: item.description ?? null,
  active: item.active,
  versions: asArray(item.versions).map(mapMatchingModelVersion),
});

const mapSegmentRule = (item: SegmentRuleResponse): SegmentRuleRecord => ({
  id: item.id,
  targetType: item.target_type,
  attributePath: item.attribute_path,
  operator: item.operator,
  value: item.value,
  logic: item.logic,
});

const mapSegment = (item: SegmentResponse): SegmentRecord => ({
  id: item.id,
  code: item.code,
  label: item.label,
  macroSegment: item.macro_segment ?? null,
  priority: item.priority,
  active: item.active,
  rules: [],
});

const mapSegmentFull = (item: SegmentFullResponse): SegmentRecord => ({
  id: item.id,
  code: item.code,
  label: item.label,
  macroSegment: item.macro_segment ?? null,
  priority: item.priority,
  active: item.active,
  rules: asArray(item.rules).map(mapSegmentRule),
});

const mapTechAdminRole = (item: TechAdminRoleResponse): TechAdminRoleRecord => ({
  id: item.id,
  code: item.code,
  label: item.label,
});

const mapTechAdminUser = (item: TechAdminUserResponse): TechAdminUserRecord => ({
  id: item.id,
  email: item.email,
  phone: item.phone ?? null,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  roles: asArray(item.roles).map(mapTechAdminRole),
});

const mapAuditEvent = (item: AuditEventResponse): AuditEventRecord => ({
  id: item.id,
  eventTime: item.event_time,
  eventCategory: item.event_category,
  eventType: item.event_type,
  severity: item.severity,
  actorUserId: item.actor_user_id ?? null,
  actorEmail: item.actor_email ?? null,
  actorRoles: asArray(item.actor_roles),
  entityType: item.entity_type ?? null,
  entityId: item.entity_id ?? null,
  action: item.action ?? null,
  status: item.status ?? null,
  requestId: item.request_id ?? null,
  traceId: item.trace_id ?? null,
  correlationId: item.correlation_id ?? null,
  ipAddress: item.ip_address ?? null,
  userAgent: item.user_agent ?? null,
  requestMethod: item.request_method ?? null,
  requestPath: item.request_path ?? null,
  message: item.message ?? null,
  errorCode: item.error_code ?? null,
  errorMessage: item.error_message ?? null,
  metadata: item.metadata ?? {},
});

const mapCandidateMatchedOffer = (
  item: CandidateMatchedOfferResponse,
): CandidateMatchedOfferRecord => ({
  resultId: item.result_id,
  runId: item.run_id,
  offerId: item.offer_id,
  title: toStringValue(item.title, "Offre non renseignée"),
  employerName: toStringValue(item.employer_name, "Entreprise non renseignée"),
  description: item.description ?? null,
  status: item.status ?? null,
  contractType: item.contract_type ?? null,
  workMode: item.work_mode ?? null,
  country: item.country ?? null,
  governorateCode: item.governorate_code ?? null,
  governorateLabel: item.governorate_label ?? null,
  delegationCode: item.delegation_code ?? null,
  delegationLabel: item.delegation_label ?? null,
  publishedAt: item.published_at ?? null,
  deadlineAt: item.deadline_at ?? null,
  scoreGlobal: toNumberValue(item.score_global),
  scorePercent: toNumberValue(item.score_percent),
  rank: toNumberValue(item.rank),
  explanationShort: item.explanation_short ?? null,
  explanationJson: item.explanation_json ?? {},
  hasGaps: Boolean(item.has_gaps),
});

const mapCandidateMatchedOffers = (
  payload: CandidateMatchedOffersResponse,
): CandidateMatchedOffersRecord => ({
  modelCode: payload.model_code,
  modelVersionId: payload.model_version_id,
  runId: payload.run_id,
  minScore: toNumberValue(payload.min_score),
  activeOffersCount: toNumberValue(payload.active_offers_count),
  totalResults: toNumberValue(payload.total_results),
  matchedCount: toNumberValue(payload.matched_count),
  offers: asArray(payload.offers).map(mapCandidateMatchedOffer),
});

export const gatewayApi = {
  referentials: {
    async list(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
      const payload = await apiRequest<ReferentialResponse[]>(path, { method: "GET" }, { query });
      return payload.map((item) => ({
        code: item.code,
        label: item.label,
        governorateCode: item.governorate_code ?? null,
      }));
    },
    governorates: () => gatewayApi.referentials.list("/referentials/governorates"),
    delegations: (governorateCode?: string) =>
      gatewayApi.referentials.list("/referentials/delegations", {
        governorate_code: governorateCode,
      }),
    languages: () => gatewayApi.referentials.list("/referentials/languages"),
    languageLevels: () => gatewayApi.referentials.list("/referentials/language-levels"),
    contractTypes: () => gatewayApi.referentials.list("/referentials/contract-types"),
    permitTypes: () => gatewayApi.referentials.list("/referentials/permit-types"),
    genders: () => gatewayApi.referentials.list("/referentials/genders"),
    educationLevels: () => gatewayApi.referentials.list("/referentials/education-levels"),
    diplomas: () => gatewayApi.referentials.list("/referentials/diplomas"),
    specialties: () => gatewayApi.referentials.list("/referentials/specialties"),
    workRegimes: () => gatewayApi.referentials.list("/referentials/work-regimes"),
    workTimeOrganizations: () =>
      gatewayApi.referentials.list("/referentials/work-time-organizations"),
    offerTypes: () => gatewayApi.referentials.list("/referentials/offer-types"),
    offerStatuses: () => gatewayApi.referentials.list("/referentials/offer-statuses"),
    handicapTypes: () => gatewayApi.referentials.list("/referentials/handicap-types"),
    handicapDegrees: () => gatewayApi.referentials.list("/referentials/handicap-degrees"),
    certifications: () => gatewayApi.referentials.list("/referentials/certifications"),
    segmentations: () => gatewayApi.referentials.list("/referentials/segmentations"),
  },
  taxonomy: {
    async listNodes(params: {
      type?: string;
      q?: string;
      active?: boolean;
      source?: string;
      limit?: number;
      offset?: number;
    } = {}): Promise<TaxonomyNodeRecord[]> {
      const payload = await apiRequest<TaxonomyNodeResponse[]>(
        "/taxonomy/nodes",
        { method: "GET" },
        {
          query: {
            type: params.type,
            q: params.q,
            active: params.active,
            source: params.source,
            limit: params.limit ?? 20,
            offset: params.offset ?? 0,
          },
        },
      );
      return payload.map(mapTaxonomyNode);
    },
    async getNode(nodeId: string): Promise<TaxonomyNodeRecord> {
      const payload = await apiRequest<TaxonomyNodeResponse>(
        `/taxonomy/nodes/${encodeURIComponent(nodeId)}`,
        { method: "GET" },
      );
      return mapTaxonomyNode(payload);
    },
  },
  candidate: {
    async hasProfile(): Promise<boolean> {
      await apiRequest<CandidateProfileResponse>("/candidates/me", {
        method: "GET",
      });
      return true;
    },
    async getBundle(): Promise<CandidateProfileBundle> {
      const [profile, education, experience, skills, languages, preference, cvRecords] =
        await Promise.all([
          apiRequest<CandidateProfileResponse>("/candidates/me", { method: "GET" }),
          apiRequest<CandidateEducationResponse[]>("/candidates/me/education", { method: "GET" }),
          apiRequest<CandidateExperienceResponse[]>("/candidates/me/experience", { method: "GET" }),
          apiRequest<CandidateSkillResponse[]>("/candidates/me/skills", { method: "GET" }),
          apiRequest<CandidateLanguageResponse[]>("/candidates/me/languages", { method: "GET" }),
          apiRequest<CandidatePreferenceResponse | null>("/candidates/me/preference", { method: "GET" }),
          apiRequest<CandidateCvResponse[]>("/candidates/me/cv", { method: "GET" }),
        ]);

      return {
        id: profile.id,
        status: profile.status,
        registrationDate: profile.registration_date ?? null,
        primaryLanguage: profile.primary_language ?? null,
        identity: profile.identity ?? null,
        contact: profile.contact ?? null,
        education: education.map(mapCandidateEducation),
        experience: experience.map(mapCandidateExperience),
        skills: skills.map(mapCandidateSkill),
        languages: languages.map(mapCandidateLanguage),
        preference: mapCandidatePreference(preference),
        currentCv: profile.current_cv ? mapCvRecord(profile.current_cv) : null,
        cvRecords: cvRecords.map(mapCvRecord),
      };
    },
    updateProfile: (payload: { primary_language?: string | null }) =>
      apiJsonRequest<CandidateProfileResponse>("/candidates/me", "PUT", payload),
    updateIdentity: (payload: Record<string, unknown>) =>
      apiJsonRequest<CandidateProfileResponse>("/candidates/me/identity", "PUT", payload),
    updateContact: (payload: Record<string, unknown>) =>
      apiJsonRequest<CandidateProfileResponse>("/candidates/me/contact", "PUT", payload),
    listEducation: async (): Promise<CandidateEducationRecord[]> =>
      (await apiRequest<CandidateEducationResponse[]>("/candidates/me/education", { method: "GET" })).map(
        mapCandidateEducation,
      ),
    createEducation: async (payload: Record<string, unknown>): Promise<CandidateEducationRecord[]> =>
      (await apiJsonRequest<CandidateEducationResponse[]>(
        "/candidates/me/education",
        "POST",
        payload,
      )).map(mapCandidateEducation),
    updateEducation: async (
      educationId: string,
      payload: Record<string, unknown>,
    ): Promise<CandidateEducationRecord[]> =>
      (await apiJsonRequest<CandidateEducationResponse[]>(
        `/candidates/me/education/${encodeURIComponent(educationId)}`,
        "PUT",
        payload,
      )).map(mapCandidateEducation),
    async deleteEducation(educationId: string): Promise<void> {
      await apiRequest(
        `/candidates/me/education/${encodeURIComponent(educationId)}`,
        { method: "DELETE" },
      );
    },
    listExperience: async (): Promise<CandidateExperienceRecord[]> =>
      (await apiRequest<CandidateExperienceResponse[]>(
        "/candidates/me/experience",
        { method: "GET" },
      )).map(mapCandidateExperience),
    createExperience: async (payload: Record<string, unknown>): Promise<CandidateExperienceRecord[]> =>
      (await apiJsonRequest<CandidateExperienceResponse[]>(
        "/candidates/me/experience",
        "POST",
        payload,
      )).map(mapCandidateExperience),
    updateExperience: async (
      experienceId: string,
      payload: Record<string, unknown>,
    ): Promise<CandidateExperienceRecord[]> =>
      (await apiJsonRequest<CandidateExperienceResponse[]>(
        `/candidates/me/experience/${encodeURIComponent(experienceId)}`,
        "PUT",
        payload,
      )).map(mapCandidateExperience),
    async deleteExperience(experienceId: string): Promise<void> {
      await apiRequest(
        `/candidates/me/experience/${encodeURIComponent(experienceId)}`,
        { method: "DELETE" },
      );
    },
    listSkills: async (): Promise<CandidateSkillRecord[]> =>
      (await apiRequest<CandidateSkillResponse[]>("/candidates/me/skills", { method: "GET" })).map(
        mapCandidateSkill,
      ),
    createSkill: async (payload: Record<string, unknown>): Promise<CandidateSkillRecord[]> =>
      (await apiJsonRequest<CandidateSkillResponse[]>(
        "/candidates/me/skills",
        "POST",
        payload,
      )).map(mapCandidateSkill),
    updateSkill: async (
      skillRowId: string,
      payload: Record<string, unknown>,
    ): Promise<CandidateSkillRecord[]> =>
      (await apiJsonRequest<CandidateSkillResponse[]>(
        `/candidates/me/skills/${encodeURIComponent(skillRowId)}`,
        "PUT",
        payload,
      )).map(mapCandidateSkill),
    async deleteSkill(skillRowId: string): Promise<void> {
      await apiRequest(
        `/candidates/me/skills/${encodeURIComponent(skillRowId)}`,
        { method: "DELETE" },
      );
    },
    listLanguages: async (): Promise<CandidateLanguageRecord[]> =>
      (await apiRequest<CandidateLanguageResponse[]>(
        "/candidates/me/languages",
        { method: "GET" },
      )).map(mapCandidateLanguage),
    createLanguage: async (payload: Record<string, unknown>): Promise<CandidateLanguageRecord[]> =>
      (await apiJsonRequest<CandidateLanguageResponse[]>(
        "/candidates/me/languages",
        "POST",
        payload,
      )).map(mapCandidateLanguage),
    updateLanguage: async (
      languageId: string,
      payload: Record<string, unknown>,
    ): Promise<CandidateLanguageRecord[]> =>
      (await apiJsonRequest<CandidateLanguageResponse[]>(
        `/candidates/me/languages/${encodeURIComponent(languageId)}`,
        "PUT",
        payload,
      )).map(mapCandidateLanguage),
    async deleteLanguage(languageId: string): Promise<void> {
      await apiRequest(
        `/candidates/me/languages/${encodeURIComponent(languageId)}`,
        { method: "DELETE" },
      );
    },
    async getPreference(): Promise<CandidatePreferenceRecord | null> {
      const payload = await apiRequest<CandidatePreferenceResponse | null>(
        "/candidates/me/preference",
        { method: "GET" },
      );
      return mapCandidatePreference(payload);
    },
    updatePreference: async (payload: Record<string, unknown>): Promise<CandidatePreferenceRecord | null> =>
      mapCandidatePreference(
        await apiJsonRequest<CandidatePreferenceResponse | null>(
          "/candidates/me/preference",
          "PUT",
          payload,
        ),
      ),
    async uploadCv(file: File): Promise<CandidateCvRecord> {
      const formData = new FormData();
      formData.append("file", file);
      const payload = await apiRequest<CandidateCvResponse>("/candidates/me/cv", {
        method: "POST",
        body: formData,
      });
      return mapCvRecord(payload);
    },
    async listCvRecords(): Promise<CandidateCvRecord[]> {
      const payload = await apiRequest<CandidateCvResponse[]>("/candidates/me/cv", {
        method: "GET",
      });
      return payload.map(mapCvRecord);
    },
    async getCurrentCv(): Promise<CandidateCvRecord> {
      return mapCvRecord(
        await apiRequest<CandidateCvResponse>("/candidates/me/cv/current", {
          method: "GET",
        }),
      );
    },
    getCurrentCvViewUrl: () => "/candidates/me/cv/current/view",
    async deleteCv(cvRecordId: string): Promise<void> {
      await apiRequest(`/candidates/me/cv/${encodeURIComponent(cvRecordId)}`, {
        method: "DELETE",
      });
    },

    async getKeywords(): Promise<JobSeekerKeywordRecord[]> {
      const payload = await apiRequest<Array<JobSeekerKeywordResponse | string>>(
        "/candidates/me/keywords",
        { method: "GET" },
      );

      const seen = new Set<string>();

      return asArray(payload)
        .map((item, index) => mapJobSeekerKeyword(item, index))
        .filter((item): item is JobSeekerKeywordRecord => Boolean(item))
        .filter((item) => {
          const key = item.keyword.trim().toLowerCase();
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
    },

    async replaceKeywords(keywords: string[]): Promise<JobSeekerKeywordRecord[]> {
      const normalizedKeywords = normalizeKeywordPayload(keywords);
      const payloadVariants: unknown[] = [
        { keywords: normalizedKeywords },
        normalizedKeywords,
        normalizedKeywords.map((keyword) => ({ keyword })),
      ];

      let lastError: unknown = null;

      for (const payload of payloadVariants) {
        try {
          const response = await apiJsonRequest<Array<JobSeekerKeywordResponse | string>>(
            "/candidates/me/keywords",
            "PUT",
            payload,
          );

          const seen = new Set<string>();

          return asArray(response)
            .map((item, index) => mapJobSeekerKeyword(item, index))
            .filter((item): item is JobSeekerKeywordRecord => Boolean(item))
            .filter((item) => {
              const key = item.keyword.trim().toLowerCase();
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });
        } catch (error) {
          if (!isUnsupportedPayloadError(error) || [404, 405].includes(error.status)) {
            throw error;
          }

          lastError = error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Impossible de mettre à jour les mots-clés.");
    },

    updateKeywords(keywords: string[]): Promise<JobSeekerKeywordRecord[]> {
      return gatewayApi.candidate.replaceKeywords(keywords);
    },

    async getOfferThreshold(): Promise<CandidateOfferThresholdRecord | null> {
      const payload = await apiRequest<CandidateOfferThresholdResponse | number | string | null>(
        "/candidates/me/preferences/offer-threshold",
        { method: "GET" },
      );

      return mapCandidateOfferThreshold(payload);
    },

    async updateOfferThreshold(
      minThreshold: number,
    ): Promise<CandidateOfferThresholdRecord | null> {
      const payloadVariants: unknown[] = [
        { min_threshold: minThreshold },
        { threshold: minThreshold },
        minThreshold,
      ];

      let lastError: unknown = null;

      for (const payload of payloadVariants) {
        try {
          const response = await apiJsonRequest<
            CandidateOfferThresholdResponse | number | string | null
          >(
            "/candidates/me/preferences/offer-threshold",
            "PUT",
            payload,
          );

          return mapCandidateOfferThreshold(response);
        } catch (error) {
          if (!isUnsupportedPayloadError(error) || [404, 405].includes(error.status)) {
            throw error;
          }

          lastError = error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Impossible de mettre à jour le seuil des offres.");
    },

    getActiveOffersCount: async (): Promise<number> => {
      const payload = await apiRequest<CandidateActiveOffersCountResponse>(
        "/candidates/me/offers/active-count",
        { method: "GET" },
      );

      return toNumberValue(payload.active_offers_count);
    },

    getMatchedOffers: async (
      minScore?: number,
    ): Promise<CandidateMatchedOffersRecord> => {
      const payload = await apiRequest<CandidateMatchedOffersResponse>(
        "/candidates/me/matched-offers",
        { method: "GET" },
        typeof minScore === "number"
          ? {
            query: {
              min_score: minScore,
            },
          }
          : undefined,
      );

      return mapCandidateMatchedOffers(payload);
    },

    applyToOffer: async (payload: {
      offer_id: string;
      matching_result_id?: string | null;
      cover_message?: string | null;
    }): Promise<Record<string, unknown> | null> =>
      apiJsonRequest<Record<string, unknown> | null>(
        "/candidates/me/applications",
        "POST",
        payload,
      ),

    async parseCv(cvRecordId: string): Promise<CandidateCvParseResult> {
      const payload = await apiRequest<CandidateCvParseResponse>(
        `/candidates/me/cv/${encodeURIComponent(cvRecordId)}/parse`,
        { method: "POST" },
      );

      return {
        cvRecordId: payload.cv_record_id,
        jobSeekerId: payload.job_seeker_id,
        parsingStatus: payload.parsing_status,
        parsedPayload: payload.parsed_payload ?? {},
        mappedPayload: payload.mapped_payload ?? {},
        extractedProfilePatch: {
          identity: payload.extracted_profile_patch?.identity ?? {},
          education: payload.extracted_profile_patch?.education ?? [],
          experience: payload.extracted_profile_patch?.experience ?? [],
          stages: payload.extracted_profile_patch?.stages ?? [],
          skills: payload.extracted_profile_patch?.skills ?? [],
          languages: payload.extracted_profile_patch?.languages ?? [],
          certifications: payload.extracted_profile_patch?.certifications ?? [],
          projects: payload.extracted_profile_patch?.projects ?? [],
          interests: payload.extracted_profile_patch?.interests ?? [],
          preferences: payload.extracted_profile_patch?.preferences ?? {},
          geoNormalization:
            payload.extracted_profile_patch?.geo_normalization ?? {},
          cvMetadata: payload.extracted_profile_patch?.cv_metadata ?? {},
        },
        warnings: payload.warnings ?? [],
        parserVersion: payload.parser_version,
      };
    },
  },
  employer: {
    async getProfile(): Promise<EmployerProfile> {
      const payload = await apiRequest<EmployerProfileResponse>("/employers/me", {
        method: "GET",
      });

      return {
        id: payload.id,
        legalName: payload.legal_name ?? null,
        commercialName: payload.commercial_name ?? null,
        taxIdentifier: payload.tax_identifier ?? null,
        employerTypeCode: payload.employer_type_code ?? null,
        sizeBandCode: payload.size_band_code ?? null,
        websiteUrl: payload.website_url ?? null,
        logoUrl: payload.logo_url ?? null,
        status: payload.status,
        contact: payload.contact ?? null,
        location: payload.location ?? null,
      };
    },
    updateProfile: (payload: Record<string, unknown>) =>
      apiJsonRequest<EmployerProfileResponse>("/employers/me", "PUT", payload),
    updateContact: (payload: Record<string, unknown>) =>
      apiJsonRequest<EmployerProfileResponse>("/employers/me/contact", "PUT", payload),
    updateLocation: (payload: Record<string, unknown>) =>
      apiJsonRequest<EmployerProfileResponse>("/employers/me/location", "PUT", payload),
    async listOffers(): Promise<EmployerOffer[]> {
      return (
        await apiRequest<EmployerOfferResponse[]>("/employers/me/offers", { method: "GET" })
      ).map(mapEmployerOffer);
    },
    async createOffer(payload: Record<string, unknown>): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiJsonRequest<EmployerOfferResponse>("/employers/me/offers", "POST", payload),
      );
    },
    async getOffer(offerId: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiRequest<EmployerOfferResponse>(
          `/employers/me/offers/${encodeURIComponent(offerId)}`,
          { method: "GET" },
        ),
      );
    },
    async updateOffer(offerId: string, payload: Record<string, unknown>): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiJsonRequest<EmployerOfferResponse>(
          `/employers/me/offers/${encodeURIComponent(offerId)}`,
          "PUT",
          payload,
        ),
      );
    },
    async deleteOffer(offerId: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiRequest<EmployerOfferResponse>(
          `/employers/me/offers/${encodeURIComponent(offerId)}`,
          { method: "DELETE" },
        ),
      );
    },
    async submitOffer(offerId: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiRequest<EmployerOfferResponse>(
          `/employers/me/offers/${encodeURIComponent(offerId)}/submit`,
          { method: "POST" },
        ),
      );
    },
    async parseOfferDraft(payload: { raw_text: string; title?: string | null }): Promise<EmployerOfferDraft> {
      const response = await apiJsonRequest<EmployerOfferDraftResponse>(
        "/employers/me/offers/parse",
        "POST",
        payload,
      );

      const extractedRequirements = asArray(response.extracted_requirements);
      const draftPayload = (response.draft ?? {}) as Record<string, unknown>;

      return {
        parsingStatus: response.parsing_status,
        parsedPayload: response.parsed_payload ?? {},
        mappedPayload: response.mapped_payload ?? {},
        extractedRequirements,
        warnings: response.warnings ?? [],
        parserVersion: response.parser_version ?? null,
        draft: {
          ...draftPayload,
          requirements: Array.isArray(draftPayload.requirements)
            ? (draftPayload.requirements as Array<Record<string, unknown>>)
            : extractedRequirements,
        },
      };
    },
    async listApplications(): Promise<EmployerApplication[]> {
      return (
        await apiRequest<EmployerApplicationResponse[]>(
          "/employers/me/applications",
          { method: "GET" },
        )
      ).map(mapEmployerApplication);
    },
  },
  advisor: {
    async getMe(): Promise<AdvisorMeRecord> {
      const payload = await apiRequest<AdvisorMeResponse>("/advisors/me", { method: "GET" });
      return {
        id: payload.id,
        userId: payload.user_id,
        email: payload.email,
        roles: payload.roles,
        fullName: payload.full_name,
        position: payload.position ?? null,
        active: payload.active,
        agency: payload.agency ?? null,
      };
    },
    async listCandidates(params: {
      q?: string;
      status?: string;
      governorate_code?: string;
      delegation_code?: string;
      has_cv?: boolean;
      limit?: number;
      offset?: number;
    } = {}): Promise<CandidateListItem[]> {
      const payload = await apiRequest<CandidateListItemResponse[]>(
        "/advisor/candidates",
        { method: "GET" },
        { query: params },
      );
      return payload.map(mapCandidateListItem);
    },
    async getCandidate(candidateId: string): Promise<CandidateProfileBundle> {
      const profile = await apiRequest<CandidateProfileResponse>(
        `/advisor/candidates/${encodeURIComponent(candidateId)}`,
        { method: "GET" },
      );

      return {
        id: profile.id,
        status: profile.status,
        registrationDate: profile.registration_date ?? null,
        primaryLanguage: profile.primary_language ?? null,
        identity: profile.identity ?? null,
        contact: profile.contact ?? null,
        education: asArray(profile.education).map(mapCandidateEducation),
        experience: asArray(profile.experience).map(mapCandidateExperience),
        skills: asArray(profile.skills).map(mapCandidateSkill),
        languages: asArray(profile.languages).map(mapCandidateLanguage),
        preference: mapCandidatePreference(profile.preference ?? null),
        currentCv: profile.current_cv ? mapCvRecord(profile.current_cv) : null,
        cvRecords: profile.current_cv ? [mapCvRecord(profile.current_cv)] : [],
      };
    },
    updateCandidateStatus: (candidateId: string, payload: { status: string; reason?: string | null }) =>
      apiJsonRequest<{ id: string; status: string; reason?: string | null; warning?: string | null }>(
        `/advisor/candidates/${encodeURIComponent(candidateId)}/status`,
        "PUT",
        payload,
      ),
    async getCandidateCurrentCv(candidateId: string): Promise<CandidateCvRecord> {
      return mapCvRecord(
        await apiRequest<CandidateCvResponse>(
          `/advisor/candidates/${encodeURIComponent(candidateId)}/cv/current`,
          { method: "GET" },
        ),
      );
    },
    candidateCurrentCvViewUrl: (candidateId: string) =>
      `/advisor/candidates/${encodeURIComponent(candidateId)}/cv/current/view`,
    async listOffers(): Promise<EmployerOffer[]> {
      return (await apiRequest<EmployerOfferResponse[]>("/advisor/offers", { method: "GET" })).map(
        mapEmployerOffer,
      );
    },
    async getOffer(offerId: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiRequest<EmployerOfferResponse>(
          `/advisor/offers/${encodeURIComponent(offerId)}`,
          { method: "GET" },
        ),
      );
    },
    async validateOffer(offerId: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiRequest<EmployerOfferResponse>(
          `/advisor/offers/${encodeURIComponent(offerId)}/validate`,
          { method: "POST" },
        ),
      );
    },
    async rejectOffer(offerId: string, reason?: string): Promise<EmployerOffer> {
      return mapEmployerOffer(
        await apiJsonRequest<EmployerOfferResponse>(
          `/advisor/offers/${encodeURIComponent(offerId)}/reject`,
          "POST",
          { reason: reason ?? null },
        ),
      );
    },
    async createCandidate(payload: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      phone?: string | null;
      governorate_code?: string | null;
      delegation_code?: string | null;
      primary_language?: string;
    }): Promise<{
      candidate_id: string;
      user_id: string;
      email: string;
      temporary_password: string;
      first_name: string;
      last_name: string;
    }> {
      return apiJsonRequest("/advisor/candidates", "POST", payload);
    },
    async listEmployers(): Promise<Array<{ id: string; legal_name: string; commercial_name?: string | null; email?: string | null }>> {
      return apiRequest("/advisor/employers", { method: "GET" });
    },
    async createOffer(payload: Record<string, unknown>): Promise<{ id: string; aneti_identifier?: string | null }> {
      return apiJsonRequest("/advisor/offers", "POST", payload);
    },
    async parseOfferDraft(payload: { raw_text: string; title?: string | null }): Promise<EmployerOfferDraft> {
      const response = await apiJsonRequest<EmployerOfferDraftResponse>(
        "/advisor/offers/parse",
        "POST",
        payload,
      );
      const extractedRequirements = asArray(response.extracted_requirements);
      const draftPayload = (response.draft ?? {}) as Record<string, unknown>;
      return {
        parsingStatus: response.parsing_status,
        parsedPayload: response.parsed_payload ?? {},
        mappedPayload: response.mapped_payload ?? {},
        extractedRequirements,
        warnings: response.warnings ?? [],
        parserVersion: response.parser_version ?? null,
        draft: {
          ...draftPayload,
          requirements: Array.isArray(draftPayload.requirements)
            ? (draftPayload.requirements as Array<Record<string, unknown>>)
            : extractedRequirements,
        },
      };
    },
    async uploadCandidateCv(candidateId: string, file: File): Promise<CandidateCvRecord> {
      const formData = new FormData();
      formData.append("file", file);
      return mapCvRecord(
        await apiRequest<CandidateCvResponse>(
          `/advisor/candidates/${encodeURIComponent(candidateId)}/cv`,
          { method: "POST", body: formData },
        ),
      );
    },
    async parseCandidateCv(candidateId: string, cvRecordId: string): Promise<{ parsing_status: string; message: string }> {
      return apiRequest(
        `/advisor/candidates/${encodeURIComponent(candidateId)}/cv/${encodeURIComponent(cvRecordId)}/parse`,
        { method: "POST" },
      );
    },
  },
  search: {
    async offers(payload: {
      query?: string;
      size?: number;
      filters?: Record<string, unknown>;
      [key: string]: unknown;
    }): Promise<SearchOffersResponse> {
      const response = await apiJsonRequest<Record<string, unknown>>(
        "/search/offers",
        "POST",
        payload,
      );

      const data = asRecord(response.data);
      const meta = asRecord(response.meta);
      const pagination = asRecord(response.pagination);
      const resolvedResults =
        asArray(response.results as SearchOfferResponseItem[] | undefined).length > 0
          ? asArray(response.results as SearchOfferResponseItem[] | undefined)
          : asArray(response.items as SearchOfferResponseItem[] | undefined).length > 0
            ? asArray(response.items as SearchOfferResponseItem[] | undefined)
            : asArray(data.results as SearchOfferResponseItem[] | undefined).length > 0
              ? asArray(data.results as SearchOfferResponseItem[] | undefined)
              : asArray(data.items as SearchOfferResponseItem[] | undefined);
      const total =
        response.total ??
        pagination.total ??
        meta.total ??
        data.total ??
        response.count ??
        resolvedResults.length;

      return {
        total: toNumberValue(total, resolvedResults.length) || resolvedResults.length,
        mode: toNullableString(response.mode),
        query: toNullableString(response.query),
        results: resolvedResults.map(mapSearchOffer),
        raw: response,
      };
    },
    async candidates(payload: Record<string, unknown>): Promise<SearchCandidatesResponse> {
      const response = await apiJsonRequest<Record<string, unknown>>(
        "/search/candidates",
        "POST",
        payload,
      );

      const candidateResults = asArray(response.results as SearchCandidateResponseItem[]).map(mapSearchCandidate);
      return {
        total: toNumberValue(response.total) || candidateResults.length,
        filtersApplied:
          (response.filters_applied as Record<string, unknown> | undefined) ?? {},
        results: candidateResults,
        raw: response,
      };
    },
    async offerDetail(offerId: string): Promise<SearchOfferResult> {
      return mapSearchOffer(
        await apiRequest<SearchOfferResponseItem>(
          `/search/offers/${encodeURIComponent(offerId)}`,
          { method: "GET" },
        ),
      );
    },
    sync: () => apiRequest<Record<string, unknown>>("/tech-admin/services/search/sync", { method: "POST" }),
  },
  matching: {
    createRun: async (payload: Record<string, unknown>): Promise<MatchingRunRecord> =>
      mapMatchingRun(await apiJsonRequest<MatchingRunResponse>("/matching/runs", "POST", payload)),
    executeRun: async (runId: string, payload: Record<string, unknown>): Promise<MatchingExecutionRecord> =>
      mapMatchingExecution(
        await apiJsonRequest<MatchingExecutionResponse>(
          `/matching/runs/${encodeURIComponent(runId)}/execute`,
          "POST",
          payload,
        ),
      ),
    getRun: async (runId: string): Promise<MatchingRunRecord> =>
      mapMatchingRun(
        await apiRequest<MatchingRunResponse>(
          `/matching/runs/${encodeURIComponent(runId)}`,
          { method: "GET" },
        ),
      ),
    listResults: async (runId: string): Promise<MatchingResultRecord[]> =>
      (await apiRequest<MatchingResultResponse[]>(
        `/matching/runs/${encodeURIComponent(runId)}/results`,
        { method: "GET" },
      )).map(mapMatchingResult),
    async getResult(resultId: string): Promise<{
      result: MatchingResultRecord;
      details: MatchingResultDetailRecord[];
    }> {
      const payload = await apiRequest<MatchingResultWithDetailsResponse>(
        `/matching/results/${encodeURIComponent(resultId)}`,
        { method: "GET" },
      );
      return {
        result: mapMatchingResult(payload.result),
        details: asArray(payload.details).map(mapMatchingResultDetail),
      };
    },
    updateDecision: async (
      resultId: string,
      payload: { decision_status: string; decision_reason?: string | null },
    ): Promise<MatchingResultRecord> =>
      mapMatchingResult(
        await apiJsonRequest<MatchingResultResponse>(
          `/matching/results/${encodeURIComponent(resultId)}/decision`,
          "PUT",
          payload,
        ),
      ),
  },
  matchingConfig: {
    listCriteria: async (): Promise<MatchingCriterionRecord[]> =>
      (await apiRequest<MatchingCriterionResponse[]>("/matching/criteria", { method: "GET" })).map(
        mapMatchingCriterion,
      ),
    getCriterion: async (criterionId: string): Promise<MatchingCriterionRecord> =>
      mapMatchingCriterion(
        await apiRequest<MatchingCriterionResponse>(
          `/matching/criteria/${encodeURIComponent(criterionId)}`,
          { method: "GET" },
        ),
      ),
    createCriterion: async (payload: Record<string, unknown>): Promise<MatchingCriterionRecord> =>
      mapMatchingCriterion(
        await apiJsonRequest<MatchingCriterionResponse>("/matching/criteria", "POST", payload),
      ),
    updateCriterion: async (
      criterionId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingCriterionRecord> =>
      mapMatchingCriterion(
        await apiJsonRequest<MatchingCriterionResponse>(
          `/matching/criteria/${encodeURIComponent(criterionId)}`,
          "PUT",
          payload,
        ),
      ),
    deleteCriterion: async (criterionId: string): Promise<MatchingCriterionRecord> =>
      mapMatchingCriterion(
        await apiRequest<MatchingCriterionResponse>(
          `/matching/criteria/${encodeURIComponent(criterionId)}`,
          { method: "DELETE" },
        ),
      ),
    listModels: async (): Promise<MatchingModelRecord[]> =>
      (await apiRequest<MatchingModelResponse[]>("/matching/models", { method: "GET" })).map(
        mapMatchingModel,
      ),
    getModel: async (modelId: string): Promise<MatchingModelRecord> =>
      mapMatchingModel(
        await apiRequest<MatchingModelResponse>(
          `/matching/models/${encodeURIComponent(modelId)}`,
          { method: "GET" },
        ),
      ),
    createModel: async (payload: Record<string, unknown>): Promise<MatchingModelRecord> =>
      mapMatchingModel(
        await apiJsonRequest<MatchingModelResponse>("/matching/models", "POST", payload),
      ),
    updateModel: async (modelId: string, payload: Record<string, unknown>): Promise<MatchingModelRecord> =>
      mapMatchingModel(
        await apiJsonRequest<MatchingModelResponse>(
          `/matching/models/${encodeURIComponent(modelId)}`,
          "PUT",
          payload,
        ),
      ),
    deleteModel: async (modelId: string): Promise<MatchingModelRecord> =>
      mapMatchingModel(
        await apiRequest<MatchingModelResponse>(
          `/matching/models/${encodeURIComponent(modelId)}`,
          { method: "DELETE" },
        ),
      ),
    listVersions: async (modelId: string): Promise<MatchingModelVersionRecord[]> =>
      (await apiRequest<MatchingModelVersionResponse[]>(
        `/matching/models/${encodeURIComponent(modelId)}/versions`,
        { method: "GET" },
      )).map(mapMatchingModelVersion),
    createVersion: async (modelId: string, payload: Record<string, unknown>): Promise<MatchingModelVersionRecord> =>
      mapMatchingModelVersion(
        await apiJsonRequest<MatchingModelVersionResponse>(
          `/matching/models/${encodeURIComponent(modelId)}/versions`,
          "POST",
          payload,
        ),
      ),
    updateVersion: async (
      modelId: string,
      versionId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingModelVersionRecord> =>
      mapMatchingModelVersion(
        await apiJsonRequest<MatchingModelVersionResponse>(
          `/matching/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}`,
          "PUT",
          payload,
        ),
      ),
    publishVersion: async (modelId: string, versionId: string): Promise<MatchingModelVersionRecord> =>
      mapMatchingModelVersion(
        await apiRequest<MatchingModelVersionResponse>(
          `/matching/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}/publish`,
          { method: "POST" },
        ),
      ),
    archiveVersion: async (modelId: string, versionId: string): Promise<MatchingModelVersionRecord> =>
      mapMatchingModelVersion(
        await apiRequest<MatchingModelVersionResponse>(
          `/matching/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}/archive`,
          { method: "POST" },
        ),
      ),
    listModelCriteria: async (versionId: string): Promise<MatchingModelCriterionRecord[]> =>
      (await apiRequest<MatchingModelCriterionResponse[]>(
        `/matching/model-versions/${encodeURIComponent(versionId)}/criteria`,
        { method: "GET" },
      )).map(mapMatchingModelCriterion),
    createModelCriterion: async (
      versionId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingModelCriterionRecord> =>
      mapMatchingModelCriterion(
        await apiJsonRequest<MatchingModelCriterionResponse>(
          `/matching/model-versions/${encodeURIComponent(versionId)}/criteria`,
          "POST",
          payload,
        ),
      ),
    updateModelCriterion: async (
      versionId: string,
      criterionId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingModelCriterionRecord> =>
      mapMatchingModelCriterion(
        await apiJsonRequest<MatchingModelCriterionResponse>(
          `/matching/model-versions/${encodeURIComponent(versionId)}/criteria/${encodeURIComponent(criterionId)}`,
          "PUT",
          payload,
        ),
      ),
    async deleteModelCriterion(versionId: string, criterionId: string): Promise<void> {
      await apiRequest(
        `/matching/model-versions/${encodeURIComponent(versionId)}/criteria/${encodeURIComponent(criterionId)}`,
        { method: "DELETE" },
      );
    },
    listHardFilters: async (versionId: string): Promise<MatchingHardFilterRecord[]> =>
      (await apiRequest<MatchingHardFilterResponse[]>(
        `/matching/model-versions/${encodeURIComponent(versionId)}/hard-filters`,
        { method: "GET" },
      )).map(mapMatchingHardFilter),
    createHardFilter: async (
      versionId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingHardFilterRecord> =>
      mapMatchingHardFilter(
        await apiJsonRequest<MatchingHardFilterResponse>(
          `/matching/model-versions/${encodeURIComponent(versionId)}/hard-filters`,
          "POST",
          payload,
        ),
      ),
    updateHardFilter: async (
      versionId: string,
      filterId: string,
      payload: Record<string, unknown>,
    ): Promise<MatchingHardFilterRecord> =>
      mapMatchingHardFilter(
        await apiJsonRequest<MatchingHardFilterResponse>(
          `/matching/model-versions/${encodeURIComponent(versionId)}/hard-filters/${encodeURIComponent(filterId)}`,
          "PUT",
          payload,
        ),
      ),
    async deleteHardFilter(versionId: string, filterId: string): Promise<void> {
      await apiRequest(
        `/matching/model-versions/${encodeURIComponent(versionId)}/hard-filters/${encodeURIComponent(filterId)}`,
        { method: "DELETE" },
      );
    },
  },
  techAdmin: {
    me: () => apiRequest<Record<string, unknown>>("/tech-admin/me", { method: "GET" }),
    async dashboard(): Promise<TechAdminDashboardRecord> {
      const payload = await apiRequest<TechAdminDashboardResponse>("/tech-admin/dashboard", {
        method: "GET",
      });
      return {
        apiGateway: payload.api_gateway,
        database: payload.database,
        parsingService: payload.parsing_service,
        matchingService: payload.matching_service,
        searchService: payload.search_service,
        storageProvider: payload.storage_provider,
        kafkaStatus: payload.kafka_status,
      };
    },
    health: () => apiRequest<Record<string, unknown>>("/tech-admin/health", { method: "GET" }),
    services: () =>
      apiRequest<Record<string, ServiceHealthResponse>>("/tech-admin/services", {
        method: "GET",
      }),
    parsingHealth: async (): Promise<ServiceHealthRecord> => {
      const payload = await apiRequest<ServiceHealthResponse>(
        "/tech-admin/services/parsing/health",
        { method: "GET" },
      );
      return payload;
    },
    matchingHealth: async (): Promise<ServiceHealthRecord> => {
      const payload = await apiRequest<ServiceHealthResponse>(
        "/tech-admin/services/matching/health",
        { method: "GET" },
      );
      return payload;
    },
    searchHealth: async (): Promise<ServiceHealthRecord> => {
      const payload = await apiRequest<ServiceHealthResponse>(
        "/tech-admin/services/search/health",
        { method: "GET" },
      );
      return payload;
    },
    async listUsers(): Promise<TechAdminUserRecord[]> {
      return (await apiRequest<TechAdminUserResponse[]>("/tech-admin/users", { method: "GET" })).map(
        mapTechAdminUser,
      );
    },
    async getUser(userId: string): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiRequest<TechAdminUserResponse>(
          `/tech-admin/users/${encodeURIComponent(userId)}`,
          { method: "GET" },
        ),
      );
    },
    async createUser(payload: Record<string, unknown>): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiJsonRequest<TechAdminUserResponse>("/tech-admin/users", "POST", payload),
      );
    },
    async updateUser(userId: string, payload: Record<string, unknown>): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiJsonRequest<TechAdminUserResponse>(
          `/tech-admin/users/${encodeURIComponent(userId)}`,
          "PUT",
          payload,
        ),
      );
    },
    async updateUserStatus(
      userId: string,
      payload: Record<string, unknown>,
    ): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiJsonRequest<TechAdminUserResponse>(
          `/tech-admin/users/${encodeURIComponent(userId)}/status`,
          "PUT",
          payload,
        ),
      );
    },
    async listRoles(): Promise<TechAdminRoleRecord[]> {
      return (await apiRequest<TechAdminRoleResponse[]>("/tech-admin/roles", { method: "GET" })).map(
        mapTechAdminRole,
      );
    },
    async assignRole(userId: string, roleId: string): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiJsonRequest<TechAdminUserResponse>(
          `/tech-admin/users/${encodeURIComponent(userId)}/roles`,
          "POST",
          { role_id: roleId },
        ),
      );
    },
    async removeRole(userId: string, roleId: string): Promise<TechAdminUserRecord> {
      return mapTechAdminUser(
        await apiRequest<TechAdminUserResponse>(
          `/tech-admin/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
          { method: "DELETE" },
        ),
      );
    },
  },
  segments: {
    async list(params: { active?: boolean; macro_segment?: string; q?: string } = {}): Promise<SegmentRecord[]> {
      const query: Record<string, string | number | boolean | undefined> = {};
      if (params.active !== undefined) query.active = params.active;
      if (params.macro_segment) query.macro_segment = params.macro_segment;
      if (params.q) query.q = params.q;
      return (
        await apiRequest<SegmentResponse[]>("/segments", { method: "GET" }, { query })
      ).map(mapSegment);
    },
    async get(segmentId: string): Promise<SegmentRecord> {
      return mapSegmentFull(
        await apiRequest<SegmentFullResponse>(`/segments/${encodeURIComponent(segmentId)}`, { method: "GET" }),
      );
    },
    async create(payload: Record<string, unknown>): Promise<SegmentRecord> {
      return mapSegmentFull(
        await apiJsonRequest<SegmentFullResponse>("/segments", "POST", payload),
      );
    },
    async update(segmentId: string, payload: Record<string, unknown>): Promise<SegmentRecord> {
      return mapSegmentFull(
        await apiJsonRequest<SegmentFullResponse>(`/segments/${encodeURIComponent(segmentId)}`, "PUT", payload),
      );
    },
    async deactivate(segmentId: string): Promise<SegmentRecord> {
      return mapSegmentFull(
        await apiRequest<SegmentFullResponse>(`/segments/${encodeURIComponent(segmentId)}`, { method: "DELETE" }),
      );
    },
    async listRules(segmentId: string): Promise<SegmentRuleRecord[]> {
      return (
        await apiRequest<SegmentRuleResponse[]>(`/segments/${encodeURIComponent(segmentId)}/rules`, { method: "GET" })
      ).map(mapSegmentRule);
    },
    async createRule(segmentId: string, payload: Record<string, unknown>): Promise<SegmentRuleRecord> {
      return mapSegmentRule(
        await apiJsonRequest<SegmentRuleResponse>(`/segments/${encodeURIComponent(segmentId)}/rules`, "POST", payload),
      );
    },
    async updateRule(segmentId: string, ruleId: string, payload: Record<string, unknown>): Promise<SegmentRuleRecord> {
      return mapSegmentRule(
        await apiJsonRequest<SegmentRuleResponse>(
          `/segments/${encodeURIComponent(segmentId)}/rules/${encodeURIComponent(ruleId)}`,
          "PUT",
          payload,
        ),
      );
    },
    async deleteRule(segmentId: string, ruleId: string): Promise<void> {
      await apiRequest(
        `/segments/${encodeURIComponent(segmentId)}/rules/${encodeURIComponent(ruleId)}`,
        { method: "DELETE" },
      );
    },
  },
  audit: {
    async listEvents(params: Record<string, string | number | boolean | undefined> = {}): Promise<AuditEventRecord[]> {
      return (
        await apiRequest<AuditEventResponse[]>(
          "/tech-admin/audit/events",
          { method: "GET" },
          { query: params },
        )
      ).map(mapAuditEvent);
    },
    async getEvent(eventId: string): Promise<AuditEventRecord> {
      return mapAuditEvent(
        await apiRequest<AuditEventResponse>(
          `/tech-admin/audit/events/${encodeURIComponent(eventId)}`,
          { method: "GET" },
        ),
      );
    },
    async summary(): Promise<AuditSummaryRecord> {
      const payload = await apiRequest<AuditSummaryResponse>("/tech-admin/audit/summary", {
        method: "GET",
      });
      return {
        totalEvents: payload.total_events,
        errorEvents: payload.error_events,
        latestEventTime: payload.latest_event_time ?? null,
        byCategory: payload.by_category ?? [],
        bySeverity: payload.by_severity ?? [],
        byEventType: payload.by_event_type ?? [],
      };
    },
  },
};

export const inferCandidateDisplayName = (bundle: CandidateProfileBundle): string => {
  const firstName = toStringValue(bundle.identity?.first_name).trim();
  const lastName = toStringValue(bundle.identity?.last_name).trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return bundle.contact?.email ?? "Candidate";
};

export const inferCandidateLocation = (bundle: CandidateProfileBundle): string =>
  joinLocation(
    bundle.contact?.address,
    bundle.contact?.delegation_label,
    bundle.contact?.governorate_label,
    bundle.contact?.country,
  );

export const inferSkillLabel = (skill: CandidateSkillRecord): string =>
  skill.skillNodeLabel ??
  skill.skillLabelRaw ??
  skill.skillId ??
  "Skill";

export const inferLanguageLabel = (language: CandidateLanguageRecord): string => {
  const languageLabel =
    language.languageLabelFr ??
    language.languageLabelEn ??
    language.languageCode;

  const levelLabel =
    language.levelLabelFr ??
    language.levelLabelEn ??
    language.level;

  return [languageLabel, levelLabel].filter(Boolean).join(" - ");
};

export const humanizeContractType = (value: string | null | undefined): string =>
  titleCase(value) || "Not specified";
