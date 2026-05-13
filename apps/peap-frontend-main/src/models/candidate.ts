export type CandidateStatus = "New" | "Reviewed" | "Shortlisted" | "Rejected";

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  occupation: string;
  location: string;
  experienceYears: number;
  score: number;
  topSkills: string[];
  missing: string[];
  summary: string;
  status: CandidateStatus;
  email?: string;
  phone?: string;
  offerId?: string;
  offerTitle?: string;
  company?: string;
  rank?: number;
  documents?: CandidateDocument[];
  offers?: Array<{ id: string; title: string; company: string; score: number; rank?: number }>;
  experiences?: CandidateExperience[];
  jobExperiences?: CandidateExperience[];
  internshipExperiences?: CandidateExperience[];
  codingSkills?: string[] | null;
  education?: CandidateEducation[];
  languages?: CandidateLanguage[];
}

export interface CandidateExperience {
  company: string;
  role: string;
  years: string;
  description: string;
}

export interface CandidateEducation {
  school: string;
  degree: string;
  years: string;
}

export interface CandidateLanguage {
  label: string;
  level: string;
}

export interface CandidateDocument {
  id: string;
  docType: string;
  filename: string;
  mimeType?: string;
  uploadedAt?: string;
  accessUrl?: string;
}

export interface CandidateProfile {
  name: string;
  initials: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  primaryLang?: string;
  occupation: string;
  occupationConfidence: number;
  yearsExperience: number;
  skillsCount: number;
  coreSkills: string[];
  secondarySkills: string[];
  suggestedSkills: string[];
  experiences: CandidateExperience[];
  jobExperiences: CandidateExperience[];
  internshipExperiences: CandidateExperience[];
  codingSkills: string[] | null;
  education: CandidateEducation[];
  languages: CandidateLanguage[];
  documents: CandidateDocument[];
}

export interface CandidateProfileUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  primaryLang?: string;
}

export interface CandidateCvUploadResult {
  cvId: string;
  traceId: string;
  status: string;
  linkedCandidateId?: string;
  sessionToken?: string;
  resumeId?: string;
  message?: string;
  redirectTo?: string;
  pipeline?: {
    current?: Record<string, unknown> | null;
    lastUploadAt?: string | null;
    steps: Array<{
      label: string;
      status: string;
      timestamp?: string | null;
    }>;
  } | null;
}
