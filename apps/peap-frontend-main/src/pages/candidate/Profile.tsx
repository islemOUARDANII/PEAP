import {
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Eye,
  FileUp,
  Globe2,
  GraduationCap,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import CandidateProfileOnboardingCard from '@/components/common/CandidateProfileOnboardingCard';
import { PageHeader } from '@/components/common/PageHeader';
import { SkillTag } from '@/components/common/SkillTag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/services/api/queryKeys';
import {
  gatewayApi,
  inferCandidateDisplayName,
  inferCandidateLocation,
  mapAggregateToBundle,
  type CandidateEducationRecord,
  type CandidateExperienceRecord,
  type CandidateLanguageRecord,
  type CandidateProfileBundle,
  type CandidateProfilePatchPayload,
  type CandidateSkillRecord,
  type ReferentialOption,
  type CandidateCvParseResult,
} from '@/services/api/gateway';
import {
  useGeoCountriesQuery,
  useGeoAdminUnitsQuery,
  usePatchCandidateProfileMutation,
  useRefDropdownQuery,
  useTaxonomyAutocompleteQuery,
} from '@/services/api/queries';
import { appEnv } from '@/config/env';
import { ApiServiceError } from '@/services/api/client';
import { readStoredSession } from '@/services/auth/sessionStorage';
import ErrorCard from '@/components/common/ErrorCard';
import LoadingCard from '@/components/common/LoadingCard';
import {
  candidateOfferScoreOptions,
  getStoredCandidateInterestKeywords,
  getStoredCandidateMinimumOfferScore,
  normalizeCandidateMinimumOfferScore,
  setStoredCandidateInterestKeywords,
  setStoredCandidateMinimumOfferScore,
} from '@/services/candidate/candidatePortalPreferences';
import {
  buildCertificationItems,
  buildEducationItems,
  buildExperienceSections,
  buildInterestKeywords,
  buildLanguageItems,
  buildProjectItems,
  buildSkillItems,
  cleanText as cleanProfileText,
  cleanDisplayText as cleanCandidateDisplayText,
  formatDate as formatCandidateDate,
  formatDateRange as formatCandidateDateRange,
  formatDurationLabel,
  formatLevelLabel as formatCandidateLevelLabel,
  formatLanguageLabel as formatCandidateLanguageLabel,
  groupSkillsByCategory,
  type DisplayCertificationItem,
  type DisplayEducationItem,
  type DisplayExperienceItem,
  type DisplayLanguageItem,
  type DisplayProjectItem,
  type DisplaySkillItem,
} from './profileUtils';
import { PercentageScore } from '@/components/common/PercentageScore';
import {
  getCandidatePortalErrorMessage,
  invalidateCandidatePortalQueries,
  isJobSeekerProfileNotFoundError,
  shouldRetryCandidateProfileQuery,
  uploadAndParseCandidateCv,
} from '@/services/candidate/candidateProfileOnboarding';
import { SkillPicker } from './profile/SkillPicker';
import { OccupationAutocomplete } from './profile/OccupationAutocomplete';
import { GeoAddressFields } from './profile/GeoAddressFields';
import { TaxonomyKeywordsEditor } from './profile/TaxonomyKeywordsEditor';

interface EducationDraft {
  id?: string;
  levelCode: string;
  levelRefId: string;       // FK to EDUCATION_LEVEL ref_value
  degree: string;           // diploma code (backward compat)
  diplomaLabel: string;
  diplomaRefId: string;     // FK to DIPLOMA ref_value
  specialty: string;
  specialtyRefId: string;   // FK to SPECIALTY ref_value
  institution: string;
  startDate: string;
  endDate: string;
  graduationYear: string;
  location: string;
  honors: string;
  gpa: string;
}

interface ExperienceDraft {
  id?: string;
  jobTitleRaw: string;
  occupationNodeId: string; // FK to taxonomy RTMC OCCUPATION
  companyName: string;
  sector: string;
  sectorRefId: string;      // FK to ACTIVITY_SECTOR ref_value
  location: string;         // free-text fallback
  locationCountry: string;  // ISO2 country code for structured geo
  locationGovCode: string;  // admin level-1 code
  locationGovLabel: string; // admin level-1 label (for compose)
  locationDelegCode: string;  // admin level-2 code
  locationDelegLabel: string; // admin level-2 label (for compose)
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  durationMonths: string;
  durationYears: string;
  description: string;
  responsibilities: string[];
  technologies: string[];
  projects: Array<Record<string, unknown> | string>;
  entryType: string;
}

interface SkillDraft {
  id?: string;
  skillNodeId: string;    // FK to taxonomy RTMC SKILL or SOFT_SKILL node
  skillLabelRaw: string;
  skillNodeType: string;  // 'SKILL' | 'SOFT_SKILL'
  level: string;
  years: string;
  evidence: string;
}

interface LanguageDraft {
  id?: string;
  languageCode: string;
  level: string;
  evidence: string;
}

interface ProfileDraft {
  firstName: string;
  lastName: string;
  cin: string;
  passportNumber: string;
  birthDate: string;
  genderCode: string;
  nationality: string;
  nationalityCountryId: string; // FK to geo.country
  codeHandicap: string;
  codeDegreHandicap: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  governorateCode: string;
  delegationCode: string;
  primaryLanguage: string;
  preferredContractType: string;
  preferredGovernorate: string;
  mobilityRadiusKm: string;
  acceptsRelocation: boolean;
  desiredSalaryMin: string;
  desiredSalaryMax: string;
  education: EducationDraft[];
  experience: ExperienceDraft[];
  skills: SkillDraft[];
  languages: LanguageDraft[];
}

type ParsedPatchItem = Record<string, unknown>;

type CandidateLocation = {
  raw_location?: string | null;
  normalized_location?: string | null;
  display_location?: string | null;
  status?: string | null;
  country?: string | null;
  governorate?: {
    code?: string | null;
    label?: string | null;
  } | null;
  delegation?: {
    code?: string | null;
    label?: string | null;
  } | null;
  confidence?: number | null;
  source?: string | null;
};

type GeoNormalization = {
  candidate_location?: CandidateLocation | null;
};
type ExtractedProfilePatch = {
  identity?: Record<string, unknown>;
  education?: ParsedPatchItem[];
  experience?: ParsedPatchItem[];
  stages?: ParsedPatchItem[];
  skills?: ParsedPatchItem[];
  languages?: ParsedPatchItem[];
};

const emptyEducation = (): EducationDraft => ({
  levelCode: '',
  levelRefId: '',
  degree: '',
  diplomaLabel: '',
  diplomaRefId: '',
  specialty: '',
  specialtyRefId: '',
  institution: '',
  startDate: '',
  endDate: '',
  graduationYear: '',
  location: '',
  honors: '',
  gpa: '',
});

const emptyExperience = (): ExperienceDraft => ({
  jobTitleRaw: '',
  occupationNodeId: '',
  companyName: '',
  sector: '',
  sectorRefId: '',
  location: '',
  locationCountry: '',
  locationGovCode: '',
  locationGovLabel: '',
  locationDelegCode: '',
  locationDelegLabel: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  durationMonths: '',
  durationYears: '',
  description: '',
  responsibilities: [],
  technologies: [],
  projects: [],
  entryType: '',
});

const emptySkill = (nodeType = 'SKILL'): SkillDraft => ({
  skillNodeId: '',
  skillLabelRaw: '',
  skillNodeType: nodeType,
  level: '',
  years: '',
  evidence: '',
});

const emptyLanguage = (): LanguageDraft => ({
  languageCode: '',
  level: '',
  evidence: '',
});

const toDraft = (bundle: CandidateProfileBundle): ProfileDraft => ({
  firstName: bundle.identity?.first_name ?? '',
  lastName: bundle.identity?.last_name ?? '',
  cin: bundle.identity?.cin ?? '',
  passportNumber: bundle.identity?.passport_number ?? '',
  birthDate: bundle.identity?.birth_date ?? '',
  genderCode: bundle.identity?.gender_code ?? '',
  nationality: bundle.identity?.nationality ?? '',
  nationalityCountryId: (bundle.identity as Record<string, unknown>)?.nationality_country_id as string ?? '',
  codeHandicap: bundle.identity?.code_handicap ?? '0',
  codeDegreHandicap: bundle.identity?.code_degre_handicap ?? '',
  email: bundle.contact?.email ?? '',
  phone: bundle.contact?.phone ?? '',
  address: bundle.contact?.address ?? '',
  country: bundle.contact?.country ?? 'TN',
  governorateCode: bundle.contact?.governorate_code ?? '',
  delegationCode: bundle.contact?.delegation_code ?? '',
  primaryLanguage: bundle.primaryLanguage ?? '',
  preferredContractType: bundle.preference?.preferredContractType ?? '',
  preferredGovernorate: bundle.preference?.preferredGovernorate ?? '',
  mobilityRadiusKm:
    bundle.preference?.mobilityRadiusKm == null
      ? ''
      : String(bundle.preference.mobilityRadiusKm),
  acceptsRelocation: bundle.preference?.acceptsRelocation ?? false,
  desiredSalaryMin:
    bundle.preference?.desiredSalaryMin == null
      ? ''
      : String(bundle.preference.desiredSalaryMin),
  desiredSalaryMax:
    bundle.preference?.desiredSalaryMax == null
      ? ''
      : String(bundle.preference.desiredSalaryMax),
  education: bundle.education.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    return {
      id: item.id,
      levelCode: item.levelCode ?? '',
      levelRefId: raw.level_ref_id as string ?? '',
      degree: item.degree ?? item.diplomaLabel ?? raw.diploma_code as string ?? '',
      diplomaLabel: item.diplomaLabel ?? '',
      diplomaRefId: raw.diploma_ref_id as string ?? '',
      specialty: item.specialty ?? raw.specialty_code as string ?? '',
      specialtyRefId: raw.specialty_ref_id as string ?? '',
      institution: item.institution ?? '',
      startDate: item.startDate ?? '',
      endDate: item.endDate ?? '',
      graduationYear: item.graduationYear == null ? '' : String(item.graduationYear),
      location: item.location ?? '',
      honors: item.honors ?? '',
      gpa: item.gpa ?? '',
    };
  }),
  experience: bundle.experience.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    return {
      id: item.id,
      jobTitleRaw: item.jobTitleRaw ?? '',
      occupationNodeId: raw.occupation_node_id as string ?? '',
      companyName: item.companyName ?? '',
      sector: item.sector ?? '',
      sectorRefId: raw.sector_ref_id as string ?? '',
      location: item.location ?? '',
      locationCountry: '',
      locationGovCode: '',
      locationGovLabel: '',
      locationDelegCode: '',
      locationDelegLabel: '',
      startDate: item.startDate ?? '',
      endDate: item.endDate ?? '',
      isCurrent: (raw.is_current as boolean) ?? item.isCurrent ?? false,
      durationMonths: item.durationMonths == null ? '' : String(item.durationMonths),
      durationYears: item.durationYears == null ? '' : String(item.durationYears),
      description: item.description ?? '',
      responsibilities: item.responsibilities ?? [],
      technologies: item.technologies ?? [],
      projects: item.projects ?? [],
      entryType: item.entryType ?? '',
    };
  }),
  skills: bundle.skills.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    return {
      id: item.id,
      skillNodeId: raw.skill_node_id as string ?? item.skillId ?? '',
      skillLabelRaw: item.skillLabelRaw ?? item.skillNodeLabel ?? '',
      skillNodeType: item.skillNodeType ?? 'SKILL',
      level: item.level ?? '',
      years: item.years == null ? '' : String(item.years),
      evidence: item.evidence ?? '',
    };
  }),
  languages: bundle.languages.map((item) => ({
    id: item.id,
    languageCode: item.languageCode,
    level: item.level ?? '',
    evidence: item.evidence ?? '',
  })),
});

const toNullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasEducationValue = (item: EducationDraft): boolean =>
  [
    item.degree,
    item.diplomaLabel,
    item.specialty,
    item.institution,
    item.graduationYear,
    item.honors,
  ].some((value) => value.trim());

const hasExperienceValue = (item: ExperienceDraft): boolean =>
  [
    item.jobTitleRaw,
    item.companyName,
    item.sector,
    item.location,
    item.startDate,
    item.endDate,
    item.durationMonths,
    item.durationYears,
    item.description,
    item.entryType,
    ...item.responsibilities,
    ...item.technologies,
  ].some((value) => value.trim());

const hasSkillValue = (item: SkillDraft): boolean =>
  [item.skillLabelRaw, item.level].some((value) => value.trim());

const hasLanguageValue = (item: LanguageDraft): boolean =>
  [item.languageCode, item.level].some((value) => value.trim());

const isEndpointUnavailableError = (error: unknown): boolean =>
  error instanceof ApiServiceError && [404, 405, 501].includes(error.status);

const normalizeKeyword = (value: unknown): string | null =>
  cleanProfileText(value);

const normalizeKeywordList = (keywords: string[]): string[] =>
  Array.from(
    new Set(
      keywords
        .map((keyword) => normalizeKeyword(keyword))
        .filter((keyword): keyword is string => Boolean(keyword)),
    ),
  );

const toKeywordRecords = (keywords: string[]) =>
  normalizeKeywordList(keywords).map((keyword, index) => ({
    id: `keyword-local-${index + 1}`,
    keyword,
    keywordType: null,
    source: 'LOCAL',
    weight: null,
  }));

const toNullableYear = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) {
    return null;
  }

  return Number(yearMatch[0]);
};

const splitListValue = (value: string, separatorPattern: RegExp): string[] =>
  Array.from(
    new Set(
      value
        .split(separatorPattern)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const toCommaSeparatedValue = (items: string[]): string => items.join(', ');

const toMultilineValue = (items: string[]): string => items.join('\n');

const uniqueTextValues = (
  ...values: Array<string | null | undefined>
): string[] => {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const normalized = normalizeKeyword(value);
    if (!normalized) {
      continue;
    }

    const comparable = normalized.toLocaleLowerCase('fr');
    if (seen.has(comparable)) {
      continue;
    }

    seen.add(comparable);
    items.push(normalized);
  }

  return items;
};

const formatCountryLabel = (
  value: string | null | undefined,
): string | null => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const countryLabels: Record<string, string> = {
    TN: 'Tunisie',
    FR: 'France',
    DE: 'Allemagne',
    IT: 'Italie',
    ES: 'Espagne',
    UK: 'Royaume-Uni',
    US: 'États-Unis',
  };

  return countryLabels[normalized] ?? cleanCandidateDisplayText(value, '');
};

