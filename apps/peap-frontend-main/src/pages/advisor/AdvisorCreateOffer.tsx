import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { SkillTag } from "@/components/common/SkillTag";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { gatewayApi, type EmployerOfferDraft } from "@/services/api/gateway";

type InputMode = "smart" | "manual";

interface OfferLanguageDraft {
  languageCode: string;
  level: string;
}

interface StructuredOfferForm {
  employer_id: string;
  title: string;
  company_name: string;
  governorate_code: string;
  delegation_code: string;
  contract_type: string;
  number_of_positions: string;
  work_mode: string;
  seniority_level: string;
  salary_min: string;
  salary_max: string;
  deadline_at: string;
  mandatory_skills: string;
  optional_skills: string;
  min_years_experience: string;
  languages: OfferLanguageDraft[];
}

const EMPTY_FORM: StructuredOfferForm = {
  employer_id: "",
  title: "",
  company_name: "",
  governorate_code: "",
  delegation_code: "",
  contract_type: "",
  number_of_positions: "1",
  work_mode: "UNKNOWN",
  seniority_level: "mid",
  salary_min: "",
  salary_max: "",
  deadline_at: "",
  mandatory_skills: "",
  optional_skills: "",
  min_years_experience: "",
  languages: [],
};

const WORK_MODE_OPTIONS = [
  { value: "ONSITE", label: "Présentiel" },
  { value: "REMOTE", label: "Télétravail" },
  { value: "HYBRID", label: "Hybride" },
  { value: "UNKNOWN", label: "Non précisé" },
];

const SAMPLE_OFFER = `Ingénieur Data Senior chez Atlas Analytics. Nous recherchons un ingénieur data senior à Tunis ou en mode hybride pour concevoir des pipelines de données robustes avec Python, SQL, PostgreSQL, Airflow et Docker. Une expérience avec Kafka est un plus. Minimum 4 ans d'expérience, anglais B2 requis, français apprécié. Poste à temps plein dans les services informatiques.`;

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const t = value.trim();
    const c = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (c === "non specifie" || c === "not specified") return "";
    return t;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return cleanText(o.label ?? o.name ?? o.title ?? o.raw_value ?? o.code ?? "");
  }
  return String(value);
}

function joinClean(values: unknown[]): string {
  const skill = (v: unknown): string => {
    if (!v) return "";
    if (typeof v === "string") return cleanText(v);
    const o = asRecord(v);
    return cleanText(o.normalized_label ?? o.raw_label ?? o.label ?? o.name ?? o.raw_value ?? "");
  };
  return Array.from(new Set(values.map(skill).filter(Boolean))).join(", ");
}

