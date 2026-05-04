import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill } from '@/components/common/StatusPill';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateOfferMutation } from '@/services/api/queries';
import { gatewayApi } from '@/services/api/gateway';
import type { OfferParsedOutput } from '@/models';
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type OfferInputMode = 'smart' | 'manual';

interface OfferLanguageDraft {
  languageCode: string;
  level: string;
}

type ReferentialOption = {
  code: string;
  label: string;
};

type ParsedOfferResult = Partial<OfferParsedOutput> & {
  parsingStatus?: string;
  parsing_status?: string;
  parsedPayload?: Record<string, unknown>;
  parsed_payload?: Record<string, unknown>;
  mappedPayload?: Record<string, unknown>;
  mapped_payload?: Record<string, unknown>;
  extractedRequirements?: Array<Record<string, unknown>>;
  extracted_requirements?: Array<Record<string, unknown>>;
  draft?: Record<string, unknown>;
  warnings?: string[];
  parserVersion?: string | null;
};
const EMPTY_FORM: StructuredOfferForm = {
  title: '',
  companyName: '',
  governorateCode: '',
  delegationCode: '',
  contractType: '',
  numberOfPositions: '1',
  workMode: 'UNKNOWN',
  seniorityLevel: 'mid',
  salaryMin: '',
  salaryMax: '',
  deadlineAt: '',
  targetOccupations: '',
  mandatorySkills: '',
  optionalSkills: '',
  minYearsExperience: '',
  educationMin: '',
  certificationsPreferred: '',
  languages: [],
};

const SAMPLE_OFFER = `Ingénieur Data Senior chez Atlas Analytics. Nous recherchons un ingénieur data senior à Tunis ou en mode hybride pour concevoir des pipelines de données robustes avec Python, SQL, PostgreSQL, Airflow et Docker. Une expérience avec Kafka est un plus. Minimum 4 ans d'expérience, anglais B2 requis, français apprécié. Poste à temps plein dans les services informatiques.`;
const SENIORITY_LEVEL_OPTIONS = ['junior', 'confirmé', 'senior', 'chef de projet'];
const WORK_MODE_OPTIONS = [
  { value: 'ONSITE', label: 'Sur site' },
  { value: 'REMOTE', label: 'À distance' },
  { value: 'HYBRID', label: 'Hybride' },
  { value: 'UNKNOWN', label: 'Non précisé' },
];


const emptyOfferLanguage = (): OfferLanguageDraft => ({
  languageCode: '',
  level: '',
});

interface StructuredOfferForm {
  title: string;
  companyName: string;
  governorateCode: string;
  delegationCode: string;
  contractType: string;
  numberOfPositions: string;
  workMode: string;
  seniorityLevel: string;
  salaryMin: string;
  salaryMax: string;
  deadlineAt: string;
  targetOccupations: string;
  mandatorySkills: string;
  optionalSkills: string;
  minYearsExperience: string;
  educationMin: string;
  certificationsPreferred: string;
  languages: OfferLanguageDraft[];
}

