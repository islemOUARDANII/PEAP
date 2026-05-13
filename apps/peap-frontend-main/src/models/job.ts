export type JobStatus = "Active" | "Draft" | "Archived" | "Paused";

export interface Job {
  id: string;
  anetiIdentifier?: string | null;
  title: string;
  company: string;
  location: string;
  contract: string;
  level: string;
  postedDays: number;
  applicants: number;
  matched: number;
  status: JobStatus;
  required: string[];
  preferred: string[];
  score?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  scoreBreakdown?: JobScoreBreakdown[];
}

export interface JobScoreBreakdown {
  code: string;
  label: string;
  score: number;
  matched: boolean;
  explanation?: unknown;
}

export interface CreateJobOfferPayload {
  title: string;
  description?: string | null;

  company_name?: string | null;

  number_of_positions?: number;
  contract_type?: string | null;
  work_mode?: "ONSITE" | "REMOTE" | "HYBRID" | "UNKNOWN" | string | null;

  salary_min?: number | null;
  salary_max?: number | null;

  country?: string;
  governorate_code?: string | null;
  delegation_code?: string | null;
  deadline_at?: string | null;

  rtmc_occupation_id?: string | null;

  requirements?: Array<Record<string, unknown>>;

  // anciens champs gardés temporairement pour ne pas casser d'autres usages front
  rawText?: string;
  companyName?: string;
  location?: string;
  contract?: string;
  level?: string;
  governorateCode?: string | null;
  delegationCode?: string | null;
  numberOfPositions?: number;
  workMode?: "ONSITE" | "REMOTE" | "HYBRID" | "UNKNOWN" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  deadlineAt?: string | null;

  targetOccupations?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  minYearsExperience?: number | "";
  educationMin?: string;
  certificationsPreferred?: string[];
  languages?: string[];
  parsedOffer?: OfferParsedOutput;
}

export interface OfferParsedOutput {
  contract_version: string;
  offer_id: string;
  source: {
    filename: string;
    mime_type: string;
    [key: string]: unknown;
  };
  parsing_metadata: {
    parser_version: string;
    parsed_at: string;
    lang: string;
    confidence_overall: number;
  };
  offer: {
    title: string;
    company_name: string;
    location: string;
    employment_type:
    | "internship"
    | "full_time"
    | "part_time"
    | "contract"
    | string;
    country?: string;
    company_domain?: string;
    external_company_id?: string;
    seniority_level?: "junior" | "mid" | "senior" | "lead" | string;
    industry_code?: string;
  };
  occupations_target: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
  requirements: {
    mandatory_skills: Array<{
      code: string | null;
      label: string;
      min_level: string;
      weight: number;
    }>;
    optional_skills: Array<{
      code: string | null;
      label: string;
      weight: number;
    }>;
    min_years_experience?: number;
    education_min?: {
      code: string;
      label: string;
    };
    certifications_preferred?: Array<{
      code: string | null;
      label: string;
    }>;
    languages?: Array<{
      code: string;
      label: string;
      min_level: string;
    }>;
  };
}

export interface OfferParsePayload {
  rawText: string;
  offerId?: string;
  filename?: string;
}

export interface ProviderOfferDetail {
  offer: Job;
  candidates: import("./candidate").Candidate[];
  raw?: unknown;
}

export interface AdminCreateProviderPayload {
  email: string;
  password: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  website?: string;
  companySize?: string;
}

export interface AdminCreateProviderResponse {
  id: string;
  email: string;
  role: string;
  status: string;
  company_id?: string | null;
  message: string;
}
