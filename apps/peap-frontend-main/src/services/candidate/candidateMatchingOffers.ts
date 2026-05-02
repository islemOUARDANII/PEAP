import {
  gatewayApi,
  type EmployerOffer,
  type EmployerOfferRequirement,
  type MatchingModelRecord,
  type MatchingModelVersionRecord,
  type MatchingResultRecord,
} from '@/services/api/gateway';

const ACTIVE_OFFER_STATUS = 'ACTIVE';

const FINAL_MATCHING_RUN_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

const MATCHING_UNAVAILABLE_MESSAGE =
  "Le moteur de matching n'est pas encore disponible.";

export interface CandidateMatchedOfferSummary {
  matchingResultId: string;
  offerId: string;
  title: string;
  companyName: string;
  location: string;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  skills: string[];
  languages: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  companyDetails: string[];
  scoreGlobal: number;
  scoreRuleBased: number | null;
  scoreSemantic: number | null;
  rank: number;
  explanationShort: string | null;
  explanationJson: Record<string, unknown>;
  eligibilityStatus: string;
  decisionStatus: string;
  publishedAt: string | null;
  status: string | null;
}

export interface CandidateMatchingOffersData {
  matchingAvailable: boolean;
  activeOffersCount: number | null;
  offers: CandidateMatchedOfferSummary[];
  unavailableMessage: string | null;
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const normalizeScore = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const cleanText = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (
    !normalized ||
    /^(non specifie|non spécifié|not specified|null|undefined|n\/a)$/i.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const uniqueStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

const extractReadableValues = (value: unknown): string[] => {
  const text = cleanText(value);
  if (text) {
    return [text];
  }

  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.flatMap((item) => extractReadableValues(item))),
    );
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  const languageLabel = cleanText(
    record.language_label_fr ??
      record.language_label_en ??
      record.language ??
      record.code,
  );
  const levelLabel = cleanText(
    record.level_label_fr ??
      record.level_label_en ??
      record.level ??
      record.min_level,
  );

  if (languageLabel) {
    return [levelLabel ? `${languageLabel} - ${levelLabel}` : languageLabel];
  }

  return Array.from(
    new Set(
      [
        record.label,
        record.name,
        record.title,
        record.raw_value,
        record.value,
        record.display_value,
        record.node_label,
        record.description,
      ].flatMap((candidate) => extractReadableValues(candidate)),
    ),
  );
};

const extractExplanationValues = (
  explanation: Record<string, unknown>,
  keys: string[],
): string[] =>
  Array.from(
    new Set(keys.flatMap((key) => extractReadableValues(explanation[key]))),
  );

