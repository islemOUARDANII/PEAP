import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
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
import { Separator } from '@/components/ui/separator';
import { gatewayApi } from '@/services/api/gateway';
import {
  useGeoCountriesQuery,
  useGeoAdminUnitsQuery,
  useRefDropdownQuery,
} from '@/services/api/queries';
import { OccupationAutocomplete } from '@/pages/candidate/profile/OccupationAutocomplete';
import { GeoAddressFields, type GeoAddressValue } from '@/pages/candidate/profile/GeoAddressFields';
import {
  SkillRequirementList,
  type SkillRequirement,
  emptySkillRequirement,
} from './offer/SkillRequirementPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

type OfferInputMode = 'smart' | 'manual';

interface LanguageDraft {
  languageCode: string;
  levelCode: string;
  isMandatory: boolean;
}

interface OfferForm {
  // Poste
  title: string;
  occupationNodeId: string;
  companyName: string;
  numberOfPositions: string;
  description: string;

  // Localisation (canonical)
  location: GeoAddressValue;

  // Contrat & rémunération
  contractType: string;
  workMode: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  deadlineAt: string;

  // Expérience & formation
  minExperienceMonths: string;
  diplomaRefId: string;
  specialtyRefId: string;

  // Compétences
  mandatorySkills: SkillRequirement[];
  softSkills: SkillRequirement[];
  optionalSkills: SkillRequirement[];

  // Langues
  languages: LanguageDraft[];

  // Accessibilité
  isAccessibleToDisabled: boolean;
  accessibilityNotes: string;
}

type ParsedDraft = Record<string, unknown>;

const EMPTY_LOCATION: GeoAddressValue = {
  countryIso2: 'TN',
  adminUnit1Code: '',
  adminUnit1Label: '',
  adminUnit2Code: '',
  adminUnit2Label: '',
};

const EMPTY_FORM: OfferForm = {
  title: '',
  occupationNodeId: '',
  companyName: '',
  numberOfPositions: '1',
  description: '',
  location: EMPTY_LOCATION,
  contractType: '',
  workMode: 'UNKNOWN',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'TND',
  deadlineAt: '',
  minExperienceMonths: '',
  diplomaRefId: '',
  specialtyRefId: '',
  mandatorySkills: [],
  softSkills: [],
  optionalSkills: [],
  languages: [],
  isAccessibleToDisabled: false,
  accessibilityNotes: '',
};

const WORK_MODE_OPTIONS = [
  { value: 'ONSITE', label: 'Sur site' },
  { value: 'REMOTE', label: 'À distance' },
  { value: 'HYBRID', label: 'Hybride' },
  { value: 'UNKNOWN', label: 'Non précisé' },
];

const CURRENCY_OPTIONS = ['TND', 'EUR', 'USD'];

