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
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type OfferInputMode = 'smart' | 'manual';

interface OfferLanguageDraft {
  languageCode: string;
  level: string;
  evidence: string;
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

const EMPLOYMENT_TYPE_OPTIONS = [
  'full_time',
  'part_time',
  'contract',
  'internship',
];

const SENIORITY_LEVEL_OPTIONS = ['junior', 'mid', 'senior', 'lead'];

const emptyOfferLanguage = (): OfferLanguageDraft => ({
  languageCode: '',
  level: '',
  evidence: '',
});

interface StructuredOfferForm {
  title: string;
  companyName: string;
  location: string;
  employmentType: string;
  seniorityLevel: string;
  targetOccupations: string;
  mandatorySkills: string;
  optionalSkills: string;
  minYearsExperience: string;
  educationMin: string;
  certificationsPreferred: string;
  languages: OfferLanguageDraft[];
}

const EMPTY_FORM: StructuredOfferForm = {
  title: '',
  companyName: '',
  location: '',
  employmentType: 'full_time',
  seniorityLevel: 'mid',
  targetOccupations: '',
  mandatorySkills: '',
  optionalSkills: '',
  minYearsExperience: '',
  educationMin: '',
  certificationsPreferred: '',
  languages: [],
};

const SAMPLE_OFFER = `Senior Data Engineer at Atlas Analytics. We are looking for a senior data engineer in Tunis or remote hybrid to design robust data pipelines using Python, SQL, PostgreSQL, Airflow and Docker. Kafka experience is a plus. Minimum 4 years of experience, English B2 required, French appreciated. Full-time role in the IT services industry.`;

export default function CreateOffer() {
  const navigate = useNavigate();
  const createOffer = useCreateOfferMutation();
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
  const [inputMode, setInputMode] = useState<OfferInputMode>('smart');
  const [step, setStep] = useState<'raw' | 'structured'>('raw');
  const [isParsing, setIsParsing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedOfferResult | null>(null);
  const [form, setForm] = useState<StructuredOfferForm>(EMPTY_FORM);

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
      toast.success('Offer parsed and form prefilled');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offer parsing failed',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const submit = async () => {
    if (
      !form.title.trim() ||
      !form.companyName.trim() ||
      !form.location.trim()
    ) {
      toast.error(
        'Title, company name, and location are required before submission',
      );
      return;
    }

    const languageOptions = languagesQuery.data ?? [];
    const languageStrings = form.languages
      .map((item) => languageDraftToText(item, languageOptions))
      .filter(Boolean);

    const normalizedRawText =
      rawText.trim() || buildRawTextFromForm(form, languageOptions);
    if (normalizedRawText.trim().length < 20) {
      toast.error(
        'Add a bit more detail before submission so the backend keeps a usable offer trace',
      );
      return;
    }

    try {
      await createOffer.mutateAsync({
        rawText: normalizedRawText,
        title: form.title.trim(),
        companyName: form.companyName.trim(),
        location: form.location.trim(),
        contract: form.employmentType,
        level: form.seniorityLevel,
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
      toast.success('Offer submitted to the backend parsing pipeline');
      navigate('/provider/offers');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offer submission failed',
      );
    }
  };

  const confidence = parsed?.parsing_metadata?.confidence_overall;
  const modeLabel =
    inputMode === 'manual'
      ? 'Manual entry'
      : step === 'raw'
        ? '1. Raw input'
        : '2. Structured review';

  return (
    <div className="space-y-6 w-full">
      <Link
        to="/provider/offers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-md border border-border px-4 py-2 light-link-md-border-right-orange"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to offers
      </Link>

      <PageHeader
        title="Create Job Offer"
        description="Choose whether to parse one paragraph into fields or fill the offer manually."
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
                label={`${Math.round(confidence * 100)}% confidence`}
                tone="accent"
              />
            )}
          </div>
        }
      />

