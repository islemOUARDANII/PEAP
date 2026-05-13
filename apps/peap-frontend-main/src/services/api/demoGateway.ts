import {
  buildDemoMatchingResult,
  buildDemoProfileCandidate,
  demoCandidates,
  demoMatchingModels,
  demoOffers,
  demoParsedOfferResult,
  extractLanguageLevel,
  getCandidateDistanceForOffer,
  getLanguageLabel,
  scoreOfferAgainstCandidate,
  type DemoCandidate,
  type DemoEducationLevel,
  type DemoLanguageLevel,
  type DemoMatchingModel,
  type DemoMatchingResult,
  type DemoOffer,
  type DemoParsedCvResult,
  type DemoParsedOfferResult,
} from "@/demo/demoData";
import {
  gatewayApi,
  type CandidateCvParseResult,
  inferCandidateDisplayName,
  inferCandidateLocation,
  inferLanguageLabel,
  inferSkillLabel,
  type CandidateProfileBundle,
  type EmployerOffer,
  type MatchingModelCriterionRecord,
  type MatchingModelRecord,
  type MatchingModelVersionRecord,
  type MatchingResultDetailRecord,
  type MatchingResultRecord,
  type SearchCandidateResult,
  type SearchOfferResult,
} from "@/services/api/gateway";
import { readDemoCandidateProfile } from "@/services/candidate/demoProfileSession";

export interface SafeApiResult<T> {
  data: T;
  demoMode: boolean;
  errorMessage?: string;
}

export interface DemoOfferSearchItem extends DemoOffer {
  estimatedMatchScore: number;
}

export interface DemoCandidateSearchItem extends DemoCandidate {
  score: number;
}

export interface DemoMatchingRunRecord {
  id: string;
  status: string;
  modelVersionId: string;
  sourceEntityId: string;
  parametersJson: Record<string, unknown>;
}

export interface DemoMatchingExecutionRecord {
  runId: string;
  status: string;
  resultsCount: number;
  warnings: string[];
}

interface SearchOffersSafeParams {
  query?: string;
  location?: string;
  contractType?: string;
  skills?: string[];
  candidateProfile?: DemoParsedCvResult;
}

interface SearchCandidatesSafeParams {
  query?: string;
  location?: string;
  skills?: string[];
  minExperience?: number;
  offer?: DemoOffer | DemoParsedOfferResult;
}

interface GetMatchingResultsSafeParams {
  offer: DemoOffer;
}

export interface ParseCvSafeResult extends SafeApiResult<DemoParsedCvResult> {
  parsedCv: CandidateCvParseResult | null;
}

const educationOrder: Record<DemoEducationLevel, number> = {
  Bac: 1,
  Licence: 2,
  Master: 3,
};

const languageOrder: Record<DemoLanguageLevel, number> = {
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
};

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

const toArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const firstNonEmptyRecord = (...values: unknown[]): Record<string, unknown> =>
  values
    .map((value) => toRecord(value))
    .find((record) => Object.keys(record).length > 0) ?? {};

const toUniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  values.forEach((value) => {
    const normalized = toNullableString(value);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return [...unique];
};

const normalizeScore = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const friendlyErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const inferEducationLevel = (value: string | null | undefined): DemoEducationLevel => {
  const normalized = toStringValue(value).toLowerCase();
  if (normalized.includes("master")) {
    return "Master";
  }
  if (normalized.includes("licence") || normalized.includes("bachelor") || normalized.includes("bac+3")) {
    return "Licence";
  }
  return "Bac";
};

const inferLanguageLevel = (value: string | null | undefined): DemoLanguageLevel => {
  const normalized = toStringValue(value).toUpperCase();
  if (normalized.includes("C1")) {
    return "C1";
  }
  if (normalized.includes("B2")) {
    return "B2";
  }
  if (normalized.includes("B1")) {
    return "B1";
  }
  return "A2";
};

const inferExperienceYears = (value: string | null | undefined): number => {
  const match = toStringValue(value).match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
};

const formatRequirementLabel = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((item) => item[0].toUpperCase() + item.slice(1).toLowerCase())
    .join(" ");

const pickSeedOffer = (index = 0): DemoOffer =>
  demoOffers[index % demoOffers.length];

const pickSeedCandidate = (index = 0): DemoCandidate =>
  demoCandidates[index % demoCandidates.length];

const pickRawString = (raw: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = toNullableString(raw[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickRawArray = (raw: Record<string, unknown>, keys: string[]): string[] => {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => toStringValue(item).trim())
        .filter(Boolean);
    }
  }
  return [];
};

const pickRecordString = (
  record: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = toNullableString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickRecordArray = (
  record: Record<string, unknown>,
  keys: string[],
): Array<Record<string, unknown>> => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => toRecord(item))
        .filter((item) => Object.keys(item).length > 0);
    }
  }
  return [];
};

const buildEmptyParsedCvProfile = (): DemoParsedCvResult => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  title: "",
  summary: "",
  education: "",
  experience: "",
  skills: [],
  languages: [],
});

