import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CheckCircle2,
  Eye,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  parseOfferSafe,
  searchCandidatesSafe,
  type DemoCandidateSearchItem,
} from "@/services/api/demoGateway";
import { gatewayApi } from "@/services/api/gateway";
import {
  type DemoEducationLevel,
  type DemoLanguageLevel,
  type DemoParsedOfferResult,
} from "@/demo/demoData";

interface ProviderOfferForm extends DemoParsedOfferResult {
  companyName: string;
}

const sampleOfferText =
  "Nous recrutons un Développeur Full Stack Python React à Tunis en mode hybride. Le poste couvre le développement d'API FastAPI, l'intégration SQL, la maintenance React et la participation aux ateliers produit. Licence minimum, 2 ans d'expérience, Français B2 requis, Docker apprécié.";

const buildFormFromParsed = (
  parsed: DemoParsedOfferResult,
  companyName: string,
): ProviderOfferForm => ({
  ...parsed,
  companyName,
});

const parseListField = (value: string): string[] =>
  value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function DemoOfferAndCandidates() {
  const [rawText, setRawText] = useState(sampleOfferText);
  const [pageDemoMode, setPageDemoMode] = useState(false);
  const [pageMessage, setPageMessage] = useState(
    "Collez une offre en texte libre puis générez une version structurée et éditable.",
  );
  const [savedOfferId, setSavedOfferId] = useState("");
  const [selectedCandidate, setSelectedCandidate] =
    useState<DemoCandidateSearchItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const employerProfileQuery = useQuery({
    queryKey: ["demo", "provider", "profile"],
    queryFn: () => gatewayApi.employer.getProfile(),
    retry: false,
    staleTime: 30_000,
  });

  const companyName =
    employerProfileQuery.data?.commercialName ??
    employerProfileQuery.data?.legalName ??
    "Entreprise démonstration";

  const [form, setForm] = useState<ProviderOfferForm>(
    buildFormFromParsed(
      {
        title: "",
        description: "",
        location: "Tunis",
        contractType: "CDI",
        workMode: "Hybride",
        salaryMin: 1800,
        salaryMax: 2600,
        salaryLabel: "1 800 - 2 600 TND",
        numberOfPositions: 1,
        requirements: [],
        requiredSkills: [],
        preferredSkills: [],
        educationLevel: "Licence",
        minExperienceYears: 1,
        maxDistanceKm: 80,
        languageLevel: "B2",
        minScore: 65,
      },
      companyName,
    ),
  );

  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateLocation, setCandidateLocation] = useState("");
  const [candidateSkill, setCandidateSkill] = useState("all");
  const [candidateExperience, setCandidateExperience] = useState("0");

  useEffect(() => {
    setForm((current) =>
      current.companyName && current.companyName !== "Entreprise démonstration"
        ? current
        : { ...current, companyName },
    );
  }, [companyName]);

  const generateMutation = useMutation({
    mutationFn: async () => parseOfferSafe(rawText, undefined),
    onSuccess: ({ data, demoMode, errorMessage }) => {
      setForm(buildFormFromParsed(data, companyName));
      setPageDemoMode(demoMode);
      setPageMessage(
        demoMode
          ? "Le parsing réel n'est pas disponible. Une offre de démonstration a été générée pour poursuivre la présentation."
          : "L'offre a été structurée. Vous pouvez maintenant la relire, l'ajuster puis lancer une recherche candidats.",
      );
      toast.success(
        demoMode ? "Offre de démonstration générée." : "Offre structurée avec succès.",
      );

      if (demoMode && errorMessage) {
        toast.message(errorMessage);
      }
    },
    onError: () => {
      setPageDemoMode(true);
      setPageMessage(
        "La génération n'est pas disponible pour le moment. Le mode démonstration reste disponible.",
      );
      toast.error("Impossible de générer l'offre.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (submitAfterSave: boolean) => {
      const payload = {
        title: form.title,
        description: form.description,
        number_of_positions: form.numberOfPositions,
        contract_type: form.contractType,
        work_mode: form.workMode,
        salary_min: form.salaryMin,
        salary_max: form.salaryMax,
        country: "TN",
        governorate_label: form.location,
        requirements: [
          ...form.requiredSkills.map((skill) => ({
            criterion_type: "SKILL",
            raw_value: skill,
            is_must: true,
            weight: 100,
          })),
          ...form.preferredSkills.map((skill) => ({
            criterion_type: "SKILL",
            raw_value: skill,
            is_must: false,
            weight: 50,
          })),
          {
            criterion_type: "EDUCATION",
            raw_value: form.educationLevel,
            is_must: false,
          },
          {
            criterion_type: "EXPERIENCE_YEARS",
            raw_value: String(form.minExperienceYears),
            min_years: form.minExperienceYears,
            is_must: true,
          },
          {
            criterion_type: "LANGUAGE",
            raw_value: `Français ${form.languageLevel}`,
            is_must: false,
          },
        ],
      };

      try {
        const created = await gatewayApi.employer.createOffer(payload);
        if (submitAfterSave) {
          await gatewayApi.employer.submitOffer(created.id);
        }

        return {
          demoMode: false,
          offerId: created.id,
          message: submitAfterSave
            ? "Offre enregistrée et soumise."
            : "Offre enregistrée.",
        };
      } catch {
        return {
          demoMode: true,
          offerId: `demo-offer-${Date.now()}`,
          message: "Offre enregistrée pour la démonstration",
        };
      }
    },
    onSuccess: ({ demoMode, offerId, message }) => {
      setPageDemoMode((current) => current || demoMode);
      setSavedOfferId(offerId);
      setPageMessage(message);
      toast.success(message);
    },
    onError: () => {
      setPageDemoMode(true);
      setPageMessage("Offre enregistrée pour la démonstration");
      toast.success("Offre enregistrée pour la démonstration");
    },
  });

  const candidatesQuery = useQuery({
    queryKey: [
      "demo",
      "provider",
      "candidates",
      {
        title: form.title,
        location: form.location,
        query: candidateQuery,
        candidateLocation,
        skill: candidateSkill,
        experience: candidateExperience,
        requiredSkills: form.requiredSkills.join("|"),
        preferredSkills: form.preferredSkills.join("|"),
      },
    ],
    queryFn: () =>
      searchCandidatesSafe({
        query: candidateQuery,
        location: candidateLocation,
        skills: candidateSkill === "all" ? [] : [candidateSkill],
        minExperience: Number.parseInt(candidateExperience, 10),
        offer: form,
      }),
    enabled: form.title.trim().length > 0,
    staleTime: 30_000,
  });

  const candidates = candidatesQuery.data?.data ?? [];
  const candidateSkillOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...form.requiredSkills, ...form.preferredSkills, ...candidates.flatMap((candidate) => candidate.skills)].filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [candidates, form.preferredSkills, form.requiredSkills],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Démo Offre"
        description="Transformez un texte libre en offre structurée, enregistrez-la si possible, puis recherchez des candidats pertinents sans exposer d'erreurs techniques."
        actions={
          <>
            {pageDemoMode ? (
              <StatusPill label="Mode démo" tone="accent" />
            ) : null}
            <StatusPill label={companyName} tone="info" />
          </>
        }
      />

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="stat-label">Étape 1</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Décrivez votre offre en texte libre
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Le frontend utilise d'abord le parseur réel de l'API Gateway, puis bascule automatiquement sur une version de démonstration si nécessaire.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setRawText(sampleOfferText)}>
              Exemple
            </Button>
            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || rawText.trim().length < 20}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generateMutation.isPending ? "Génération..." : "Générer l'offre"}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <Label className="text-xs text-muted-foreground">
            Décrivez votre offre en texte libre
          </Label>
          <Textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            rows={8}
            className="mt-1.5"
          />
        </div>

        <div className="mt-4 rounded-3xl border border-border bg-primary-muted/20 p-4 text-sm text-foreground">
          {pageMessage}
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="stat-label">Étape 2</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Offre structurée et éditable
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vérifiez les éléments générés puis enregistrez ou soumettez l'offre selon l'état du backend.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveMutation.mutate(false)}
              disabled={saveMutation.isPending || form.title.trim().length === 0}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Enregistrer l'offre
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate(true)}
              disabled={saveMutation.isPending || form.title.trim().length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Enregistrer et soumettre
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="Titre"
            value={form.title}
            onChange={(value) => setForm((current) => ({ ...current, title: value }))}
          />
          <Field
            label="Entreprise"
            value={form.companyName}
            onChange={(value) => setForm((current) => ({ ...current, companyName: value }))}
          />
          <Field
            label="Localisation"
            value={form.location}
            onChange={(value) => setForm((current) => ({ ...current, location: value }))}
          />
          <Field
            label="Type de contrat"
            value={form.contractType}
            onChange={(value) => setForm((current) => ({ ...current, contractType: value }))}
          />
          <Field
            label="Mode de travail"
            value={form.workMode}
            onChange={(value) => setForm((current) => ({ ...current, workMode: value }))}
          />
          <Field
            label="Nombre de postes"
            type="number"
            value={String(form.numberOfPositions)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                numberOfPositions: Number.parseInt(value || "0", 10) || 0,
              }))
            }
          />
          <Field
            label="Salaire minimum"
            type="number"
            value={String(form.salaryMin)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                salaryMin: Number.parseInt(value || "0", 10) || 0,
              }))
            }
          />
          <Field
            label="Salaire maximum"
            type="number"
            value={String(form.salaryMax)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                salaryMax: Number.parseInt(value || "0", 10) || 0,
              }))
            }
          />
        </div>

        <div className="mt-4">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            rows={5}
            className="mt-1.5"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ListField
            label="Requirements"
            value={form.requirements.join(", ")}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                requirements: parseListField(value),
              }))
            }
          />
          <div className="space-y-4">
            <ListField
              label="Compétences requises"
              value={form.requiredSkills.join(", ")}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  requiredSkills: parseListField(value),
                }))
              }
            />
            <ListField
              label="Compétences souhaitées"
              value={form.preferredSkills.join(", ")}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  preferredSkills: parseListField(value),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(form.requiredSkills ?? []).map((skill) => (
            <SkillTag key={`required-${skill}`} label={skill} variant="matched" />
          ))}
          {(form.preferredSkills ?? []).map((skill) => (
            <SkillTag key={`preferred-${skill}`} label={skill} variant="outline" />
          ))}
        </div>

        {savedOfferId ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Référence offre : {savedOfferId}
          </p>
        ) : null}
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="stat-label">Étape 3</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Recherche candidats
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La recherche tente d'abord le service réel, puis affiche une sélection de démonstration alignée sur l'offre courante.
            </p>
          </div>

          {candidatesQuery.data?.demoMode ? (
            <StatusPill label="Mode démo" tone="accent" />
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={candidateQuery}
              onChange={(event) => setCandidateQuery(event.target.value)}
              placeholder="Nom, profil, compétence..."
              className="h-10 bg-surface-muted pl-9"
            />
          </div>

          <Input
            value={candidateLocation}
            onChange={(event) => setCandidateLocation(event.target.value)}
            placeholder="Localisation"
            className="h-10 bg-surface-muted"
          />

          <Select value={candidateSkill} onValueChange={setCandidateSkill}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Compétence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les compétences</SelectItem>
              {(candidateSkillOptions ?? []).map((skill) => (
                <SelectItem key={`candidate-skill-${skill}`} value={skill}>
                  {skill}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
          <Select value={candidateExperience} onValueChange={setCandidateExperience}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Expérience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 an et plus</SelectItem>
              <SelectItem value="1">1 an et plus</SelectItem>
              <SelectItem value="2">2 ans et plus</SelectItem>
              <SelectItem value="3">3 ans et plus</SelectItem>
            </SelectContent>
          </Select>

          {candidatesQuery.data?.errorMessage ? (
            <div className="rounded-3xl border border-border bg-primary-muted/20 px-4 py-3 text-sm text-foreground">
              {candidatesQuery.data.errorMessage}
            </div>
          ) : null}
        </div>

        {candidatesQuery.isLoading ? (
          <div className="mt-6 text-sm text-muted-foreground">
            Chargement des candidats...
          </div>
        ) : candidates.length === 0 ? (
          <div className="mt-6 text-sm text-muted-foreground">
            Aucun candidat ne correspond aux filtres actuels.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(candidates ?? []).map((candidate) => (
              <article key={candidate.id} className="panel flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {candidate.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {candidate.title}
                    </p>
                  </div>
                  <ScoreBadge score={candidate.score} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {candidate.yearsExperience} an(s)
                  </span>
                  <StatusPill
                    label={candidate.educationLevel}
                    tone={statusToTone(candidate.educationLevel)}
                    dot={false}
                  />
                </div>

                <p className="mt-4 text-sm leading-6 text-foreground/90">
                  {candidate.summary}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(candidate.skills ?? []).slice(0, 6).map((skill) => (
                    <SkillTag key={`${candidate.id}-${skill}`} label={skill} variant="matched" />
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    setDialogOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Voir profil
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCandidate?.name ?? "Profil candidat"}
            </DialogTitle>
            <DialogDescription>
              Aperçu du profil candidat pour la démonstration employeur.
            </DialogDescription>
          </DialogHeader>

          {selectedCandidate ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MiniCard label="Score" value={`${selectedCandidate.score}%`} />
                <MiniCard label="Ville" value={selectedCandidate.location} />
                <MiniCard
                  label="Expérience"
                  value={`${selectedCandidate.yearsExperience} an(s)`}
                />
                <MiniCard
                  label="Études"
                  value={selectedCandidate.educationLevel}
                />
              </div>

              <div className="rounded-3xl border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Profil
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground/90">
                  {selectedCandidate.summary}
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">
                  Compétences
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedCandidate.skills ?? []).map((skill) => (
                    <SkillTag key={`dialog-${selectedCandidate.id}-${skill}`} label={skill} variant="matched" />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">
                  Langues
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedCandidate.languages ?? []).map((language) => (
                    <SkillTag key={`dialog-language-${language.name}`} label={`${language.name} ${language.level}`} variant="outline" />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-1.5"
      />
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