      <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between card-border-top-orange">
        <div>
          <p className="text-sm font-semibold text-foreground">Input mode</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Parse from paragraph uses the backend parser to prefill the form.
            Fill manually skips parsing and lets you write the structured fields
            directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={inputMode === 'smart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchInputMode('smart')}
          >
            Parse from paragraph
          </Button>
          <Button
            type="button"
            variant={inputMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchInputMode('manual')}
          >
            Fill manually
          </Button>
        </div>
      </div>

      {inputMode === 'smart' && step === 'raw' ? (
        <div className="panel p-5 space-y-4 card-border-top-orange">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="stat-label">Raw Offer Input</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste one offer paragraph and MatchCore will prefill the
                editable structured form.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRawText(SAMPLE_OFFER)}
            >
              Use sample
            </Button>
          </div>

          <div>
            <Label className="text-xs">Offer text *</Label>
            <Textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={14}
              placeholder="Paste the full job description, including role, company, requirements, location and language expectations..."
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
              {isParsing ? 'Analyzing...' : 'Parse / Analyze'}
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
            <p className="stat-label">Role Basics</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Job title *"
                value={form.title}
                onChange={(value) => updateField('title', value)}
              />
              <Field
                label="Company name *"
                value={form.companyName}
                onChange={(value) => updateField('companyName', value)}
              />
              <Field
                label="Location *"
                value={form.location}
                onChange={(value) => updateField('location', value)}
              />
              <div>
                <Label className="text-xs">Employment type</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(value) =>
                    updateField('employmentType', value)
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Seniority level</Label>
                <Select
                  value={form.seniorityLevel}
                  onValueChange={(value) =>
                    updateField('seniorityLevel', value)
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Minimum years experience"
                value={form.minYearsExperience}
                type="number"
                onChange={(value) => updateField('minYearsExperience', value)}
              />
            </div>
          </div>

          <div className="panel p-5 space-y-4 card-border-top">
            <p className="stat-label">Extracted Requirements</p>
            <ListField
              label="Target occupations"
              value={form.targetOccupations}
              onChange={(value) => updateField('targetOccupations', value)}
            />
            <TagPreview value={form.targetOccupations} />
            <ListField
              label="Mandatory skills"
              value={form.mandatorySkills}
              onChange={(value) => updateField('mandatorySkills', value)}
            />
            <TagPreview value={form.mandatorySkills} matched />
            <ListField
              label="Optional skills"
              value={form.optionalSkills}
              onChange={(value) => updateField('optionalSkills', value)}
            />
            <TagPreview value={form.optionalSkills} />
          </div>

          <div className="panel p-5 space-y-4 card-border-top">
            <p className="stat-label">Education, Certifications & Languages</p>
            <Field
              label="Minimum education"
              value={form.educationMin}
              onChange={(value) => updateField('educationMin', value)}
            />
            <ListField
              label="Preferred certifications"
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
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
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
                ? 'Submitting...'
                : inputMode === 'manual'
                  ? 'Create offer'
                  : 'Validate & submit'}
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
          <Label className="text-xs">Languages</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Select required languages and their minimum level.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, emptyOfferLanguage()])}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add language
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          No language requirement yet.
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
                  <Label className="text-xs">Language</Label>
                  <Select
                    value={item.languageCode || undefined}
                    onValueChange={(languageCode) =>
                      updateItem(index, { languageCode })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Choose language" />
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
                    <Label className="text-xs">Minimum level</Label>

                    {item.level ? (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => updateItem(index, { level: '' })}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <Select
                    value={item.level || undefined}
                    onValueChange={(level) => updateItem(index, { level })}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Choose level" />
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
                    aria-label="Remove language"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="md:col-span-3">
                  <Field
                    label="Evidence / note"
                    value={item.evidence}
                    onChange={(evidence) => updateItem(index, { evidence })}
                  />
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
        placeholder="Comma-separated values"
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
      <p className="text-xs text-muted-foreground">No values extracted yet.</p>
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
  const optionalSkillCandidates = asArray(requirements.optional_skills).filter(
    (item) => !isLanguageLikeSkill(item),
  );
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
  const normalizedEmploymentType = normalizeEnumValue(offer.employment_type);
  const employmentType = EMPLOYMENT_TYPE_OPTIONS.includes(
    normalizedEmploymentType,
  )
    ? normalizedEmploymentType
    : cleanParsedText(offer.employment_type) ||
      current.employmentType ||
      EMPTY_FORM.employmentType;
  const normalizedSeniorityLevel = normalizeEnumValue(offer.seniority_level);
  const seniorityLevel = SENIORITY_LEVEL_OPTIONS.includes(
    normalizedSeniorityLevel,
  )
    ? normalizedSeniorityLevel
    : current.seniorityLevel || EMPTY_FORM.seniorityLevel;
  const languages = languageRequirements.length
    ? languageRequirements
        .map((item) => {
          const metadata = asRecord(item.metadata);
          return {
            languageCode: cleanParsedText(
              item.raw_value ?? metadata.language_code,
            ),
            level: cleanParsedText(item.min_level ?? metadata.level),
            evidence: cleanParsedText(metadata.evidence || ''),
          };
        })
        .filter((item) => item.languageCode || item.level || item.evidence)
    : asArray(requirements.languages)
        .map((item) => {
          const languageItem = asRecord(item);
          const level = cleanParsedText(
            languageItem.min_level ?? languageItem.level,
          );
          return {
            languageCode: cleanParsedText(
              languageItem.code ?? languageItem.language_code,
            ),
            level,
            evidence: [
              cleanParsedText(languageItem.label ?? languageItem.code),
              level,
            ]
              .filter(Boolean)
              .join(' '),
          };
        })
        .filter((item) => item.languageCode || item.level || item.evidence);

  return {
    title: cleanParsedTitle(offer.title) || current.title || '',
    companyName: cleanParsedText(offer.company_name),
    location:
      cleanParsedText(offerLocation.display_location) ||
      cleanParsedText(offerLocation.raw_location) ||
      cleanParsedText(offer.location),
    employmentType,
    seniorityLevel,
    targetOccupations: joinCleanList(
      asArray(
        parsedPayload.occupations_target ?? parseResult.occupations_target,
      ),
    ),
    mandatorySkills,
    optionalSkills,
    minYearsExperience: cleanParsedText(requirements.min_years_experience),
    educationMin: diplomaLabels || fallbackEducation,
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
  const languages = form.languages
    .map((item) => languageDraftToText(item, languageOptions))
    .filter(Boolean);
  const certifications = splitList(form.certificationsPreferred);

  return [
    `${form.title.trim()} at ${form.companyName.trim()}.`,
    `Location: ${form.location.trim()}.`,
    `Employment type: ${form.employmentType}.`,
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