const pickExplanationText = (
  explanation: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = cleanText(explanation[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const isCandidateToOffersDirection = (direction: string): boolean =>
  direction.trim().toUpperCase().startsWith('CANDIDATE_TO');

const isPublishedOrActiveVersion = (
  version: MatchingModelVersionRecord,
): boolean => ['PUBLISHED', 'ACTIVE', 'READY'].includes(version.status.toUpperCase());

const isActiveOffer = (offer: EmployerOffer): boolean =>
  offer.status.trim().toUpperCase() === ACTIVE_OFFER_STATUS;

const requirementTypeMatches = (
  requirement: EmployerOfferRequirement,
  ...expectedTypes: string[]
): boolean => {
  const normalized = requirement.criterionType.trim().toUpperCase();
  return expectedTypes.some((expectedType) => normalized.includes(expectedType));
};

const extractRequirementLabels = (
  offer: EmployerOffer | undefined,
  expectedTypes: string[],
): string[] => {
  if (!offer) {
    return [];
  }

  return uniqueStrings(
    offer.requirements
      .filter((requirement) =>
        requirementTypeMatches(requirement, ...expectedTypes),
      )
      .map(
        (requirement) =>
          requirement.nodeLabel ??
          requirement.rawValue ??
          requirement.criterionType,
      ),
  );
};

const formatContractTypeLabel = (
  value: string | null | undefined,
): string | null => {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  const labels: Record<string, string> = {
    cdi: 'CDI',
    cdd: 'CDD',
    freelance: 'Freelance',
    interim: 'Intérim',
    alternance: 'Alternance',
    stage: 'Stage',
    internship: 'Stage',
    part_time: 'Temps partiel',
    full_time: 'Temps plein',
  };

  return labels[normalized] ?? normalized.replace(/[_-]+/g, ' ');
};

const formatWorkModeLabel = (value: string | null | undefined): string | null => {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  const labels: Record<string, string> = {
    remote: 'Télétravail',
    hybrid: 'Hybride',
    onsite: 'Sur site',
    on_site: 'Sur site',
    presential: 'Sur site',
  };

  return labels[normalized] ?? normalized.replace(/[_-]+/g, ' ');
};

const buildCompanyDetails = (
  offer: EmployerOffer | undefined,
  explanation: Record<string, unknown>,
): string[] =>
  uniqueStrings([
    offer?.warning ?? null,
    offer?.actionReason ?? null,
    ...extractExplanationValues(explanation, [
      'company_details',
      'company_information',
      'company_description',
      'employer_description',
      'website_url',
    ]),
  ]);

const mapMatchingResultToOfferSummary = (
  result: MatchingResultRecord,
  offer: EmployerOffer | undefined,
): CandidateMatchedOfferSummary | null => {
  const explanation = result.explanationJson ?? {};
  const offerId = cleanText(result.offerId) ?? offer?.id ?? result.id;
  const title =
    cleanText(result.offerTitle) ??
    cleanText(offer?.title) ??
    pickExplanationText(explanation, ['offer_title', 'title', 'job_title']) ??
    'Offre non renseignée';

  const companyName =
    cleanText(offer?.employerName) ??
    pickExplanationText(explanation, [
      'company_name',
      'employer_name',
      'company',
      'organization_name',
    ]) ??
    'Entreprise non renseignée';

  const location =
    cleanText(offer?.locationLabel) ??
    pickExplanationText(explanation, [
      'location',
      'display_location',
      'city',
      'governorate',
    ]) ??
    'Non renseigné';

  const contractType =
    formatContractTypeLabel(offer?.contractType) ??
    formatContractTypeLabel(
      pickExplanationText(explanation, ['contract_type', 'employment_type']),
    );

  const workMode =
    formatWorkModeLabel(offer?.workMode) ??
    formatWorkModeLabel(
      pickExplanationText(explanation, ['work_mode', 'work_arrangement']),
    );

  const skills = uniqueStrings([
    ...extractRequirementLabels(offer, ['SKILL', 'TECHNOLOGY', 'TOOL']),
    ...extractExplanationValues(explanation, [
      'skills',
      'required_skills',
      'offer_skills',
    ]),
  ]);

  const languages = uniqueStrings([
    ...extractRequirementLabels(offer, ['LANGUAGE']),
    ...extractExplanationValues(explanation, [
      'languages',
      'required_languages',
      'language_requirements',
    ]),
  ]);

  const educationRequirements = uniqueStrings([
    ...extractRequirementLabels(offer, ['EDUCATION', 'DIPLOMA']),
    ...extractExplanationValues(explanation, [
      'education',
      'education_level',
      'required_education',
      'diploma',
    ]),
  ]);

  const experienceRequirements = uniqueStrings([
    ...extractRequirementLabels(offer, ['EXPERIENCE']),
    ...extractExplanationValues(explanation, [
      'required_experience',
      'experience_required',
      'years_experience',
    ]),
  ]);

  return {
    matchingResultId: result.id,
    offerId,
    title,
    companyName,
    location,
    contractType,
    workMode,
    description:
      cleanText(offer?.description) ??
      pickExplanationText(explanation, [
        'offer_description',
        'description',
        'summary',
      ]),
    skills,
    languages,
    educationRequirements,
    experienceRequirements,
    companyDetails: buildCompanyDetails(offer, explanation),
    scoreGlobal: normalizeScore(result.scoreGlobal),
    scoreRuleBased:
      result.scoreRuleBased == null
        ? null
        : normalizeScore(result.scoreRuleBased),
    scoreSemantic:
      result.scoreSemantic == null ? null : normalizeScore(result.scoreSemantic),
    rank: result.rank,
    explanationShort: cleanText(result.explanationShort),
    explanationJson: explanation,
    eligibilityStatus: result.eligibilityStatus,
    decisionStatus: result.decisionStatus,
    publishedAt: offer?.publishedAt ?? offer?.createdAt ?? null,
    status: offer?.status ?? null,
  };
};

const sortMatchedOffers = (
  left: CandidateMatchedOfferSummary,
  right: CandidateMatchedOfferSummary,
): number => {
  if (right.scoreGlobal !== left.scoreGlobal) {
    return right.scoreGlobal - left.scoreGlobal;
  }

  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  return left.title.localeCompare(right.title);
};

const getOptionalActiveOffersCatalog = async (): Promise<{
  activeOffersCount: number | null;
  offersById: Map<string, EmployerOffer>;
}> => {
  try {
    const offers = await gatewayApi.advisor.listOffers();
    return {
      activeOffersCount: offers.filter(isActiveOffer).length,
      offersById: new Map(offers.map((offer) => [offer.id, offer])),
    };
  } catch {
    return {
      activeOffersCount: null,
      offersById: new Map<string, EmployerOffer>(),
    };
  }
};

const loadModelVersions = async (
  model: MatchingModelRecord,
): Promise<MatchingModelVersionRecord[]> => {
  if (model.versions.length > 0) {
    return model.versions;
  }

  return gatewayApi.matchingConfig.listVersions(model.id);
};

const selectCandidateToOffersModel = async (): Promise<{
  model: MatchingModelRecord;
  version: MatchingModelVersionRecord;
}> => {
  const models = await gatewayApi.matchingConfig.listModels();
  const candidateModels = models.filter(
    (model) => model.active && isCandidateToOffersDirection(model.direction),
  );

  if (candidateModels.length === 0) {
    throw new Error("Aucun modèle de matching candidat vers offres n'est disponible.");
  }

  const versionCandidates = (
    await Promise.all(
      candidateModels.map(async (model) => ({
        model,
        versions: await loadModelVersions(model).catch(() => []),
      })),
    )
  ).flatMap(({ model, versions }) =>
    versions.map((version) => ({ model, version })),
  );

  const viableVersions = versionCandidates.filter(({ version }) =>
    isPublishedOrActiveVersion(version),
  );
  const pool = viableVersions.length > 0 ? viableVersions : versionCandidates;

  if (pool.length === 0) {
    throw new Error("Aucune version de matching exploitable n'est disponible.");
  }

  pool.sort((left, right) => {
    const leftPublished = isPublishedOrActiveVersion(left.version) ? 1 : 0;
    const rightPublished = isPublishedOrActiveVersion(right.version) ? 1 : 0;

    if (rightPublished !== leftPublished) {
      return rightPublished - leftPublished;
    }

    if (right.version.versionNumber !== left.version.versionNumber) {
      return right.version.versionNumber - left.version.versionNumber;
    }

    return (
      new Date(right.version.createdAt).getTime() -
      new Date(left.version.createdAt).getTime()
    );
  });

  return pool[0];
};

const waitForMatchingResults = async (
  runId: string,
): Promise<MatchingResultRecord[]> => {
  let results: MatchingResultRecord[] = [];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    results = await gatewayApi.matching.listResults(runId).catch(() => []);
    if (results.length > 0) {
      return results;
    }

    const run = await gatewayApi.matching.getRun(runId).catch(() => null);
    if (run && FINAL_MATCHING_RUN_STATUSES.has(run.status.toUpperCase())) {
      return results;
    }

    await wait(800);
  }

  return results;
};

export async function getCandidateMatchingOffers(
  candidateId: string,
): Promise<CandidateMatchingOffersData> {
  const activeOffersCatalogPromise = getOptionalActiveOffersCatalog();

  try {
    const [{ activeOffersCount, offersById }, selection] = await Promise.all([
      activeOffersCatalogPromise,
      selectCandidateToOffersModel(),
    ]);

    const run = await gatewayApi.matching.createRun({
      run_type: 'MANUAL',
      direction: selection.model.direction,
      model_version_id: selection.version.id,
      source_entity_type: 'CANDIDATE',
      source_entity_id: candidateId,
      parameters_json: {},
    });

    await gatewayApi.matching.executeRun(run.id, { dry_run: false });

    const results = await waitForMatchingResults(run.id);
    const offers = results
      .map((result) =>
        mapMatchingResultToOfferSummary(
          result,
          result.offerId ? offersById.get(result.offerId) : undefined,
        ),
      )
      .filter((offer): offer is CandidateMatchedOfferSummary => Boolean(offer))
      .sort(sortMatchedOffers);

    return {
      matchingAvailable: true,
      activeOffersCount,
      offers,
      unavailableMessage: null,
    };
  } catch {
    const { activeOffersCount } = await activeOffersCatalogPromise;

    return {
      matchingAvailable: false,
      activeOffersCount,
      offers: [],
      unavailableMessage: MATCHING_UNAVAILABLE_MESSAGE,
    };
  }
}

export const candidateMatchingUnavailableMessage = MATCHING_UNAVAILABLE_MESSAGE;