function formFromParsed(parsed: EmployerOfferDraft, current: StructuredOfferForm): StructuredOfferForm {
  const pp = asRecord(parsed.parsedPayload);
  const mp = asRecord(parsed.mappedPayload);
  const offer = { ...asRecord(pp), ...asRecord(asRecord(pp).offer) };
  const reqs = asRecord(asRecord(pp).requirements);
  const geo = asRecord(asRecord(mp).offer_location ?? asRecord(asRecord(mp).geo_normalization).offer_location ?? null);

  const extracted = asArray(parsed.extractedRequirements).map(asRecord);
  const skillReqs = extracted.filter((r) => String(r.criterion_type ?? "").toUpperCase() === "SKILL");
  const langReqs = extracted.filter((r) => String(r.criterion_type ?? "").toUpperCase() === "LANGUAGE");

  const mandatory =
    asArray(reqs.mandatory_skills).filter((x) => !isLangSkill(x)).length
      ? joinClean(asArray(reqs.mandatory_skills).filter((x) => !isLangSkill(x)))
      : joinClean(skillReqs.filter((r) => isMust(r)));

  const optional =
    asArray(reqs.optional_skills).filter((x) => !isLangSkill(x)).length
      ? joinClean(asArray(reqs.optional_skills).filter((x) => !isLangSkill(x)))
      : joinClean(skillReqs.filter((r) => !isMust(r)));

  const languages: OfferLanguageDraft[] = langReqs.length
    ? langReqs.map((r) => ({
        languageCode: cleanText(r.raw_value ?? asRecord(r.metadata).language_code),
        level: cleanText(r.min_level ?? asRecord(r.metadata).level),
      })).filter((l) => l.languageCode || l.level)
    : asArray(reqs.languages).map((l) => {
        const o = asRecord(l);
        return { languageCode: cleanText(o.code ?? o.language_code), level: cleanText(o.min_level ?? o.level) };
      }).filter((l) => l.languageCode || l.level);

  return {
    ...current,
    title: cleanText(offer.title) || current.title,
    company_name: current.company_name || cleanText(offer.company_name),
    governorate_code:
      cleanText(asRecord(geo.governorate).code ?? geo.governorate_code ?? offer.governorate_code) ||
      current.governorate_code,
    delegation_code:
      cleanText(asRecord(geo.delegation).code ?? geo.delegation_code ?? offer.delegation_code) ||
      current.delegation_code,
    contract_type: cleanText(offer.contract_type ?? offer.employment_type) || current.contract_type,
    number_of_positions:
      cleanText(offer.number_of_positions ?? offer.numberOfPositions) || current.number_of_positions,
    work_mode: cleanText(offer.work_mode ?? offer.workMode) || current.work_mode,
    salary_min: cleanText(offer.salary_min ?? offer.salaryMin) || current.salary_min,
    salary_max: cleanText(offer.salary_max ?? offer.salaryMax) || current.salary_max,
    mandatory_skills: mandatory,
    optional_skills: optional,
    min_years_experience:
      cleanText(asRecord(reqs).min_years_experience) || current.min_years_experience,
    languages,
  };
}

function isMust(r: Record<string, unknown>): boolean {
  return typeof r.is_must === "boolean" ? r.is_must : String(r.is_must ?? "").toLowerCase() === "true";
}

function isLangSkill(v: unknown): boolean {
  const o = asRecord(v);
  return ["LANGUAGE"].includes(
    String(o.category ?? o.type ?? o.criterion_type ?? "").toUpperCase(),
  );
}

