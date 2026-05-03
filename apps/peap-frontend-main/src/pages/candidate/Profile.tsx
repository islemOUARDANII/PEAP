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
  type CandidateEducationRecord,
  type CandidateExperienceRecord,
  type CandidateLanguageRecord,
  type CandidateProfileBundle,
  type CandidateSkillRecord,
  type ReferentialOption,
  type CandidateCvParseResult,
} from '@/services/api/gateway';
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
  formatLanguageLabel as formatCandidateLanguageLabel,
  groupSkillsByCategory,
  type DisplayCertificationItem,
  type DisplayEducationItem,
  type DisplayExperienceItem,
  type DisplayLanguageItem,
  type DisplayProjectItem,
} from './profileUtils';
import { PercentageScore } from '@/components/common/PercentageScore';

interface EducationDraft {
  id?: string;
  levelCode: string;
  degree: string;
  diplomaLabel: string;
  specialty: string;
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
  companyName: string;
  sector: string;
  location: string;
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
  skillLabelRaw: string;
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
  degree: '',
  diplomaLabel: '',
  specialty: '',
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
  companyName: '',
  sector: '',
  location: '',
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

const emptySkill = (): SkillDraft => ({
  skillLabelRaw: '',
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
  education: bundle.education.map((item) => ({
    id: item.id,
    levelCode: item.levelCode ?? '',
    degree: item.degree ?? item.diplomaLabel ?? '',
    diplomaLabel: item.diplomaLabel ?? '',
    specialty: item.specialty ?? '',
    institution: item.institution ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    graduationYear:
      item.graduationYear == null ? '' : String(item.graduationYear),
    location: item.location ?? '',
    honors: item.honors ?? '',
    gpa: item.gpa ?? '',
  })),
  experience: bundle.experience.map((item) => ({
    id: item.id,
    jobTitleRaw: item.jobTitleRaw ?? '',
    companyName: item.companyName ?? '',
    sector: item.sector ?? '',
    location: item.location ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    isCurrent: item.isCurrent ?? false,
    durationMonths:
      item.durationMonths == null ? '' : String(item.durationMonths),
    durationYears: item.durationYears == null ? '' : String(item.durationYears),
    description: item.description ?? '',
    responsibilities: item.responsibilities ?? [],
    technologies: item.technologies ?? [],
    projects: item.projects ?? [],
    entryType: item.entryType ?? '',
  })),
  skills: bundle.skills.map((item) => ({
    id: item.id,
    skillLabelRaw: item.skillLabelRaw ?? item.skillNodeLabel ?? '',
    level: item.level ?? '',
    years: item.years == null ? '' : String(item.years),
    evidence: item.evidence ?? '',
  })),
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
    item.levelCode,
    item.degree,
    item.diplomaLabel,
    item.specialty,
    item.institution,
    item.startDate,
    item.endDate,
    item.graduationYear,
    item.location,
    item.honors,
    item.gpa,
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
  [item.skillLabelRaw, item.level, item.years, item.evidence].some((value) =>
    value.trim(),
  );

const hasLanguageValue = (item: LanguageDraft): boolean =>
  [item.languageCode, item.level, item.evidence].some((value) => value.trim());

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
  const [interestKeywordInput, setInterestKeywordInput] = useState('');
  const [minimumOfferScoreDraft, setMinimumOfferScoreDraft] = useState(
    getStoredCandidateMinimumOfferScore(),
  );

  const bundleQuery = useQuery({
    queryKey: queryKeys.candidate.bundle(),
    queryFn: () => gatewayApi.candidate.getBundle(),
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
    staleTime: 5 * 60_000,
    retry: false,
  });

  const bundle = bundleQuery.data;
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
      setInterestKeywordInput('');
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

  const refreshCandidateViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.dashboard(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.profile(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.keywords(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.offerThreshold(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.bundle(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.cvRecords(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.matches(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.jobOffers(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidate.recommendations(),
      }),
      queryClient.invalidateQueries({
        queryKey: ['search', 'offers'],
      }),
    ]);
  };

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
  const startEditing = () => {
    if (bundle) {
      setDraft(toDraft(bundle));
    }
    setInterestKeywordsDraft(savedInterestKeywords);
    setMinimumOfferScoreDraft(savedMinimumOfferScore);
    setInterestKeywordInput('');
    setIsEditing(true);
  };
  const addInterestKeyword = () => {
    const normalizedKeyword = normalizeKeyword(interestKeywordInput);
    if (!normalizedKeyword) {
      return;
    }

    setInterestKeywordsDraft((current) =>
      normalizeKeywordList([...current, normalizedKeyword]),
    );
    setInterestKeywordInput('');
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
    setInterestKeywordInput('');
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
      const record = await gatewayApi.candidate.uploadCv(file);

      setIsUploadingCv(false);
      setIsParsingCv(true);

      toast.success('CV importé. Analyse en cours...');

      const parseResult = await gatewayApi.candidate.parseCv(record.id);
      setLatestParseResult(parseResult);

      setDraft((current) =>
        current ? applyParsedCvToDraft(current, parseResult) : current,
      );

      const parsedKeywords = buildInterestKeywords(parseResult);
      setInterestKeywordsDraft(
        parsedKeywords.length > 0 ? parsedKeywords : savedInterestKeywords,
      );
      setMinimumOfferScoreDraft(savedMinimumOfferScore);
      setInterestKeywordInput('');
      setIsEditing(true);

      await refreshCandidateViews();
      await refetchCandidateBundle();

      toast.success(
        'CV analysé. Vérifiez les champs puis cliquez sur Enregistrer.',
      );
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Impossible d'uploader ou d'analyser le CV"),
      );
    } finally {
      setIsUploadingCv(false);
      setIsParsingCv(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const buildEducationPayload = (item: EducationDraft) => ({
    level_code: item.levelCode || null,
    degree: item.degree || null,
    diploma_label: item.diplomaLabel || item.degree || null,
    specialty: item.specialty || null,
    institution: item.institution || null,
    start_date: item.startDate || null,
    end_date: item.endDate || null,
    graduation_year: toNullableYear(item.graduationYear),
    location: item.location || null,
    honors: item.honors || null,
    gpa: item.gpa || null,
  });

  const buildExperiencePayload = (item: ExperienceDraft) => ({
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
    location: item.location || null,
    start_date: item.startDate || null,
    end_date: item.endDate || null,
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

  const handleSave = async () => {
    if (!bundle || !currentDraft) {
      return;
    }

    setIsSaving(true);
    try {
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
            skill_label_raw: item.skillLabelRaw || null,
            level: item.level || null,
            years: toNullableNumber(item.years),
            evidence: item.evidence || null,
            source: 'MANUAL',
          }),
        (item) =>
          gatewayApi.candidate.updateSkill(item.id!, {
            skill_label_raw: item.skillLabelRaw || null,
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

      const normalizedKeywords = normalizeKeywordList(interestKeywordsDraft);
      const persistedKeywords = toKeywordRecords(normalizedKeywords);

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

      const requestedMinimumOfferScore = normalizeCandidateMinimumOfferScore(
        minimumOfferScoreDraft,
      );
      let persistedMinimumOfferScore = requestedMinimumOfferScore;

      try {
        const thresholdRecord = await gatewayApi.candidate.updateOfferThreshold(
          requestedMinimumOfferScore,
        );
        persistedMinimumOfferScore = normalizeCandidateMinimumOfferScore(
          thresholdRecord?.minThreshold ?? requestedMinimumOfferScore,
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
      setInterestKeywordInput('');
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
      {isUploadingCv || isParsingCv ? (
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
      ) : null}
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
                  disabled={isSaving}
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
                title="Informations personnelles"
                description="Vos informations personnelles et vos coordonnées."
                icon={UserRound}
                iconClassName="icon-background-color-3"
                items={[
                  { label: 'Prénom', value: currentDraft.firstName },
                  { label: 'Nom', value: currentDraft.lastName },
                  { label: 'E-mail', value: currentDraft.email },
                  { label: 'Téléphone', value: currentDraft.phone },
                  {
                    label: 'Adresse',
                    value: displayLocation || currentDraft.address,
                    fullWidth: true,
                  },
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
                ]}
              />

              {/* <Separator className="bg-primary/40" /> */}
              <div className="profile-border-left-orange">
                <ReadOnlyGridSection
                  title="Préférences professionnelles"
                  description="Vos préférences de contrat, de mobilité et de salaire."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
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

                <Separator className="bg-accent/70" />

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

                <SkillsReadOnly skillGroups={skillGroups} />

                <Separator className="bg-accent/70" />

                <LanguagesReadOnly items={languageItems} />

                {certificationItems.length > 0 ? (
                  <>
                    <Separator className="bg-primary/40" />
                    <CertificationsReadOnly items={certificationItems} />
                  </>
                ) : null}

                {projectItems.length > 0 ? (
                  <>
                    <Separator className="bg-primary/40" />
                    <ProjectsReadOnly items={projectItems} />
                  </>
                ) : null}
              </div>
              {/* <Separator className="bg-primary/40" /> */}
              <div className="profile-border-left-19">
                <InterestsReadOnly keywords={visibleInterestKeywords} />
              </div>
              {/* <Separator className="bg-primary/40" /> */}
              {/* <div className="profile-border-left-20">
                <RecommendationPreferencesReadOnly
                  minimumOfferScore={savedMinimumOfferScore}
                />
              </div> */}
            </>
          ) : (
            <>
              <section className="space-y-4">
                <SectionTitle
                  title="Informations personnelles"
                  description="Mettez à jour vos informations personnelles et vos coordonnées."
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
                  <Field
                    label="Adresse"
                    value={currentDraft.address}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, address: value } : current,
                      )
                    }
                  />
                  <Field
                    label="Nationalité"
                    value={currentDraft.nationality}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, nationality: value } : current,
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
                    disabled={!currentDraft.governorateCode}
                  />
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
              </section>

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Préférences professionnelles"
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

              <Separator className="bg-primary/40" />

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
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Diplôme"
                      value={item.degree}
                      onChange={(value) => update({ ...item, degree: value })}
                    />
                    <Field
                      label="Libellé du diplôme"
                      value={item.diplomaLabel}
                      onChange={(value) =>
                        update({ ...item, diplomaLabel: value })
                      }
                    />
                    <Field
                      label="Niveau"
                      value={item.levelCode}
                      onChange={(value) =>
                        update({ ...item, levelCode: value })
                      }
                    />
                    <Field
                      label="Spécialité"
                      value={item.specialty}
                      onChange={(value) =>
                        update({ ...item, specialty: value })
                      }
                    />
                    <Field
                      label="Établissement"
                      value={item.institution}
                      onChange={(value) =>
                        update({ ...item, institution: value })
                      }
                    />
                    <Field
                      label="Lieu"
                      value={item.location}
                      onChange={(value) => update({ ...item, location: value })}
                    />
                    <Field
                      label="Date de début"
                      type="date"
                      value={item.startDate}
                      onChange={(value) =>
                        update({ ...item, startDate: value })
                      }
                    />
                    <Field
                      label="Date de fin"
                      type="date"
                      value={item.endDate}
                      onChange={(value) => update({ ...item, endDate: value })}
                    />
                    <Field
                      label="Année d'obtention"
                      value={item.graduationYear}
                      onChange={(value) =>
                        update({ ...item, graduationYear: value })
                      }
                    />
                    <Field
                      label="Mention"
                      value={item.honors}
                      onChange={(value) => update({ ...item, honors: value })}
                    />
                    <div className="md:col-span-2">
                      <Field
                        label="GPA"
                        value={item.gpa}
                        onChange={(value) => update({ ...item, gpa: value })}
                      />
                    </div>
                  </div>
                )}
                viewItem={() => null}
              />

              <Separator className="bg-primary/40" />

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
                  />
                )}
                viewItem={() => null}
              />

              <Separator className="bg-primary/40" />

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
                  />
                )}
                viewItem={() => null}
              />

              <Separator className="bg-primary/40" />

              <CollectionSection<SkillDraft>
                title="Compétences"
                description="Les compétences que vous souhaitez mettre en avant."
                icon={Globe2}
                iconClassName="icon-background-color-7"
                items={currentDraft.skills}
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
                isEditing
                emptyStateMessage="Aucune compétence renseignée."
                renderItem={(item, update) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Compétence"
                      value={item.skillLabelRaw}
                      onChange={(value) =>
                        update({ ...item, skillLabelRaw: value })
                      }
                    />
                    <Field
                      label="Niveau"
                      value={item.level}
                      onChange={(value) => update({ ...item, level: value })}
                    />
                    <Field
                      label="Années d'expérience"
                      type="number"
                      value={item.years}
                      onChange={(value) => update({ ...item, years: value })}
                    />
                    <Field
                      label="Preuve"
                      value={item.evidence}
                      onChange={(value) => update({ ...item, evidence: value })}
                    />
                  </div>
                )}
                viewItem={() => null}
              />

              <Separator className="bg-primary/40" />

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
                    <SelectField
                      label="Langue"
                      value={item.languageCode}
                      onChange={(value) =>
                        update({ ...item, languageCode: value })
                      }
                      options={languagesQuery.data ?? []}
                      placeholder="Choisir une langue"
                    />
                    <SelectField
                      label="Niveau"
                      value={item.level}
                      onChange={(value) => update({ ...item, level: value })}
                      options={languageLevelsQuery.data ?? []}
                      placeholder="Choisir un niveau"
                    />
                    <div className="md:col-span-2">
                      <Field
                        label="Preuve"
                        value={item.evidence}
                        onChange={(value) =>
                          update({ ...item, evidence: value })
                        }
                      />
                    </div>
                  </div>
                )}
                viewItem={() => null}
              />

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Domaines et technologies qui vous intéressent"
                  description="Mots-clés du profil candidat utilisés pour retrouver des offres pertinentes."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
                />
                <InterestKeywordsEditor
                  keywords={interestKeywordsDraft}
                  inputValue={interestKeywordInput}
                  onInputChange={setInterestKeywordInput}
                  onAdd={addInterestKeyword}
                  onRemove={removeInterestKeyword}
                />
              </section>

              <Separator className="bg-primary/40" />

              <section className="space-y-4">
                <SectionTitle
                  title="Préférences de recommandation"
                  description="Paramètres utilisés pour filtrer les offres compatibles."
                  icon={Globe2}
                  iconClassName="icon-background-color-7"
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
                className="rounded-2xl border border-border bg-background p-5"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex justify-end">
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
          className={`rounded-2xl border border-border bg-background p-4 ${
            item.fullWidth ? 'md:col-span-2 xl:col-span-3' : ''
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
      label:
        languageCount > 0
          ? `${languageCount} langue(s) renseignée(s)`
          : 'Aucune langue renseignée',
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
            Gardez vos coordonnées, vos expériences, vos compétences et vos
            préférences à jour pour recevoir des offres plus pertinentes.
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
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  items: ReadOnlyGridItem[];
}) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
      />
      <ReadOnlyDataGrid items={items} />
    </section>
  );
}

function EducationReadOnly({ items }: { items: DisplayEducationItem[] }) {
  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Formations et diplômes"
        description="Vos diplômes, niveaux et établissements renseignés."
        icon={GraduationCap}
        iconClassName="icon-background-color-7"
      />
      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => {
            const period =
              formatCandidateDateRange(item.startDate, item.endDate) ??
              cleanProfileText(item.graduationYear);
            const secondaryLabel = uniqueTextValues(
              item.diplomaLabel !== item.degree ? item.diplomaLabel : null,
              item.specialty,
            ).join(' • ');
            const metadata = [
              item.levelCode ? `Niveau : ${item.levelCode}` : null,
              item.location ? `Lieu : ${item.location}` : null,
              item.honors ? `Mention : ${item.honors}` : null,
              item.gpa ? `GPA : ${item.gpa}` : null,
            ].filter((value): value is string => Boolean(value));

            return (
              <article
                key={`education-readonly-${index}`}
                className="rounded-2xl border border-border bg-background p-5"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {cleanCandidateDisplayText(
                    item.degree ?? item.diplomaLabel ?? item.levelCode,
                    'Formation',
                  )}
                </h3>
                {secondaryLabel ? (
                  <p className="mt-1 text-sm text-foreground">
                    {secondaryLabel}
                  </p>
                ) : null}
                {item.institution || period ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {uniqueTextValues(item.institution, period).join(' — ')}
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

function SkillsReadOnly({
  skillGroups,
}: {
  skillGroups: Array<{ category: string; items: string[] }>;
}) {
  const hasMultipleGroups = skillGroups.length > 1;

  return (
    <section className="space-y-4 px-6 py-6 sm:px-8">
      <SectionTitle
        title="Compétences"
        description="Les compétences que vous souhaitez mettre en avant."
        icon={Globe2}
        iconClassName="icon-background-color-7"
      />
      <div className="rounded-2xl border border-border bg-background p-5">
        {skillGroups.length > 0 ? (
          <div className="space-y-4">
            {skillGroups.map((group) => (
              <div key={group.category}>
                {hasMultipleGroups ? (
                  <p className="text-sm font-medium text-foreground">
                    {group.category}
                  </p>
                ) : null}
                <div
                  className={
                    hasMultipleGroups
                      ? 'mt-3 flex flex-wrap gap-2'
                      : 'flex flex-wrap gap-2'
                  }
                >
                  {group.items.map((label) => (
                    <SkillTag
                      key={`${group.category}-${label}`}
                      label={label}
                      variant="matched"
                    />
                  ))}
                </div>
              </div>
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
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <SkillTag
                key={`${item.name}-${item.level ?? index}`}
                label={item.level ? `${item.name} — ${item.level}` : item.name}
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

function ExperienceDraftFields({
  item,
  update,
  type,
}: {
  item: ExperienceDraft;
  update: (next: ExperienceDraft) => void;
  type: 'experience' | 'internship';
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field
        label={
          type === 'internship' ? 'Intitulé du stage' : 'Intitulé du poste'
        }
        value={item.jobTitleRaw}
        onChange={(value) =>
          update({ ...item, jobTitleRaw: value, entryType: type })
        }
      />
      <Field
        label="Entreprise"
        value={item.companyName}
        onChange={(value) =>
          update({ ...item, companyName: value, entryType: type })
        }
      />
      <Field
        label="Lieu"
        value={item.location}
        onChange={(value) =>
          update({ ...item, location: value, entryType: type })
        }
      />
      <Field
        label="Secteur"
        value={item.sector}
        onChange={(value) =>
          update({ ...item, sector: value, entryType: type })
        }
      />
      <Field
        label="Date de début"
        type="date"
        value={item.startDate}
        onChange={(value) =>
          update({ ...item, startDate: value, entryType: type })
        }
      />
      <Field
        label="Date de fin"
        type="date"
        value={item.endDate}
        onChange={(value) =>
          update({ ...item, endDate: value, entryType: type })
        }
      />
      <Field
        label="Durée (mois)"
        type="number"
        value={item.durationMonths}
        onChange={(value) =>
          update({ ...item, durationMonths: value, entryType: type })
        }
      />
      <Field
        label="Durée (années)"
        type="number"
        value={item.durationYears}
        onChange={(value) =>
          update({ ...item, durationYears: value, entryType: type })
        }
      />
      <label className="md:col-span-2 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={item.isCurrent}
          onChange={(event) =>
            update({
              ...item,
              isCurrent: event.target.checked,
              entryType: type,
            })
          }
        />
        En cours actuellement
      </label>
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