const skillLevelOptions: ReferentialOption[] = [
  { code: 'beginner', label: 'Débutant' },
  { code: 'intermediate', label: 'Intermédiaire' },
  { code: 'advanced', label: 'Avancé' },
  { code: 'expert', label: 'Expert' },
];

const normalizeComparableText = (
  value: string | null | undefined,
): string | null => {
  const normalized = cleanProfileText(value);
  return normalized ? normalized.toLocaleLowerCase('fr') : null;
};

const findMatchingOption = (
  options: ReferentialOption[],
  ...candidates: Array<string | null | undefined>
): ReferentialOption | null => {
  const normalizedCandidates = Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeComparableText(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    ),
  );

  if (normalizedCandidates.length === 0) {
    return null;
  }

  return (
    options.find((option) => {
      const optionCode = normalizeComparableText(option.code);
      const optionLabel = normalizeComparableText(option.label);

      return normalizedCandidates.some(
        (candidate) => candidate === optionCode || candidate === optionLabel,
      );
    }) ?? null
  );
};

const buildOptionsWithCurrentValue = (
  options: ReferentialOption[],
  value: string | null | undefined,
  fallbackLabel?: string | null,
): ReferentialOption[] => {
  const normalizedValue = cleanProfileText(value);
  if (!normalizedValue || findMatchingOption(options, value, fallbackLabel)) {
    return options;
  }

  return [
    {
      code: normalizedValue,
      label:
        cleanProfileText(fallbackLabel) ??
        cleanCandidateDisplayText(value, normalizedValue),
    },
    ...options,
  ];
};

const resolveOptionValue = (
  options: ReferentialOption[],
  value: string | null | undefined,
  fallbackLabel?: string | null,
): string =>
  findMatchingOption(options, value, fallbackLabel)?.code ??
  cleanProfileText(value) ??
  '';

const extractEducationYear = (item: DisplayEducationItem): string | null => {
  const graduationYear = cleanProfileText(item.graduationYear);
  if (graduationYear) {
    return graduationYear;
  }

  const endDate = cleanProfileText(item.endDate);
  if (!endDate) {
    return null;
  }

  const yearMatch = endDate.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : null;
};

async function syncDraftCollection<
  TCurrent extends { id: string },
  TDraft extends { id?: string },
>(
  currentItems: TCurrent[],
  draftItems: TDraft[],
  hasValue: (item: TDraft) => boolean,
  createItem: (item: TDraft) => Promise<unknown>,
  updateItem: (item: TDraft) => Promise<unknown>,
  deleteItem: (id: string) => Promise<unknown>,
): Promise<void> {
  const keptIds = new Set(
    draftItems
      .map((item) => item.id)
      .filter((value): value is string => Boolean(value)),
  );

  for (const existing of currentItems) {
    if (!keptIds.has(existing.id)) {
      await deleteItem(existing.id);
    }
  }

  for (const draftItem of draftItems) {
    if (!hasValue(draftItem)) {
      continue;
    }

    if (draftItem.id) {
      await updateItem(draftItem);
    } else {
      await createItem(draftItem);
    }
  }
}

function SectionTitle({
  title,
  description,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Sélectionner',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReferentialOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReferentialOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value || '__empty__'}
        onValueChange={(next) => onChange(next === '__empty__' ? '' : next)}
        disabled={disabled}
      >
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiServiceError) {
    return `${fallback}: ${error.message}`;
  }

  return error instanceof Error ? error.message : fallback;
};

const toStringOrEmpty = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

const splitFullName = (
  fullName: unknown,
): { firstName: string; lastName: string } => {
  const text = toStringOrEmpty(fullName).trim();

  if (!text) {
    return { firstName: '', lastName: '' };
  }

  const parts = text.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
};

const extractCandidateLocationCodes = (
  mappedPayload: Record<string, unknown>,
): { governorateCode: string; delegationCode: string } => {
  const geo = mappedPayload.geo_normalization as
    | {
      candidate_location?: {
        governorate?: { code?: string | null };
        delegation?: { code?: string | null };
      };
    }
    | undefined;

  return {
    governorateCode: geo?.candidate_location?.governorate?.code ?? '',
    delegationCode: geo?.candidate_location?.delegation?.code ?? '',
  };
};

function applyParsedCvToDraft(
  current: ProfileDraft,
  parseResult: CandidateCvParseResult,
): ProfileDraft {
  const patch: ExtractedProfilePatch =
    (parseResult.extractedProfilePatch as ExtractedProfilePatch | undefined) ??
    {};
  const identity = patch.identity ?? {};

  const mappedPayload = parseResult.mappedPayload ?? {};
  const { governorateCode, delegationCode } =
    extractCandidateLocationCodes(mappedPayload);

  const parsedPayload = parseResult.parsedPayload ?? {};
  const cvData = parsedPayload.cv_data as Record<string, unknown> | undefined;
  const personalInfo = cvData?.personal_info as
    | Record<string, unknown>
    | undefined;

  const fullName = splitFullName(
    identity.full_name ??
    identity.name ??
    personalInfo?.full_name ??
    personalInfo?.name,
  );

  const parsedGeo = parsedPayload.geo_normalization as
    | GeoNormalization
    | undefined;
  const mappedGeo = mappedPayload.geo_normalization as
    | GeoNormalization
    | undefined;

  const candidateLocation =
    parsedGeo?.candidate_location ?? mappedGeo?.candidate_location ?? null;

  const displayLocation =
    candidateLocation?.display_location ||
    toStringOrEmpty(identity.location) ||
    toStringOrEmpty(personalInfo?.location);
  const firstParsedLanguage =
    Array.isArray(patch.languages) && patch.languages.length > 0
      ? patch.languages[0]
      : undefined;
  const parsedPrimaryLanguage = toStringOrEmpty(
    identity.primary_language ??
    personalInfo?.primary_language ??
    (firstParsedLanguage &&
      typeof firstParsedLanguage === 'object' &&
      !Array.isArray(firstParsedLanguage)
      ? ((firstParsedLanguage as Record<string, unknown>).language_code ??
        (firstParsedLanguage as Record<string, unknown>).code)
      : undefined),
  );

  return {
    ...current,

    firstName:
      toStringOrEmpty(identity.first_name) ||
      fullName.firstName ||
      current.firstName,

    lastName:
      toStringOrEmpty(identity.last_name) ||
      fullName.lastName ||
      current.lastName,

    birthDate: toStringOrEmpty(identity.birth_date) || current.birthDate,
    nationality: toStringOrEmpty(identity.nationality) || current.nationality,

    email:
      toStringOrEmpty(identity.email) ||
      toStringOrEmpty(personalInfo?.email) ||
      current.email,

    phone:
      toStringOrEmpty(identity.phone) ||
      toStringOrEmpty(personalInfo?.phone) ||
      current.phone,

    address: displayLocation || current.address,
    governorateCode: governorateCode || current.governorateCode,
    delegationCode: delegationCode || current.delegationCode,
    primaryLanguage: parsedPrimaryLanguage || current.primaryLanguage,

    education: (patch.education ?? []).map((item) => ({
      levelCode: toStringOrEmpty(item.level_code ?? item.levelCode),
      degree: toStringOrEmpty(item.degree ?? item.raw_degree),
      diplomaLabel: toStringOrEmpty(
        item.diploma_label ??
        item.diplomaLabel ??
        item.degree ??
        item.raw_degree,
      ),
      specialty: toStringOrEmpty(
        item.specialty ?? item.specialty_label ?? item.field,
      ),
      institution: toStringOrEmpty(item.institution),
      startDate: toStringOrEmpty(item.start_date ?? item.startDate),
      endDate: toStringOrEmpty(item.end_date ?? item.endDate),
      graduationYear: toStringOrEmpty(
        item.graduation_year ?? item.graduationYear ?? item.end_date,
      ),
      location: toStringOrEmpty(item.location),
      honors: toStringOrEmpty(item.honors),
      gpa: toStringOrEmpty(item.gpa),
    })),

    experience: [
      ...(patch.experience ?? []).map((item) => ({
        ...item,
        entry_type: item.entry_type ?? item.entryType ?? 'experience',
      })),
      ...(patch.stages ?? []).map((item) => ({
        ...item,
        entry_type: item.entry_type ?? item.entryType ?? 'internship',
      })),
    ].map((item) => ({
      jobTitleRaw: toStringOrEmpty(
        item.title ?? item.job_title ?? item.jobTitleRaw,
      ),
      companyName: toStringOrEmpty(item.company ?? item.company_name),
      sector: '',
      location: toStringOrEmpty(item.location),
      startDate: toStringOrEmpty(item.start_date),
      endDate: toStringOrEmpty(item.end_date),
      isCurrent: item.is_current === true,
      durationMonths: toStringOrEmpty(
        item.duration_months ?? item.durationMonths,
      ),
      durationYears: toStringOrEmpty(item.duration_years ?? item.durationYears),
      description: toStringOrEmpty(item.description),
      responsibilities: Array.isArray(item.responsibilities)
        ? item.responsibilities
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
        : [],
      technologies: Array.isArray(item.technologies)
        ? item.technologies
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
        : [],
      projects: Array.isArray(item.projects) ? item.projects : [],
      entryType: toStringOrEmpty(item.entry_type ?? item.entryType),
    })),

    skills: (patch.skills ?? []).map((item) => ({
      skillLabelRaw: toStringOrEmpty(
        item.skill_label_raw ?? item.name ?? item.label ?? item.skill,
      ),
      level: toStringOrEmpty(item.level),
      years: '',
      evidence: 'CV',
    })),

    languages: (patch.languages ?? []).map((item) => ({
      languageCode: toStringOrEmpty(
        item.language_code ?? item.code ?? item.name,
      ),
      level: toStringOrEmpty(item.level),
      evidence: 'CV',
    })),
  };
}

const fallbackLanguageLabels: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  ar: 'Arabe',
  de: 'Allemand',
  es: 'Espagnol',
  it: 'Italien',
  zh: 'Chinois',
  ja: 'Japonais',
  ko: 'Coréen',
  pt: 'Portugais',
  ru: 'Russe',
  tr: 'Turc',
};

const fallbackLanguageLevelLabels: Record<string, string> = {
  native: 'Langue maternelle',
  fluent: 'Courant',
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

const cleanDisplayText = (
  value: string | null | undefined,
  fallback = 'Non renseigné',
): string => {
  const normalized = value?.trim();

  if (
    !normalized ||
    /^(non specifie|non spécifié|not specified|null|undefined)$/i.test(
      normalized,
    )
  ) {
    return fallback;
  }

  return normalized;
};

const formatBooleanLabel = (value: boolean): string => (value ? 'Oui' : 'Non');

const formatCvStatusLabel = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return 'Non renseigné';
  }

  const labels: Record<string, string> = {
    parsed: 'Analyse terminée',
    search_ready: 'Prêt pour les offres',
    pending: 'En attente',
    processing: 'Analyse en cours',
    failed: 'Échec de l’analyse',
    uploaded: 'CV importé',
  };

  return labels[normalized] ?? cleanDisplayText(value);
};

const formatShortDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('fr-FR');
};

const formatLanguageLabel = (
  languageCode: string,
  languageLabel?: string | null,
): string => {
  const normalizedCode = languageCode.trim().toLowerCase();

  return (
    languageLabel?.trim() ||
    fallbackLanguageLabels[normalizedCode] ||
    normalizedCode.toUpperCase()
  );
};

const formatLanguageLevelLabel = (
  level: string,
  levelLabel?: string | null,
): string => {
  const normalizedLevel = level.trim().toLowerCase();

  return (
    levelLabel?.trim() ||
    fallbackLanguageLevelLabels[normalizedLevel] ||
    cleanDisplayText(level, 'Niveau non renseigné')
  );
};

const isInternshipExperience = (experience: ExperienceDraft): boolean => {
  const normalizedEntryType = experience.entryType.trim().toLowerCase();
  if (normalizedEntryType === 'internship') {
    return true;
  }

  const haystack = [
    experience.jobTitleRaw,
    experience.companyName,
    experience.sector,
    experience.description,
  ]
    .join(' ')
    .toLowerCase();

  return /\b(stage|internship|intern)\b/.test(haystack);
};

const formatExperiencePeriod = (
  startDate: string,
  endDate: string,
): string | null => {
  const start = formatShortDate(startDate);
  const end = formatShortDate(endDate);

  if (!start && !end) {
    return null;
  }

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end;
};