const SAMPLE_OFFER = `Ingénieur Data Senior chez Atlas Analytics. Nous recherchons un ingénieur data senior à Tunis ou en mode hybride pour concevoir des pipelines de données robustes avec Python, SQL, PostgreSQL, Airflow et Docker. Une expérience avec Kafka est un plus. Minimum 4 ans d'expérience, anglais B2 requis, français apprécié. Poste à temps plein dans les services informatiques.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function extractRequirements(
  skills: SkillRequirement[],
  criterionType: 'SKILL' | 'SOFT_SKILL',
): Array<Record<string, unknown>> {
  return skills
    .filter((s) => s.rawValue.trim() || s.taxonomyNodeId)
    .map((s) => ({
      criterion_type: criterionType,
      node_id: s.taxonomyNodeId || null,
      raw_value: s.rawValue || null,
      is_must: s.isMust,
      weight: s.weight,
    }));
}

// Parse draft helpers
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function cleanText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  const r = asRecord(v);
  return cleanText(r.label ?? r.raw_value ?? r.code ?? r.name ?? '');
}
function requirementTypeOf(v: unknown): string {
  return String(v ?? '').toUpperCase();
}

function formFromParsed(draft: ParsedDraft, current: OfferForm): OfferForm {
  const parsed = asRecord(draft);
  const requirements = asArray(parsed.requirements ?? parsed.extracted_requirements);

  const skillReqs = requirements.filter(
    (r) => ['SKILL', 'SOFT_SKILL'].includes(requirementTypeOf(asRecord(r).criterion_type)),
  );
  const mandatory = skillReqs
    .filter((r) => asRecord(r).is_must)
    .map((r): SkillRequirement => ({
      taxonomyNodeId: cleanText(asRecord(r).node_id),
      rawValue: cleanText(asRecord(r).raw_value ?? asRecord(r).label),
      isMust: true,
      weight: null,
    }))
    .filter((s) => s.rawValue);

  const langReqs = requirements.filter(
    (r) => requirementTypeOf(asRecord(r).criterion_type) === 'LANGUAGE',
  );
  const languages: LanguageDraft[] = langReqs
    .map((r) => ({
      languageCode: cleanText(asRecord(r).raw_value ?? asRecord(r).node_id),
      levelCode: cleanText(asRecord(r).min_level),
      isMandatory: Boolean(asRecord(r).is_must),
    }))
    .filter((l) => l.languageCode);

  return {
    ...current,
    title: cleanText(parsed.title) || current.title,
    description: cleanText(parsed.description) || current.description,
    contractType: cleanText(parsed.contract_type) || current.contractType,
    workMode: cleanText(parsed.work_mode) || current.workMode,
    salaryMin: cleanText(parsed.salary_min) || current.salaryMin,
    salaryMax: cleanText(parsed.salary_max) || current.salaryMax,
    numberOfPositions: cleanText(parsed.number_of_positions) || current.numberOfPositions,
    mandatorySkills: mandatory.length ? mandatory : current.mandatorySkills,
    languages: languages.length ? languages : current.languages,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateOffer() {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<OfferInputMode>('smart');
  const [step, setStep] = useState<'raw' | 'structured'>('raw');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);

  // Referential data
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
  const diplomasQuery = useRefDropdownQuery('DIPLOMA');
  const specialtiesQuery = useRefDropdownQuery('SPECIALTY');

  const employerProfileQuery = useQuery({
    queryKey: ['employer', 'profile'],
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
    setForm((current) => ({ ...current, companyName }));
  }, [employerProfileQuery.data]);

  const updateField = <K extends keyof OfferForm>(field: K, value: OfferForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const switchMode = (mode: OfferInputMode) => {
    setInputMode(mode);
    setStep(mode === 'manual' ? 'structured' : 'raw');
  };

  const analyze = async () => {
    setIsParsing(true);
    try {
      const result = await gatewayApi.employer.parseOfferDraft({ raw_text: rawText, title: null });
      const draft = (result as unknown as { draft?: ParsedDraft }).draft ?? {};
      setForm((current) => formFromParsed(draft, current));
      setStep('structured');
      toast.success("L'offre a été analysée. Vérifiez les champs puis soumettez.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'analyse.");
    } finally {
      setIsParsing(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre du poste est obligatoire.");
      return;
    }
    if (!form.contractType) {
      toast.error("Le type de contrat est obligatoire.");
      return;
    }

    const salaryMin = toNullableNumber(form.salaryMin);
    const salaryMax = toNullableNumber(form.salaryMax);
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      toast.error("Le salaire maximum doit être supérieur ou égal au salaire minimum.");
      return;
    }

    const requirements = [
      ...extractRequirements(form.mandatorySkills, 'SKILL'),
      ...extractRequirements(form.softSkills, 'SOFT_SKILL'),
      ...extractRequirements(form.optionalSkills, 'SKILL'),
    ];

    if (form.occupationNodeId) {
      requirements.push({
        criterion_type: 'OCCUPATION',
        node_id: form.occupationNodeId,
        raw_value: form.title,
        is_must: false,
        weight: 40,
      });
    }

    const language_requirements = form.languages
      .filter((l) => l.languageCode)
      .map((l) => ({
        language_code: l.languageCode,
        level_code: l.levelCode || null,
        is_mandatory: l.isMandatory,
      }));

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      company_name: toNullable(form.companyName),
      description: toNullable(rawText || form.description),
      occupation_node_id: toNullable(form.occupationNodeId),
      number_of_positions: Number(form.numberOfPositions) || 1,
      contract_type: toNullable(form.contractType),
      work_mode: form.workMode || 'UNKNOWN',
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency_code: form.salaryCurrency || 'TND',
      country: form.location.countryIso2 || 'TN',
      governorate_code: toNullable(form.location.adminUnit1Code),
      delegation_code: toNullable(form.location.adminUnit2Code),
      deadline_at: toNullable(form.deadlineAt),
      min_experience_months: toNullableNumber(form.minExperienceMonths),
      diploma_ref_id: toNullable(form.diplomaRefId),
      specialty_ref_id: toNullable(form.specialtyRefId),
      is_accessible_to_disabled: form.isAccessibleToDisabled,
      accessibility_notes: toNullable(form.accessibilityNotes),
      requirements,
      language_requirements,
    };

    setIsSubmitting(true);
    try {
      await gatewayApi.employer.createOffer(payload);
      toast.success("L'offre a été créée avec succès.");
      navigate('/provider/offers');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de la création de l'offre.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeLabel =
    inputMode === 'manual' ? 'Saisie manuelle' : step === 'raw' ? '1. Texte brut' : '2. Formulaire';

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
        description="Analyser un texte libre ou remplir directement le formulaire structuré."
        actions={
          <StatusPill
            label={modeLabel}
            tone={inputMode === 'manual' ? 'neutral' : step === 'raw' ? 'info' : 'success'}
          />
        }
      />

      {/* Mode selector */}
      <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between card-border-top-orange">
        <p className="text-sm text-muted-foreground">
          Analysez une description brute ou passez directement au formulaire.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={inputMode === 'smart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchMode('smart')}
          >
            Analyser un texte
          </Button>
          <Button
            type="button"
            variant={inputMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchMode('manual')}
          >
            Saisie manuelle
          </Button>
        </div>
      </div>

      {/* Smart raw text step */}
      {inputMode === 'smart' && step === 'raw' ? (
        <div className="panel p-5 space-y-4 card-border-top-orange">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="stat-label">Texte brut de l'offre</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Collez une description complète. Le backend la parsera et préremplira le formulaire.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRawText(SAMPLE_OFFER)}>
              Exemple
            </Button>
          </div>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            placeholder="Collez la description de l'offre…"
            className="font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={rawText.trim().length < 20 || isParsing}
              onClick={analyze}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isParsing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSearch className="h-4 w-4 mr-1" />}
              {isParsing ? 'Analyse…' : 'Analyser'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Section 1: Poste et entreprise ──────────────────────── */}
          <FormSection title="Poste et entreprise">
            <div className="space-y-4">
              <OccupationAutocomplete
                jobTitleRaw={form.title}
                occupationNodeId={form.occupationNodeId}
                label="Titre du poste *"
                onChange={(nodeId, raw) => setForm((c) => ({ ...c, title: raw, occupationNodeId: nodeId }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Entreprise</Label>
                  <div className="mt-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {form.companyName || 'Entreprise connectée'}
                  </div>
                </div>
                <Field
                  label="Nombre de postes"
                  value={form.numberOfPositions}
                  type="number"
                  onChange={(v) => updateField('numberOfPositions', v)}
                />
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 2: Localisation ──────────────────────────────── */}
          <FormSection title="Localisation">
            <div className="grid gap-4 md:grid-cols-2">
              <GeoAddressFields
                value={form.location}
                onChange={(geo) => updateField('location', geo)}
              />
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 3: Contrat et rémunération ──────────────────── */}
          <FormSection title="Contrat et rémunération">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs">Type de contrat *</Label>
                <Select
                  value={form.contractType || undefined}
                  onValueChange={(v) => updateField('contractType', v)}
                  disabled={contractTypesQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contractTypesQuery.data ?? []).map((o) => (
                      <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mode de travail</Label>
                <Select value={form.workMode} onValueChange={(v) => updateField('workMode', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Salary — compact grouped */}
              <div className="md:col-span-2">
                <Label className="text-xs">Salaire proposé</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={form.salaryMin}
                    onChange={(e) => updateField('salaryMin', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={form.salaryMax}
                    onChange={(e) => updateField('salaryMax', e.target.value)}
                    className="w-28"
                  />
                  <Select value={form.salaryCurrency} onValueChange={(v) => updateField('salaryCurrency', v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Field
                label="Date de clôture"
                value={form.deadlineAt}
                type="date"
                onChange={(v) => updateField('deadlineAt', v)}
              />
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 4: Expérience et formation ──────────────────── */}
          <FormSection title="Expérience et formation">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Expérience minimum (mois)"
                value={form.minExperienceMonths}
                type="number"
                onChange={(v) => updateField('minExperienceMonths', v)}
              />
              <div>
                <Label className="text-xs">Diplôme minimum</Label>
                <Select
                  value={form.diplomaRefId || undefined}
                  onValueChange={(v) => updateField('diplomaRefId', v)}
                  disabled={diplomasQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(diplomasQuery.data ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label_fr ?? o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Spécialité</Label>
                <Select
                  value={form.specialtyRefId || undefined}
                  onValueChange={(v) => updateField('specialtyRefId', v)}
                  disabled={specialtiesQuery.isLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(specialtiesQuery.data ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label_fr ?? o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 5: Compétences et langues ───────────────────── */}
          <FormSection title="Compétences et langues">
            <div className="space-y-6">
              <SkillRequirementList
                label="Compétences obligatoires"
                description="Compétences techniques indispensables (RTMC SKILL)."
                items={form.mandatorySkills}
                onChange={(v) => updateField('mandatorySkills', v)}
                nodeType="SKILL"
                isMust
              />
              <SkillRequirementList
                label="Soft skills"
                description="Compétences comportementales (RTMC SOFT_SKILL)."
                items={form.softSkills}
                onChange={(v) => updateField('softSkills', v)}
                nodeType="SOFT_SKILL"
              />
              <SkillRequirementList
                label="Compétences optionnelles"
                description="Un plus mais non bloquant (RTMC SKILL)."
                items={form.optionalSkills}
                onChange={(v) => updateField('optionalSkills', v)}
                nodeType="SKILL"
                isMust={false}
              />

              <LanguageRequirementsEditor
                value={form.languages}
                onChange={(v) => updateField('languages', v)}
                languageOptions={languagesQuery.data ?? []}
                levelOptions={languageLevelsQuery.data ?? []}
                isLoading={languagesQuery.isLoading || languageLevelsQuery.isLoading}
              />
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 6: Accessibilité ─────────────────────────────── */}
          <FormSection title="Accessibilité">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAccessibleToDisabled}
                  onChange={(e) => updateField('isAccessibleToDisabled', e.target.checked)}
                />
                Ce poste est accessible aux personnes en situation de handicap
              </label>
              {form.isAccessibleToDisabled ? (
                <div>
                  <Label className="text-xs">Notes d'accessibilité</Label>
                  <Textarea
                    value={form.accessibilityNotes}
                    onChange={(e) => updateField('accessibilityNotes', e.target.value)}
                    rows={3}
                    placeholder="Aménagements, conditions particulières…"
                    className="mt-1.5"
                  />
                </div>
              ) : null}
            </div>
          </FormSection>

          <Separator />

          {/* ── Section 7: Description ───────────────────────────────── */}
          <FormSection title="Description de l'offre">
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={8}
              placeholder="Description complète du poste, environnement, missions…"
            />
            {inputMode === 'smart' && rawText.trim() ? (
              <p className="text-xs text-muted-foreground mt-1">
                Texte brut analysé utilisé comme description si ce champ est vide.
              </p>
            ) : null}
          </FormSection>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            {inputMode === 'smart' && (
              <Button type="button" variant="outline" onClick={() => setStep('raw')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
            )}
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={submit}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              {isSubmitting ? 'Création…' : "Créer l'offre"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5 space-y-4 card-border-top">
      <p className="stat-label">{title}</p>
      {children}
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
    </div>
  );
}

interface ReferentialOption { code: string; label: string; }

function LanguageRequirementsEditor({
  value,
  onChange,
  languageOptions,
  levelOptions,
  isLoading = false,
}: {
  value: LanguageDraft[];
  onChange: (v: LanguageDraft[]) => void;
  languageOptions: ReferentialOption[];
  levelOptions: ReferentialOption[];
  isLoading?: boolean;
}) {
  const update = (index: number, patch: Partial<LanguageDraft>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, { languageCode: '', levelCode: '', isMandatory: false }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Langues requises</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une langue
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Aucune exigence linguistique.
        </div>
      ) : (
        value.map((item, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto] border-color-aneti-blue border-left-aneti"
          >
            <div>
              <Label className="text-xs">Langue</Label>
              <Select
                value={item.languageCode || undefined}
                onValueChange={(v) => update(index, { languageCode: v })}
                disabled={isLoading}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Niveau minimum</Label>
              <Select
                value={item.levelCode || undefined}
                onValueChange={(v) => update(index, { levelCode: v })}
                disabled={isLoading}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-1.5 pb-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={item.isMandatory}
                onChange={(e) => update(index, { isMandatory: e.target.checked })}
              />
              Obligatoire
            </label>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
