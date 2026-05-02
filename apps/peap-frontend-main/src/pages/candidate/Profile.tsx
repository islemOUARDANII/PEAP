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
import {
  gatewayApi,
  inferCandidateDisplayName,
  inferCandidateLocation,
  inferSkillLabel,
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
  candidateInterestKeywords,
  candidateOfferScoreOptions,
  getStoredCandidateMinimumOfferScore,
  setStoredCandidateMinimumOfferScore,
} from '@/services/candidate/candidatePortalPreferences';

interface EducationDraft {
  id?: string;
  levelCode: string;
  diplomaLabel: string;
  specialty: string;
  institution: string;
  graduationYear: string;
}

interface ExperienceDraft {
  id?: string;
  jobTitleRaw: string;
  companyName: string;
  sector: string;
  startDate: string;
  endDate: string;
  description: string;
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
  skills?: ParsedPatchItem[];
  languages?: ParsedPatchItem[];
};

const emptyEducation = (): EducationDraft => ({
  levelCode: '',
  diplomaLabel: '',
  specialty: '',
  institution: '',
  graduationYear: '',
});

const emptyExperience = (): ExperienceDraft => ({
  jobTitleRaw: '',
  companyName: '',
  sector: '',
  startDate: '',
  endDate: '',
  description: '',
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
    diplomaLabel: item.diplomaLabel ?? '',
    specialty: item.specialty ?? '',
    institution: item.institution ?? '',
    graduationYear:
      item.graduationYear == null ? '' : String(item.graduationYear),
  })),
  experience: bundle.experience.map((item) => ({
    id: item.id,
    jobTitleRaw: item.jobTitleRaw ?? '',
    companyName: item.companyName ?? '',
    sector: item.sector ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    description: item.description ?? '',
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
    item.diplomaLabel,
    item.specialty,
    item.institution,
    item.graduationYear,
  ].some((value) => value.trim());

const hasExperienceValue = (item: ExperienceDraft): boolean =>
  [
    item.jobTitleRaw,
    item.companyName,
    item.sector,
    item.startDate,
    item.endDate,
    item.description,
  ].some((value) => value.trim());

const hasSkillValue = (item: SkillDraft): boolean =>
  [item.skillLabelRaw, item.level, item.years, item.evidence].some((value) =>
    value.trim(),
  );

const hasLanguageValue = (item: LanguageDraft): boolean =>
  [item.languageCode, item.level, item.evidence].some((value) => value.trim());

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
  typeof value === "string" ? value : value == null ? "" : String(value);

const splitFullName = (fullName: unknown): { firstName: string; lastName: string } => {
  const text = toStringOrEmpty(fullName).trim();

  if (!text) {
    return { firstName: "", lastName: "" };
  }

  const parts = text.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
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
    governorateCode: geo?.candidate_location?.governorate?.code ?? "",
    delegationCode: geo?.candidate_location?.delegation?.code ?? "",
  };
};

function applyParsedCvToDraft(
  current: ProfileDraft,
  parseResult: CandidateCvParseResult,
): ProfileDraft {
  const patch: ExtractedProfilePatch =
    (parseResult.extractedProfilePatch as ExtractedProfilePatch | undefined) ?? {};
  const identity = patch.identity ?? {};

  const mappedPayload = parseResult.mappedPayload ?? {};
  const { governorateCode, delegationCode } = extractCandidateLocationCodes(mappedPayload);

  const parsedPayload = parseResult.parsedPayload ?? {};
  const cvData = parsedPayload.cv_data as Record<string, unknown> | undefined;
  const personalInfo = cvData?.personal_info as Record<string, unknown> | undefined;

  const fullName = splitFullName(
    identity.full_name
    ?? identity.name
    ?? personalInfo?.full_name
    ?? personalInfo?.name,
  );

  const parsedGeo = parsedPayload.geo_normalization as GeoNormalization | undefined;
  const mappedGeo = mappedPayload.geo_normalization as GeoNormalization | undefined;

  const candidateLocation =
    parsedGeo?.candidate_location ??
    mappedGeo?.candidate_location ??
    null;

  const displayLocation =
    candidateLocation?.display_location ||
    toStringOrEmpty(identity.location) ||
    toStringOrEmpty(personalInfo?.location);
  return {
    ...current,

    firstName:
      toStringOrEmpty(identity.first_name)
      || fullName.firstName
      || current.firstName,

    lastName:
      toStringOrEmpty(identity.last_name)
      || fullName.lastName
      || current.lastName,

    birthDate: toStringOrEmpty(identity.birth_date) || current.birthDate,
    nationality: toStringOrEmpty(identity.nationality) || current.nationality,

    email:
      toStringOrEmpty(identity.email)
      || toStringOrEmpty(personalInfo?.email)
      || current.email,

    phone:
      toStringOrEmpty(identity.phone)
      || toStringOrEmpty(personalInfo?.phone)
      || current.phone,

    address: displayLocation || current.address,
    governorateCode: governorateCode || current.governorateCode,
    delegationCode: delegationCode || current.delegationCode,

    education: patch.education.map((item) => ({
      levelCode: toStringOrEmpty(item.level_code ?? item.levelCode),
      diplomaLabel: toStringOrEmpty(
        item.diploma_label
        ?? item.diplomaLabel
        ?? item.degree
        ?? item.raw_degree,
      ),
      specialty: toStringOrEmpty(
        item.specialty
        ?? item.specialty_label
        ?? item.field,
      ),
      institution: toStringOrEmpty(item.institution),
      graduationYear: toStringOrEmpty(
        item.graduation_year
        ?? item.graduationYear
        ?? item.end_date,
      ),
    })),

    experience: (patch.experience ?? []).map((item) => ({
      jobTitleRaw: toStringOrEmpty(item.title ?? item.job_title ?? item.jobTitleRaw),
      companyName: toStringOrEmpty(item.company ?? item.company_name),
      sector: "",
      startDate: toStringOrEmpty(item.start_date),
      endDate: toStringOrEmpty(item.end_date),
      description: toStringOrEmpty(item.description),
    })),

    skills: (patch.skills ?? []).map((item) => ({
      skillLabelRaw: toStringOrEmpty(
        item.skill_label_raw ?? item.name ?? item.label ?? item.skill,
      ),
      level: toStringOrEmpty(item.level),
      years: "",
      evidence: "CV",
    })),

    languages: (patch.languages ?? []).map((item) => ({
      languageCode: toStringOrEmpty(item.language_code ?? item.code ?? item.name),
      level: toStringOrEmpty(item.level),
      evidence: "CV",
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
  const [minimumOfferScore, setMinimumOfferScore] = useState(
    getStoredCandidateMinimumOfferScore(),
  );

  const bundleQuery = useQuery({
    queryKey: ['candidate', 'bundle'],
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
    queryKey: ["referentials", "languages"],
    queryFn: () => gatewayApi.referentials.languages(),
    staleTime: 5 * 60_000,
  });

  const languageLevelsQuery = useQuery({
    queryKey: ["referentials", "language-levels"],
    queryFn: () => gatewayApi.referentials.languageLevels(),
    staleTime: 5 * 60_000,
  });

  const bundle = bundleQuery.data;

  useEffect(() => {
    if (bundle && !isEditing) {
      setDraft(toDraft(bundle));
    }
  }, [bundle, isEditing]);

  const currentDraft = draft ?? (bundle ? toDraft(bundle) : null);

  const displayName = useMemo(
    () => (bundle ? inferCandidateDisplayName(bundle) : 'Mon profil'),
    [bundle],
  );
  const displayLocation = useMemo(
    () => (bundle ? inferCandidateLocation(bundle) : ''),
    [bundle],
  );
  const currentCv = bundle?.currentCv;

  const professionalExperiences = useMemo(
    () =>
      (currentDraft?.experience ?? []).filter(
        (item) => !isInternshipExperience(item),
      ),
    [currentDraft?.experience],
  );

  const internshipExperiences = useMemo(
    () =>
      (currentDraft?.experience ?? []).filter((item) =>
        isInternshipExperience(item),
      ),
    [currentDraft?.experience],
  );

  const codingSkillLabels = useMemo(() => {
    const skillLabels = (bundle?.skills ?? []).map(inferSkillLabel);
    return skillLabels.filter((label) =>
      /(python|java|react|sql|typescript|javascript|docker|kafka|spark|node)/i.test(
        label,
      ),
    );
  }, [bundle?.skills]);

  const refreshCandidateViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['candidate', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['candidate', 'matches'] }),
      queryClient.invalidateQueries({ queryKey: ['candidate', 'job-offers'] }),
    ]);
  };

  const refetchCandidateBundle = async () =>
    queryClient.fetchQuery({
      queryKey: ['candidate', 'bundle'],
      queryFn: () => gatewayApi.candidate.getBundle(),
    });


  const handleCancel = () => {
    if (bundle) {
      setDraft(toDraft(bundle));
    }
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
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(
        `${appEnv.apiBaseUrl.replace(/\/+$/, "")}${gatewayApi.candidate.getCurrentCvViewUrl()}`,
        {
          method: "GET",
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

      setDraft((current) =>
        current ? applyParsedCvToDraft(current, parseResult) : current,
      );

      setIsEditing(true);

      await refreshCandidateViews();

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
          gatewayApi.candidate.createEducation({
            level_code: item.levelCode || null,
            diploma_label: item.diplomaLabel || null,
            specialty: item.specialty || null,
            institution: item.institution || null,
            graduation_year: item.graduationYear
              ? Number(item.graduationYear)
              : null,
          }),
        (item) =>
          gatewayApi.candidate.updateEducation(item.id!, {
            level_code: item.levelCode || null,
            diploma_label: item.diplomaLabel || null,
            specialty: item.specialty || null,
            institution: item.institution || null,
            graduation_year: item.graduationYear
              ? Number(item.graduationYear)
              : null,
          }),
        (id) => gatewayApi.candidate.deleteEducation(id),
      );

      await syncDraftCollection<CandidateExperienceRecord, ExperienceDraft>(
        bundle.experience,
        currentDraft.experience,
        hasExperienceValue,
        (item) =>
          gatewayApi.candidate.createExperience({
            job_title_raw: item.jobTitleRaw || null,
            company_name: item.companyName || null,
            sector: item.sector || null,
            start_date: item.startDate || null,
            end_date: item.endDate || null,
            description: item.description || null,
          }),
        (item) =>
          gatewayApi.candidate.updateExperience(item.id!, {
            job_title_raw: item.jobTitleRaw || null,
            company_name: item.companyName || null,
            sector: item.sector || null,
            start_date: item.startDate || null,
            end_date: item.endDate || null,
            description: item.description || null,
          }),
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

      const updatedBundle = await refetchCandidateBundle();
      await refreshCandidateViews();
      setDraft(toDraft(updatedBundle));
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
                onClick={() => setIsEditing(true)}
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
        <div className="border-b border-border bg-gradient-to-br from-primary/[0.06] via-background to-accent-soft/50 px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-start">
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
                <ProfileMetaChip
                  icon={MapPin}
                  label={cleanDisplayText(displayLocation)}
                />
                <ProfileMetaChip
                  icon={Mail}
                  label={cleanDisplayText(bundle?.contact?.email)}
                />
                <ProfileMetaChip
                  icon={Globe2}
                  label={`Langue principale : ${
                    bundle?.primaryLanguage
                      ? formatLanguageLabel(bundle.primaryLanguage)
                      : 'Non renseigné'
                  }`}
                />
                <ProfileMetaChip
                  icon={Languages}
                  label={`${bundle?.languages.length ?? 0} langue(s) renseignée(s)`}
                />
              </div>
            </div>
            <div className="w-full rounded-2xl border border-border bg-background/90 p-4 shadow-sm lg:max-w-sm">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                CV actuel
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {currentCv?.originalFilename ?? 'Aucun CV importé'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {currentCv
                  ? `Statut : ${formatCvStatusLabel(currentCv.parsingStatus)}${
                      formatShortDate(currentCv.uploadedAt)
                        ? ` • Importé le ${formatShortDate(currentCv.uploadedAt)}`
                        : ''
                    }`
                  : 'Importez votre CV pour enrichir automatiquement votre profil.'}
              </p>
            </div>
          </div>

        </div>

        <div className="space-y-8 px-6 py-7 sm:px-8">
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
              <Field
                label="Langue principale"
                value={currentDraft.primaryLanguage}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, primaryLanguage: value } : current,
                  )
                }
                disabled={!isEditing}
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
                    current ? { ...current, delegationCode: value } : current,
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
                      current ? { ...current, passportNumber: value } : current,
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
                    current ? { ...current, mobilityRadiusKm: value } : current,
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
                    current ? { ...current, desiredSalaryMin: value } : current,
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
                    current ? { ...current, desiredSalaryMax: value } : current,
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
            title="Formation"
            description="Vos diplômes, spécialités et établissements."
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
                  onChange={(value) => update({ ...item, levelCode: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Diplôme"
                  value={item.diplomaLabel}
                  onChange={(value) => update({ ...item, diplomaLabel: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Spécialité"
                  value={item.specialty}
                  onChange={(value) => update({ ...item, specialty: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Établissement"
                  value={item.institution}
                  onChange={(value) => update({ ...item, institution: value })}
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
            title="Expérience"
            description="Vos expériences professionnelles et vos stages."
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
                  onChange={(value) => update({ ...item, jobTitleRaw: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Entreprise"
                  value={item.companyName}
                  onChange={(value) => update({ ...item, companyName: value })}
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
                  onChange={(value) => update({ ...item, startDate: value })}
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
            renderListView={() => (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-5">
                  <h3 className="text-base font-semibold text-foreground">
                    Expériences professionnelles
                  </h3>
                  <div className="mt-4 space-y-4">
                    {professionalExperiences.length > 0 ? (
                      professionalExperiences.map((item, index) => (
                        <div
                          key={item.id ?? `professional-${index}`}
                          className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {item.jobTitleRaw || 'Expérience professionnelle'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[item.companyName, item.sector]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                          {formatExperiencePeriod(
                            item.startDate,
                            item.endDate,
                          ) ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatExperiencePeriod(item.startDate, item.endDate)}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-3 text-sm leading-6 text-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      ))
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
                      internshipExperiences.map((item, index) => (
                        <div
                          key={item.id ?? `internship-${index}`}
                          className="rounded-2xl border border-border bg-surface-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {item.jobTitleRaw || 'Stage'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[item.companyName, item.sector]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                          {formatExperiencePeriod(
                            item.startDate,
                            item.endDate,
                          ) ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatExperiencePeriod(item.startDate, item.endDate)}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-3 text-sm leading-6 text-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucun stage renseigné.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            viewItem={(item) => (
              <>
                <h3 className="text-base font-semibold text-foreground">
                  {item.jobTitleRaw || 'Expérience'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[item.companyName, item.sector].filter(Boolean).join(' • ')}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {item.description || 'Aucune description renseignée.'}
                </p>
              </>
            )}
          />

          <Separator className="bg-primary/40" />

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
            renderListView={(items) => (
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex flex-wrap gap-2">
                  {items.map((item, index) => (
                    <SkillTag
                      key={item.id ?? `skill-${index}`}
                      label={item.skillLabelRaw || 'Compétence'}
                      variant="matched"
                    />
                  ))}
                </div>
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

          <Separator className="bg-primary/40" />

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
                  onChange={(value) => update({ ...item, languageCode: value })}
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
                    onChange={(value) => update({ ...item, evidence: value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            )}
            renderListView={(items) => (
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex flex-wrap gap-2">
                  {items.map((item, index) => {
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
                      <SkillTag
                        key={item.id ?? `language-${index}`}
                        label={label}
                        variant="outline"
                      />
                    );
                  })}
                </div>
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
                  {item.evidence ? <SkillTag label={item.evidence} /> : null}
                </div>
              );
            }}
          />

          <Separator className="bg-primary/40" />

          <section className="space-y-4">
            <SectionTitle
              title="Compétences détectées depuis le CV"
              description="Un aperçu des informations extraites automatiquement de votre CV."
              icon={Languages}
              iconClassName="icon-background-color-7"
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-5 card-border-top">
                <p className="text-sm font-semibold text-foreground">
                  Compétences détectées
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {bundle?.skills.length ? (
                    bundle.skills.map((skill) => (
                      <SkillTag
                        key={skill.id}
                        label={inferSkillLabel(skill)}
                        variant="matched"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune compétence n'est encore enregistrée. Importez un CV
                      ou ajoutez-les manuellement.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5 card-border-top">
                <p className="text-sm font-semibold text-foreground">
                  Compétences numériques
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {codingSkillLabels.length ? (
                    codingSkillLabels.map((skill) => (
                      <SkillTag key={skill} label={skill} variant="matched" />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Les compétences techniques apparaîtront ici lorsqu'elles
                      seront détectées dans votre profil.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <Separator className="bg-primary/40" />

          <section className="space-y-4">
            <SectionTitle
              title="Domaines et technologies qui vous intéressent"
              description="Préférences temporaires côté front, en attendant leur persistance via l'API."
              icon={Globe2}
              iconClassName="icon-background-color-7"
            />

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="flex flex-wrap gap-2">
                {candidateInterestKeywords.map((keyword) => (
                  <SkillTag key={keyword} label={keyword} variant="matched" />
                ))}
              </div>

              <div className="mt-6 grid gap-3 md:max-w-xs">
                <Label className="text-xs text-muted-foreground">
                  Score minimum des offres
                </Label>
                <Select
                  value={String(minimumOfferScore)}
                  onValueChange={(value) => {
                    const nextScore = Number(value);
                    setMinimumOfferScore(nextScore);
                    // Ce seuil servira plus tard à filtrer les offres recommandées via l'API.
                    setStoredCandidateMinimumOfferScore(nextScore);
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
                  Ce seuil est actuellement conservé uniquement dans votre
                  navigateur.
                </p>
              </div>
            </div>
          </section>
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
    <section className="space-y-4">
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
        {items?.length === 0 ? (
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