export default function Profile() {
  const handicapTypesQuery = useQuery({
    queryKey: queryKeys.referentials.handicapTypes(),
    queryFn: gatewayApi.referentials.handicapTypes,
    staleTime: 30 * 60_000,
  });

  const handicapDegreesQuery = useQuery({
    queryKey: queryKeys.referentials.handicapDegrees(),
    queryFn: gatewayApi.referentials.handicapDegrees,
    staleTime: 30 * 60_000,
  });
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [isOpeningCv, setIsOpeningCv] = useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [latestParseResult, setLatestParseResult] =
    useState<CandidateCvParseResult | null>(null);
  const [interestKeywordsDraft, setInterestKeywordsDraft] = useState<string[]>(
    [],
  );

  const [minimumOfferScoreDraft, setMinimumOfferScoreDraft] = useState(
    getStoredCandidateMinimumOfferScore(),
  );

  const bundleQuery = useQuery({
    queryKey: queryKeys.candidate.bundle(),
    queryFn: () => gatewayApi.candidate.getBundle(),
    retry: shouldRetryCandidateProfileQuery,
  });
  const governoratesQuery = useQuery({
    queryKey: ['referentials', 'governorates'],
    queryFn: () => gatewayApi.referentials.governorates(),
    staleTime: 5 * 60_000,
  });
  const delegationsQuery = useQuery({
    queryKey: ['referentials', 'delegations', draft?.governorateCode ?? ''],
    queryFn: () =>
      gatewayApi.referentials.delegations(draft?.governorateCode || undefined),
    enabled: Boolean(draft?.governorateCode),
    staleTime: 5 * 60_000,
  });
  const gendersQuery = useQuery({
    queryKey: ['referentials', 'genders'],
    queryFn: () => gatewayApi.referentials.genders(),
    staleTime: 5 * 60_000,
  });
  const contractTypesQuery = useQuery({
    queryKey: ['referentials', 'contract-types'],
    queryFn: () => gatewayApi.referentials.contractTypes(),
    staleTime: 5 * 60_000,
  });
  const diplomasQuery = useQuery({
    queryKey: ['referentials', 'diplomas'],
    queryFn: () => gatewayApi.referentials.diplomas(),
    staleTime: 5 * 60_000,
  });

  // ── New canonical reference dropdowns ─────────────────────────────────────
  const geoCountriesQuery = useGeoCountriesQuery();
  const educationLevelsQuery = useRefDropdownQuery('EDUCATION_LEVEL');
  const canonicalDiplomasQuery = useRefDropdownQuery('DIPLOMA');
  const specialtiesQuery = useRefDropdownQuery('SPECIALTY');
  const activitySectorsQuery = useRefDropdownQuery('ACTIVITY_SECTOR');

  // ─────────────────────────────────────────────────────────────────────────

  const languagesQuery = useQuery({
    queryKey: ['referentials', 'languages'],
    queryFn: () => gatewayApi.referentials.languages(),
    staleTime: 5 * 60_000,
  });

  const languageLevelsQuery = useQuery({
    queryKey: ['referentials', 'language-levels'],
    queryFn: () => gatewayApi.referentials.languageLevels(),
    staleTime: 5 * 60_000,
  });
  const keywordsQuery = useQuery({
    queryKey: queryKeys.candidate.keywords(),
    queryFn: async () => {
      try {
        return await gatewayApi.candidate.getKeywords();
      } catch (error) {
        if (isEndpointUnavailableError(error)) {
          return toKeywordRecords(getStoredCandidateInterestKeywords());
        }

        throw error;
      }
    },
    enabled: bundleQuery.isSuccess,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const offerThresholdQuery = useQuery({
    queryKey: queryKeys.candidate.offerThreshold(),
    queryFn: async () => {
      try {
        return await gatewayApi.candidate.getOfferThreshold();
      } catch (error) {
        if (isEndpointUnavailableError(error)) {
          return {
            minThreshold: getStoredCandidateMinimumOfferScore(),
          };
        }

        throw error;
      }
    },
    enabled: bundleQuery.isSuccess,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const bundle = bundleQuery.data;
  const isMissingCandidateProfile = isJobSeekerProfileNotFoundError(
    bundleQuery.error,
  );
  const savedInterestKeywords = useMemo(
    () =>
      keywordsQuery.data
        ? normalizeKeywordList(keywordsQuery.data.map((item) => item.keyword))
        : normalizeKeywordList(getStoredCandidateInterestKeywords()),
    [keywordsQuery.data],
  );
  const savedMinimumOfferScore = useMemo(
    () =>
      normalizeCandidateMinimumOfferScore(
        offerThresholdQuery.data?.minThreshold ??
        getStoredCandidateMinimumOfferScore(),
      ),
    [offerThresholdQuery.data?.minThreshold],
  );
  const minimumOfferScore = minimumOfferScoreDraft;
  const setMinimumOfferScore = setMinimumOfferScoreDraft;

  useEffect(() => {
    if (bundle && !isEditing) {
      setDraft(toDraft(bundle));
    }
  }, [bundle, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setInterestKeywordsDraft(savedInterestKeywords);
      setMinimumOfferScoreDraft(savedMinimumOfferScore);
  
    }
  }, [isEditing, savedInterestKeywords, savedMinimumOfferScore]);

  const currentDraft = draft ?? (bundle ? toDraft(bundle) : null);
  const currentCv = bundle?.currentCv;
  const preferParsedView = isEditing && Boolean(latestParseResult);

  const selectedGovernorateLabel = useMemo(
    () =>
      governoratesQuery.data?.find(
        (option) => option.code === currentDraft?.governorateCode,
      )?.label ??
      bundle?.contact?.governorate_label ??
      '',
    [
      bundle?.contact?.governorate_label,
      currentDraft?.governorateCode,
      governoratesQuery.data,
    ],
  );

  const selectedDelegationLabel = useMemo(
    () =>
      delegationsQuery.data?.find(
        (option) => option.code === currentDraft?.delegationCode,
      )?.label ??
      bundle?.contact?.delegation_label ??
      '',
    [
      bundle?.contact?.delegation_label,
      currentDraft?.delegationCode,
      delegationsQuery.data,
    ],
  );
  const selectedGenderLabel = useMemo(
    () =>
      gendersQuery.data?.find(
        (option) => option.code === currentDraft?.genderCode,
      )?.label ??
      bundle?.identity?.gender_label ??
      '',
    [
      bundle?.identity?.gender_label,
      currentDraft?.genderCode,
      gendersQuery.data,
    ],
  );
  const preferredContractTypeLabel = useMemo(
    () =>
      contractTypesQuery.data?.find(
        (option) => option.code === currentDraft?.preferredContractType,
      )?.label ??
      currentDraft?.preferredContractType ??
      '',
    [contractTypesQuery.data, currentDraft?.preferredContractType],
  );
  const preferredGovernorateLabel = useMemo(
    () =>
      governoratesQuery.data?.find(
        (option) => option.code === currentDraft?.preferredGovernorate,
      )?.label ??
      currentDraft?.preferredGovernorate ??
      '',
    [currentDraft?.preferredGovernorate, governoratesQuery.data],
  );
  const primaryLanguageLabel = useMemo(
    () =>
      currentDraft?.primaryLanguage
        ? formatCandidateLanguageLabel(currentDraft.primaryLanguage)
        : null,
    [currentDraft?.primaryLanguage],
  );
  const diplomaOptions = diplomasQuery.data ?? [];

  const displayName = useMemo(() => {
    const draftName = [currentDraft?.firstName, currentDraft?.lastName]
      .filter((value) => value?.trim())
      .join(' ')
      .trim();

    if (draftName) {
      return draftName;
    }

    return bundle ? inferCandidateDisplayName(bundle) : 'Mon profil';
  }, [bundle, currentDraft?.firstName, currentDraft?.lastName]);

  const displayLocation = useMemo(() => {
    const parts = uniqueTextValues(
      currentDraft?.address?.trim(),
      selectedDelegationLabel,
      selectedGovernorateLabel,
      formatCountryLabel(currentDraft?.country),
    );

    if (parts.length > 0) {
      return parts.join(', ');
    }

    return bundle ? inferCandidateLocation(bundle) : '';
  }, [
    bundle,
    currentDraft?.address,
    selectedDelegationLabel,
    selectedGovernorateLabel,
  ]);

  const educationItems = useMemo<DisplayEducationItem[]>(
    () =>
      buildEducationItems(
        bundle?.education ?? [],
        latestParseResult,
        preferParsedView,
      ),
    [bundle?.education, latestParseResult, preferParsedView],
  );

  const {
    professional: professionalExperiences,
    internships: internshipExperiences,
  } = useMemo(
    () =>
      buildExperienceSections(
        bundle?.experience ?? [],
        latestParseResult,
        preferParsedView,
      ),
    [bundle?.experience, latestParseResult, preferParsedView],
  );

  const skillItems = useMemo(
    () =>
      buildSkillItems(
        bundle?.skills ?? [],
        latestParseResult,
        preferParsedView,
      ),
    [bundle?.skills, latestParseResult, preferParsedView],
  );
  const skillGroups = useMemo(
    () => groupSkillsByCategory(skillItems),
    [skillItems],
  );

  const languageItems = useMemo<DisplayLanguageItem[]>(
    () =>
      buildLanguageItems(
        bundle?.languages ?? [],
        latestParseResult,
        preferParsedView,
      ),
    [bundle?.languages, latestParseResult, preferParsedView],
  );

  const certificationItems = useMemo<DisplayCertificationItem[]>(
    () => buildCertificationItems(latestParseResult),
    [latestParseResult],
  );

  const projectItems = useMemo<DisplayProjectItem[]>(
    () => buildProjectItems(latestParseResult),
    [latestParseResult],
  );

  const parsedInterestKeywords = useMemo(
    () => buildInterestKeywords(latestParseResult),
    [latestParseResult],
  );

  const visibleInterestKeywords =
    preferParsedView && parsedInterestKeywords.length > 0
      ? parsedInterestKeywords
      : savedInterestKeywords;

  const refreshCandidateViews = async () =>
    invalidateCandidatePortalQueries(queryClient);

  const refetchCandidateBundle = async () =>
    queryClient.fetchQuery({
      queryKey: queryKeys.candidate.bundle(),
      queryFn: () => gatewayApi.candidate.getBundle(),
    });
  const professionalExperienceDrafts = useMemo(
    () =>
      currentDraft?.experience.filter(
        (item) => !isInternshipExperience(item),
      ) ?? [],
    [currentDraft?.experience],
  );
  const internshipExperienceDrafts = useMemo(
    () =>
      currentDraft?.experience.filter((item) => isInternshipExperience(item)) ??
      [],
    [currentDraft?.experience],
  );
  const replaceExperienceDrafts = (
    segment: 'professional' | 'internship',
    nextItems: SetStateAction<ExperienceDraft[]>,
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const currentSegment = current.experience.filter((item) =>
        segment === 'professional'
          ? !isInternshipExperience(item)
          : isInternshipExperience(item),
      );
      const otherSegment = current.experience.filter((item) =>
        segment === 'professional'
          ? isInternshipExperience(item)
          : !isInternshipExperience(item),
      );
      const resolvedSegment =
        typeof nextItems === 'function' ? nextItems(currentSegment) : nextItems;

      return {
        ...current,
        experience:
          segment === 'professional'
            ? [...resolvedSegment, ...otherSegment]
            : [...otherSegment, ...resolvedSegment],
      };
    });
  };
  // ── Skill segment helpers (technical vs. soft skills) ────────────────────
  const technicalSkillDrafts = useMemo(
    () => currentDraft?.skills.filter((s) => s.skillNodeType !== 'SOFT_SKILL') ?? [],
    [currentDraft?.skills],
  );
  const softSkillDrafts = useMemo(
    () => currentDraft?.skills.filter((s) => s.skillNodeType === 'SOFT_SKILL') ?? [],
    [currentDraft?.skills],
  );
  const replaceSkillDrafts = (
    segment: 'technical' | 'soft',
    nextItems: SetStateAction<SkillDraft[]>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const isTech = (s: SkillDraft) => s.skillNodeType !== 'SOFT_SKILL';
      const currentSeg = current.skills.filter((s) => (segment === 'technical' ? isTech(s) : !isTech(s)));
      const otherSeg = current.skills.filter((s) => (segment === 'technical' ? !isTech(s) : isTech(s)));
      const resolved = typeof nextItems === 'function' ? nextItems(currentSeg) : nextItems;
      return {
        ...current,
        skills: segment === 'technical' ? [...resolved, ...otherSeg] : [...otherSeg, ...resolved],
      };
    });
  };

  const startEditing = () => {
    if (bundle) {
      setDraft(toDraft(bundle));
    }
    setInterestKeywordsDraft(savedInterestKeywords);
    setMinimumOfferScoreDraft(savedMinimumOfferScore);

    setIsEditing(true);
  };
  const removeInterestKeyword = (keyword: string) => {
    setInterestKeywordsDraft((current) =>
      current.filter(
        (item) =>
          item.toLocaleLowerCase('fr') !== keyword.toLocaleLowerCase('fr'),
      ),
    );
  };

  const handleCancel = () => {
    if (bundle) {
      setDraft(toDraft(bundle));
    }
    setInterestKeywordsDraft(savedInterestKeywords);
    setMinimumOfferScoreDraft(savedMinimumOfferScore);

    setLatestParseResult(null);
    setIsEditing(false);
  };

  const handleOpenCurrentCv = async () => {
    setIsCvPreviewOpen(true);
    setCvPreviewUrl(null);
    setIsOpeningCv(true);

    try {
      const token = readStoredSession()?.token;
      const headers = new Headers();

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(
        `${appEnv.apiBaseUrl.replace(/\/+$/, '')}${gatewayApi.candidate.getCurrentCvViewUrl()}`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Impossible de charger le CV: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setCvPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return blobUrl;
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'ouvrir le CV actuel"));
      setIsCvPreviewOpen(false);
    } finally {
      setIsOpeningCv(false);
    }
  };

  const handleUploadCv = async (file: File | null) => {
    if (!file || !currentDraft) {
      return;
    }

    setIsUploadingCv(true);
    setIsParsingCv(false);

    try {
      let asyncParseStatus: string | null = null;

      const { parseResult } = await uploadAndParseCandidateCv(file, {
        onUploaded: () => {
          setIsUploadingCv(false);
          setIsParsingCv(true);
          toast.success('CV importé. Analyse en cours...');
        },
        onParsed: (status) => {
          asyncParseStatus = status;
          if (status === 'TIMEOUT') {
            toast.info('Analyse en cours en arrière-plan. Rafraîchissez dans quelques instants.');
          } else if (status !== 'PARSED') {
            toast.error("L'analyse du CV a échoué. Veuillez réessayer.");
          }
        },
      });

      await refreshCandidateViews();
      await refetchCandidateBundle();

      if (parseResult) {
        setLatestParseResult(parseResult);
        setDraft((current) =>
          current ? applyParsedCvToDraft(current, parseResult) : current,
        );
        const parsedKeywords = buildInterestKeywords(parseResult);
        setInterestKeywordsDraft(
          parsedKeywords.length > 0 ? parsedKeywords : savedInterestKeywords,
        );
        setMinimumOfferScoreDraft(savedMinimumOfferScore);
    
        setIsEditing(true);
        toast.success('CV analysé. Vérifiez les champs puis cliquez sur Enregistrer.');
      } else if (asyncParseStatus === 'PARSED') {
        setIsEditing(true);
        toast.success('CV analysé avec succès. Vérifiez et complétez votre profil.');
      }
    } catch (error) {
      toast.error(
        getCandidatePortalErrorMessage(
          error,
          "Impossible d'uploader ou d'analyser le CV",
        ),
      );
    } finally {
      setIsUploadingCv(false);
      setIsParsingCv(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const buildEducationPayload = (item: EducationDraft) => {
    const diplomaOption = findMatchingOption(
      diplomaOptions,
      item.degree,
      item.diplomaLabel,
    );

    return {
      level_code: item.levelCode || null,
      level_ref_id: item.levelRefId || null,
      degree: diplomaOption?.code ?? item.degree ?? null,
      diploma_label: diplomaOption?.label ?? item.diplomaLabel ?? item.degree ?? null,
      diploma_code: item.diplomaRefId ? null : ((diplomaOption?.code ?? item.degree) || null),
      diploma_ref_id: item.diplomaRefId || null,
      specialty: item.specialty || null,
      specialty_code: item.specialtyRefId ? null : (item.specialty || null),
      specialty_ref_id: item.specialtyRefId || null,
      institution: item.institution || null,
      start_date: item.startDate || null,
      end_date: item.endDate || null,
      graduation_year: toNullableYear(item.graduationYear),
      location: item.location || null,
      honors: item.honors || null,
      gpa: item.gpa || null,
    };
  };

  const buildExperiencePayload = (item: ExperienceDraft) => {
    // Compose structured geo parts + free text into a single location string
    const geoParts = [item.locationDelegLabel, item.locationGovLabel]
      .filter(Boolean);
    if (item.locationCountry && item.locationCountry !== 'TN' && geoParts.length === 0) {
      geoParts.push(item.locationCountry);
    }
    const composedLocation = [...geoParts, item.location].filter(Boolean).join(', ') || null;
    return ({
    occupation_node_id: item.occupationNodeId || null,
    job_title_raw:
      item.entryType === 'internship'
        ? item.jobTitleRaw
          ? /stage|internship|intern/i.test(item.jobTitleRaw)
            ? item.jobTitleRaw
            : `Stage - ${item.jobTitleRaw}`
          : 'Stage'
        : item.jobTitleRaw || null,
    company_name: item.companyName || null,
    sector: item.sector || null,
    sector_ref_id: item.sectorRefId || null,
    location: composedLocation,
    start_date: item.startDate || null,
    end_date: item.isCurrent ? null : (item.endDate || null),
    is_current: item.isCurrent,
    duration_months: toNullableNumber(item.durationMonths),
    duration_years: toNullableNumber(item.durationYears),
    description: item.description || null,
    responsibilities:
      item.responsibilities.length > 0 ? item.responsibilities : null,
    technologies: item.technologies.length > 0 ? item.technologies : null,
    projects: item.projects.length > 0 ? item.projects : null,
    entry_type:
      item.entryType ||
      (isInternshipExperience(item) ? 'internship' : 'experience'),
  });
  };

  // ── aggregate PATCH helper ──────────────────────────────────────────────────
  const patchProfileMutation = usePatchCandidateProfileMutation();

  /** Convert draft+saved into a {upsert, delete_ids} changeset section. */
  function buildCollectionChangeset<
    TSaved extends { id: string },
    TDraft extends { id?: string },
  >(
    saved: TSaved[],
    draft: TDraft[],
    hasValue: (item: TDraft) => boolean,
    buildPayload: (item: TDraft) => Record<string, unknown>,
  ): { upsert: Array<Record<string, unknown> & { id?: string }>; delete_ids: string[] } {
    const keptIds = new Set(
      draft.map((item) => item.id).filter((id): id is string => Boolean(id)),
    );
    const delete_ids = saved
      .filter((item) => !keptIds.has(item.id))
      .map((item) => item.id);
    const upsert = draft
      .filter(hasValue)
      .map((item) => ({ ...buildPayload(item), ...(item.id ? { id: item.id } : {}) }));
    return { upsert, delete_ids };
  }

  const handleSave = async () => {
    if (!bundle || !currentDraft) {
      return;
    }

    setIsSaving(true);

    const normalizedKeywords = normalizeKeywordList(interestKeywordsDraft);
    const requestedThreshold = normalizeCandidateMinimumOfferScore(minimumOfferScoreDraft);

    try {
      // ── Fast path: single aggregate PATCH ────────────────────────────────
      const changeset: CandidateProfilePatchPayload = {
        candidate: { primary_language: currentDraft.primaryLanguage || null },
        identity: {
          cin: currentDraft.cin || null,
          passport_number: currentDraft.passportNumber || null,
          first_name: currentDraft.firstName || 'Unknown',
          last_name: currentDraft.lastName || 'Candidate',
          birth_date: currentDraft.birthDate || null,
          gender_code: currentDraft.genderCode || null,
          nationality: currentDraft.nationality || null,
          nationality_country_id: currentDraft.nationalityCountryId || null,
          code_handicap: currentDraft.codeHandicap || null,
          code_degre_handicap: currentDraft.codeHandicap && currentDraft.codeHandicap !== '0'
            ? currentDraft.codeDegreHandicap || null
            : null,
        },
        contact: {
          email: currentDraft.email || null,
          phone: currentDraft.phone || null,
          address: currentDraft.address || null,
          country: currentDraft.country || 'TN',
          governorate_code: currentDraft.governorateCode || null,
          delegation_code: currentDraft.delegationCode || null,
        },
        preference: {
          preferred_contract_type: currentDraft.preferredContractType || null,
          preferred_governorate: currentDraft.preferredGovernorate || null,
          mobility_radius_km: toNullableNumber(currentDraft.mobilityRadiusKm),
          accepts_relocation: currentDraft.acceptsRelocation,
          desired_salary_min: toNullableNumber(currentDraft.desiredSalaryMin),
          desired_salary_max: toNullableNumber(currentDraft.desiredSalaryMax),
        },
        education: buildCollectionChangeset(
          bundle.education, currentDraft.education,
          hasEducationValue, buildEducationPayload,
        ),
        experience: buildCollectionChangeset(
          bundle.experience, currentDraft.experience,
          hasExperienceValue, buildExperiencePayload,
        ),
        skills: buildCollectionChangeset(
          bundle.skills, currentDraft.skills,
          hasSkillValue,
          (item) => ({
            skill_node_id: item.skillNodeId || null,
            skill_id: item.skillNodeId || null, // backward compat
            skill_label_raw: item.skillLabelRaw || null,
            skill_node_type: item.skillNodeType || 'SKILL',
            level: item.level || null,
            years: toNullableNumber(item.years),
            evidence: item.evidence || null,
            source: 'MANUAL',
          }),
        ),
        languages: buildCollectionChangeset(
          bundle.languages, currentDraft.languages,
          hasLanguageValue,
          (item) => ({
            language_code: item.languageCode || 'fr',
            level: item.level || null,
            evidence: item.evidence || null,
          }),
        ),
        keywords: normalizedKeywords,
        offer_threshold: requestedThreshold,
      };

      try {
        const result = await patchProfileMutation.mutateAsync(changeset);
        // Use the returned aggregate to refresh state — no fan-out refetch.
        const updatedBundle = mapAggregateToBundle(result, bundle.cvRecords);
        setDraft(toDraft(updatedBundle));
        const persistedThreshold = normalizeCandidateMinimumOfferScore(result.offer_threshold);
        setStoredCandidateInterestKeywords(result.keywords);
        setStoredCandidateMinimumOfferScore(persistedThreshold);
        queryClient.setQueryData(queryKeys.candidate.keywords(), toKeywordRecords(result.keywords));
        queryClient.setQueryData(queryKeys.candidate.offerThreshold(), { minThreshold: persistedThreshold });
        setInterestKeywordsDraft(result.keywords);
        setMinimumOfferScoreDraft(persistedThreshold);
        setLatestParseResult(null);
    
        setIsEditing(false);
        toast.success('Votre profil a été enregistré.');
        return;
      } catch (aggregateError) {
        // Fall through to legacy sequential approach only when the aggregate
        // endpoint is not yet deployed (404/405).
        if (!isEndpointUnavailableError(aggregateError)) {
          throw aggregateError;
        }
      }

      // ── Legacy fallback: sequential individual calls ───────────────────
      await gatewayApi.candidate.updateProfile({
        primary_language: currentDraft.primaryLanguage || null,
      });

      await gatewayApi.candidate.updateIdentity({
        cin: currentDraft.cin || null,
        passport_number: currentDraft.passportNumber || null,
        first_name: currentDraft.firstName || 'Unknown',
        last_name: currentDraft.lastName || 'Candidate',
        birth_date: currentDraft.birthDate || null,
        gender_code: currentDraft.genderCode || null,
        nationality: currentDraft.nationality || null,
        code_handicap: currentDraft.codeHandicap || null,
        code_degre_handicap:
          currentDraft.codeHandicap && currentDraft.codeHandicap !== '0'
            ? currentDraft.codeDegreHandicap || null
            : null,
      });

      await gatewayApi.candidate.updateContact({
        email: currentDraft.email || null,
        phone: currentDraft.phone || null,
        address: currentDraft.address || null,
        country: currentDraft.country || 'TN',
        governorate_code: currentDraft.governorateCode || null,
        delegation_code: currentDraft.delegationCode || null,
      });

      await gatewayApi.candidate.updatePreference({
        preferred_contract_type: currentDraft.preferredContractType || null,
        preferred_governorate: currentDraft.preferredGovernorate || null,
        mobility_radius_km: toNullableNumber(currentDraft.mobilityRadiusKm),
        accepts_relocation: currentDraft.acceptsRelocation,
        desired_salary_min: toNullableNumber(currentDraft.desiredSalaryMin),
        desired_salary_max: toNullableNumber(currentDraft.desiredSalaryMax),
      });

      await syncDraftCollection<CandidateEducationRecord, EducationDraft>(
        bundle.education,
        currentDraft.education,
        hasEducationValue,
        (item) =>
          gatewayApi.candidate.createEducation(buildEducationPayload(item)),
        (item) =>
          gatewayApi.candidate.updateEducation(
            item.id!,
            buildEducationPayload(item),
          ),
        (id) => gatewayApi.candidate.deleteEducation(id),
      );

      await syncDraftCollection<CandidateExperienceRecord, ExperienceDraft>(
        bundle.experience,
        currentDraft.experience,
        hasExperienceValue,
        (item) =>
          gatewayApi.candidate.createExperience(buildExperiencePayload(item)),
        (item) =>
          gatewayApi.candidate.updateExperience(
            item.id!,
            buildExperiencePayload(item),
          ),
        (id) => gatewayApi.candidate.deleteExperience(id),
      );

      await syncDraftCollection<CandidateSkillRecord, SkillDraft>(
        bundle.skills,
        currentDraft.skills,
        hasSkillValue,
        (item) =>
          gatewayApi.candidate.createSkill({
            skill_node_id: item.skillNodeId || null,
            skill_label_raw: item.skillLabelRaw || null,
            skill_node_type: item.skillNodeType || 'SKILL',
            level: item.level || null,
            years: toNullableNumber(item.years),
            evidence: item.evidence || null,
            source: 'MANUAL',
          }),
        (item) =>
          gatewayApi.candidate.updateSkill(item.id!, {
            skill_node_id: item.skillNodeId || null,
            skill_label_raw: item.skillLabelRaw || null,
            skill_node_type: item.skillNodeType || 'SKILL',
            level: item.level || null,
            years: toNullableNumber(item.years),
            evidence: item.evidence || null,
            source: 'MANUAL',
          }),
        (id) => gatewayApi.candidate.deleteSkill(id),
      );

      await syncDraftCollection<CandidateLanguageRecord, LanguageDraft>(
        bundle.languages,
        currentDraft.languages,
        hasLanguageValue,
        (item) =>
          gatewayApi.candidate.createLanguage({
            language_code: item.languageCode || 'fr',
            level: item.level || null,
            evidence: item.evidence || null,
          }),
        (item) =>
          gatewayApi.candidate.updateLanguage(item.id!, {
            language_code: item.languageCode || 'fr',
            level: item.level || null,
            evidence: item.evidence || null,
          }),
        (id) => gatewayApi.candidate.deleteLanguage(id),
      );

      let persistedKeywords = toKeywordRecords(normalizedKeywords);

      try {
        persistedKeywords =
          await gatewayApi.candidate.replaceKeywords(normalizedKeywords);
      } catch (error) {
        if (!isEndpointUnavailableError(error)) {
          throw error;
        }
      }

      setStoredCandidateInterestKeywords(
        persistedKeywords.map((item) => item.keyword),
      );
      queryClient.setQueryData(
        queryKeys.candidate.keywords(),
        persistedKeywords,
      );

      let persistedMinimumOfferScore = requestedThreshold;

      try {
        const thresholdRecord = await gatewayApi.candidate.updateOfferThreshold(
          requestedThreshold,
        );
        persistedMinimumOfferScore = normalizeCandidateMinimumOfferScore(
          thresholdRecord?.minThreshold ?? requestedThreshold,
        );
      } catch (error) {
        if (!isEndpointUnavailableError(error)) {
          throw error;
        }
      }

      setStoredCandidateMinimumOfferScore(persistedMinimumOfferScore);
      queryClient.setQueryData(queryKeys.candidate.offerThreshold(), {
        minThreshold: persistedMinimumOfferScore,
      });

      const updatedBundle = await refetchCandidateBundle();
      await refreshCandidateViews();
      setDraft(toDraft(updatedBundle));
      setLatestParseResult(null);
      setInterestKeywordsDraft(persistedKeywords.map((item) => item.keyword));
      setMinimumOfferScoreDraft(persistedMinimumOfferScore);
  
      setIsEditing(false);
      toast.success('Votre profil a été enregistré.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer votre profil.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (bundleQuery.isLoading && !currentDraft) {
    return <LoadingCard text="Chargement de votre profil..." />;
  }

  if (isMissingCandidateProfile) {
    return <CandidateProfileOnboardingCard />;
  }

  if (bundleQuery.isError) {
    return (
      <ErrorCard
        queryResult={bundleQuery}
        text="Impossible de charger votre profil."
      />
    );
  }

  if (!currentDraft) {
    return <LoadingCard text="Préparation de votre profil..." />;
  }

  return (
    <div className="relative space-y-6">
      {/* {isUploadingCv || isParsingCv ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-background px-6 py-5 text-center shadow-lg">
            <div className="flex items-center justify-center gap-3 text-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm font-medium">
                {isParsingCv
                  ? 'CV importé. Analyse de votre CV en cours...'
                  : 'Import du CV en cours...'}
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Merci de patienter avant toute autre action.
            </p>
          </div>
        </div>
      ) : null} */}
      <PageHeader
        title="Mon profil"
        description="Retrouvez vos informations, vos compétences et vos préférences au même endroit."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={(event) =>
                void handleUploadCv(event.target.files?.[0] ?? null)
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleOpenCurrentCv()}
              disabled={!currentCv || isOpeningCv}
            >
              <Eye className="h-4 w-4" />
              Afficher le CV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCv || isParsingCv}
            >
              {isUploadingCv || isParsingCv ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {isUploadingCv
                ? 'Import...'
                : isParsingCv
                  ? 'Analyse...'
                  : 'Uploader un CV'}
            </Button>
            {!isEditing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startEditing}
                disabled={isUploadingCv || isParsingCv}
              >
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4" />
                  Annuler
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isUploadingCv || isParsingCv || isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </>
            )}
          </div>
        }
      />

      <article className="panel-elevated overflow-hidden card-border-top">
        <ProfileOverviewSection
          displayName={displayName}
          displayLocation={displayLocation}
          email={currentDraft.email}
          primaryLanguageLabel={primaryLanguageLabel}
          languageCount={languageItems.length}
          minimumOfferScore={savedMinimumOfferScore}
        />

        <div className="space-y-4 px-6 py-7 sm:px-8">
          {!isEditing ? (
            <>
              <ReadOnlyGridSection
                title="Informations complémentaires"
                description="Les informations utiles en complément des éléments déjà visibles dans l'en-tête."
                icon={UserRound}
                iconClassName="icon-background-color-3"
                emptyMessage="Aucune information complémentaire renseignée."
                items={[
                  { label: 'Téléphone', value: currentDraft.phone },
                  { label: 'Nationalité', value: currentDraft.nationality },
                  {
                    label: 'Date de naissance',
                    value: formatCandidateDate(currentDraft.birthDate),
                  },
                  { label: 'Genre', value: selectedGenderLabel },
                  { label: 'Gouvernorat', value: selectedGovernorateLabel },
                  { label: 'Délégation', value: selectedDelegationLabel },
                  { label: 'CIN', value: currentDraft.cin },
                  { label: 'Passeport', value: currentDraft.passportNumber },
                  {
                    label: 'Handicap',
                    value: bundle.identity?.handicap_label ?? 'Aucun',
                  },
                  ...(bundle.identity?.code_handicap &&
                    bundle.identity.code_handicap !== '0'
                    ? [
                      {
                        label: 'Degré de handicap',
                        value:
                          bundle.identity?.degre_handicap_label ??
                          'Non renseigné',
                      },
                    ]
                    : []),
                ]}
              />
              <div className="profile-border-left-orange">
                <EducationReadOnly items={educationItems} />

                <Separator className="bg-accent/70" />

                <ExperienceReadOnlySection
                  title="Expériences professionnelles"
                  description="Vos expériences professionnelles renseignées."
                  items={professionalExperiences}
                  emptyMessage="Aucune expérience professionnelle renseignée."
                />

                <Separator className="bg-accent/70" />

                <ExperienceReadOnlySection
                  title="Stages"
                  description="Vos stages et expériences de type internship."
                  items={internshipExperiences}
                  emptyMessage="Aucun stage renseigné."
                />

                <Separator className="bg-accent/70" />

                <SkillsReadOnly items={skillItems} />

                <Separator className="bg-accent/70" />

                <LanguagesReadOnly items={languageItems} />

                {certificationItems.length > 0 ? (
                  <>
                    <Separator className="bg-accent/70" />
                    <CertificationsReadOnly items={certificationItems} />
                  </>
                ) : null}

                {projectItems.length > 0 ? (
                  <>
                    <Separator className="bg-accent/70" />
                    <ProjectsReadOnly items={projectItems} />
                  </>
                ) : null}
              </div>
              {/* <Separator className="bg-accent/70" /> */}

              <div className="profile-border-left-19">
                <InterestsReadOnly keywords={visibleInterestKeywords} />
              </div>

              {/* <Separator className="bg-primary/40" /> */}
              <div className="profile-border-left-20">
                <ReadOnlyGridSection
                  title="Préférences professionnelles"
                  description="Vos critères de contrat, de mobilité et de rémunération."
                  icon={Globe2}
                  iconClassName="icon-background-color-20"
                  emptyMessage="Aucune préférence professionnelle renseignée."
                  items={[
                    {
                      label: 'Type de contrat souhaité',
                      value: preferredContractTypeLabel,
                    },
                    {
                      label: 'Gouvernorat souhaité',
                      value: preferredGovernorateLabel,
                    },
                    {
                      label: 'Rayon de mobilité',
                      value: currentDraft.mobilityRadiusKm
                        ? `${currentDraft.mobilityRadiusKm} km`
                        : null,
                    },
                    {
                      label: 'Mobilité élargie',
                      value: formatBooleanLabel(currentDraft.acceptsRelocation),
                    },
                    {
                      label: 'Salaire minimum souhaité',
                      value: currentDraft.desiredSalaryMin
                        ? `${currentDraft.desiredSalaryMin}`
                        : null,
                    },
                    {
                      label: 'Salaire maximum souhaité',
                      value: currentDraft.desiredSalaryMax
                        ? `${currentDraft.desiredSalaryMax}`
                        : null,
                    },
                  ]}
                />
              </div>
              {/* <Separator className="bg-primary/40" /> */}

              {/* <RecommendationPreferencesReadOnly
                  minimumOfferScore={savedMinimumOfferScore}
                /> */}
            </>
          ) : (
            <>
              <section className="space-y-6 px-6 py-6 sm:px-8">
                <SectionTitle
                  title="Informations personnelles"
                  description="Mettez à jour vos informations personnelles et vos coordonnées."
                  icon={UserRound}
                  iconClassName="icon-background-color-3"
                />

                {/* ── Identité ────────────────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identité
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Prénom"
                      value={currentDraft.firstName}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, firstName: value } : current,
                        )
                      }
                    />
                    <Field
                      label="Nom"
                      value={currentDraft.lastName}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, lastName: value } : current,
                        )
                      }
                    />
                    <Field
                      label="Date de naissance"
                      type="date"
                      value={currentDraft.birthDate}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, birthDate: value } : current,
                        )
                      }
                    />
                    <OptionSelect
                      label="Genre"
                      value={currentDraft.genderCode}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, genderCode: value } : current,
                        )
                      }
                      options={gendersQuery.data ?? []}
                      placeholder="Sélectionner"
                    />
                    <OptionSelect
                      label="Nationalité"
                      value={currentDraft.nationalityCountryId || currentDraft.nationality}
                      onChange={(value) => {
                        const country = (geoCountriesQuery.data ?? []).find(
                          (c) => c.id === value || c.iso2 === value,
                        );
                        setDraft((current) =>
                          current
                            ? {
                              ...current,
                              nationalityCountryId: country?.id ?? value,
                              nationality: country?.iso2 ?? value,
                            }
                            : current,
                        );
                      }}
                      options={(geoCountriesQuery.data ?? []).map((c) => ({
                        code: c.id,
                        label: c.name_fr ?? c.iso2,
                      }))}
                      placeholder="Sélectionner un pays"
                    />
                  </div>
                </div>

                {/* ── Contact ─────────────────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="E-mail"
                      value={currentDraft.email}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, email: value } : current,
                        )
                      }
                    />
                    <Field
                      label="Téléphone"
                      value={currentDraft.phone}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, phone: value } : current,
                        )
                      }
                    />
                    <SelectField
                      label="Langue principale"
                      value={currentDraft.primaryLanguage}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, primaryLanguage: value }
                            : current,
                        )
                      }
                      options={languagesQuery.data ?? []}
                      placeholder="Choisir une langue"
                    />
                  </div>
                </div>

                {/* ── Adresse de résidence ─────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Adresse de résidence
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <GeoAddressFields
                      value={{
                        countryIso2: currentDraft.country,
                        adminUnit1Code: currentDraft.governorateCode,
                        adminUnit1Label: selectedGovernorateLabel,
                        adminUnit2Code: currentDraft.delegationCode,
                        adminUnit2Label: selectedDelegationLabel,
                      }}
                      onChange={(geo) =>
                        setDraft((current) =>
                          current
                            ? {
                              ...current,
                              country: geo.countryIso2 || 'TN',
                              governorateCode: geo.adminUnit1Code,
                              delegationCode: geo.adminUnit2Code,
                              preferredGovernorate:
                                current.preferredGovernorate || geo.adminUnit1Code,
                            }
                            : current,
                        )
                      }
                    />
                    <div className="md:col-span-2">
                      <Field
                        label="Adresse (complément libre)"
                        value={currentDraft.address}
                        onChange={(value) =>
                          setDraft((current) =>
                            current ? { ...current, address: value } : current,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* ── Documents d'identité ─────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Documents d'identité
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="CIN"
                      value={currentDraft.cin}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, cin: value } : current,
                        )
                      }
                    />
                    <Field
                      label="Passeport"
                      value={currentDraft.passportNumber}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, passportNumber: value }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>

                {/* ── Situation particulière ───────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Situation particulière
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="codeHandicap">Type de handicap</Label>
                      <Select
                        value={draft.codeHandicap || '0'}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            codeHandicap: value,
                            codeDegreHandicap:
                              value === '0' ? '' : current.codeDegreHandicap,
                          }))
                        }
                      >
                        <SelectTrigger id="codeHandicap">
                          <SelectValue placeholder="Sélectionner un type de handicap" />
                        </SelectTrigger>
                        <SelectContent>
                          {(handicapTypesQuery.data ?? []).map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codeDegreHandicap">Degré de handicap</Label>
                      <Select
                        value={draft.codeDegreHandicap || 'none'}
                        disabled={!draft.codeHandicap || draft.codeHandicap === '0'}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            codeDegreHandicap: value === 'none' ? '' : value,
                          }))
                        }
                      >
                        <SelectTrigger id="codeDegreHandicap">
                          <SelectValue placeholder="Sélectionner un degré" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non renseigné</SelectItem>
                          {(handicapDegreesQuery.data ?? []).map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              <div className="profile-border-left-orange">
                <CollectionSection<EducationDraft>
                  title="Formations et diplômes"
                  description="Vos diplômes, niveaux et établissements renseignés."
                  icon={GraduationCap}
                  iconClassName="icon-background-color-7"
                  items={currentDraft.education}
                  setItems={(updater) =>
                    setDraft((current) =>
                      current
                        ? {
                          ...current,
                          education:
                            typeof updater === 'function'
                              ? updater(current.education)
                              : updater,
                        }
                        : current,
                    )
                  }
                  emptyItem={emptyEducation}
                  isEditing
                  emptyStateMessage="Aucune formation renseignée."
                  renderItem={(item, update) => {
                    // Canonical reference dropdowns ────────────────────────
                    const diplomaOpts = (canonicalDiplomasQuery.data ?? []).map(
                      (v) => ({ code: v.id, label: v.label_fr ?? v.label }),
                    );
                    const specialtyOpts = (specialtiesQuery.data ?? []).map(
                      (v) => ({ code: v.id, label: v.label_fr ?? v.label }),
                    );
                    // Fallback to old referentials if canonical is empty ────
                    const finalDiplomaOpts =
                      diplomaOpts.length > 0
                        ? diplomaOpts
                        : buildOptionsWithCurrentValue(
                          diplomaOptions,
                          item.degree,
                          item.diplomaLabel,
                        );

                    return (
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* level_ref_id kept internally — derived from diploma; not shown */}
                        <OptionSelect
                          label="Diplôme"
                          value={item.diplomaRefId || item.degree}
                          onChange={(value) => {
                            const opt = finalDiplomaOpts.find((o) => o.code === value);
                            update({
                              ...item,
                              diplomaRefId: value,
                              degree: opt?.code ?? value,
                              diplomaLabel: opt?.label ?? '',
                            });
                          }}
                          options={finalDiplomaOpts}
                          placeholder="Choisir un diplôme"
                        />
                        {specialtyOpts.length > 0 ? (
                          <OptionSelect
                            label="Spécialité"
                            value={item.specialtyRefId || item.specialty}
                            onChange={(value) => {
                              const opt = specialtyOpts.find((o) => o.code === value);
                              update({
                                ...item,
                                specialtyRefId: value,
                                specialty: opt?.label ?? value,
                              });
                            }}
                            options={specialtyOpts}
                            placeholder="Choisir une spécialité"
                          />
                        ) : (
                          <Field
                            label="Spécialité"
                            value={item.specialty}
                            onChange={(value) => update({ ...item, specialty: value })}
                          />
                        )}
                        <Field
                          label="Établissement"
                          value={item.institution}
                          onChange={(value) =>
                            update({ ...item, institution: value })
                          }
                        />
                        <Field
                          label="Année d'obtention"
                          type="number"
                          value={item.graduationYear}
                          onChange={(value) =>
                            update({ ...item, graduationYear: value })
                          }
                        />
                        <div className="md:col-span-2">
                          <Field
                            label="Mention"
                            value={item.honors}
                            onChange={(value) =>
                              update({ ...item, honors: value })
                            }
                          />
                        </div>
                      </div>
                    );
                  }}
                  viewItem={() => null}
                />

                <Separator className="bg-accent/70" />

                <CollectionSection<ExperienceDraft>
                  title="Expériences professionnelles"
                  description="Vos expériences professionnelles."
                  icon={Briefcase}
                  iconClassName="icon-background-color-7"
                  items={professionalExperienceDrafts}
                  setItems={(updater) =>
                    replaceExperienceDrafts('professional', updater)
                  }
                  emptyItem={() => ({
                    ...emptyExperience(),
                    entryType: 'experience',
                  })}
                  isEditing
                  emptyStateMessage="Aucune expérience professionnelle renseignée."
                  renderItem={(item, update) => (
                    <ExperienceDraftFields
                      item={item}
                      update={update}
                      type="experience"
                      sectorOptions={(activitySectorsQuery.data ?? []).map(
                        (v) => ({ code: v.id, label: v.label_fr ?? v.label }),
                      )}
                    />
                  )}
                  viewItem={() => null}
                />

                <Separator className="bg-accent/70" />

                <CollectionSection<ExperienceDraft>
                  title="Stages"
                  description="Vos stages et expériences de type internship."
                  icon={Briefcase}
                  iconClassName="icon-background-color-7"
                  items={internshipExperienceDrafts}
                  setItems={(updater) =>
                    replaceExperienceDrafts('internship', updater)
                  }
                  emptyItem={() => ({
                    ...emptyExperience(),
                    entryType: 'internship',
                  })}
                  isEditing
                  emptyStateMessage="Aucun stage renseigné."
                  renderItem={(item, update) => (
                    <ExperienceDraftFields
                      item={item}
                      update={update}
                      type="internship"
                      sectorOptions={(activitySectorsQuery.data ?? []).map(
                        (v) => ({ code: v.id, label: v.label_fr ?? v.label }),
                      )}
                    />
                  )}
                  viewItem={() => null}
                />

                <Separator className="bg-accent/70" />

                <CollectionSection<SkillDraft>
                  title="Compétences techniques"
                  description="Compétences métier et techniques (RTMC SKILL)."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                  items={technicalSkillDrafts}
                  setItems={(updater) => replaceSkillDrafts('technical', updater)}
                  emptyItem={() => emptySkill('SKILL')}
                  isEditing
                  emptyStateMessage="Aucune compétence technique renseignée."
                  renderItem={(item, update) => (
                    <SkillPicker item={item} update={update} nodeType="SKILL" />
                  )}
                  viewItem={() => null}
                />

                <Separator className="bg-accent/70" />

                <CollectionSection<SkillDraft>
                  title="Compétences transversales"
                  description="Soft skills et compétences comportementales (RTMC SOFT_SKILL)."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                  items={softSkillDrafts}
                  setItems={(updater) => replaceSkillDrafts('soft', updater)}
                  emptyItem={() => emptySkill('SOFT_SKILL')}
                  isEditing
                  emptyStateMessage="Aucune compétence transversale renseignée."
                  renderItem={(item, update) => (
                    <SkillPicker item={item} update={update} nodeType="SOFT_SKILL" />
                  )}
                  viewItem={() => null}
                />

                <Separator className="bg-accent/70" />

                <CollectionSection<LanguageDraft>
                  title="Langues"
                  description="Les langues que vous maîtrisez."
                  icon={Languages}
                  iconClassName="icon-background-color-7"
                  items={currentDraft.languages}
                  setItems={(updater) =>
                    setDraft((current) =>
                      current
                        ? {
                          ...current,
                          languages:
                            typeof updater === 'function'
                              ? updater(current.languages)
                              : updater,
                        }
                        : current,
                    )
                  }
                  emptyItem={emptyLanguage}
                  isEditing
                  emptyStateMessage="Aucune langue renseignée."
                  renderItem={(item, update) => (
                    <div className="grid gap-3 md:grid-cols-2">
                      <OptionSelect
                        label="Langue"
                        value={resolveOptionValue(
                          languagesQuery.data ?? [],
                          item.languageCode,
                          formatCandidateLanguageLabel(item.languageCode),
                        )}
                        onChange={(value) =>
                          update({ ...item, languageCode: value })
                        }
                        options={buildOptionsWithCurrentValue(
                          languagesQuery.data ?? [],
                          item.languageCode,
                          formatCandidateLanguageLabel(item.languageCode),
                        )}
                        placeholder="Choisir une langue"
                      />
                      <OptionSelect
                        label="Niveau"
                        value={resolveOptionValue(
                          languageLevelsQuery.data ?? [],
                          item.level,
                          formatCandidateLevelLabel(item.level),
                        )}
                        onChange={(value) => update({ ...item, level: value })}
                        options={buildOptionsWithCurrentValue(
                          languageLevelsQuery.data ?? [],
                          item.level,
                          formatCandidateLevelLabel(item.level),
                        )}
                        placeholder="Choisir un niveau"
                      />
                    </div>
                  )}
                  viewItem={() => null}
                />
              </div>
              <div className="profile-border-left-19">
                <section className="space-y-4 px-6 py-6 sm:px-8">
                  <SectionTitle
                    title="Domaines et technologies qui vous intéressent"
                    description="Mots-clés du profil candidat utilisés pour retrouver des offres pertinentes."
                    icon={Globe2}
                    iconClassName="icon-background-color-19"
                  />
                  <TaxonomyKeywordsEditor
                    keywords={interestKeywordsDraft}
                    onAdd={(keyword) => {
                      const normalized = normalizeKeyword(keyword);
                      if (normalized) {
                        setInterestKeywordsDraft((current) =>
                          normalizeKeywordList([...current, normalized]),
                        );
                      }
                    }}
                    onRemove={removeInterestKeyword}
                  />
                </section>
              </div>
              <div className="profile-border-left-20">
                <section className="space-y-4 px-6 py-6 sm:px-8">
                  <SectionTitle
                    title="Préférences professionnelles"
                    description="Vos préférences de contrat, de mobilité et de salaire."
                    icon={Globe2}
                    iconClassName="icon-background-color-20"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <OptionSelect
                      label="Type de contrat souhaité"
                      value={currentDraft.preferredContractType}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, preferredContractType: value }
                            : current,
                        )
                      }
                      options={contractTypesQuery.data ?? []}
                      placeholder="Sélectionner"
                    />
                    <OptionSelect
                      label="Gouvernorat souhaité"
                      value={currentDraft.preferredGovernorate}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, preferredGovernorate: value }
                            : current,
                        )
                      }
                      options={governoratesQuery.data ?? []}
                      placeholder="Sélectionner"
                    />
                    <Field
                      label="Rayon de mobilité (km)"
                      type="number"
                      value={currentDraft.mobilityRadiusKm}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, mobilityRadiusKm: value }
                            : current,
                        )
                      }
                    />
                    <Field
                      label="Salaire minimum souhaité"
                      type="number"
                      value={currentDraft.desiredSalaryMin}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, desiredSalaryMin: value }
                            : current,
                        )
                      }
                    />
                    <Field
                      label="Salaire maximum souhaité"
                      type="number"
                      value={currentDraft.desiredSalaryMax}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, desiredSalaryMax: value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={currentDraft.acceptsRelocation}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                              ...current,
                              acceptsRelocation: event.target.checked,
                            }
                            : current,
                        )
                      }
                    />
                    Accepte la mobilité élargie
                  </label>
                </section>
              </div>
              {/* <Separator className="bg-primary/40" /> */}
              <div className="profile-border-left-3">
                <section className="space-y-4 px-6 py-6 sm:px-8 flex justify-between items-center">
                  <SectionTitle
                    title="Préférences de recommandation"
                    description="Paramètres utilisés pour filtrer les offres compatibles."
                    icon={Globe2}
                    iconClassName="icon-background-color-3"
                  />
                  <div className="rounded-2xl border border-border bg-background p-5 md:max-w-sm">
                    <Label className="text-xs text-muted-foreground">
                      Score minimum des offres compatibles
                    </Label>
                    <Select
                      value={String(minimumOfferScoreDraft)}
                      onValueChange={(value) =>
                        setMinimumOfferScoreDraft(
                          normalizeCandidateMinimumOfferScore(Number(value)),
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {candidateOfferScoreOptions.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </section>
              </div>
            </>
          )}
          {false ? (
            <>
              <section className="space-y-4">
                <SectionTitle
                  title="Informations personnelles"
                  description="Vos informations personnelles et vos coordonnées."
                  icon={UserRound}
                  iconClassName="icon-background-color-3"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Prénom"
                    value={currentDraft.firstName}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, firstName: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Nom"
                    value={currentDraft.lastName}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, lastName: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="E-mail"
                    value={currentDraft.email}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, email: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Téléphone"
                    value={currentDraft.phone}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, phone: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Adresse"
                    value={currentDraft.address}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, address: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Nationalité"
                    value={currentDraft.nationality}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, nationality: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Date de naissance"
                    type="date"
                    value={currentDraft.birthDate}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, birthDate: value } : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <SelectField
                    label="Langue principale"
                    value={currentDraft.primaryLanguage}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, primaryLanguage: value }
                          : current,
                      )
                    }
                    options={languagesQuery.data ?? []}
                    disabled={!isEditing}
                    placeholder="Choisir une langue"
                  />
                  <OptionSelect
                    label="Genre"
                    value={currentDraft.genderCode}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, genderCode: value } : current,
                      )
                    }
                    options={gendersQuery.data ?? []}
                    placeholder="Sélectionner"
                    disabled={!isEditing}
                  />
                  <OptionSelect
                    label="Gouvernorat"
                    value={currentDraft.governorateCode}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? {
                            ...current,
                            governorateCode: value,
                            delegationCode: '',
                            preferredGovernorate:
                              current.preferredGovernorate || value,
                          }
                          : current,
                      )
                    }
                    options={governoratesQuery.data ?? []}
                    placeholder="Sélectionner"
                    disabled={!isEditing}
                  />
                  <OptionSelect
                    label="Délégation"
                    value={currentDraft.delegationCode}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, delegationCode: value }
                          : current,
                      )
                    }
                    options={delegationsQuery.data ?? []}
                    placeholder="Sélectionner"
                    disabled={!isEditing || !currentDraft.governorateCode}
                  />
                  <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
                    <Field
                      label="CIN"
                      value={currentDraft.cin}
                      onChange={(value) =>
                        setDraft((current) =>
                          current ? { ...current, cin: value } : current,
                        )
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Passeport"
                      value={currentDraft.passportNumber}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, passportNumber: value }
                            : current,
                        )
                      }
                      disabled={!isEditing}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="codeHandicap">Type de handicap</Label>
                        <Select
                          value={draft.codeHandicap || '0'}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              codeHandicap: value,
                              codeDegreHandicap:
                                value === '0' ? '' : current.codeDegreHandicap,
                            }))
                          }
                        >
                          <SelectTrigger id="codeHandicap">
                            <SelectValue placeholder="Sélectionner un type de handicap" />
                          </SelectTrigger>
                          <SelectContent>
                            {(handicapTypesQuery.data ?? []).map((item) => (
                              <SelectItem key={item.code} value={item.code}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="codeDegreHandicap">
                          Degré de handicap
                        </Label>
                        <Select
                          value={draft.codeDegreHandicap || 'none'}
                          disabled={
                            !draft.codeHandicap || draft.codeHandicap === '0'
                          }
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              codeDegreHandicap: value === 'none' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger id="codeDegreHandicap">
                            <SelectValue placeholder="Sélectionner un degré" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non renseigné</SelectItem>
                            {(handicapDegreesQuery.data ?? []).map((item) => (
                              <SelectItem key={item.code} value={item.code}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Préférences"
                  description="Vos préférences de contrat, de mobilité et de salaire."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <OptionSelect
                    label="Type de contrat souhaité"
                    value={currentDraft.preferredContractType}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, preferredContractType: value }
                          : current,
                      )
                    }
                    options={contractTypesQuery.data ?? []}
                    placeholder="Sélectionner"
                    disabled={!isEditing}
                  />
                  <OptionSelect
                    label="Gouvernorat souhaité"
                    value={currentDraft.preferredGovernorate}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, preferredGovernorate: value }
                          : current,
                      )
                    }
                    options={governoratesQuery.data ?? []}
                    placeholder="Sélectionner"
                    disabled={!isEditing}
                  />
                  <Field
                    label="Rayon de mobilité (km)"
                    type="number"
                    value={currentDraft.mobilityRadiusKm}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, mobilityRadiusKm: value }
                          : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Mobilité élargie"
                    value={formatBooleanLabel(currentDraft.acceptsRelocation)}
                    onChange={() => undefined}
                    disabled
                  />
                  <Field
                    label="Salaire minimum souhaité"
                    type="number"
                    value={currentDraft.desiredSalaryMin}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, desiredSalaryMin: value }
                          : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                  <Field
                    label="Salaire maximum souhaité"
                    type="number"
                    value={currentDraft.desiredSalaryMax}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? { ...current, desiredSalaryMax: value }
                          : current,
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                {isEditing ? (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={currentDraft.acceptsRelocation}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                              ...current,
                              acceptsRelocation: event.target.checked,
                            }
                            : current,
                        )
                      }
                    />
                    Accepte la mobilité élargie
                  </label>
                ) : null}
              </section>

              <Separator className="bg-primary/40" />

              <CollectionSection<EducationDraft>
                title="Formations et diplômes"
                description="Vos diplômes, niveaux et établissements renseignés."
                icon={GraduationCap}
                iconClassName="icon-background-color-7"
                items={currentDraft?.education}
                setItems={(updater) =>
                  setDraft((current) =>
                    current
                      ? {
                        ...current,
                        education:
                          typeof updater === 'function'
                            ? updater(current.education)
                            : updater,
                      }
                      : current,
                  )
                }
                emptyItem={emptyEducation}
                isEditing={isEditing}
                emptyStateMessage="Aucune formation renseignée."
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Niveau"
                      value={item.levelCode}
                      onChange={(value) =>
                        update({ ...item, levelCode: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Diplôme"
                      value={item.diplomaLabel}
                      onChange={(value) =>
                        update({ ...item, diplomaLabel: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Spécialité"
                      value={item.specialty}
                      onChange={(value) =>
                        update({ ...item, specialty: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Établissement"
                      value={item.institution}
                      onChange={(value) =>
                        update({ ...item, institution: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Année d'obtention"
                      type="number"
                      value={item.graduationYear}
                      onChange={(value) =>
                        update({ ...item, graduationYear: value })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                )}
                renderListView={() => (
                  <div className="space-y-4">
                    {educationItems.length > 0 ? (
                      educationItems.map((item, index) => {
                        const dateRange =
                          formatCandidateDateRange(
                            item.startDate,
                            item.endDate,
                          ) ?? item.graduationYear;
                        const metadata = [
                          item.levelCode ? `Niveau : ${item.levelCode}` : null,
                          item.specialty,
                          item.location,
                          item.honors,
                          item.gpa ? `GPA : ${item.gpa}` : null,
                        ].filter(Boolean);

                        return (
                          <article
                            key={`education-view-${index}`}
                            className="rounded-2xl border border-border bg-background p-5"
                          >
                            <h3 className="text-base font-semibold text-foreground">
                              {item.degree ??
                                item.diplomaLabel ??
                                item.levelCode ??
                                'Formation'}
                            </h3>
                            {item.diplomaLabel &&
                              item.diplomaLabel !== item.degree ? (
                              <p className="mt-1 text-sm text-foreground">
                                {item.diplomaLabel}
                              </p>
                            ) : null}
                            {item.institution || dateRange ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {[item.institution, dateRange]
                                  .filter(Boolean)
                                  .join(' - ')}
                              </p>
                            ) : null}
                            {metadata.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {metadata.map((value) => (
                                  <SkillTag
                                    key={`${index}-${value}`}
                                    label={value}
                                    variant="outline"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                        Aucune formation renseignée.
                      </div>
                    )}
                  </div>
                )}
                viewItem={(item) => (
                  <>
                    <h3 className="text-base font-semibold text-foreground">
                      {item.diplomaLabel || item.levelCode || 'Formation'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[item.institution, item.specialty, item.graduationYear]
                        .filter(Boolean)
                        .join(' - ')}
                    </p>
                  </>
                )}
              />

              <Separator className="bg-primary/40" />

              <CollectionSection<ExperienceDraft>
                title="Parcours professionnel"
                description="Vos expériences professionnelles et vos stages, affichés séparément."
                icon={Briefcase}
                iconClassName="icon-background-color-7"
                items={currentDraft?.experience}
                setItems={(updater) =>
                  setDraft((current) =>
                    current
                      ? {
                        ...current,
                        experience:
                          typeof updater === 'function'
                            ? updater(current.experience)
                            : updater,
                      }
                      : current,
                  )
                }
                emptyItem={emptyExperience}
                isEditing={isEditing}
                emptyStateMessage="Aucune expérience renseignée."
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Intitulé du poste"
                      value={item.jobTitleRaw}
                      onChange={(value) =>
                        update({ ...item, jobTitleRaw: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Entreprise"
                      value={item.companyName}
                      onChange={(value) =>
                        update({ ...item, companyName: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Secteur"
                      value={item.sector}
                      onChange={(value) => update({ ...item, sector: value })}
                      disabled={!isEditing}
                    />
                    <Field
                      label="Date de début"
                      type="date"
                      value={item.startDate}
                      onChange={(value) =>
                        update({ ...item, startDate: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Date de fin"
                      type="date"
                      value={item.endDate}
                      onChange={(value) => update({ ...item, endDate: value })}
                      disabled={!isEditing}
                    />
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        Description
                      </Label>
                      <Textarea
                        value={item.description}
                        onChange={(event) =>
                          update({ ...item, description: event.target.value })
                        }
                        className="mt-1.5 min-h-[96px]"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                )}
                renderListView={() => {
                  const renderExperienceCard = (
                    item: DisplayExperienceItem,
                    index: number,
                    fallbackTitle: string,
                  ) => {
                    const period = formatCandidateDateRange(
                      item.startDate,
                      item.endDate,
                      item.isCurrent,
                    );
                    const duration = formatDurationLabel(
                      item.durationMonths,
                      item.durationYears,
                    );
                    const projects = item.projects.filter(
                      (project) =>
                        project.name ||
                        project.description ||
                        project.technologies.length > 0,
                    );

                    return (
                      <div
                        key={`${fallbackTitle}-${index}`}
                        className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {item.title ?? fallbackTitle}
                        </p>
                        {item.company || item.location ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[item.company, item.location]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        ) : null}
                        {period || duration ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {period ? <span>{period}</span> : null}
                            {duration ? <span>{duration}</span> : null}
                          </div>
                        ) : null}
                        {item.description ? (
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            {item.description}
                          </p>
                        ) : null}
                        {item.responsibilities.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                            {item.responsibilities.map((responsibility) => (
                              <li key={responsibility}>{responsibility}</li>
                            ))}
                          </ul>
                        ) : null}
                        {item.technologies.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.technologies.map((technology) => (
                              <SkillTag
                                key={technology}
                                label={technology}
                                variant="matched"
                              />
                            ))}
                          </div>
                        ) : null}
                        {projects.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {projects.map((project, projectIndex) => (
                              <div
                                key={`${fallbackTitle}-${index}-project-${projectIndex}`}
                                className="rounded-xl border border-border bg-background p-3"
                              >
                                <p className="text-sm font-medium text-foreground">
                                  {project.name ?? 'Projet'}
                                </p>
                                {project.description ? (
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {project.description}
                                  </p>
                                ) : null}
                                {project.technologies.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {project.technologies.map((technology) => (
                                      <SkillTag
                                        key={`${projectIndex}-${technology}`}
                                        label={technology}
                                        variant="outline"
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-background p-5">
                        <h3 className="text-base font-semibold text-foreground">
                          Expériences professionnelles
                        </h3>
                        <div className="mt-4 space-y-4">
                          {professionalExperiences.length > 0 ? (
                            professionalExperiences.map((item, index) =>
                              renderExperienceCard(
                                item,
                                index,
                                'Expérience professionnelle',
                              ),
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Aucune expérience professionnelle renseignée.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-5">
                        <h3 className="text-base font-semibold text-foreground">
                          Stages
                        </h3>
                        <div className="mt-4 space-y-4">
                          {internshipExperiences.length > 0 ? (
                            internshipExperiences.map((item, index) =>
                              renderExperienceCard(item, index, 'Stage'),
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Aucun stage renseigné.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
                viewItem={(item) => (
                  <>
                    <h3 className="text-base font-semibold text-foreground">
                      {item.jobTitleRaw || 'Expérience'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[item.companyName, item.sector]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {item.description || 'Aucune description renseignée.'}
                    </p>
                  </>
                )}
              />

              <Separator className="bg-accent/70" />

              <CollectionSection<SkillDraft>
                title="Compétences"
                description="Les compétences que vous souhaitez mettre en avant."
                icon={Globe2}
                items={currentDraft?.skills}
                iconClassName="icon-background-color-7"
                setItems={(updater) =>
                  setDraft((current) =>
                    current
                      ? {
                        ...current,
                        skills:
                          typeof updater === 'function'
                            ? updater(current.skills)
                            : updater,
                      }
                      : current,
                  )
                }
                emptyItem={emptySkill}
                isEditing={isEditing}
                emptyStateMessage="Aucune compétence renseignée."
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Compétence"
                      value={item.skillLabelRaw}
                      onChange={(value) =>
                        update({ ...item, skillLabelRaw: value })
                      }
                      disabled={!isEditing}
                    />
                    <Field
                      label="Niveau"
                      value={item.level}
                      onChange={(value) => update({ ...item, level: value })}
                      disabled={!isEditing}
                    />
                    <Field
                      label="Années d'expérience"
                      type="number"
                      value={item.years}
                      onChange={(value) => update({ ...item, years: value })}
                      disabled={!isEditing}
                    />
                    <Field
                      label="Preuve"
                      value={item.evidence}
                      onChange={(value) => update({ ...item, evidence: value })}
                      disabled={!isEditing}
                    />
                  </div>
                )}
                renderListView={() => (
                  <div className="space-y-4 rounded-2xl border border-border bg-background p-5">
                    {skillGroups.length > 0 ? (
                      skillGroups.map((group) => (
                        <div key={group.category}>
                          <p className="text-sm font-medium text-foreground">
                            {group.category}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.items.map((label) => (
                              <SkillTag
                                key={`${group.category}-${label}`}
                                label={label}
                                variant="matched"
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune compétence renseignée.
                      </p>
                    )}
                  </div>
                )}
                viewItem={(item) => (
                  <div className="flex flex-wrap gap-2">
                    <SkillTag
                      label={item.skillLabelRaw || 'Compétence'}
                      variant="matched"
                    />
                    {item.level ? <SkillTag label={item.level} /> : null}
                    {item.years ? (
                      <SkillTag label={`${item.years} an(s)`} />
                    ) : null}
                  </div>
                )}
              />

              <Separator className="bg-accent/70" />

              <CollectionSection<LanguageDraft>
                title="Langues"
                description="Les langues que vous maîtrisez."
                icon={Languages}
                items={currentDraft?.languages}
                iconClassName="icon-background-color-7"
                setItems={(updater) =>
                  setDraft((current) =>
                    current
                      ? {
                        ...current,
                        languages:
                          typeof updater === 'function'
                            ? updater(current.languages)
                            : updater,
                      }
                      : current,
                  )
                }
                emptyItem={emptyLanguage}
                isEditing={isEditing}
                emptyStateMessage="Aucune langue renseignée."
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectField
                      label="Langue"
                      value={item.languageCode}
                      onChange={(value) =>
                        update({ ...item, languageCode: value })
                      }
                      options={languagesQuery.data ?? []}
                      disabled={!isEditing}
                      placeholder="Choisir une langue"
                    />

                    <SelectField
                      label="Niveau"
                      value={item.level}
                      onChange={(value) => update({ ...item, level: value })}
                      options={languageLevelsQuery.data ?? []}
                      disabled={!isEditing}
                      placeholder="Choisir un niveau"
                    />

                    <div className="md:col-span-2">
                      <Field
                        label="Preuve"
                        value={item.evidence}
                        onChange={(value) =>
                          update({ ...item, evidence: value })
                        }
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                )}
                renderListView={() => (
                  <div className="rounded-2xl border border-border bg-background p-5">
                    {languageItems.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {languageItems.map((item, index) => (
                          <SkillTag
                            key={`${item.name}-${item.level ?? index}`}
                            label={
                              item.level
                                ? `${item.name} - ${item.level}`
                                : item.name
                            }
                            variant="outline"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune langue renseignée.
                      </p>
                    )}
                  </div>
                )}
                viewItem={(item) => {
                  const bundleLanguage = bundle?.languages.find(
                    (language) => language.id === item.id,
                  );
                  const languageOption = languagesQuery.data?.find(
                    (option) => option.code === item.languageCode,
                  );

                  const levelOption = languageLevelsQuery.data?.find(
                    (option) => option.code === item.level,
                  );

                  const label = `${formatLanguageLabel(
                    item.languageCode,
                    bundleLanguage?.languageLabelFr ??
                    bundleLanguage?.languageLabelEn ??
                    languageOption?.label,
                  )} - ${formatLanguageLevelLabel(
                    item.level,
                    bundleLanguage?.levelLabelFr ??
                    bundleLanguage?.levelLabelEn ??
                    levelOption?.label,
                  )}`;

                  return (
                    <div className="flex flex-wrap gap-2">
                      <SkillTag label={label || 'Langue'} />
                      {item.evidence ? (
                        <SkillTag label={item.evidence} />
                      ) : null}
                    </div>
                  );
                }}
              />

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Certifications"
                  description="Les certifications extraites ou renseignées pour votre profil."
                  icon={GraduationCap}
                  iconClassName="icon-background-color-7"
                />
                <div className="rounded-2xl border border-border bg-background p-5">
                  {certificationItems.length > 0 ? (
                    <div className="space-y-4">
                      {certificationItems.map((item, index) => (
                        <article
                          key={`certification-${index}`}
                          className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {item.name ?? 'Certification'}
                          </p>
                          {item.issuer || item.date ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[item.issuer, formatCandidateDate(item.date)]
                                .filter(Boolean)
                                .join(' - ')}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune certification renseignée.
                    </p>
                  )}
                </div>
              </section>

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Projets"
                  description="Les projets détectés dans votre CV ou associés à votre profil."
                  icon={Briefcase}
                  iconClassName="icon-background-color-7"
                />

                <div className="rounded-2xl border border-border bg-background p-5">
                  {projectItems.length > 0 ? (
                    <div className="space-y-4">
                      {projectItems.map((project, index) => (
                        <article
                          key={`project-${index}`}
                          className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {project.name ?? 'Projet'}
                          </p>
                          {project.description ? (
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {project.description}
                            </p>
                          ) : null}
                          {project.technologies.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {project.technologies.map((technology) => (
                                <SkillTag
                                  key={`${index}-${technology}`}
                                  label={technology}
                                  variant="outline"
                                />
                              ))}
                            </div>
                          ) : null}
                          {project.url ? (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Voir le projet
                            </a>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun projet renseigné.
                    </p>
                  )}
                </div>
              </section>

              <Separator className="profile-background-color-19-opacity-70" />

              <section className="space-y-4">
                <SectionTitle
                  title="Domaines et technologies qui vous intéressent"
                  description="Mots-clés du profil candidat, avec fallback temporaire côté frontend si nécessaire."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                />

                <div className="rounded-2xl border border-border bg-background p-5">
                  <div className="flex flex-wrap gap-2">
                    {visibleInterestKeywords.map((keyword) => (
                      <SkillTag
                        key={keyword}
                        label={keyword}
                        variant="matched"
                      />
                    ))}
                  </div>
                  {visibleInterestKeywords.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Aucun mot-clé renseigné.
                    </p>
                  ) : null}
                </div>
              </section>

              <Separator className="profile-background-color-19-opacity-70" />

              <section className="space-y-4">
                <SectionTitle
                  title="Préférences de recommandation"
                  description="Paramètres utilisés pour filtrer les offres compatibles."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                />

                <div className="rounded-2xl border border-border bg-background p-5">
                  <div className="grid gap-3 md:max-w-sm">
                    <p className="text-sm font-semibold text-foreground">
                      Score minimum des offres compatibles
                    </p>
                    <Label className="text-xs text-muted-foreground">
                      Seuil minimum
                    </Label>
                    <Select
                      value={String(minimumOfferScore)}
                      onValueChange={async (value) => {
                        const nextScore = Number(value);
                        setMinimumOfferScore(nextScore);
                        setStoredCandidateMinimumOfferScore(nextScore);
                        await Promise.all([
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.candidate.matches(),
                          }),
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.candidate.jobOffers(),
                          }),
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.candidate.dashboard(),
                          }),
                        ]);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {candidateOfferScoreOptions.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Aucun endpoint dédié n’est encore branché sur ce portail
                      pour ce réglage. Le seuil est donc conservé localement
                      dans votre navigateur.
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </article>

      {isCvPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">Aperçu du CV</h2>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCvPreviewOpen(false);

                  if (cvPreviewUrl) {
                    URL.revokeObjectURL(cvPreviewUrl);
                    setCvPreviewUrl(null);
                  }
                }}
              >
                Fermer
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {isOpeningCv ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Chargement du CV...</span>
                </div>
              ) : cvPreviewUrl ? (
                <iframe
                  src={cvPreviewUrl}
                  title="Aperçu du CV"
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Aucun CV à afficher.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMetaChip({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm text-foreground">
      <Icon className="h-4 w-4 text-accent" />
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10"
      />
    </div>
  );
}

function CollectionSection<T extends { id?: string }>({
  title,
  description,
  icon,
  items,
  setItems,
  emptyItem,
  isEditing,
  renderItem,
  viewItem,
  renderListView,
  iconClassName,
  emptyStateMessage = 'Aucune information renseignée.',
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  items: T[];
  setItems:
  | Dispatch<SetStateAction<T[]>>
  | ((next: SetStateAction<T[]>) => void);
  emptyItem: () => T;
  isEditing: boolean;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  viewItem: (item: T) => ReactNode;
  renderListView?: (items: T[]) => ReactNode;
  iconClassName?: string;
  emptyStateMessage?: string;
}) {
  const updateItem = (index: number, nextItem: T) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    );
  };

  const removeItem = (index: number) => {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const addItem = () => {
    setItems((current) => [...current, emptyItem()]);
  };

  return (
    <section className="space-y-4 px-6 py-7 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          title={title}
          description={description}
          icon={icon}
          iconClassName={iconClassName}
        />
        {isEditing ? (
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {items?.length === 0 && (isEditing || !renderListView) ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
            {emptyStateMessage}
          </div>
        ) : null}

        {!isEditing && renderListView
          ? renderListView(items)
          : items?.map((item, index) => (
            <article
              key={item.id ?? `${title}-${index}`}
              className="rounded-2xl border border-border bg-background p-5 border-color-aneti-blue border-left-aneti"
            >
              {isEditing ? (
                <div className="space-y-4 relative">
                  <div className="absolute right-[-10px] top-[-30px]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {renderItem(item, (next) => updateItem(index, next))}
                </div>
              ) : (
                viewItem(item)
              )}
            </article>
          ))}
      </div>
    </section>
  );
}

type ReadOnlyGridItem = {
  label: string;
  value: string | null;
  fullWidth?: boolean;
};

function EmptyStateCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ReadOnlyDataGrid({ items }: { items: ReadOnlyGridItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.label}
          className={`rounded-2xl border border-border bg-background p-4 ${item.fullWidth ? 'md:col-span-2 xl:col-span-3' : ''
            }`}
        >
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {cleanCandidateDisplayText(item.value)}
          </p>
        </article>
      ))}
    </div>
  );
}

function ProfileOverviewSection({
  displayName,
  displayLocation,
  email,
  primaryLanguageLabel,
  languageCount,
  minimumOfferScore,
}: {
  displayName: string;
  displayLocation: string;
  email: string;
  primaryLanguageLabel: string | null;
  languageCount: number;
  minimumOfferScore?: number;
}) {
  const languageCountLabel =
    languageCount > 0
      ? `${languageCount} ${languageCount > 1 ? 'langues renseignées' : 'langue renseignée'}`
      : 'Aucune langue renseignée';

  const metaItems = [
    displayLocation ? { icon: MapPin, label: displayLocation } : null,
    normalizeKeyword(email) ? { icon: Mail, label: email } : null,
    primaryLanguageLabel
      ? {
        icon: Globe2,
        label: `Langue principale : ${primaryLanguageLabel}`,
      }
      : null,
    {
      icon: Languages,
      label: languageCountLabel,
    },
  ].filter(
    (
      item,
    ): item is {
      icon: ComponentType<{ className?: string }>;
      label: string;
    } => Boolean(item),
  );

  return (
    <div className="border-b border-border bg-gradient-to-br from-primary/[0.06] via-background to-accent-soft/50 px-6 py-7 sm:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Profil candidat
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Présentez l'essentiel de votre parcours et de vos préférences pour
            recevoir des offres plus pertinentes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {metaItems.map((item) => (
              <ProfileMetaChip
                key={item.label}
                icon={item.icon}
                label={item.label}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 items-center justify-center rounded-2xl border border-border bg-background p-4 profile-border-left-orange">
          <span>
            <p className="text-xs uppercase text-muted-foreground font-meduim">
              Score minimum des offres compatibles
            </p>
          </span>
          <PercentageScore
            color="hsl(var(--accent))"
            score={minimumOfferScore}
            size={80}
            stroke={6}
          />
        </div>
      </div>
    </div>
  );
}

function ReadOnlyGridSection({
  title,
  description,
  icon,
  iconClassName,
  items,
  emptyMessage = 'Aucune information renseignée.',
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  items: ReadOnlyGridItem[];
  emptyMessage?: string;
}) {
  const visibleItems = items.filter((item) => normalizeKeyword(item.value));

  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
      />
      {visibleItems.length > 0 ? (
        <ReadOnlyDataGrid items={visibleItems} />
      ) : (
        <EmptyStateCard message={emptyMessage} />
      )}
    </section>
  );
}

function EducationReadOnly({ items }: { items: DisplayEducationItem[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Formations et diplômes"
        description="Les diplômes, spécialités et établissements les plus utiles à retenir."
        icon={GraduationCap}
        iconClassName="icon-background-color-7"
      />
      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => {
            const graduationYear = extractEducationYear(item);
            const metadata = [
              graduationYear ? `Année d'obtention : ${graduationYear}` : null,
              item.honors ? `Mention : ${item.honors}` : null,
            ].filter((value): value is string => Boolean(value));

            return (
              <article
                key={`education-readonly-${index}`}
                className="rounded-2xl border border-border bg-background p-5"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {cleanCandidateDisplayText(
                    item.diplomaLabel ?? item.degree,
                    'Formation',
                  )}
                </h3>
                {item.specialty ? (
                  <p className="mt-1 text-sm text-foreground">
                    {item.specialty}
                  </p>
                ) : null}
                {item.institution ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.institution}
                  </p>
                ) : null}
                {metadata.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metadata.map((value) => (
                      <SkillTag
                        key={`${index}-${value}`}
                        label={value}
                        variant="outline"
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <EmptyStateCard message="Aucune formation renseignée." />
        )}
      </div>
    </section>
  );
}

function ExperienceReadOnlySection({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: DisplayExperienceItem[];
  emptyMessage: string;
}) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title={title}
        description={description}
        icon={Briefcase}
        iconClassName="icon-background-color-7"
      />
      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => {
            const period = formatCandidateDateRange(
              item.startDate,
              item.endDate,
              item.isCurrent,
            );
            const duration = formatDurationLabel(
              item.durationMonths,
              item.durationYears,
            );

            return (
              <article
                key={`${title}-${index}`}
                className="rounded-2xl border border-border bg-background p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {cleanCandidateDisplayText(
                        item.title,
                        title.slice(0, -1),
                      )}
                    </h3>
                    {item.company || item.location ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {uniqueTextValues(item.company, item.location).join(
                          ' • ',
                        )}
                      </p>
                    ) : null}
                  </div>
                  {period || duration ? (
                    <div className="flex flex-wrap gap-2">
                      {period ? (
                        <SkillTag label={period} variant="outline" />
                      ) : null}
                      {duration ? (
                        <SkillTag label={duration} variant="outline" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="mt-4 text-sm leading-6 text-foreground">
                    {item.description}
                  </p>
                ) : null}
                {item.responsibilities.length > 0 ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {item.responsibilities.map((responsibility) => (
                      <li key={responsibility}>{responsibility}</li>
                    ))}
                  </ul>
                ) : null}
                {item.technologies.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.technologies.map((technology) => (
                      <SkillTag
                        key={`${title}-${index}-${technology}`}
                        label={technology}
                        variant="matched"
                      />
                    ))}
                  </div>
                ) : null}
                {item.projects.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {item.projects.map((project, projectIndex) => (
                      <div
                        key={`${title}-${index}-project-${projectIndex}`}
                        className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {cleanCandidateDisplayText(project.name, 'Projet')}
                        </p>
                        {project.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        ) : null}
                        {project.technologies.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {project.technologies.map((technology) => (
                              <SkillTag
                                key={`${title}-${index}-${projectIndex}-${technology}`}
                                label={technology}
                                variant="outline"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <EmptyStateCard message={emptyMessage} />
        )}
      </div>
    </section>
  );
}

function SkillsReadOnly({ items }: { items: DisplaySkillItem[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Compétences"
        description="Les compétences que vous souhaitez mettre en avant."
        icon={Globe2}
        iconClassName="icon-background-color-7"
      />
      <div className="rounded-2xl border border-border bg-background p-5">
        {items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={`${item.label}-${item.level ?? 'no-level'}`}
                className="rounded-2xl border border-border bg-surface-muted/20 p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.label}
                </p>
                {item.level ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {item.level}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune compétence renseignée.
          </p>
        )}
      </div>
    </section>
  );
}

function LanguagesReadOnly({ items }: { items: DisplayLanguageItem[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Langues"
        description="Les langues que vous maîtrisez."
        icon={Languages}
        iconClassName="icon-background-color-7"
      />
      <div className="rounded-2xl border border-border bg-background p-5">
        {items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <article
                key={`${item.name}-${item.level ?? index}`}
                className="rounded-2xl border border-border bg-surface-muted/20 p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.level ? `${item.name} — ${item.level}` : item.name}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune langue renseignée.
          </p>
        )}
      </div>
    </section>
  );
}

function CertificationsReadOnly({
  items,
}: {
  items: DisplayCertificationItem[];
}) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Certifications"
        description="Les certifications associées à votre profil."
        icon={GraduationCap}
        iconClassName="icon-background-color-7"
      />
      <div className="space-y-4">
        {items.map((item, index) => (
          <article
            key={`certification-readonly-${index}`}
            className="rounded-2xl border border-border bg-background p-5"
          >
            <p className="text-sm font-semibold text-foreground">
              {cleanCandidateDisplayText(item.name, 'Certification')}
            </p>
            {item.issuer || item.date ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {uniqueTextValues(
                  item.issuer,
                  formatCandidateDate(item.date),
                ).join(' — ')}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectsReadOnly({ items }: { items: DisplayProjectItem[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Projets"
        description="Les projets détectés dans votre CV ou associés à votre profil."
        icon={Briefcase}
        iconClassName="icon-background-color-7"
      />
      <div className="space-y-4">
        {items.map((project, index) => (
          <article
            key={`project-readonly-${index}`}
            className="rounded-2xl border border-border bg-background p-5"
          >
            <p className="text-sm font-semibold text-foreground">
              {cleanCandidateDisplayText(project.name, 'Projet')}
            </p>
            {project.description ? (
              <p className="mt-2 text-sm leading-6 text-foreground">
                {project.description}
              </p>
            ) : null}
            {project.technologies.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {project.technologies.map((technology) => (
                  <SkillTag
                    key={`${index}-${technology}`}
                    label={technology}
                    variant="outline"
                  />
                ))}
              </div>
            ) : null}
            {project.url ? (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Voir le projet
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function InterestsReadOnly({ keywords }: { keywords: string[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Domaines et technologies qui vous intéressent"
        description="Mots-clés du profil candidat utilisés pour retrouver des offres pertinentes."
        icon={Globe2}
        iconClassName="icon-background-color-19"
      />
      <div className="rounded-2xl border border-border bg-background p-5">
        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <SkillTag key={keyword} label={keyword} variant="matched" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun mot-clé renseigné.
          </p>
        )}
      </div>
    </section>
  );
}

function RecommendationPreferencesReadOnly({
  minimumOfferScore,
}: {
  minimumOfferScore: number;
}) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Préférences de recommandation"
        description="Paramètres utilisés pour filtrer les offres compatibles."
        icon={Globe2}
        iconClassName="icon-background-color-20"
      />
      <div className="rounded-2xl border border-border bg-background p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Score minimum des offres compatibles
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {minimumOfferScore}%
        </p>
      </div>
    </section>
  );
}

function computeDurationMonths(
  startDate: string,
  endDate: string,
  isCurrent: boolean,
): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = isCurrent || !endDate ? new Date() : new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()),
  );
}

function ExperienceDraftFields({
  item,
  update,
  type,
  sectorOptions = [],
}: {
  item: ExperienceDraft;
  update: (next: ExperienceDraft) => void;
  type: 'experience' | 'internship';
  sectorOptions?: Array<{ code: string; label: string }>;
}) {
  const computedMonths = computeDurationMonths(
    item.startDate,
    item.endDate,
    item.isCurrent,
  );
  const computedYears =
    computedMonths != null
      ? `${Math.floor(computedMonths / 12)} ans ${computedMonths % 12} mois`
      : '';

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Occupation autocomplete (RTMC OCCUPATION) */}
      <div className="md:col-span-2">
        <OccupationAutocomplete
          jobTitleRaw={item.jobTitleRaw}
          occupationNodeId={item.occupationNodeId}
          label={type === 'internship' ? 'Intitulé du stage' : 'Intitulé du poste'}
          onChange={(nodeId, raw) =>
            update({ ...item, occupationNodeId: nodeId, jobTitleRaw: raw, entryType: type })
          }
        />
      </div>
      <Field
        label="Entreprise"
        value={item.companyName}
        onChange={(value) =>
          update({ ...item, companyName: value, entryType: type })
        }
      />
      {sectorOptions.length > 0 ? (
        <OptionSelect
          label="Secteur d'activité"
          value={item.sectorRefId || item.sector}
          onChange={(value) => {
            const opt = sectorOptions.find((o) => o.code === value);
            update({
              ...item,
              sectorRefId: value,
              sector: opt?.label ?? value,
              entryType: type,
            });
          }}
          options={sectorOptions}
          placeholder="Choisir un secteur"
        />
      ) : (
        <Field
          label="Secteur d'activité"
          value={item.sector}
          onChange={(value) =>
            update({ ...item, sector: value, entryType: type })
          }
        />
      )}
      {/* Geo location: country + admin units + optional free text */}
      <GeoAddressFields
        value={{
          countryIso2: item.locationCountry,
          adminUnit1Code: item.locationGovCode,
          adminUnit1Label: item.locationGovLabel,
          adminUnit2Code: item.locationDelegCode,
          adminUnit2Label: item.locationDelegLabel,
        }}
        onChange={(geo) =>
          update({
            ...item,
            locationCountry: geo.countryIso2,
            locationGovCode: geo.adminUnit1Code,
            locationGovLabel: geo.adminUnit1Label,
            locationDelegCode: geo.adminUnit2Code,
            locationDelegLabel: geo.adminUnit2Label,
            entryType: type,
          })
        }
      />
      <Field
        label="Lieu (précision libre)"
        value={item.location}
        onChange={(value) =>
          update({ ...item, location: value, entryType: type })
        }
      />
      <label className="md:col-span-2 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={item.isCurrent}
          onChange={(event) => {
            const checked = event.target.checked;
            const months = computeDurationMonths(item.startDate, '', checked);
            update({
              ...item,
              isCurrent: checked,
              endDate: checked ? '' : item.endDate,
              durationMonths: months != null ? String(months) : '',
              entryType: type,
            });
          }}
        />
        En cours actuellement
      </label>
      <Field
        label="Date de début"
        type="date"
        value={item.startDate}
        onChange={(value) => {
          const months = computeDurationMonths(value, item.endDate, item.isCurrent);
          update({
            ...item,
            startDate: value,
            durationMonths: months != null ? String(months) : '',
            entryType: type,
          });
        }}
      />
      <Field
        label="Date de fin"
        type="date"
        value={item.endDate}
        onChange={(value) => {
          const months = computeDurationMonths(item.startDate, value, false);
          update({
            ...item,
            endDate: value,
            isCurrent: false,
            durationMonths: months != null ? String(months) : '',
            entryType: type,
          });
        }}
        disabled={item.isCurrent}
      />
      {/* Computed duration — read-only */}
      {computedYears && (
        <div className="md:col-span-2 text-xs text-muted-foreground">
          Durée : {computedYears}
        </div>
      )}
      <div className="md:col-span-2">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea
          value={item.description}
          onChange={(event) =>
            update({
              ...item,
              description: event.target.value,
              entryType: type,
            })
          }
          className="mt-1.5 min-h-[110px]"
        />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs text-muted-foreground">Responsabilités</Label>
        <Textarea
          value={toMultilineValue(item.responsibilities)}
          onChange={(event) =>
            update({
              ...item,
              responsibilities: splitListValue(event.target.value, /\r?\n/),
              entryType: type,
            })
          }
          className="mt-1.5 min-h-[110px]"
          placeholder="Une responsabilité par ligne"
        />
      </div>
      <div className="md:col-span-2">
        <Field
          label="Technologies"
          value={toCommaSeparatedValue(item.technologies)}
          onChange={(value) =>
            update({
              ...item,
              technologies: splitListValue(value, /,/),
              entryType: type,
            })
          }
        />
      </div>
    </div>
  );
}

function InterestKeywordsEditor({
  keywords,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}: {
  keywords: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (keyword: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/30 px-3 py-1.5 text-sm text-foreground"
          >
            {keyword}
            <button
              type="button"
              className="text-muted-foreground transition hover:text-foreground"
              onClick={() => onRemove(keyword)}
              aria-label={`Supprimer ${keyword}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      {keywords.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun mot-clé renseigné.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder="Ajouter un mot-clé"
          className="h-10"
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