export default function CreateOffer() {
  const navigate = useNavigate();
  const createOffer = useCreateOfferMutation();
  const [form, setForm] = useState<StructuredOfferForm>(EMPTY_FORM);

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

  const employerProfileQuery = useQuery({
    queryKey: ["employer", "profile"],
    queryFn: gatewayApi.employer.getProfile,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    const employer = employerProfileQuery.data;

    const companyName =
      employer?.legalName?.trim() ||
      employer?.commercialName?.trim() ||
      employer?.contact?.contact_name?.trim() ||
      '';

    setForm((current) => ({
      ...current,
      companyName,
    }));
  }, [employerProfileQuery.data]);

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

  const governoratesQuery = useQuery({
    queryKey: ['referentials', 'governorates'],
    queryFn: () => gatewayApi.referentials.governorates(),
    staleTime: 5 * 60_000,
  });

  const delegationsQuery = useQuery({
    queryKey: ['referentials', 'delegations', form.governorateCode],
    queryFn: () => gatewayApi.referentials.delegations(form.governorateCode),
    enabled: Boolean(form.governorateCode),
    staleTime: 5 * 60_000,
  });

  const [inputMode, setInputMode] = useState<OfferInputMode>('smart');
  const [step, setStep] = useState<'raw' | 'structured'>('raw');
  const [isParsing, setIsParsing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedOfferResult | null>(null);

  const updateField = (
    field: Exclude<keyof StructuredOfferForm, 'languages'>,
    value: string,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const switchInputMode = (nextMode: OfferInputMode) => {
    setInputMode(nextMode);
    setStep(nextMode === 'manual' ? 'structured' : 'raw');
    if (nextMode === 'manual') {
      setParsed(null);
    }
  };

  const analyze = async () => {
    setIsParsing(true);
    try {
      const parsedOutput = (await gatewayApi.employer.parseOfferDraft({
        raw_text: rawText,
        title: null,
      })) as ParsedOfferResult;
      setParsed(parsedOutput);
      setForm((current) => formFromParsed(parsedOutput, current));
      setStep('structured');
      toast.success("L'offre a été analysée et le formulaire a été prérempli.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de l'analyse de l'offre.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const submit = async () => {
    if (
      !form.title.trim() ||
      !form.delegationCode ||
      !form.governorateCode ||
      !form.contractType
    ) {
      toast.error(
        'Le titre, le gouvernorat, la délégation et le type de contrat sont obligatoires avant la soumission.',
      );
      return;
    }

    const numberOfPositions = Number(form.numberOfPositions || 1);
    if (!Number.isFinite(numberOfPositions) || numberOfPositions < 1) {
      toast.error(
        'Le nombre de postes ouverts doit être supérieur ou égal à 1.',
      );
      return;
    }

    const salaryMin = form.salaryMin ? Number(form.salaryMin) : null;
    const salaryMax = form.salaryMax ? Number(form.salaryMax) : null;
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      toast.error(
        'Le salaire maximum doit être supérieur ou égal au salaire minimum.',
      );
      return;
    }

    const languageOptions = languagesQuery.data ?? [];
    const languageStrings = form.languages
      .map((item) => languageDraftToText(item, languageOptions))
      .filter(Boolean);

    const governorateOptions = governoratesQuery.data ?? [];
    const delegationOptions = delegationsQuery.data ?? [];

    const selectedGovernorateLabel =
      governorateOptions.find((item) => item.code === form.governorateCode)?.label ??
      form.governorateCode;

    const selectedDelegationLabel =
      delegationOptions.find((item) => item.code === form.delegationCode)?.label ??
      form.delegationCode;

    const locationLabel = [selectedDelegationLabel, selectedGovernorateLabel, 'TN']
      .filter(Boolean)
      .join(', ');

    const normalizedRawText =
      rawText.trim() || buildRawTextFromForm(form, languageOptions);
    if (normalizedRawText.trim().length < 20) {
      toast.error(
        "Ajoutez un peu plus de détails avant la soumission afin de conserver une trace exploitable de l'offre.",
      );
      return;
    }

    try {

      await createOffer.mutateAsync({
        // Champs backend réels
        title: form.title.trim(),
        description: normalizedRawText,
        company_name: form.companyName.trim() || null,
        number_of_positions: numberOfPositions,
        contract_type: form.contractType || null,
        work_mode: form.workMode || 'UNKNOWN',
        salary_min: salaryMin,
        salary_max: salaryMax,
        country: 'TN',
        governorate_code: form.governorateCode || null,
        delegation_code: form.delegationCode || null,
        deadline_at: form.deadlineAt || null,

        // Anciens champs gardés pour ne rien casser côté front
        rawText: normalizedRawText,
        companyName: form.companyName.trim(),
        location: locationLabel,
        contract: form.contractType,
        level: form.seniorityLevel,
        numberOfPositions,
        workMode: form.workMode || 'UNKNOWN',
        salaryMin,
        salaryMax,
        deadlineAt: form.deadlineAt || null,

        targetOccupations: splitList(form.targetOccupations),
        requiredSkills: splitList(form.mandatorySkills),
        preferredSkills: splitList(form.optionalSkills),
        minYearsExperience: form.minYearsExperience
          ? Number(form.minYearsExperience)
          : '',
        educationMin: form.educationMin.trim(),
        certificationsPreferred: splitList(form.certificationsPreferred),
        languages: languageStrings,
        parsedOffer:
          inputMode === 'smart'
            ? ((parsed as unknown as OfferParsedOutput) ?? undefined)
            : undefined,
      });

      toast.success("L'offre a été créée avec succès.");
      navigate('/provider/offers');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la création de l'offre.",
      );
    }
  };

  const confidence = parsed?.parsing_metadata?.confidence_overall;
  const modeLabel =
    inputMode === 'manual'
      ? 'Saisie manuelle'
      : step === 'raw'
        ? '1. Texte brut'
        : '2. Revue structurée';

  return (
    <div className="space-y-6 w-full">
      <Link
        to="/provider/offers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-md border border-border px-4 py-2 light-link-md-border-right-orange"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux offres
      </Link>

      <PageHeader
        title="Créer une offre d'emploi"
        description="Choisissez entre l'analyse d'un texte libre ou la saisie manuelle du formulaire structuré."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill
              label={modeLabel}
              tone={
                inputMode === 'manual'
                  ? 'neutral'
                  : step === 'raw'
                    ? 'info'
                    : 'success'
              }
            />
            {typeof confidence === 'number' && (
              <StatusPill
                label={`${Math.round(confidence * 100)}% de confiance`}
                tone="accent"
              />
            )}
          </div>
        }
      />

      <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between card-border-top-orange">
        <div>
          <p className="text-sm font-semibold text-foreground">Mode de saisie</p>
          <p className="mt-1 text-xs text-muted-foreground">
            L'analyse à partir d'un paragraphe utilise le parseur backend pour
            préremplir le formulaire. La saisie manuelle contourne cette étape
            et vous permet de renseigner directement les champs structurés.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={inputMode === 'smart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchInputMode('smart')}
          >
            Analyser un paragraphe
          </Button>
          <Button
            type="button"
            variant={inputMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchInputMode('manual')}
          >
            Saisir manuellement
          </Button>
        </div>
      </div>

      {inputMode === 'smart' && step === 'raw' ? (
        <div className="panel p-5 space-y-4 card-border-top-orange">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="stat-label">Texte brut de l'offre</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Collez un paragraphe décrivant l'offre et MatchCore
                préremplira le formulaire structuré modifiable.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRawText(SAMPLE_OFFER)}
            >
              Utiliser un exemple
            </Button>
          </div>

          <div>
            <Label className="text-xs">Texte de l'offre *</Label>
            <Textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={14}
              placeholder="Collez la description complète du poste, incluant le rôle, l'entreprise, les exigences, la localisation et les attentes linguistiques..."
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          <div className="flex items-end justify-end">
            <Button
              type="button"
              disabled={rawText.trim().length < 20 || isParsing}
              onClick={analyze}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isParsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4 mr-1.5" />
              )}
              {isParsing ? 'Analyse en cours...' : 'Analyser le texte'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Structured Review
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {parsed
                  ? 'Fields are editable. Empty values mean the parser did not extract enough signal.'
                  : 'Manual mode writes the structured offer directly. MatchCore generates the raw trace internally when you submit.'}
              </p>
            </div>
            {inputMode === 'smart' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('raw')}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Rework raw text
              </Button>
            )}
          </div> */}

          <div className="panel p-5 space-y-4 card-border-top">
            <p className="stat-label">Informations du poste</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Titre du poste *"
                value={form.title}
                onChange={(value) => updateField('title', value)}
              />
              <div>
                <Label className="text-xs">Nom de l’entreprise</Label>
                <div className="mt-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {form.companyName || 'Entreprise connectée'}
                </div>
              </div>
              <div>
                <Label className="text-xs">Type de contrat *</Label>
                <Select
                  value={form.contractType || undefined}
                  onValueChange={(value) => updateField('contractType', value)}
                  disabled={contractTypesQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner un type de contrat" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contractTypesQuery.data ?? []).map((option) => (
                      <SelectItem key={option.code} value={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Gouvernorat *</Label>
                <Select
                  value={form.governorateCode || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      governorateCode: value,
                      delegationCode: '',
                    }))
                  }
                  disabled={governoratesQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner un gouvernorat" />
                  </SelectTrigger>
                  <SelectContent>
                    {(governoratesQuery.data ?? []).map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Délégation *</Label>
                <Select
                  value={form.delegationCode || undefined}
                  onValueChange={(value) => updateField('delegationCode', value)}
                  disabled={!form.governorateCode || delegationsQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner une délégation" />
                  </SelectTrigger>
                  <SelectContent>
                    {(delegationsQuery.data ?? []).map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Field
                label="Nombre de postes ouverts"
                value={form.numberOfPositions}
                type="number"
                onChange={(value) => updateField('numberOfPositions', value)}
              />

              <div>
                <Label className="text-xs">Mode de travail</Label>
                <Select
                  value={form.workMode || undefined}
                  onValueChange={(value) => updateField('workMode', value)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner un mode de travail" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Niveau d’expérience</Label>
                <Select
                  value={form.seniorityLevel}
                  onValueChange={(value) => updateField('seniorityLevel', value)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="mid">Intermédiaire</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Responsable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Field
                label="Années d’expérience minimum"
                value={form.minYearsExperience}
                type="number"
                onChange={(value) => updateField('minYearsExperience', value)}
              />

              <Field
                label="Salaire minimum proposé"
                value={form.salaryMin}
                type="number"
                onChange={(value) => updateField('salaryMin', value)}
              />

              <Field
                label="Salaire maximum proposé"
                value={form.salaryMax}
                type="number"
                onChange={(value) => updateField('salaryMax', value)}
              />

              <Field
                label="Date de clôture de l'offre"
                value={form.deadlineAt}
                type="date"
                onChange={(value) => updateField('deadlineAt', value)}
              />
            </div>
          </div>

          <div className="panel p-5 space-y-4 card-border-top">
            <p className="stat-label">Exigences extraites</p>
            <ListField
              label="Métiers ciblés"
              value={form.targetOccupations}
              onChange={(value) => updateField('targetOccupations', value)}
            />
            <TagPreview value={form.targetOccupations} />
            <ListField
              label="Compétences obligatoires"
              value={form.mandatorySkills}
              onChange={(value) => updateField('mandatorySkills', value)}
            />
            <TagPreview value={form.mandatorySkills} matched />
            <ListField
              label="Compétences optionnelles"
              value={form.optionalSkills}
              onChange={(value) => updateField('optionalSkills', value)}
            />
            <TagPreview value={form.optionalSkills} />
          </div>

          <div className="panel p-5 space-y-4 card-border-top">
            <p className="stat-label">Formation, certifications et langues</p>
            <div>
              <Label className="text-xs">Diplôme minimum</Label>
              <Select
                value={form.educationMin || undefined}
                onValueChange={(value) => updateField('educationMin', value)}
                disabled={diplomasQuery.isLoading}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Sélectionner un diplôme minimum" />
                </SelectTrigger>
                <SelectContent>
                  {(diplomasQuery.data ?? []).map((option) => (
                    <SelectItem key={option.code} value={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ListField
              label="Certifications souhaitées"
              value={form.certificationsPreferred}
              onChange={(value) =>
                updateField('certificationsPreferred', value)
              }
            />
            <LanguageRequirementsField
              value={form.languages}
              onChange={(languages) =>
                setForm((current) => ({
                  ...current,
                  languages,
                }))
              }
              languageOptions={languagesQuery.data ?? []}
              levelOptions={languageLevelsQuery.data ?? []}
              isLoading={
                languagesQuery.isLoading || languageLevelsQuery.isLoading
              }
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            {inputMode === 'smart' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('raw')}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
              </Button>
            )}
            <Button
              type="button"
              disabled={createOffer.isPending}
              onClick={submit}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {createOffer.isPending
                ? 'Soumission en cours...'
                : inputMode === 'manual'
                  ? "Créer l'offre"
                  : 'Valider et soumettre'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageRequirementsField({
  value,
  onChange,
  languageOptions,
  levelOptions,
  isLoading = false,
}: {
  value: OfferLanguageDraft[];
  onChange: (value: OfferLanguageDraft[]) => void;
  languageOptions: ReferentialOption[];
  levelOptions: ReferentialOption[];
  isLoading?: boolean;
}) {
  const updateItem = (index: number, patch: Partial<OfferLanguageDraft>) => {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">Langues</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Sélectionnez les langues requises et leur niveau minimum.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, emptyOfferLanguage()])}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter une langue
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          Aucune exigence linguistique pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((item, index) => {
            const currentLanguageOptions =
              item.languageCode &&
                !languageOptions.some(
                  (option) => option.code === item.languageCode,
                )
                ? [
                  {
                    code: item.languageCode,
                    label: item.languageCode,
                  },
                  ...languageOptions,
                ]
                : languageOptions;

            const currentLevelOptions =
              item.level &&
                !levelOptions.some((option) => option.code === item.level)
                ? [
                  {
                    code: item.level,
                    label: item.level,
                  },
                  ...levelOptions,
                ]
                : levelOptions;

            return (
              <div
                key={`${item.languageCode}-${index}`}
                className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto] border-color-aneti-blue border-left-aneti"
              >
                <div>
                  <Label className="text-xs">Langue</Label>
                  <Select
                    value={item.languageCode || undefined}
                    onValueChange={(languageCode) =>
                      updateItem(index, { languageCode })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Choisir une langue" />
                    </SelectTrigger>

                    <SelectContent>
                      {currentLanguageOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div>
                    <Label className="text-xs">Niveau minimum</Label>

                    {item.level ? (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => updateItem(index, { level: '' })}
                      >
                        Effacer
                      </button>
                    ) : null}
                  </div>

                  <Select
                    value={item.level || undefined}
                    onValueChange={(level) => updateItem(index, { level })}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Choisir un niveau" />
                    </SelectTrigger>

                    <SelectContent>
                      {currentLevelOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeItem(index)}
                    aria-label="Supprimer la langue"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => {
            const label = languageDraftToText(item, languageOptions);
            return label ? (
              <SkillTag
                key={`${label}-${index}`}
                label={label}
                variant="outline"
              />
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5"
      />
    </div>
  );
}

function ListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder="Valeurs séparées par des virgules"
        className="mt-1.5"
      />
    </div>
  );
}

function TagPreview({
  value,
  matched = false,
}: {
  value: string;
  matched?: boolean;
}) {
  const items = splitList(value).slice(0, 10);
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Aucune valeur extraite pour le moment.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <SkillTag
          key={item}
          label={item}
          variant={matched ? 'matched' : 'outline'}
        />
      ))}
    </div>
  );
}

function formFromParsed(
  parseResult: ParsedOfferResult,
  current: StructuredOfferForm = EMPTY_FORM,
): StructuredOfferForm {
  const parsedPayload = asRecord(
    parseResult.parsedPayload ?? parseResult.parsed_payload ?? {},
  );

  const offer = {
    ...asRecord(parsedPayload),
    ...asRecord(parseResult.offer),
    ...asRecord(parsedPayload.offer),
  };

  const requirements = {
    ...asRecord(parseResult.requirements),
    ...asRecord(parsedPayload.requirements),
  };

  const geo = asRecord(parsedPayload.geo_normalization);
  const offerLocation = asRecord(geo.offer_location ?? null);

  const extractedRequirements = asArray(
    parseResult.extractedRequirements ??
    parseResult.extracted_requirements ??
    [],
  ).map((item) => asRecord(item));

  const diplomaRequirements = extractedRequirements.filter(
    (item) => requirementType(item.criterion_type) === 'DIPLOMA',
  );

  const languageRequirements = extractedRequirements.filter(
    (item) => requirementType(item.criterion_type) === 'LANGUAGE',
  );

  const extractedSkillRequirements = extractedRequirements.filter(
    (item) => requirementType(item.criterion_type) === 'SKILL',
  );

  const mandatorySkillCandidates = asArray(
    requirements.mandatory_skills,
  ).filter((item) => !isLanguageLikeSkill(item));

  const optionalSkillCandidates = asArray(
    requirements.optional_skills,
  ).filter((item) => !isLanguageLikeSkill(item));

  const mandatorySkills = mandatorySkillCandidates.length
    ? joinCleanList(mandatorySkillCandidates)
    : joinCleanList(
      extractedSkillRequirements.filter((item) => isMustRequirement(item)),
    );

  const optionalSkills = optionalSkillCandidates.length
    ? joinCleanList(optionalSkillCandidates)
    : joinCleanList(
      extractedSkillRequirements.filter((item) => !isMustRequirement(item)),
    );

  const diplomaLabels = Array.from(
    new Set(
      diplomaRequirements
        .map((item) => cleanParsedText(item.raw_value ?? item))
        .filter(Boolean),
    ),
  ).join(', ');

  const fallbackEducation = cleanParsedText(
    asRecord(requirements.education_min).label ?? requirements.education_min,
  );

  const contractType =
    cleanParsedText(offer.contract_type) ||
    cleanParsedText(offer.employment_type) ||
    current.contractType ||
    EMPTY_FORM.contractType;

  const normalizedSeniorityLevel = normalizeEnumValue(offer.seniority_level);

  const seniorityLevel = SENIORITY_LEVEL_OPTIONS.includes(
    normalizedSeniorityLevel,
  )
    ? normalizedSeniorityLevel
    : current.seniorityLevel || EMPTY_FORM.seniorityLevel;

  const companyName =
    current.companyName ||
    cleanParsedText(offer.company_name) ||
    EMPTY_FORM.companyName;

  const languages = languageRequirements.length
    ? languageRequirements
      .map((item) => {
        const metadata = asRecord(item.metadata);

        return {
          languageCode: cleanParsedText(
            item.raw_value ?? metadata.language_code,
          ),
          level: cleanParsedText(item.min_level ?? metadata.level),
        };
      })
      .filter((item) => item.languageCode || item.level)
    : asArray(requirements.languages)
      .map((item) => {
        const languageItem = asRecord(item);

        return {
          languageCode: cleanParsedText(
            languageItem.code ?? languageItem.language_code,
          ),
          level: cleanParsedText(
            languageItem.min_level ?? languageItem.level,
          ),
        };
      })
      .filter((item) => item.languageCode || item.level);

  return {
    title: cleanParsedTitle(offer.title) || current.title || '',
    companyName,
    governorateCode:
      cleanParsedText(
        asRecord(offerLocation.governorate).code ??
        offerLocation.governorate_code ??
        offer.governorate_code,
      ) || current.governorateCode,
    delegationCode:
      cleanParsedText(
        asRecord(offerLocation.delegation).code ??
        offerLocation.delegation_code ??
        offer.delegation_code,
      ) || current.delegationCode,
    contractType,
    numberOfPositions:
      cleanParsedText(offer.number_of_positions) ||
      cleanParsedText(offer.numberOfPositions) ||
      current.numberOfPositions ||
      EMPTY_FORM.numberOfPositions,
    workMode:
      cleanParsedText(offer.work_mode) ||
      cleanParsedText(offer.workMode) ||
      current.workMode ||
      EMPTY_FORM.workMode,
    seniorityLevel,
    salaryMin:
      cleanParsedText(offer.salary_min) ||
      cleanParsedText(offer.salaryMin) ||
      current.salaryMin ||
      EMPTY_FORM.salaryMin,
    salaryMax:
      cleanParsedText(offer.salary_max) ||
      cleanParsedText(offer.salaryMax) ||
      current.salaryMax ||
      EMPTY_FORM.salaryMax,
    deadlineAt:
      cleanParsedText(offer.deadline_at) ||
      cleanParsedText(offer.deadlineAt) ||
      current.deadlineAt ||
      EMPTY_FORM.deadlineAt,
    targetOccupations: joinCleanList(
      asArray(
        parsedPayload.occupations_target ?? parseResult.occupations_target,
      ),
    ),
    mandatorySkills,
    optionalSkills,
    minYearsExperience: cleanParsedText(requirements.min_years_experience),
    educationMin: diplomaLabels || fallbackEducation || current.educationMin,
    certificationsPreferred: joinCleanList(
      asArray(requirements.certifications_preferred),
    ),
    languages,
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRawTextFromForm(
  form: StructuredOfferForm,
  languageOptions: ReferentialOption[] = [],
): string {
  const mandatorySkills = splitList(form.mandatorySkills);
  const optionalSkills = splitList(form.optionalSkills);
  const occupations = splitList(form.targetOccupations);
  const languages = (form.languages ?? [])
    .map((item) => languageDraftToText(item, languageOptions))
    .filter(Boolean);
  const certifications = splitList(form.certificationsPreferred);

  return [
    `${form.title.trim()}.`,
    `Localisation : ${[form.delegationCode, form.governorateCode, 'TN'].filter(Boolean).join(', ')}.`,
    `Employment type: ${form.contractType}.`,
    form.seniorityLevel ? `Seniority level: ${form.seniorityLevel}.` : '',
    occupations.length > 0
      ? `Target occupations: ${occupations.join(', ')}.`
      : '',
    mandatorySkills.length > 0
      ? `Required skills: ${mandatorySkills.join(', ')}.`
      : '',
    optionalSkills.length > 0
      ? `Preferred skills: ${optionalSkills.join(', ')}.`
      : '',
    form.minYearsExperience
      ? `Minimum experience: ${form.minYearsExperience} years.`
      : '',
    form.educationMin.trim()
      ? `Minimum education: ${form.educationMin.trim()}.`
      : '',
    certifications.length > 0
      ? `Preferred certifications: ${certifications.join(', ')}.`
      : '',
    languages.length > 0 ? `Languages: ${languages.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanParsedText(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const comparable = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (comparable === 'non specifie' || comparable === 'not specified') {
      return '';
    }
    return trimmed;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return cleanParsedText(
      item.label ??
      item.name ??
      item.title ??
      item.raw_value ??
      item.raw_label ??
      item.normalized_label ??
      item.code ??
      '',
    );
  }

  return String(value);
}

function cleanParsedTitle(value: unknown): string {
  const title = cleanParsedText(value);
  if (!title) {
    return '';
  }

  const normalized = title.toUpperCase();
  if (normalized === 'OCC_UNKNOWN' || /^OCC_[A-Z0-9_]+$/.test(normalized)) {
    return '';
  }

  return title;
}

function skillToText(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return cleanParsedText(value);
  }

  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return cleanParsedText(
      item.normalized_label ??
      item.raw_label ??
      item.label ??
      item.name ??
      item.raw_value ??
      '',
    );
  }

  return cleanParsedText(value);
}

function joinCleanList(values: unknown[]): string {
  return Array.from(new Set(values.map(skillToText).filter(Boolean))).join(
    ', ',
  );
}

function requirementType(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

function languageDraftToText(
  item: OfferLanguageDraft,
  languageOptions: ReferentialOption[] = [],
): string {
  if (!item.languageCode) {
    return '';
  }

  const languageLabel =
    languageOptions.find((option) => option.code === item.languageCode)
      ?.label ?? item.languageCode;

  return [languageLabel, item.level].filter(Boolean).join(' ');
}

function normalizeEnumValue(value: unknown): string {
  return cleanParsedText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isMustRequirement(value: Record<string, unknown>): boolean {
  if (typeof value.is_must === 'boolean') {
    return value.is_must;
  }

  return String(value.is_must ?? '').toLowerCase() === 'true';
}

function isLanguageLikeSkill(value: unknown): boolean {
  const item = asRecord(value);
  return (
    requirementType(item.category) === 'LANGUAGE' ||
    requirementType(item.type) === 'LANGUAGE' ||
    requirementType(item.criterion_type) === 'LANGUAGE'
  );
}
