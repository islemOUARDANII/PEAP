import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle, Copy, FileUp, Loader2, SearchCheck, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
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
import { appEnv } from "@/config/env";
import { readStoredSession } from "@/services/auth/sessionStorage";
import { gatewayApi, type CandidateCvRecord, type CandidateProfileBundle } from "@/services/api/gateway";
import { SkillTag } from "@/components/common/SkillTag";

type Step = "account" | "cv";

const emptyForm = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone: "",
  governorate_code: "",
  delegation_code: "",
  primary_language: "fr",
};

const formatStatusLabel = (value: string | null | undefined): string => {
  const labels: Record<string, string> = {
    not_parsed: "Non analysé",
    parsing: "Analyse en cours",
    parsed: "Analysé",
    search_ready: "Prêt",
    failed: "Échec",
  };
  return labels[(value ?? "").toLowerCase()] ?? value ?? "—";
};

const cvStatusBadgeClass = (status: string | null | undefined): string => {
  switch ((status ?? "").toLowerCase()) {
    case "parsing":      return "bg-amber-50 text-amber-600 border-amber-200";
    case "parsed":
    case "search_ready": return "bg-green-50 text-green-600 border-green-200";
    case "failed":       return "bg-red-50 text-red-500 border-red-200";
    default:             return "bg-gray-100 text-gray-500 border-gray-200";
  }
};

