import { useEffect, useState } from "react";

import { mockParsedCv, type MockParsedCv } from "@/mocks/mockParsedCv";

export interface LocalCandidateProfile {
  personalInfo: MockParsedCv["personal_info"];
  summary: string;
  education: MockParsedCv["education"];
  jobExperiences: MockParsedCv["job_experiences"];
  internshipExperiences: MockParsedCv["internship_experiences"];
  skills: string[];
  codingSkills: string[];
  languages: string[];
  certifications: MockParsedCv["certifications"];
}

interface ProfileCompletionSection {
  label: string;
  value: number;
}

const candidateProfileStorageKey = "matchcore.candidate.local-profile";
const candidateProfileEventName = "matchcore:candidate-local-profile-changed";

const defaultLocalCandidateProfile: LocalCandidateProfile = {
  personalInfo: { ...mockParsedCv.personal_info },
  summary: mockParsedCv.summary,
  education: mockParsedCv.education.map((item) => ({ ...item })),
  jobExperiences: mockParsedCv.job_experiences.map((item) => ({ ...item })),
  internshipExperiences: mockParsedCv.internship_experiences.map((item) => ({ ...item })),
  skills: [...mockParsedCv.skills],
  codingSkills: [...mockParsedCv.coding_skills],
  languages: [...mockParsedCv.languages],
  certifications: mockParsedCv.certifications.map((item) => ({ ...item })),
};

const isBrowser = () => typeof window !== "undefined";

const emitCandidateProfileChange = () => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(candidateProfileEventName));
};

export const cloneLocalCandidateProfile = (profile: LocalCandidateProfile): LocalCandidateProfile => ({
  personalInfo: { ...profile.personalInfo },
  summary: profile.summary,
  education: profile.education.map((item) => ({ ...item })),
  jobExperiences: profile.jobExperiences.map((item) => ({ ...item })),
  internshipExperiences: profile.internshipExperiences.map((item) => ({ ...item })),
  skills: [...profile.skills],
  codingSkills: [...profile.codingSkills],
  languages: [...profile.languages],
  certifications: profile.certifications.map((item) => ({ ...item })),
});

export const getDefaultLocalCandidateProfile = (): LocalCandidateProfile =>
  cloneLocalCandidateProfile(defaultLocalCandidateProfile);

export const readLocalCandidateProfile = (): LocalCandidateProfile => {
  if (!isBrowser()) {
    return getDefaultLocalCandidateProfile();
  }

  try {
    const raw = window.localStorage.getItem(candidateProfileStorageKey);
    if (!raw) {
      return getDefaultLocalCandidateProfile();
    }

    const parsed = JSON.parse(raw) as Partial<LocalCandidateProfile>;
    const fallback = getDefaultLocalCandidateProfile();

    return {
      personalInfo: {
        full_name: parsed.personalInfo?.full_name ?? fallback.personalInfo.full_name,
        email: parsed.personalInfo?.email ?? fallback.personalInfo.email,
        phone: parsed.personalInfo?.phone ?? fallback.personalInfo.phone,
        location: parsed.personalInfo?.location ?? fallback.personalInfo.location,
        linkedin: parsed.personalInfo?.linkedin ?? fallback.personalInfo.linkedin,
      },
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
      education: Array.isArray(parsed.education) && parsed.education.length > 0
        ? parsed.education.map((item) => ({
            degree: item.degree ?? "",
            institution: item.institution ?? "",
            start_date: item.start_date ?? "",
            end_date: item.end_date ?? "",
            description: item.description ?? "",
          }))
        : fallback.education,
      jobExperiences: Array.isArray(parsed.jobExperiences) && parsed.jobExperiences.length > 0
        ? parsed.jobExperiences.map((item) => ({
            title: item.title ?? "",
            company: item.company ?? "",
            start_date: item.start_date ?? "",
            end_date: item.end_date ?? "",
            description: item.description ?? "",
          }))
        : fallback.jobExperiences,
      internshipExperiences: Array.isArray(parsed.internshipExperiences) && parsed.internshipExperiences.length > 0
        ? parsed.internshipExperiences.map((item) => ({
            title: item.title ?? "",
            company: item.company ?? "",
            start_date: item.start_date ?? "",
            end_date: item.end_date ?? "",
            description: item.description ?? "",
          }))
        : fallback.internshipExperiences,
      skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : fallback.skills,
      codingSkills: Array.isArray(parsed.codingSkills) && parsed.codingSkills.length > 0 ? parsed.codingSkills : fallback.codingSkills,
      languages: Array.isArray(parsed.languages) && parsed.languages.length > 0 ? parsed.languages : fallback.languages,
      certifications: Array.isArray(parsed.certifications) && parsed.certifications.length > 0
        ? parsed.certifications.map((item) => ({
            name: item.name ?? "",
            issuer: item.issuer ?? "",
            year: item.year ?? "",
          }))
        : fallback.certifications,
    };
  } catch {
    return getDefaultLocalCandidateProfile();
  }
};

export const writeLocalCandidateProfile = (profile: LocalCandidateProfile) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(candidateProfileStorageKey, JSON.stringify(profile));
  emitCandidateProfileChange();
};

export const getCandidateProfileInitials = (fullName: string): string =>
  fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MC";

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const filledCount = (values: string[]) => values.filter((value) => value.trim().length > 0).length;

export const getCandidateProfileSections = (profile: LocalCandidateProfile): ProfileCompletionSection[] => {
  const personalInfoFields = [
    profile.personalInfo.full_name,
    profile.personalInfo.email,
    profile.personalInfo.phone,
    profile.personalInfo.location,
    profile.personalInfo.linkedin,
  ];

  return [
    {
      label: "Personal information",
      value: clampPercent((filledCount(personalInfoFields) / personalInfoFields.length) * 100),
    },
    {
      label: "Profile summary",
      value: profile.summary.trim() ? 100 : 0,
    },
    {
      label: "Education",
      value: profile.education.length > 0 ? 100 : 0,
    },
    {
      label: "Professional experiences",
      value: profile.jobExperiences.length > 0 ? 100 : 0,
    },
    {
      label: "Internships",
      value: profile.internshipExperiences.length > 0 ? 100 : 0,
    },
    {
      label: "Skills",
      value: clampPercent((profile.skills.length / 8) * 100),
    },
    {
      label: "Coding skills",
      value: clampPercent((profile.codingSkills.length / 8) * 100),
    },
  ];
};

export const getCandidateProfileCompletion = (profile: LocalCandidateProfile): number => {
  const sections = getCandidateProfileSections(profile);
  return clampPercent(
    sections.reduce((total, section) => total + section.value, 0) / Math.max(1, sections.length),
  );
};

const parseYear = (value: string): number | null => {
  const match = value.match(/\d{4}/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getCandidateYearsExperience = (profile: LocalCandidateProfile): number => {
  const years = [...profile.jobExperiences, ...profile.internshipExperiences]
    .map((item) => parseYear(item.start_date))
    .filter((value): value is number => value !== null);

  if (years.length === 0) {
    return 0;
  }

  return Math.max(1, new Date().getFullYear() - Math.min(...years));
};

export const useLocalCandidateProfile = () => {
  const [profile, setProfile] = useState<LocalCandidateProfile>(() => readLocalCandidateProfile());

  useEffect(() => {
    if (!isBrowser()) {
      return undefined;
    }

    const syncProfile = () => {
      setProfile(readLocalCandidateProfile());
    };

    window.addEventListener(candidateProfileEventName, syncProfile);
    window.addEventListener("storage", syncProfile);

    return () => {
      window.removeEventListener(candidateProfileEventName, syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, []);

  return profile;
};
