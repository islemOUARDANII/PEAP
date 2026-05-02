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
import {
  useCreateOfferMutation,
  useParseOfferMutation,
} from '@/services/api/queries';
import type { OfferParsedOutput } from '@/models';
import {
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type OfferInputMode = 'smart' | 'manual';

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
  languages: string;
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
  languages: '',
};

const SAMPLE_OFFER = `Senior Data Engineer at Atlas Analytics. We are looking for a senior data engineer in Tunis or remote hybrid to design robust data pipelines using Python, SQL, PostgreSQL, Airflow and Docker. Kafka experience is a plus. Minimum 4 years of experience, English B2 required, French appreciated. Full-time role in the IT services industry.`;

export default function CreateOffer() {
  const navigate = useNavigate();
  const parseOffer = useParseOfferMutation();
  const createOffer = useCreateOfferMutation();
  const [inputMode, setInputMode] = useState<OfferInputMode>('smart');
  const [step, setStep] = useState<'raw' | 'structured'>('raw');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<OfferParsedOutput | null>(null);
  const [form, setForm] = useState<StructuredOfferForm>(EMPTY_FORM);

  const updateField = (field: keyof StructuredOfferForm, value: string) => {
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
    try {
      const parsedOutput = await parseOffer.mutateAsync({ rawText });
      setParsed(parsedOutput);
      setForm(formFromParsed(parsedOutput));
      setStep('structured');
      toast.success('Offer parsed and form prefilled');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offer parsing failed',
      );
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

    const normalizedRawText = rawText.trim() || buildRawTextFromForm(form);
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
        languages: splitList(form.languages),
        parsedOffer: inputMode === 'smart' ? (parsed ?? undefined) : undefined,
      });
      toast.success('Offer submitted to the backend parsing pipeline');
      navigate('/provider/offers');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offer submission failed',
      );
    }
  };

  const confidence = parsed?.parsing_metadata.confidence_overall;
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

      <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              disabled={rawText.trim().length < 20 || parseOffer.isPending}
              onClick={analyze}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {parseOffer.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4 mr-1.5" />
              )}
              {parseOffer.isPending ? 'Analyzing...' : 'Parse / Analyze'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
          </div>

          <div className="panel p-5 space-y-4">
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

          <div className="panel p-5 space-y-4">
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

          <div className="panel p-5 space-y-4">
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
            <ListField
              label="Languages"
              value={form.languages}
              onChange={(value) => updateField('languages', value)}
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

function formFromParsed(parsed: OfferParsedOutput): StructuredOfferForm {
  return {
    title: parsed.offer.title || '',
    companyName: parsed.offer.company_name || '',
    location: parsed.offer.location || '',
    employmentType: parsed.offer.employment_type || 'full_time',
    seniorityLevel: parsed.offer.seniority_level || 'mid',
    targetOccupations: parsed.occupations_target
      .map((item) => item.label || item.code)
      .join(', '),
    mandatorySkills: parsed.requirements.mandatory_skills
      .map((item) => item.label || item.code)
      .join(', '),
    optionalSkills: parsed.requirements.optional_skills
      .map((item) => item.label || item.code)
      .join(', '),
    minYearsExperience:
      parsed.requirements.min_years_experience != null
        ? String(parsed.requirements.min_years_experience)
        : '',
    educationMin: parsed.requirements.education_min?.label ?? '',
    certificationsPreferred: (
      parsed.requirements.certifications_preferred ?? []
    )
      .map((item) => item.label || item.code)
      .join(', '),
    languages: (parsed.requirements.languages ?? [])
      .map((item) => `${item.label} ${item.min_level}`.trim())
      .join(', '),
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRawTextFromForm(form: StructuredOfferForm): string {
  const mandatorySkills = splitList(form.mandatorySkills);
  const optionalSkills = splitList(form.optionalSkills);
  const occupations = splitList(form.targetOccupations);
  const languages = splitList(form.languages);
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