const extractParsedCvSkills = (parsed: CandidateCvParseResult): string[] => {
  const payload = toRecord(parsed.parsedPayload);
  const cvData = toRecord(payload.cv_data);
  const rawJson = toRecord(payload.raw_json);
  const technicalSkills = [cvData, rawJson]
    .map((source) => toRecord(source.technical_skills))
    .flatMap((grouped) =>
      Object.values(grouped).flatMap((values) =>
        Array.isArray(values)
          ? values.map((value) => toNullableString(value))
          : [],
      ),
    );

  const directSkills = [cvData, rawJson]
    .flatMap((source) => pickRecordArray(source, ["skills"]))
    .map((item) =>
      pickRecordString(item, [
        "skill_node_label",
        "skill_label_raw",
        "raw_label",
        "label",
        "name",
        "skill",
      ]),
    );

  const extractedSkills = toArray(parsed.extractedProfilePatch.skills).map((item) =>
    pickRecordString(toRecord(item), [
      "skill_node_label",
      "skill_label_raw",
      "raw_label",
      "label",
      "name",
      "skill",
      "raw_value",
    ]),
  );

  return toUniqueStrings([...extractedSkills, ...directSkills, ...technicalSkills]);
};

const extractParsedCvLanguages = (parsed: CandidateCvParseResult): string[] => {
  const payload = toRecord(parsed.parsedPayload);
  const cvData = toRecord(payload.cv_data);
  const rawJson = toRecord(payload.raw_json);
  const languageRows = [
    ...toArray(parsed.extractedProfilePatch.languages).map((item) => toRecord(item)),
    ...pickRecordArray(cvData, ["languages"]),
    ...pickRecordArray(rawJson, ["languages"]),
  ];

  return toUniqueStrings(
    languageRows.map((item) =>
      [
        pickRecordString(item, ["language_code", "language", "name"]),
        pickRecordString(item, ["level"]),
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
};

const inferOfferRequirementsFromGateway = (offer: EmployerOffer) => {
  const requirementLabels = (offer.requirements ?? [])
    .map(
      (item) =>
        item.nodeLabel ??
        item.rawValue ??
        formatRequirementLabel(item.criterionType),
    )
    .filter(Boolean) as string[];

  const requiredSkills = (offer.requirements ?? [])
    .filter((item) => item.criterionType.toUpperCase().includes("SKILL"))
    .map((item) => item.nodeLabel ?? item.rawValue ?? "")
    .filter(Boolean);

  const preferredSkills = (offer.requirements ?? [])
    .filter((item) => item.criterionType.toUpperCase().includes("SKILL") && !item.isMust)
    .map((item) => item.nodeLabel ?? item.rawValue ?? "")
    .filter(Boolean);

  const educationRequirement = (offer.requirements ?? []).find((item) =>
    item.criterionType.toUpperCase().includes("EDUC"),
  );
  const experienceRequirement = (offer.requirements ?? []).find((item) =>
    item.criterionType.toUpperCase().includes("EXPERIENCE"),
  );
  const languageRequirement = (offer.requirements ?? []).find((item) =>
    item.criterionType.toUpperCase().includes("LANG"),
  );

  return {
    requirements: requirementLabels,
    requiredSkills,
    preferredSkills,
    educationLevel: inferEducationLevel(
      educationRequirement?.rawValue ?? educationRequirement?.nodeLabel ?? "Bac",
    ),
    minExperienceYears:
      experienceRequirement?.minYears ??
      inferExperienceYears(experienceRequirement?.rawValue) ??
      0,
    maxDistanceKm: 150,
    languageLevel: inferLanguageLevel(
      languageRequirement?.rawValue ?? languageRequirement?.nodeLabel ?? "A2",
    ),
    minScore: 0,
  };
};

const mapGatewayOfferToDemoOffer = (offer: EmployerOffer, index = 0): DemoOffer => {
  const seed = pickSeedOffer(index);
  const inferred = inferOfferRequirementsFromGateway(offer);

  return {
    id: offer.id,
    title: offer.title || seed.title,
    company: offer.employerName ?? "Entreprise",
    description: offer.description ?? "",
    location: offer.locationLabel || "Tunisie",
    contractType: offer.contractType ?? "",
    workMode: offer.workMode ?? "",
    salaryMin: offer.salaryMin ?? 0,
    salaryMax: offer.salaryMax ?? 0,
    salaryLabel:
      offer.salaryMin != null || offer.salaryMax != null
        ? `${offer.salaryMin ?? 0} - ${offer.salaryMax ?? 0} TND`
        : "Non renseigné",
    numberOfPositions: offer.numberOfPositions || 1,
    status: offer.status || "INCONNU",
    ...inferred,
  };
};

const mapGatewaySearchOfferToDemo = (
  offer: SearchOfferResult,
  candidateProfile: DemoParsedCvResult,
  index = 0,
): DemoOfferSearchItem => {
  const seed = pickSeedOffer(index);
  const raw = offer.raw ?? {};
  const company =
    pickRawString(raw, ["employer_name", "company_name", "company", "organization"]) ??
    seed.company;
  const normalizedOffer: DemoOffer = {
    ...seed,
    id: offer.offerId || seed.id,
    title: offer.title || seed.title,
    company,
    description: offer.description ?? seed.description,
    location: offer.location ?? seed.location,
    contractType: offer.contractType ?? seed.contractType,
    workMode: offer.workMode ?? seed.workMode,
    status: offer.status ?? seed.status,
    requiredSkills: offer.skills.length > 0 ? offer.skills : seed.requiredSkills,
    requirements: offer.skills.length > 0 ? offer.skills : seed.requirements,
  };

  const candidate = buildDemoProfileCandidate(candidateProfile);

  return {
    ...normalizedOffer,
    estimatedMatchScore:
      normalizeScore(offer.score) || scoreOfferAgainstCandidate(normalizedOffer, candidate),
  };
};

const mapGatewaySearchCandidateToDemo = (
  result: SearchCandidateResult,
  offer: DemoOffer | DemoParsedOfferResult,
  index = 0,
): DemoCandidateSearchItem => {
  const seed = pickSeedCandidate(index);
  const raw = result.raw ?? {};
  const name =
    pickRawString(raw, ["full_name", "candidate_label", "name", "label"]) ??
    seed.name;
  const location = result.location ?? seed.location;
  const skills = result.skills.length > 0 ? result.skills : seed.skills;
  const educationLevel = inferEducationLevel(result.education ?? seed.educationLevel);
  const yearsExperience = toNumberValue(result.yearsExperience, seed.yearsExperience);
  const languages = result.primaryLang
    ? [{ name: result.primaryLang, level: inferLanguageLevel(result.primaryLang) }]
    : seed.languages;

  const candidate: DemoCandidate = {
    ...seed,
    id: result.candidateId || seed.id,
    name,
    title:
      pickRawString(raw, ["occupation", "occupation_label", "headline", "profile_title"]) ??
      seed.title,
    location,
    educationLevel,
    yearsExperience,
    skills,
    languages,
    summary:
      pickRawString(raw, ["summary", "headline", "profile_summary"]) ?? seed.summary,
  };

  const normalizedOffer: DemoOffer = "salaryMin" in offer
    ? offer
    : {
        ...demoOffers[0],
        ...offer,
      };

  return {
    ...candidate,
    score: normalizeScore(result.score) || buildDemoMatchingResult(normalizedOffer, candidate).score,
  };
};

const mapCriterionWeights = (
  criteria: MatchingModelCriterionRecord[],
  seed: DemoMatchingModel,
) =>
  criteria.length > 0
    ? criteria.map((item) => ({
        label: item.criterionLabel || formatRequirementLabel(item.criterionCode),
        weight: toNumberValue(item.weight, 0),
        isMust: item.isMust,
      }))
    : seed.criteriaWeights;

const selectLatestVersion = (model: MatchingModelRecord): MatchingModelVersionRecord | null => {
  const versions = toArray(model.versions);
  if (versions.length === 0) {
    return null;
  }

  return [...versions].sort((left, right) => right.versionNumber - left.versionNumber)[0];
};

const mapGatewayModelToDemo = async (
  model: MatchingModelRecord,
  index = 0,
): Promise<DemoMatchingModel | null> => {
  const seed = demoMatchingModels[index % demoMatchingModels.length];
  const latestVersion = selectLatestVersion(model);
  if (!latestVersion) {
    return null;
  }

  const criteria =
    latestVersion.criteria.length > 0
      ? latestVersion.criteria
      : await gatewayApi.matchingConfig.listModelCriteria(latestVersion.id);

  return {
    id: `${model.id}-${latestVersion.id}`,
    modelId: model.id,
    name: model.label || model.code || seed.name,
    direction: model.direction || seed.direction,
    versionId: latestVersion.id,
    version: `v${latestVersion.versionNumber}`,
    status: latestVersion.status || (model.active ? "Actif" : "Inactif"),
    criteriaWeights: criteria.length > 0 ? mapCriterionWeights(criteria, seed) : [],
  };
};

const readDetailRawPayload = (detail: MatchingResultDetailRecord): Record<string, unknown> => {
  const rawDetail = detail.metadataJson?.raw_detail;
  return rawDetail && typeof rawDetail === "object"
    ? (rawDetail as Record<string, unknown>)
    : {};
};

const extractMatchedSkillsFromDetails = (details: MatchingResultDetailRecord[]): string[] =>
  details
    .filter(
      (detail) =>
        (detail.criterionCode ?? detail.criterionLabel ?? "").toLowerCase().includes("skill") &&
        detail.matched !== false,
    )
    .map(
      (detail) =>
        toNullableString(readDetailRawPayload(detail).matched_skills) ??
        toNullableString(detail.metadataJson?.matched_skills) ??
        toNullableString(detail.recommendation) ??
        toNullableString(detail.gapMessage) ??
        detail.criterionLabel ??
        detail.criterionCode ??
        "",
    )
    .flatMap((value) =>
      value
        .split(/[,;/]/)
        .map((item) => item.trim())
        .filter(Boolean),
    );

const extractMissingSkillsFromDetails = (details: MatchingResultDetailRecord[]): string[] =>
  details
    .filter(
      (detail) =>
        detail.isGap ||
        (detail.criterionCode ?? detail.criterionLabel ?? "").toLowerCase().includes("skill"),
    )
    .map(
      (detail) =>
        toNullableString(readDetailRawPayload(detail).missing_skills) ??
        toNullableString(detail.metadataJson?.missing_skills) ??
        detail.gapMessage ??
        detail.recommendation ??
        "",
    )
    .flatMap((value) =>
      value
        .split(/[,;/]/)
        .map((item) => item.replace(/^Compétence manquante :/i, "").trim())
        .filter(Boolean),
    );

const computeExperienceYearsFromBundle = (bundle: CandidateProfileBundle): number =>
  Math.max(
    0,
    Math.round(
      bundle.experience.reduce(
        (total, item) => total + Math.max(0, (item.durationMonths ?? 0) / 12),
        0,
      ),
    ),
  );

const inferEducationLevelFromBundle = (bundle: CandidateProfileBundle): DemoEducationLevel =>
  inferEducationLevel(
    bundle.education[0]?.diplomaLabel ??
      bundle.education[0]?.levelLabel ??
      bundle.education[0]?.levelCode,
  );

const inferDistanceKmFromCandidate = (
  location: string,
  offer: DemoOffer,
  fallback: number,
): number =>
  getCandidateDistanceForOffer(
    {
      id: "matching-result-candidate",
      name: "Candidate",
      title: "",
      location,
      email: "",
      phone: "",
      educationLevel: "Bac",
      yearsExperience: 0,
      skills: [],
      languages: [],
      distanceKm: fallback,
      summary: "",
    },
    offer,
  );

const buildCriterionDetailsText = (detail: MatchingResultDetailRecord): string => {
  if (detail.gapMessage) {
    return detail.gapMessage;
  }

  if (detail.recommendation) {
    return detail.recommendation;
  }

  const raw = readDetailRawPayload(detail);
  const parts = toUniqueStrings([
    typeof raw.match_type === "string" ? `match: ${raw.match_type}` : null,
    typeof raw.must_have_rate === "number"
      ? `must-have ${Math.round(raw.must_have_rate * 100)}%`
      : null,
    typeof raw.nice_to_have_rate === "number"
      ? `nice-to-have ${Math.round(raw.nice_to_have_rate * 100)}%`
      : null,
    typeof raw.degree_level_fit === "number"
      ? `niveau ${Math.round(raw.degree_level_fit * 100)}%`
      : null,
    typeof raw.years_fit === "number"
      ? `experience ${Math.round(raw.years_fit * 100)}%`
      : null,
    typeof raw.coverage === "number"
      ? `couverture ${Math.round(raw.coverage * 100)}%`
      : null,
  ]);

  return parts.join(" · ") || "Information détaillée non fournie par le backend.";
};

const mapGatewayMatchingResultToDemo = (
  result: MatchingResultRecord,
  details: MatchingResultDetailRecord[],
  offer: DemoOffer,
  candidateBundle: CandidateProfileBundle | null,
): DemoMatchingResult | null => {
  const explanation = result.explanationJson ?? {};
  const candidateName =
    (candidateBundle ? inferCandidateDisplayName(candidateBundle) : null) ??
    result.candidateLabel ??
    toNullableString(explanation.candidate_name);

  if (!candidateName) {
    return null;
  }

  const profileTitle =
    candidateBundle?.experience[0]?.jobTitleRaw ??
    pickRawString(explanation, ["title", "profile_title", "headline", "occupation"]) ??
    candidateBundle?.education[0]?.diplomaLabel ??
    "Profil candidat";
  const location =
    (candidateBundle ? inferCandidateLocation(candidateBundle) : null) ??
    pickRawString(explanation, ["location", "city", "governorate"]) ??
    "Non renseignée";
  const bundleSkills = candidateBundle
    ? toUniqueStrings(candidateBundle.skills.map((skill) => inferSkillLabel(skill)))
    : [];
  const rawSkills = pickRawArray(explanation, ["skills", "matched_skills", "candidate_skills"]);
  const allSkills = bundleSkills.length > 0 ? bundleSkills : rawSkills;
  const normalizedSkills = new Set(allSkills.map(normalizeName));
  const matchedSkills = toUniqueStrings([
    ...extractMatchedSkillsFromDetails(details),
    ...offer.requiredSkills.filter((skill) => normalizedSkills.has(normalizeName(skill))),
  ]);
  const missingSkills = toUniqueStrings([
    ...extractMissingSkillsFromDetails(details),
    ...offer.requiredSkills.filter((skill) => !normalizedSkills.has(normalizeName(skill))),
  ]);
  const languageDetails = candidateBundle
    ? toUniqueStrings(candidateBundle.languages.map((language) => inferLanguageLabel(language)))
    : pickRawArray(explanation, ["languages", "candidate_languages"]);
  const yearsExperience = candidateBundle
    ? computeExperienceYearsFromBundle(candidateBundle)
    : toNumberValue(explanation.years_experience, 0);
  const educationLevel = candidateBundle
    ? inferEducationLevelFromBundle(candidateBundle)
    : inferEducationLevel(
        pickRawString(explanation, ["education_level", "education", "diploma"]),
      );
  const distanceKm = toNumberValue(
    explanation.distance_km,
    inferDistanceKmFromCandidate(location, offer, 0),
  );

  const criteria = details.length > 0
    ? details.map((detail) => ({
        label: detail.criterionLabel ?? detail.criterionCode ?? "Critère",
        score: normalizeScore(detail.score),
        matched: detail.matched !== false && !detail.isGap,
        details: buildCriterionDetailsText(detail),
      }))
    : [
        {
          label: "Score global",
          score: normalizeScore(result.scoreGlobal),
          matched: true,
          details: result.explanationShort ?? "Résultat retourné par le moteur.",
        },
      ];

  return {
    id: result.id,
    rank: result.rank,
    candidateId: result.candidateId ?? result.id,
    candidateName,
    title: profileTitle,
    location,
    distanceKm,
    educationLevel,
    yearsExperience,
    skills: allSkills,
    languages: languageDetails,
    score: normalizeScore(result.scoreGlobal),
    matchedSkills,
    missingSkills,
    gaps: missingSkills.map((skill) => `Compétence manquante : ${skill}`),
    status: normalizeScore(result.scoreGlobal) >= 75 ? "Compatible" : "À revoir",
    matchedItems: matchedSkills,
    missingItems: missingSkills,
    recommendation:
      result.explanationShort ?? "Résultat récupéré depuis le moteur de matching.",
    criteria,
  };
};

const filterOffers = (
  offers: DemoOfferSearchItem[],
  params: SearchOffersSafeParams,
) => {
  const normalizedQuery = normalizeName(params.query ?? "");
  const normalizedLocation = normalizeName(params.location ?? "");
  const normalizedSkills = toArray(params.skills).map(normalizeName);

  return offers
    .filter((offer) => {
      if (
        normalizedQuery &&
        !normalizeName(
          [offer.title, offer.company, offer.description, ...offer.requiredSkills].join(" "),
        ).includes(normalizedQuery)
      ) {
        return false;
      }

      if (
        normalizedLocation &&
        !normalizeName(offer.location).includes(normalizedLocation)
      ) {
        return false;
      }

      if (
        params.contractType &&
        params.contractType !== "all" &&
        normalizeName(offer.contractType) !== normalizeName(params.contractType)
      ) {
        return false;
      }

      if (
        normalizedSkills.length > 0 &&
        !normalizedSkills.some((skill) =>
          offer.requiredSkills.some((requiredSkill) => normalizeName(requiredSkill) === skill),
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.estimatedMatchScore - left.estimatedMatchScore);
};

const filterCandidates = (
  candidates: DemoCandidateSearchItem[],
  params: SearchCandidatesSafeParams,
) => {
  const normalizedQuery = normalizeName(params.query ?? "");
  const normalizedLocation = normalizeName(params.location ?? "");
  const normalizedSkills = toArray(params.skills).map(normalizeName);

  return candidates
    .filter((candidate) => {
      if (
        normalizedQuery &&
        !normalizeName(
          [candidate.name, candidate.title, candidate.summary, ...candidate.skills].join(" "),
        ).includes(normalizedQuery)
      ) {
        return false;
      }

      if (
        normalizedLocation &&
        !normalizeName(candidate.location).includes(normalizedLocation)
      ) {
        return false;
      }

      if (
        typeof params.minExperience === "number" &&
        candidate.yearsExperience < params.minExperience
      ) {
        return false;
      }

      if (
        normalizedSkills.length > 0 &&
        !normalizedSkills.every((skill) =>
          candidate.skills.some((candidateSkill) => normalizeName(candidateSkill) === skill),
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.score - left.score);
};

export async function getMatchingModelsSafe(): Promise<SafeApiResult<DemoMatchingModel[]>> {
  try {
    const models = await gatewayApi.matchingConfig.listModels();
    const normalizedModels = (
      await Promise.all(models.map((model, index) => mapGatewayModelToDemo(model, index)))
    ).filter(Boolean) as DemoMatchingModel[];

    if (normalizedModels.length === 0) {
      throw new Error("Aucun modèle exploitable n'a été trouvé.");
    }

    return {
      data: normalizedModels,
      demoMode: false,
    };
  } catch (error) {
    return {
      data: [],
      demoMode: false,
      errorMessage: friendlyErrorMessage(
        error,
        "Les modèles réels ne sont pas disponibles pour le moment.",
      ),
    };
  }
}

export async function getAdvisorOfferDetailSafe(offerId: string): Promise<DemoOffer | null> {
  try {
    const offer = await gatewayApi.advisor.getOffer(offerId);
    return mapGatewayOfferToDemoOffer(offer, 0);
  } catch {
    return null;
  }
}

export async function getAdvisorOffersSafe(): Promise<SafeApiResult<DemoOffer[]>> {
  try {
    const offers = await gatewayApi.advisor.listOffers();
    if ((offers ?? []).length === 0) {
      throw new Error("Aucune offre conseiller n'a été trouvée.");
    }

    return {
      data: (offers ?? []).map((offer, index) => mapGatewayOfferToDemoOffer(offer, index)),
      demoMode: false,
    };
  } catch (error) {
    return {
      data: [],
      demoMode: false,
      errorMessage: friendlyErrorMessage(
        error,
        "Les offres réelles sont momentanément indisponibles.",
      ),
    };
  }
}

export async function parseCvSafe(
  cvRecordId?: string,
): Promise<ParseCvSafeResult> {
  try {
    if (!cvRecordId) {
      throw new Error("Identifiant de CV indisponible.");
    }

    const parsed = await gatewayApi.candidate.parseCv(cvRecordId);
    const payload = toRecord(parsed.parsedPayload);
    const cvData = toRecord(payload.cv_data);
    const rawJson = toRecord(payload.raw_json);
    const identity = parsed.extractedProfilePatch.identity ?? {};
    const personalInfo = firstNonEmptyRecord(
      cvData.personal_info,
      rawJson.personal_info,
      payload.personal_info,
    );
    const educationRows = [
      ...toArray(parsed.extractedProfilePatch.education).map((item) => toRecord(item)),
      ...pickRecordArray(cvData, ["education"]),
      ...pickRecordArray(rawJson, ["education"]),
    ];
    const experienceRows = [
      ...toArray(parsed.extractedProfilePatch.experience).map((item) => toRecord(item)),
      ...pickRecordArray(cvData, ["experience", "job_experiences", "stages"]),
      ...pickRecordArray(rawJson, ["experience", "job_experiences", "stages"]),
    ];
    const educationEntry = educationRows[0] ?? {};
    const experienceEntry = experienceRows[0] ?? {};
    const skills = extractParsedCvSkills(parsed);
    const languages = extractParsedCvLanguages(parsed);

    const fullName =
      pickRecordString(personalInfo, ["full_name", "name"]) ??
      toNullableString(identity.full_name) ??
      [
        toNullableString(identity.first_name),
        toNullableString(identity.last_name),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
    const [firstName, ...lastNameParts] = fullName ? fullName.split(/\s+/) : [];
    const nextProfile: DemoParsedCvResult = {
      firstName: firstName ?? "",
      lastName: lastNameParts.join(" "),
      email:
        pickRecordString(personalInfo, ["email"]) ??
        toNullableString(identity.email) ??
        toNullableString(payload.email) ??
        "",
      phone:
        pickRecordString(personalInfo, ["phone", "mobile", "telephone"]) ??
        toNullableString(identity.phone) ??
        toNullableString(payload.phone) ??
        "",
      location:
        pickRecordString(personalInfo, ["location", "address"]) ??
        toNullableString(identity.location) ??
        toNullableString(payload.location) ??
        "",
      title:
        pickRecordString(experienceEntry, [
          "job_title_raw",
          "job_title",
          "title",
          "role",
        ]) ??
        toNullableString(payload.profile_title) ??
        "",
      summary:
        pickRecordString(cvData, ["summary", "profile", "profile_summary"]) ??
        pickRecordString(rawJson, ["summary", "profile", "profile_summary"]) ??
        toNullableString(payload.summary) ??
        "",
      education:
        pickRecordString(educationEntry, [
          "diploma_label",
          "level_label",
          "degree",
          "diploma",
          "education_label",
          "field",
          "major",
          "raw_value",
        ]) ?? "",
      experience:
        pickRecordString(experienceEntry, [
          "description",
          "job_title_raw",
          "job_title",
          "title",
          "role",
          "raw_value",
        ]) ??
        toNullableString(payload.experience_summary) ??
        "",
      skills,
      languages,
    };

    const hasMeaningfulContent = Boolean(
      nextProfile.firstName ||
        nextProfile.lastName ||
        nextProfile.email ||
        nextProfile.phone ||
        nextProfile.location ||
        nextProfile.title ||
        nextProfile.summary ||
        nextProfile.education ||
        nextProfile.experience ||
        nextProfile.skills.length > 0 ||
        nextProfile.languages.length > 0,
    );

    if (!hasMeaningfulContent) {
      throw new Error("Le parsing n'a pas produit assez de données exploitables.");
    }

    return {
      data: nextProfile,
      demoMode: false,
      parsedCv: parsed,
    };
  } catch (error) {
    return {
      data: buildEmptyParsedCvProfile(),
      demoMode: true,
      errorMessage: friendlyErrorMessage(
        error,
        "Le parsing du CV n'est pas disponible pour le moment.",
      ),
      parsedCv: null,
    };
  }
}

export async function parseOfferSafe(
  rawText: string,
  title?: string,
): Promise<SafeApiResult<DemoParsedOfferResult>> {
  try {
    const parsed = await gatewayApi.employer.parseOfferDraft({
      raw_text: rawText,
      title: title ?? null,
    });
    const draft = parsed.draft ?? {};
    const requirements = toArray(draft.requirements)
      .map((item) =>
        toNullableString(
          item.node_label ?? item.raw_value ?? item.label ?? item.value,
        ),
      )
      .filter(Boolean) as string[];
    const requiredSkills = requirements.filter(
      (item) =>
        !/licence|master|bac|francais|anglais|experience|distance/i.test(item),
    );

    const normalizedOffer: DemoParsedOfferResult = {
      title: toStringValue(draft.title || title || demoParsedOfferResult.title),
      description:
        toStringValue(draft.description || rawText || demoParsedOfferResult.description),
      location: toStringValue(draft.governorate_label || draft.location || demoParsedOfferResult.location),
      contractType: toStringValue(draft.contract_type || demoParsedOfferResult.contractType),
      workMode: toStringValue(draft.work_mode || demoParsedOfferResult.workMode),
      salaryMin: toNumberValue(draft.salary_min, demoParsedOfferResult.salaryMin),
      salaryMax: toNumberValue(draft.salary_max, demoParsedOfferResult.salaryMax),
      salaryLabel:
        draft.salary_min || draft.salary_max
          ? `${toNumberValue(draft.salary_min, demoParsedOfferResult.salaryMin)} - ${toNumberValue(
              draft.salary_max,
              demoParsedOfferResult.salaryMax,
            )} TND`
          : demoParsedOfferResult.salaryLabel,
      numberOfPositions: toNumberValue(
        draft.number_of_positions,
        demoParsedOfferResult.numberOfPositions,
      ),
      requirements: requirements.length > 0 ? requirements : demoParsedOfferResult.requirements,
      requiredSkills:
        requiredSkills.length > 0 ? requiredSkills.slice(0, 6) : demoParsedOfferResult.requiredSkills,
      preferredSkills: [...demoParsedOfferResult.preferredSkills],
      educationLevel: inferEducationLevel(
        toNullableString(draft.education_level) ?? demoParsedOfferResult.educationLevel,
      ),
      minExperienceYears: toNumberValue(
        draft.min_years_experience,
        demoParsedOfferResult.minExperienceYears,
      ),
      maxDistanceKm: demoParsedOfferResult.maxDistanceKm,
      languageLevel: inferLanguageLevel(
        requirements.find((item) => /a2|b1|b2|c1/i.test(item)) ??
          demoParsedOfferResult.languageLevel,
      ),
      minScore: demoParsedOfferResult.minScore,
    };

    if (!normalizedOffer.title.trim()) {
      throw new Error("Le parsing n'a pas remonté de titre exploitable.");
    }

    return {
      data: normalizedOffer,
      demoMode: false,
    };
  } catch (error) {
    return {
      data: demoParsedOfferResult,
      demoMode: true,
      errorMessage: friendlyErrorMessage(
        error,
        "La génération d'offre est indisponible pour le moment.",
      ),
    };
  }
}

export async function searchOffersSafe(
  params: SearchOffersSafeParams = {},
): Promise<SafeApiResult<DemoOfferSearchItem[]>> {
  const candidateProfile = params.candidateProfile ?? readDemoCandidateProfile();
  const demoCandidate = buildDemoProfileCandidate(candidateProfile);

  try {
    const response = await gatewayApi.search.offers({
      query: params.query ?? "",
      size: 24,
      contract_type:
        params.contractType && params.contractType !== "all"
          ? params.contractType
          : undefined,
      governorate: params.location || undefined,
    });

    const mapped = (response.results ?? []).map((offer, index) =>
      mapGatewaySearchOfferToDemo(offer, candidateProfile, index),
    );

    if (mapped.length === 0) {
      throw new Error("Aucune offre exploitable n'a été remontée.");
    }

    return {
      data: filterOffers(mapped, params),
      demoMode: false,
    };
  } catch (error) {
    const fallback = demoOffers.map((offer) => ({
      ...offer,
      estimatedMatchScore: scoreOfferAgainstCandidate(offer, demoCandidate),
    }));

    return {
      data: filterOffers(fallback, params),
      demoMode: true,
      errorMessage: friendlyErrorMessage(
        error,
        "La recherche d'offres réelle est indisponible.",
      ),
    };
  }
}

export async function searchCandidatesSafe(
  params: SearchCandidatesSafeParams = {},
): Promise<SafeApiResult<DemoCandidateSearchItem[]>> {
  const normalizedOffer = "salaryMin" in (params.offer ?? {})
    ? (params.offer as DemoOffer)
    : {
        ...demoOffers[0],
        ...(params.offer ?? {}),
      };

  try {
    const response = await gatewayApi.search.candidates({
      query: params.query ?? "",
      filters: {
        location: params.location || undefined,
        min_experience: params.minExperience,
        skills: params.skills,
        size: 24,
      },
    });

    const mapped = (response.results ?? []).map((candidate, index) =>
      mapGatewaySearchCandidateToDemo(candidate, normalizedOffer, index),
    );

    if (mapped.length === 0) {
      throw new Error("Aucun candidat exploitable n'a été trouvé.");
    }

    return {
      data: filterCandidates(mapped, params),
      demoMode: false,
    };
  } catch (error) {
    const fallback = demoCandidates.map((candidate) => ({
      ...candidate,
      score: buildDemoMatchingResult(normalizedOffer, candidate).score,
    }));

    return {
      data: filterCandidates(fallback, params),
      demoMode: true,
      errorMessage: friendlyErrorMessage(
        error,
        "La recherche de candidats réelle est indisponible.",
      ),
    };
  }
}

export async function createMatchingRunSafe(
  payload: Record<string, unknown>,
): Promise<SafeApiResult<DemoMatchingRunRecord>> {
  try {
    const run = await gatewayApi.matching.createRun(payload);

    return {
      data: {
        id: run.id,
        status: run.status,
        modelVersionId: run.modelVersionId,
        sourceEntityId: run.sourceEntityId,
        parametersJson: run.parametersJson,
      },
      demoMode: false,
    };
  } catch (error) {
    throw new Error(
      friendlyErrorMessage(
        error,
        "Le moteur de matching n'a pas pu créer une exécution réelle.",
      ),
    );
  }
}

export async function executeMatchingRunSafe(
  runId: string,
): Promise<SafeApiResult<DemoMatchingExecutionRecord>> {
  try {
    const execution = await gatewayApi.matching.executeRun(runId, {
      dry_run: false,
      admin_override: true,
    });

    return {
      data: {
        runId: execution.runId,
        status: execution.status,
        resultsCount: execution.resultsCount,
        warnings: execution.warnings,
      },
      demoMode: false,
    };
  } catch (error) {
    throw new Error(
      friendlyErrorMessage(
        error,
        "L'exécution réelle du matching a échoué.",
      ),
    );
  }
}

export async function getMatchingResultsSafe(
  runId: string,
  params: GetMatchingResultsSafeParams,
): Promise<SafeApiResult<DemoMatchingResult[]>> {
  try {
    const results = await gatewayApi.matching.listResults(runId);
    const topResults = (results ?? []).slice(0, 10);
    const candidateIds = toUniqueStrings(
      topResults.map((result) => result.candidateId ?? null),
    );
    const candidateProfiles = new Map<string, CandidateProfileBundle | null>(
      await Promise.all(
        candidateIds.map(async (candidateId) => {
          try {
            const profile = await gatewayApi.advisor.getCandidate(candidateId);
            return [candidateId, profile] as const;
          } catch {
            return [candidateId, null] as const;
          }
        }),
      ),
    );
    const mappedResults = (
      await Promise.all(
        topResults.map(async (result) => {
          const detailResponse = await gatewayApi.matching
            .getResult(result.id)
            .catch(() => ({ result, details: [] as MatchingResultDetailRecord[] }));

          return mapGatewayMatchingResultToDemo(
            detailResponse.result,
            detailResponse.details,
            params.offer,
            result.candidateId ? candidateProfiles.get(result.candidateId) ?? null : null,
          );
        }),
      )
    ).filter(Boolean) as DemoMatchingResult[];

    if (mappedResults.length === 0) {
      throw new Error("Les résultats remontés ne sont pas assez lisibles pour la démonstration.");
    }

    return {
      data: mappedResults
        .sort((left, right) => right.score - left.score)
        .map((result, index) => ({ ...result, rank: index + 1 })),
      demoMode: false,
    };
  } catch (error) {
    throw new Error(
      friendlyErrorMessage(
        error,
        "Les résultats réels du matching ne sont pas exploitables.",
      ),
    );
  }
}

export const getBestLanguageForCandidate = (candidate: DemoCandidate): DemoLanguageLevel =>
  candidate.languages.reduce<DemoLanguageLevel>(
    (current, language) =>
      languageOrder[language.level] > languageOrder[current]
        ? language.level
        : current,
    "A2",
  );

export const isCandidateWithinEducationThreshold = (
  candidate: DemoCandidate,
  educationLevel: DemoEducationLevel,
) => educationOrder[candidate.educationLevel] >= educationOrder[educationLevel];

export const isCandidateWithinLanguageThreshold = (
  candidate: DemoCandidate,
  languageLevel: DemoLanguageLevel,
) => languageOrder[getBestLanguageForCandidate(candidate)] >= languageOrder[languageLevel];

export const getMatchedSkillsForOffer = (candidate: DemoCandidate, offer: DemoOffer) =>
  offer.requiredSkills.filter((skill) => candidate.skills.includes(skill));

export const getDistanceForOffer = (candidate: DemoCandidate, offer: DemoOffer) =>
  getCandidateDistanceForOffer(candidate, offer);