export default function CreateCandidate() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const [step, setStep] = useState<Step>("account");
  const [form, setForm] = useState(emptyForm);
  const [created, setCreated] = useState<{
    candidate_id: string;
    user_id: string;
    email: string;
    temporary_password: string;
    first_name: string;
    last_name: string;
  } | null>(null);
  const [cvRecord, setCvRecord] = useState<CandidateCvRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  // Poll CV status after parse is triggered
  const { data: polledCv } = useQuery({
    queryKey: ["advisor", "candidate-cv", created?.candidate_id],
    queryFn: () => gatewayApi.advisor.getCandidateCurrentCv(created!.candidate_id),
    enabled: isPolling && Boolean(created?.candidate_id),
    refetchInterval: 3000,
  });

  const isTerminalParsed = ["parsed", "search_ready"].includes(
    (cvRecord?.parsingStatus ?? "").toLowerCase(),
  );

  const profileQuery = useQuery({
    queryKey: ["advisor", "candidate-profile", created?.candidate_id],
    queryFn: () => gatewayApi.advisor.getCandidate(created!.candidate_id),
    enabled: isTerminalParsed && Boolean(created?.candidate_id),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!polledCv || !isPolling) return;
    setCvRecord(polledCv);
    const terminal = ["parsed", "search_ready", "failed"];
    if (terminal.includes((polledCv.parsingStatus ?? "").toLowerCase())) {
      setIsPolling(false);
    }
  }, [polledCv, isPolling]);

  // Load PDF preview when a CV record is set
  useEffect(() => {
    if (!cvRecord || !created) {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
      setPdfObjectUrl(null);
      return;
    }

    const controller = new AbortController();
    const session = readStoredSession();
    const token = session?.token;
    const authHeader = appEnv.authHeader || "Authorization";
    const headers: Record<string, string> = {};
    if (token) {
      headers[authHeader] =
        authHeader.toLowerCase() === "authorization" ? `Bearer ${token}` : token;
    }

    fetch(
      `${appEnv.apiBaseUrl}/advisor/candidates/${encodeURIComponent(created.candidate_id)}/cv/current/view`,
      { headers, signal: controller.signal },
    )
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || controller.signal.aborted) return;
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfObjectUrl(url);
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [cvRecord?.id, created?.candidate_id]);

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

  const createMutation = useMutation({
    mutationFn: () =>
      gatewayApi.advisor.createCandidate({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        governorate_code: form.governorate_code || null,
        delegation_code: form.delegation_code || null,
        primary_language: form.primary_language,
      }),
    onSuccess: (data) => {
      setCreated(data);
      toast.success("Compte candidat créé avec succès.");
      setStep("cv");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Impossible de créer le compte.");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copié !"));
  };

  const handleUpload = async (file: File | null) => {
    if (!file || !created) return;
    setIsUploading(true);
    try {
      const record = await gatewayApi.advisor.uploadCandidateCv(created.candidate_id, file);
      setCvRecord(record);
      // Auto-start parsing right after upload
      try {
        await gatewayApi.advisor.parseCandidateCv(created.candidate_id, record.id);
        setCvRecord((prev) => (prev ? { ...prev, parsingStatus: "parsing" } : prev));
        setIsPolling(true);
        toast.success(`CV importé — analyse lancée.`);
      } catch {
        toast.success(`CV importé : ${record.originalFilename ?? record.blobName}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'import du CV.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleParse = async () => {
    if (!created || !cvRecord) return;
    setIsParsing(true);
    try {
      await gatewayApi.advisor.parseCandidateCv(created.candidate_id, cvRecord.id);
      setCvRecord((prev) => (prev ? { ...prev, parsingStatus: "parsing" } : prev));
      setIsPolling(true);
      toast.success("Analyse lancée. Le statut sera mis à jour sous peu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec du lancement de l'analyse.");
    } finally {
      setIsParsing(false);
    }
  };

  const resetAll = () => {
    setStep("account");
    setForm(emptyForm);
    setCreated(null);
    setCvRecord(null);
    setIsPolling(false);
    setPdfObjectUrl(null);
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  };

  const candidateName = created
    ? `${created.first_name} ${created.last_name}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Créer un profil candidat"
        description="Enregistrez un nouveau demandeur d'emploi, uploadez son CV et lancez le matching."
        actions={
          <Button variant="outline" onClick={() => navigate("/advisor")}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(["account", "cv"] as Step[]).map((s) => (
          <span
            key={s}
            className={`px-3 py-1 rounded-full font-medium ${
              step === s
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {s === "account" ? "1. Compte" : "2. CV"}
          </span>
        ))}
      </div>

      {/* STEP 1 — ACCOUNT */}
      {step === "account" && (
        <div className="panel p-6 max-w-lg mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Prénom *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className="mt-1.5"
                placeholder="Ex : Ahmed"
              />
            </div>
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="mt-1.5"
                placeholder="Ex : Ben Ali"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1.5"
              placeholder="candidat@example.com"
            />
          </div>

          <div>
            <Label className="text-xs">Mot de passe temporaire *</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1.5"
              placeholder="Min. 6 caractères"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              À communiquer au candidat. Il devra le changer à la connexion.
            </p>
          </div>

          <div>
            <Label className="text-xs">Téléphone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1.5"
              placeholder="+216 XX XXX XXX"
            />
          </div>

          <div>
            <Label className="text-xs">Gouvernorat</Label>
            <Select
              value={form.governorate_code}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, governorate_code: v, delegation_code: "" }))
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Sélectionner un gouvernorat" />
              </SelectTrigger>
              <SelectContent>
                {(governoratesQuery.data ?? []).map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    {g.label ?? g.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.governorate_code && (
            <div>
              <Label className="text-xs">Délégation</Label>
              <Select
                value={form.delegation_code}
                onValueChange={(v) => setForm((f) => ({ ...f, delegation_code: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Sélectionner une délégation" />
                </SelectTrigger>
                <SelectContent>
                  {(delegationsQuery.data ?? []).map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.label ?? d.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Langue principale</Label>
            <Select
              value={form.primary_language}
              onValueChange={(v) => setForm((f) => ({ ...f, primary_language: v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="ar">Arabe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !form.email ||
                !form.password ||
                !form.first_name ||
                !form.last_name
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {createMutation.isPending ? "Création..." : "Créer et continuer"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/advisor")}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — CV */}
      {step === "cv" && created && (
        <div className="space-y-6">
        <div className={`grid gap-6 ${cvRecord ? "xl:grid-cols-[420px_1fr]" : "max-w-lg mx-auto"}`}>
          {/* Left column */}
          <div className="panel p-6 space-y-5">
            {/* Credentials summary */}
            <div className="rounded-md border border-border bg-surface-muted p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                <CheckCircle className="h-4 w-4" />
                {created.first_name} {created.last_name} — compte créé
              </div>
              <CredentialRow label="Email" value={created.email} onCopy={copyToClipboard} />
              <CredentialRow
                label="Mot de passe temporaire"
                value={created.temporary_password}
                onCopy={copyToClipboard}
              />
            </div>

            {/* CV section */}
            <div>
              <p className="text-sm font-semibold text-foreground">CV du candidat</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Importez le CV pour activer l'analyse automatique et le matching.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />

            {!cvRecord ? (
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {isUploading ? "Import en cours..." : "Importer un CV"}
              </Button>
            ) : (
              <div className="rounded-md border border-border bg-surface-muted p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {cvRecord.originalFilename ?? cvRecord.blobName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cvRecord.mimeType}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${cvStatusBadgeClass(cvRecord.parsingStatus)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {formatStatusLabel(cvRecord.parsingStatus)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleParse}
                    disabled={isParsing || isPolling}
                  >
                    {isParsing || isPolling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SearchCheck className="h-4 w-4" />
                    )}
                    {isParsing
                      ? "Lancement..."
                      : isPolling
                      ? "Analyse en cours..."
                      : "Analyser le CV"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <FileUp className="h-4 w-4" />
                    Remplacer
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() =>
                  navigate("/advisor/matching/candidate-offers", {
                    state: {
                      candidateId: created.candidate_id,
                      candidateName,
                    },
                  })
                }
              >
                <ArrowRight className="h-4 w-4" />
                Lancer le matching
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/advisor/search/candidates")}
              >
                Voir les candidats
              </Button>
              <Button variant="outline" onClick={resetAll}>
                <UserPlus className="h-4 w-4" />
                Créer un autre
              </Button>
            </div>
          </div>

          {/* Right column — PDF preview */}
          {cvRecord && (
            <div className="panel flex flex-col overflow-hidden" style={{ minHeight: "560px" }}>
              <div className="border-b border-border px-4 py-3 shrink-0 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Aperçu du CV</p>
                {!pdfObjectUrl && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {pdfObjectUrl ? (
                <iframe
                  src={pdfObjectUrl}
                  className="flex-1 w-full border-0"
                  title="Aperçu du CV"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Chargement de l'aperçu...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parsed profile — visible once CV analysis is complete */}
        {isTerminalParsed && profileQuery.data && (
          <ParsedProfileSection bundle={profileQuery.data} />
        )}
        </div>
      )}
    </div>
  );
}

function ParsedProfileSection({ bundle }: { bundle: CandidateProfileBundle }) {
  const hasData =
    bundle.skills.length > 0 ||
    bundle.languages.length > 0 ||
    bundle.experience.length > 0 ||
    bundle.education.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-foreground border-b border-border pb-2">
        Profil extrait du CV
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Skills */}
        {bundle.skills.length > 0 && (
          <div className="panel p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Compétences ({bundle.skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bundle.skills.map((s) => (
                <SkillTag
                  key={s.id}
                  label={s.skillLabelRaw ?? s.skillNodeLabel ?? ""}
                  variant="outline"
                />
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {bundle.languages.length > 0 && (
          <div className="panel p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Langues
            </p>
            <div className="space-y-2">
              {bundle.languages.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <span>{l.languageLabelFr ?? l.languageLabelEn ?? l.languageCode}</span>
                  {l.level && (
                    <span className="text-xs text-muted-foreground">
                      {l.levelLabelFr ?? l.level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Experience */}
      {bundle.experience.length > 0 && (
        <div className="panel p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Expérience professionnelle ({bundle.experience.length})
          </p>
          <div className="space-y-4">
            {bundle.experience.map((e) => (
              <div key={e.id} className="border-l-2 border-primary/30 pl-4 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {e.jobTitleRaw ?? "Poste non précisé"}
                </p>
                {e.companyName && (
                  <p className="text-xs text-muted-foreground">{e.companyName}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {[e.startDate, e.isCurrent ? "Présent" : e.endDate]
                    .filter(Boolean)
                    .join(" — ")}
                  {e.durationYears ? ` · ${e.durationYears} an(s)` : ""}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                {e.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                )}
                {e.technologies && e.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {e.technologies.slice(0, 8).map((t) => (
                      <SkillTag key={t} label={t} variant="outline" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {bundle.education.length > 0 && (
        <div className="panel p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Formation ({bundle.education.length})
          </p>
          <div className="space-y-4">
            {bundle.education.map((e) => (
              <div key={e.id} className="border-l-2 border-primary/30 pl-4 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {e.diplomaLabel ?? e.degree ?? e.levelLabel ?? "Diplôme"}
                </p>
                {e.specialty && (
                  <p className="text-xs text-muted-foreground">{e.specialty}</p>
                )}
                {e.institution && (
                  <p className="text-xs text-muted-foreground">{e.institution}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {[e.graduationYear, e.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono font-medium text-foreground">{value}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onCopy(value)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
