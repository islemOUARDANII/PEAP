import {
  demoParsedCvResult,
  type DemoParsedCvResult,
} from "@/demo/demoData";

const demoCandidateProfileStorageKey = "matchcore.demo.candidate-profile";

const isBrowser = () => typeof window !== "undefined";

export const defaultDemoCandidateProfile: DemoParsedCvResult = {
  ...demoParsedCvResult,
  skills: [...demoParsedCvResult.skills],
  languages: [...demoParsedCvResult.languages],
};

const normalizeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

export const cloneDemoCandidateProfile = (
  profile: DemoParsedCvResult,
): DemoParsedCvResult => ({
  ...profile,
  skills: [...profile.skills],
  languages: [...profile.languages],
});

export const readDemoCandidateProfile = (): DemoParsedCvResult => {
  if (!isBrowser()) {
    return cloneDemoCandidateProfile(defaultDemoCandidateProfile);
  }

  try {
    const rawValue = window.localStorage.getItem(demoCandidateProfileStorageKey);
    if (!rawValue) {
      return cloneDemoCandidateProfile(defaultDemoCandidateProfile);
    }

    const parsed = JSON.parse(rawValue) as Partial<DemoParsedCvResult>;

    return {
      firstName: String(parsed.firstName ?? defaultDemoCandidateProfile.firstName),
      lastName: String(parsed.lastName ?? defaultDemoCandidateProfile.lastName),
      email: String(parsed.email ?? defaultDemoCandidateProfile.email),
      phone: String(parsed.phone ?? defaultDemoCandidateProfile.phone),
      location: String(parsed.location ?? defaultDemoCandidateProfile.location),
      title: String(parsed.title ?? defaultDemoCandidateProfile.title),
      summary: String(parsed.summary ?? defaultDemoCandidateProfile.summary),
      education: String(parsed.education ?? defaultDemoCandidateProfile.education),
      experience: String(parsed.experience ?? defaultDemoCandidateProfile.experience),
      skills:
        normalizeList(parsed.skills).length > 0
          ? normalizeList(parsed.skills)
          : [...defaultDemoCandidateProfile.skills],
      languages:
        normalizeList(parsed.languages).length > 0
          ? normalizeList(parsed.languages)
          : [...defaultDemoCandidateProfile.languages],
    };
  } catch {
    return cloneDemoCandidateProfile(defaultDemoCandidateProfile);
  }
};

export const writeDemoCandidateProfile = (profile: DemoParsedCvResult) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    demoCandidateProfileStorageKey,
    JSON.stringify(cloneDemoCandidateProfile(profile)),
  );
};
