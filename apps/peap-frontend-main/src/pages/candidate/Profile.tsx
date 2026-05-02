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
  FileDown,
  FilePenLine,
  FileUp,
  Globe2,
  GraduationCap,
  Languages,
  Loader,
  Loader2,
  Loader2Icon,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  Settings,
  Settings2,
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
  type CandidateCvRecord,
  gatewayApi,
  inferCandidateDisplayName,
  inferCandidateLocation,
  inferLanguageLabel,
  inferSkillLabel,
  type CandidateEducationRecord,
  type CandidateExperienceRecord,
  type CandidateLanguageRecord,
  type CandidateProfileBundle,
  type CandidateSkillRecord,
  type ReferentialOption,
} from '@/services/api/gateway';
import { appEnv } from '@/config/env';
import { ApiServiceError } from '@/services/api/client';
import { readStoredSession } from '@/services/auth/sessionStorage';
import ErrorCard from '@/components/common/ErrorCard';
import LoadingCard from '@/components/common/LoadingCard';

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

async function openAuthenticatedFile(path: string): Promise<void> {
  const token = readStoredSession()?.token;
  const headers = new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    `${appEnv.apiBaseUrl.replace(/\/+$/, '')}${path}`,
    {
      method: 'GET',
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export default function Profile() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [isOpeningCv, setIsOpeningCv] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

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

  const codingSkillLabels = useMemo(() => {
    const skillLabels = (bundle?.skills ?? []).map(inferSkillLabel);
    return skillLabels.filter((label) =>
      /(python|java|react|sql|typescript|javascript|docker|kafka|spark|node)/i.test(
        label,
      ),
    );
  }, [bundle?.skills]);

  const refreshCandidateProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['candidate', 'bundle'] }),
      queryClient.invalidateQueries({ queryKey: ['candidate', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['candidate', 'matches'] }),
      queryClient.invalidateQueries({ queryKey: ['candidate', 'job-offers'] }),
      queryClient.invalidateQueries({ queryKey: ['search', 'offers'] }),
    ]);
  };

  const waitForCvParsed = async (cvId: string): Promise<CandidateCvRecord> => {
    const startedAt = Date.now();
    const timeoutMs = 70_000;
    const pollingIntervalMs = 2_500;
    const successStatuses = new Set([
      'PARSED',
      'READY',
      'COMPLETED',
      'AVAILABLE',
    ]);
    const failureStatuses = new Set(['FAILED', 'ERROR']);

    while (Date.now() - startedAt < timeoutMs) {
      const currentCv = await gatewayApi.candidate.getCurrentCv();
      const currentStatus = (currentCv.status ?? '').toUpperCase();
      const currentParsingStatus = (
        currentCv.parsingStatus ?? ''
      ).toUpperCase();

      if (currentCv.id !== cvId) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, pollingIntervalMs),
        );
        continue;
      }

      if (
        failureStatuses.has(currentStatus) ||
        failureStatuses.has(currentParsingStatus)
      ) {
        throw new Error("L'analyse du CV a échoué.");
      }

      if (
        successStatuses.has(currentStatus) ||
        successStatuses.has(currentParsingStatus)
      ) {
        return currentCv;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, pollingIntervalMs),
      );
    }

    throw new Error("L'analyse de votre CV prend plus de temps que prévu.");
  };

  const handleCancel = () => {
    if (bundle) {
      setDraft(toDraft(bundle));
    }
    setIsEditing(false);
  };

  const handleOpenCurrentCv = async () => {
    setIsOpeningCv(true);
    try {
      await openAuthenticatedFile(gatewayApi.candidate.getCurrentCvViewUrl());
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'ouvrir le CV actuel"));
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

      toast.success('CV uploadé. Analyse de votre cv en cours...');

      await waitForCvParsed(record.id);

      await refreshCandidateProfile();
      const refreshedBundle = await queryClient.fetchQuery({
        queryKey: ['candidate', 'bundle'],
        queryFn: () => gatewayApi.candidate.getBundle(),
      });
      setDraft(toDraft(refreshedBundle));
      setIsEditing(true);
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['candidate', 'bundle'] }),
        queryClient.invalidateQueries({ queryKey: ['search', 'offers'] }),
      ]);

      setIsEditing(false);
      toast.success('Candidate profile saved');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save the profile',
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

  const currentCv = bundle?.currentCv;

  return (
    <div className="relative space-y-6">
      {isUploadingCv || isParsingCv ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-background px-6 py-5 text-center shadow-lg">
            <div className="flex items-center justify-center gap-3 text-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm font-medium">
                {isParsingCv
                  ? 'CV uploadé. Analyse de votre cv en cours...'
                  : 'Upload du CV en cours...'}
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
        description="Retrouvez vos informations, vos competences et vos preferences au meme endroit."
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
              {isOpeningCv ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
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
                ? 'Upload...'
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
                Edit
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
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
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
                Gardez vos coordonnees, vos experiences, vos competences et vos
                preferences a jour pour recevoir des offres plus pertinentes.
              </p>
            </div>

            {/* <div className="rounded-2xl border border-border bg-background/90 p-4 shadow-sm lg:max-w-xs">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                CV actuel
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {currentCv?.originalFilename ?? 'Aucun CV importe'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentCv
                  ? `Status: ${currentCv.parsingStatus} • Uploaded ${currentCv.uploadedAt.slice(0, 10)}`
                  : 'Upload a CV to create and parse a structured profile.'}
              </p>
            </div> */}

            <div
              className={`flex gap-1 rounded-2xl border border-border p-2 ${currentCv && 'button-download hover:text-accent-foreground hover:bg-accent'}`}
            >
              {currentCv ? (
                <>
                  <FileDown className="h-4 w-4 text-accent" />
                  <p className="text-xs">
                    {`Status: ${currentCv.parsingStatus} • Uploaded ${currentCv.uploadedAt.slice(0, 10)}`}
                  </p>
                </>
              ) : (
                <>
                  <FilePenLine className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Upload a CV to create and parse a structured profile.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              icon={MapPin}
              label="Location"
              value={displayLocation || 'Not set'}
              className="card-border-left-orange"
            />
            <InfoCard
              icon={Mail}
              label="Email"
              value={bundle?.contact?.email || 'Not set'}
              className="card-border-left-orange"
            />
            <InfoCard
              icon={Globe2}
              label="Primary language"
              value={bundle?.primaryLanguage || 'Not set'}
              className="card-border-left-orange"
            />
            <InfoCard
              icon={Languages}
              label="Languages"
              value={String(bundle?.languages.length ?? 0)}
              className="card-border-left-orange"
            />
          </div>
        </div>

        <div className="space-y-8 px-6 py-7 sm:px-8">
          <section className="space-y-4">
            <SectionTitle
              title="Identity & Contact"
              description="Vos informations personnelles et vos coordonnees."
              icon={UserRound}
              iconClassName="icon-background-color-3"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="First name"
                value={currentDraft.firstName}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, firstName: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Last name"
                value={currentDraft.lastName}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, lastName: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Email"
                value={currentDraft.email}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, email: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Phone"
                value={currentDraft.phone}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, phone: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Address"
                value={currentDraft.address}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, address: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Nationality"
                value={currentDraft.nationality}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, nationality: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <Field
                label="Birth date"
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
                label="Primary language"
                value={currentDraft.primaryLanguage}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, primaryLanguage: value } : current,
                  )
                }
                disabled={!isEditing}
              />
              <OptionSelect
                label="Gender"
                value={currentDraft.genderCode}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, genderCode: value } : current,
                  )
                }
                options={gendersQuery.data ?? []}
                placeholder="Select gender"
                disabled={!isEditing}
              />
              <OptionSelect
                label="Governorate"
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
                placeholder="Select governorate"
                disabled={!isEditing}
              />
              <OptionSelect
                label="Delegation"
                value={currentDraft.delegationCode}
                onChange={(value) =>
                  setDraft((current) =>
                    current ? { ...current, delegationCode: value } : current,
                  )
                }
                options={delegationsQuery.data ?? []}
                placeholder="Select delegation"
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
                  label="Passport"
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
              title="Preferences"
              description="Vos preferences de contrat, de mobilite et de salaire."
              icon={Globe2}
              iconClassName="icon-background-color-7"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <OptionSelect
                label="Preferred contract"
                value={currentDraft.preferredContractType}
                onChange={(value) =>
                  setDraft((current) =>
                    current
                      ? { ...current, preferredContractType: value }
                      : current,
                  )
                }
                options={contractTypesQuery.data ?? []}
                placeholder="Select contract type"
                disabled={!isEditing}
              />
              <OptionSelect
                label="Preferred governorate"
                value={currentDraft.preferredGovernorate}
                onChange={(value) =>
                  setDraft((current) =>
                    current
                      ? { ...current, preferredGovernorate: value }
                      : current,
                  )
                }
                options={governoratesQuery.data ?? []}
                placeholder="Select governorate"
                disabled={!isEditing}
              />
              <Field
                label="Mobility radius (km)"
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
                label="Accepts relocation"
                value={currentDraft.acceptsRelocation ? 'Yes' : 'No'}
                onChange={() => undefined}
                disabled
              />
              <Field
                label="Desired salary min"
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
                label="Desired salary max"
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
                Accept relocation
              </label>
            ) : null}
          </section>

          <Separator className="bg-primary/40" />

          <CollectionSection<EducationDraft>
            title="Education"
            description="Vos diplomes, specialites et etablissements."
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
            renderItem={(item, update) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Level code"
                  value={item.levelCode}
                  onChange={(value) => update({ ...item, levelCode: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Diploma"
                  value={item.diplomaLabel}
                  onChange={(value) => update({ ...item, diplomaLabel: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Specialty"
                  value={item.specialty}
                  onChange={(value) => update({ ...item, specialty: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Institution"
                  value={item.institution}
                  onChange={(value) => update({ ...item, institution: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Graduation year"
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
                  {item.diplomaLabel || item.levelCode || 'Education entry'}
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
            title="Experience"
            description="Vos postes, secteurs et missions principales."
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
            renderItem={(item, update) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Job title"
                  value={item.jobTitleRaw}
                  onChange={(value) => update({ ...item, jobTitleRaw: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Company"
                  value={item.companyName}
                  onChange={(value) => update({ ...item, companyName: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Sector"
                  value={item.sector}
                  onChange={(value) => update({ ...item, sector: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Start date"
                  type="date"
                  value={item.startDate}
                  onChange={(value) => update({ ...item, startDate: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="End date"
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
            viewItem={(item) => (
              <>
                <h3 className="text-base font-semibold text-foreground">
                  {item.jobTitleRaw || 'Experience entry'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[item.companyName, item.sector].filter(Boolean).join(' - ')}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {item.description || 'No description provided.'}
                </p>
              </>
            )}
          />

          <Separator className="bg-primary/40" />

          <CollectionSection<SkillDraft>
            title="Skills"
            description="Les competences que vous souhaitez mettre en avant."
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
            renderItem={(item, update) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Skill"
                  value={item.skillLabelRaw}
                  onChange={(value) =>
                    update({ ...item, skillLabelRaw: value })
                  }
                  disabled={!isEditing}
                />
                <Field
                  label="Level"
                  value={item.level}
                  onChange={(value) => update({ ...item, level: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Years"
                  type="number"
                  value={item.years}
                  onChange={(value) => update({ ...item, years: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Evidence"
                  value={item.evidence}
                  onChange={(value) => update({ ...item, evidence: value })}
                  disabled={!isEditing}
                />
              </div>
            )}
            viewItem={(item) => (
              <div className="flex flex-wrap gap-2">
                <SkillTag
                  label={item.skillLabelRaw || 'Skill'}
                  variant="matched"
                />
                {item.level ? <SkillTag label={item.level} /> : null}
                {item.years ? <SkillTag label={`${item.years} years`} /> : null}
              </div>
            )}
          />

          <Separator className="bg-primary/40" />

          <CollectionSection<LanguageDraft>
            title="Languages"
            description="Les langues que vous maitrisez."
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
            renderItem={(item, update) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Language code"
                  value={item.languageCode}
                  onChange={(value) => update({ ...item, languageCode: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Level"
                  value={item.level}
                  onChange={(value) => update({ ...item, level: value })}
                  disabled={!isEditing}
                />
                <Field
                  label="Evidence"
                  value={item.evidence}
                  onChange={(value) => update({ ...item, evidence: value })}
                  disabled={!isEditing}
                />
              </div>
            )}
            viewItem={(item) => (
              <div className="flex flex-wrap gap-2">
                <SkillTag
                  label={inferLanguageLabel({
                    id: '',
                    languageCode: item.languageCode,
                    level: item.level,
                    evidence: item.evidence,
                    createdAt: '',
                    updatedAt: '',
                  })}
                />
              </div>
            )}
          />

          <Separator className="bg-primary/40" />

          <section className="space-y-4">
            <SectionTitle
              title="Competences detectees depuis le CV"
              description="Un apercu des informations extraites automatiquement de votre CV."
              icon={Languages}
              iconClassName="icon-background-color-7"
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-5 card-border-top">
                <p className="text-sm font-semibold text-foreground">
                  Competences detectees
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
                      Aucune competence n'est encore enregistree. Importez un CV
                      ou ajoutez-les manuellement.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5 card-border-top">
                <p className="text-sm font-semibold text-foreground">
                  Competences numeriques
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {codingSkillLabels.length ? (
                    codingSkillLabels.map((skill) => (
                      <SkillTag key={skill} label={skill} variant="matched" />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Les competences techniques apparaitront ici lorsqu'elles
                      seront detectees dans votre profil.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background/80 p-4 ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
        <Icon className="h-4 w-4 text-accent" />
        {value}
      </p>
    </div>
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
  iconClassName,
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
  iconClassName?: string;
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
            Add
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {items?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
            No records yet.
          </div>
        ) : null}

        {items?.map((item, index) => (
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