export default function AdvisorCreateOffer() {
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<InputMode>("smart");
  const [parseStep, setParseStep] = useState<"raw" | "structured">("raw");
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<EmployerOfferDraft | null>(null);
  const [form, setForm] = useState<StructuredOfferForm>(EMPTY_FORM);
  const [createdOffer, setCreatedOffer] = useState<{
    id: string;
    aneti_identifier?: string | null;
  } | null>(null);

  const employersQuery = useQuery({
    queryKey: ["advisor", "employers"],
    queryFn: () => gatewayApi.advisor.listEmployers(),
    staleTime: 60_000,
  });

  const governoratesQuery = useQuery({
    queryKey: ["referentials", "governorates"],
    queryFn: () => gatewayApi.referentials.governorates(),
    staleTime: 60_000,
  });

  const delegationsQuery = useQuery({
    queryKey: ["referentials", "delegations", form.governorate_code],
    queryFn: () => gatewayApi.referentials.delegations(form.governorate_code),
    enabled: Boolean(form.governorate_code),
    staleTime: 60_000,
  });

  const contractTypesQuery = useQuery({
    queryKey: ["referentials", "contract-types"],
    queryFn: () => gatewayApi.referentials.contractTypes(),
    staleTime: 60_000,
  });

  const languagesQuery = useQuery({
    queryKey: ["referentials", "languages"],
    queryFn: () => gatewayApi.referentials.languages(),
    staleTime: 60_000,
  });

  const languageLevelsQuery = useQuery({
    queryKey: ["referentials", "language-levels"],
    queryFn: () => gatewayApi.referentials.languageLevels(),
    staleTime: 60_000,
  });

  const updateField = <K extends Exclude<keyof StructuredOfferForm, "languages">>(
    field: K,
    value: string,
  ) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const switchMode = (mode: InputMode) => {
    setInputMode(mode);
    setParseStep(mode === "manual" ? "structured" : "raw");
    if (mode === "manual") setParsed(null);
  };

  const analyze = async () => {
    if (!rawText.trim() || rawText.trim().length < 20) return;
    setIsParsing(true);
    try {
      const result = await gatewayApi.advisor.parseOfferDraft({ raw_text: rawText, title: null });
      setParsed(result);
      setForm((f) => formFromParsed(result, f));
      setParseStep("structured");
      toast.success("Offre analysée — formulaire pré-rempli.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'analyse.");
    } finally {
      setIsParsing(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!form.employer_id || !form.title) {
        throw new Error("L'employeur et le titre sont obligatoires.");
      }
      const rawDescription =
        rawText.trim() ||
        [
          form.title,
          form.mandatory_skills ? `Compétences : ${form.mandatory_skills}` : "",
          form.optional_skills ? `Optionnel : ${form.optional_skills}` : "",
        ]
          .filter(Boolean)
          .join(". ");

      return gatewayApi.advisor.createOffer({
        employer_id: form.employer_id,
        title: form.title,
        description: rawDescription || null,
        company_name: form.company_name || null,
        contract_type: form.contract_type || null,
        work_mode: form.work_mode || null,
        governorate_code: form.governorate_code || null,
        delegation_code: form.delegation_code || null,
        number_of_positions: parseInt(form.number_of_positions, 10) || 1,
        salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
        salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
        deadline_at: form.deadline_at || null,
      });
    },
    onSuccess: (data) => {
      setCreatedOffer(data);
      toast.success("Offre créée (statut : Brouillon).");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de créer l'offre.");
    },
  });

  const confidence = parsed?.parsedPayload
    ? (asRecord(parsed.parsedPayload).parsing_metadata
        ? (asRecord(asRecord(parsed.parsedPayload).parsing_metadata).confidence_overall as number | undefined)
        : undefined)
    : undefined;

  if (createdOffer) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title="Offre créée"
          description="L'offre a été enregistrée en brouillon. Elle devra être validée avant publication."
          actions={
            <Button variant="outline" onClick={() => navigate("/advisor")}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          }
        />

        <div className="panel p-6 max-w-lg space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-5 w-5" />
            Offre enregistrée en brouillon
          </div>

          <div className="space-y-1 rounded-md border border-border bg-surface-muted p-4">
            <p className="text-xs text-muted-foreground">Identifiant</p>
            <p className="text-sm font-mono font-medium text-foreground">{createdOffer.id}</p>
            {createdOffer.aneti_identifier && (
              <>
                <p className="text-xs text-muted-foreground mt-2">Réf. ANETI</p>
                <p className="text-sm font-mono font-medium text-foreground">
                  {createdOffer.aneti_identifier}
                </p>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Statut actuel : <strong>Brouillon</strong>. Un administrateur devra valider l'offre pour publication.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={() =>
                navigate("/advisor/matching/offer-candidates", {
                  state: { offerId: createdOffer.id },
                })
              }
            >
              <ArrowRight className="h-4 w-4" />
              Lancer le matching
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/advisor/provider-requests")}
            >
              Voir les offres
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedOffer(null);
                setForm(EMPTY_FORM);
                setRawText("");
                setParsed(null);
                setParseStep("raw");
                setInputMode("smart");
              }}
            >
              Créer une autre offre
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Créer une offre d'emploi"
        description="Analysez un texte ou remplissez le formulaire, puis lancez le matching."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/advisor")}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            {typeof confidence === "number" && (
              <StatusPill label={`${Math.round(confidence * 100)}% confiance`} tone="accent" />
            )}
          </div>
        }
      />

      {/* Employer selector — always visible */}
      <div className="panel p-4 space-y-2">
        <Label className="text-xs">Employeur *</Label>
        <Select
          value={form.employer_id}
          onValueChange={(v) => updateField("employer_id", v)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sélectionner l'employeur concerné" />
          </SelectTrigger>
          <SelectContent>
            {(employersQuery.data ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.commercial_name ?? e.legal_name}
                {e.email ? ` — ${e.email}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mode selector */}
      <div className="panel p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Mode de saisie</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Collez un paragraphe pour pré-remplir automatiquement, ou saisissez directement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={inputMode === "smart" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("smart")}
          >
            Analyser un texte
          </Button>
          <Button
            type="button"
            variant={inputMode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("manual")}
          >
            Saisir manuellement
          </Button>
        </div>
      </div>

      {/* SMART mode — raw text input */}
      {inputMode === "smart" && parseStep === "raw" && (
        <div className="panel p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Texte brut de l'offre</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Collez la description du poste — le parseur extraira automatiquement le titre, les compétences, la localisation, le contrat, etc.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRawText(SAMPLE_OFFER)}
            >
              Exemple
            </Button>
          </div>

          <div>
            <Label className="text-xs">Texte de l'offre *</Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              placeholder="Collez la description complète du poste…"
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button
              disabled={rawText.trim().length < 20 || isParsing}
              onClick={analyze}
            >
              {isParsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4" />
              )}
              {isParsing ? "Analyse en cours..." : "Analyser le texte"}
            </Button>
          </div>
        </div>
      )}

      {/* STRUCTURED form (smart reviewed + manual) */}
      {(inputMode === "manual" || parseStep === "structured") && (
        <div className="space-y-4">
          {inputMode === "smart" && parseStep === "structured" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setParseStep("raw")}
            >
              <RotateCcw className="h-4 w-4" />
              Retour au texte brut
            </Button>
          )}

          {/* Parsing summary */}
          {parsed !== null && (
            <div className="panel p-4 space-y-3 border-l-4 border-primary">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">Analyse terminée</span>
                {typeof confidence === "number" && (
                  <StatusPill label={`${Math.round(confidence * 100)}% confiance`} tone="accent" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                {form.title && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Titre :</span>
                    <span className="font-medium truncate">{form.title}</span>
                  </div>
                )}
                {form.governorate_code && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Gouvernorat :</span>
                    <span className="font-medium">{form.governorate_code}</span>
                  </div>
                )}
                {form.contract_type && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Contrat :</span>
                    <span className="font-medium">{form.contract_type}</span>
                  </div>
                )}
                {form.work_mode && form.work_mode !== "UNKNOWN" && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Mode :</span>
                    <span className="font-medium">{WORK_MODE_OPTIONS.find((o) => o.value === form.work_mode)?.label}</span>
                  </div>
                )}
                {form.min_years_experience && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Expérience min :</span>
                    <span className="font-medium">{form.min_years_experience} ans</span>
                  </div>
                )}
                {splitList(form.mandatory_skills).length > 0 && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Compétences obligatoires :</span>
                    <span className="font-medium">{splitList(form.mandatory_skills).length}</span>
                  </div>
                )}
                {splitList(form.optional_skills).length > 0 && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Compétences optionnelles :</span>
                    <span className="font-medium">{splitList(form.optional_skills).length}</span>
                  </div>
                )}
                {form.languages.length > 0 && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Langues requises :</span>
                    <span className="font-medium">{form.languages.length}</span>
                  </div>
                )}
                {(form.salary_min || form.salary_max) && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground">Salaire :</span>
                    <span className="font-medium">
                      {form.salary_min && form.salary_max
                        ? `${form.salary_min} – ${form.salary_max} DT`
                        : form.salary_min
                        ? `≥ ${form.salary_min} DT`
                        : `≤ ${form.salary_max} DT`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job info */}
          <div className="panel p-5 space-y-4">
            <p className="text-sm font-semibold">Informations du poste</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Titre du poste *"
                value={form.title}
                onChange={(v) => updateField("title", v)}
              />
              <FormField
                label="Nom de l'entreprise (affiché)"
                value={form.company_name}
                onChange={(v) => updateField("company_name", v)}
                placeholder="Optionnel"
              />

              <div>
                <Label className="text-xs">Type de contrat</Label>
                <Select
                  value={form.contract_type || undefined}
                  onValueChange={(v) => updateField("contract_type", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contractTypesQuery.data ?? []).map((o) => (
                      <SelectItem key={o.code} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Mode de travail</Label>
                <Select
                  value={form.work_mode || undefined}
                  onValueChange={(v) => updateField("work_mode", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Gouvernorat</Label>
                <Select
                  value={form.governorate_code || undefined}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, governorate_code: v, delegation_code: "" }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(governoratesQuery.data ?? []).map((g) => (
                      <SelectItem key={g.code} value={g.code}>{g.label ?? g.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Délégation</Label>
                <Select
                  value={form.delegation_code || undefined}
                  onValueChange={(v) => updateField("delegation_code", v)}
                  disabled={!form.governorate_code}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(delegationsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.code} value={d.code}>{d.label ?? d.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                label="Nb de postes"
                value={form.number_of_positions}
                type="number"
                onChange={(v) => updateField("number_of_positions", v)}
              />
              <FormField
                label="Années d'expérience minimum"
                value={form.min_years_experience}
                type="number"
                onChange={(v) => updateField("min_years_experience", v)}
              />
              <FormField
                label="Salaire minimum (DT)"
                value={form.salary_min}
                type="number"
                onChange={(v) => updateField("salary_min", v)}
              />
              <FormField
                label="Salaire maximum (DT)"
                value={form.salary_max}
                type="number"
                onChange={(v) => updateField("salary_max", v)}
              />
              <FormField
                label="Date limite"
                value={form.deadline_at}
                type="date"
                onChange={(v) => updateField("deadline_at", v)}
              />
            </div>
          </div>

          {/* Requirements */}
          <div className="panel p-5 space-y-4">
            <p className="text-sm font-semibold">Compétences requises</p>
            <ListField
              label="Compétences obligatoires"
              value={form.mandatory_skills}
              onChange={(v) => updateField("mandatory_skills", v)}
            />
            <TagPreview value={form.mandatory_skills} matched />
            <ListField
              label="Compétences optionnelles"
              value={form.optional_skills}
              onChange={(v) => updateField("optional_skills", v)}
            />
            <TagPreview value={form.optional_skills} />
          </div>

          {/* Languages */}
          <div className="panel p-5">
            <LanguageRequirementsField
              value={form.languages}
              onChange={(langs) => setForm((f) => ({ ...f, languages: langs }))}
              languageOptions={languagesQuery.data ?? []}
              levelOptions={languageLevelsQuery.data ?? []}
              isLoading={languagesQuery.isLoading || languageLevelsQuery.isLoading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pb-4">
            <Button
              type="button"
              disabled={submitMutation.isPending || !form.employer_id || !form.title}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitMutation.isPending ? "Création..." : "Créer l'offre (brouillon)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
        placeholder={placeholder}
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
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Valeurs séparées par des virgules"
        className="mt-1.5"
      />
    </div>
  );
}

function TagPreview({ value, matched = false }: { value: string; matched?: boolean }) {
  const items = splitList(value).slice(0, 12);
  if (!items.length)
    return <p className="text-xs text-muted-foreground">Aucune valeur pour le moment.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <SkillTag key={item} label={item} variant={matched ? "matched" : "outline"} />
      ))}
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
  onChange: (v: OfferLanguageDraft[]) => void;
  languageOptions: { code: string; label: string }[];
  levelOptions: { code: string; label: string }[];
  isLoading?: boolean;
}) {
  const update = (index: number, patch: Partial<OfferLanguageDraft>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs">Langues requises</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { languageCode: "", level: "" }])}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          Aucune exigence linguistique pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto]"
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
                  value={item.level || undefined}
                  onValueChange={(v) => update(index, { level: v })}
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
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
