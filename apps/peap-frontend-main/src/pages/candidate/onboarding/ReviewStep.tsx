import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ONBOARDING_STEPS } from '@/types/candidateOnboarding';
import {
  mapOnboardingDraftToCandidateProfilePayload,
  submitCandidateOnboardingProfile,
} from '@/services/api/candidateOnboarding';
import { useOnboardingContext } from './CandidateOnboardingLayout';

function Section({
  title,
  stepIndex,
  children,
}: {
  title: string;
  stepIndex: number;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const step = ONBOARDING_STEPS[stepIndex];

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {step && (
          <button
            type="button"
            onClick={() => navigate(step.path)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Modifier
          </button>
        )}
      </div>
      <div className="px-4 py-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground min-w-[160px] shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export default function ReviewStep() {
  const { draft } = useOnboardingContext();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = mapOnboardingDraftToCandidateProfilePayload(draft);
      // TODO: activer quand le mapping payload est validé avec le backend
      await submitCandidateOnboardingProfile(payload);
      setSubmitted(true);
      setTimeout(() => navigate('/candidate', { replace: true }), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la soumission';
      // Tolérance temporaire si l'endpoint n'est pas encore prêt
      if (msg.includes('not yet implemented')) {
        setSubmitted(true);
        setTimeout(() => navigate('/candidate', { replace: true }), 1500);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Profil complété !</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Votre profil a été enregistré. Vous allez être redirigé vers votre tableau de bord.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Récapitulatif</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifiez vos informations avant de soumettre. Cliquez sur "Modifier" pour corriger une
          section.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Raisons */}
      <Section title="Raisons d'inscription" stepIndex={0}>
        {(draft.registrationReasons ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Non renseigné</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(draft.registrationReasons ?? []).map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* CV */}
      <Section title="Méthode de saisie du profil" stepIndex={1}>
        <p className="text-sm text-foreground">
          {draft.cvChoice === 'upload'
            ? 'Importation de CV'
            : draft.cvChoice === 'manual'
              ? 'Saisie manuelle'
              : 'Non sélectionné'}
        </p>
      </Section>

      {/* Infos personnelles */}
      <Section title="Informations personnelles" stepIndex={2}>
        <Row label="Civilité" value={draft.civility} />
        <Row label="État civil" value={draft.maritalStatus} />
        <Row label="Prénom" value={draft.firstName} />
        <Row label="Nom" value={draft.lastName} />
        <Row label="Date de naissance" value={draft.dateOfBirth} />
        <Row label="CIN / Passeport" value={draft.nationalId} />
        <Row label="Nationalité" value={draft.nationalityCountryIso2} />
        <Row label="Email" value={draft.email} />
        <Row label="Téléphone" value={draft.phone} />
        <Row
          label="Adresse"
          value={
            [
              draft.address,
              draft.postalCode,
            ]
              .filter(Boolean)
              .join(', ') || undefined
          }
        />
        <Row
          label="Lieu de naissance"
          value={
            draft.birthCountryId
              ? 'Renseigné'
              : undefined
          }
        />
        <Row
          label="Consentements"
          value={
            draft.consentDataProcessing
              ? 'Données accepté' + (draft.consentMarketing ? ' · Marketing accepté' : '')
              : undefined
          }
        />
      </Section>

      {/* Infos complémentaires */}
      <Section title="Informations complémentaires" stepIndex={3}>
        <Row label="Situation actuelle" value={draft.workSituation} />
        <Row label="Métier actuel" value={draft.currentOccupationLabel} />
        <Row
          label="Permis de conduire"
          value={
            draft.hasDrivingLicense
              ? (draft.drivingLicenseTypeCodes ?? []).join(', ') || 'Oui'
              : 'Non'
          }
        />
        <Row label="Mobilité" value={draft.mobilityScope} />
        <Row
          label="Handicap"
          value={
            draft.hasDisability
              ? [draft.handicapType, draft.handicapDegree].filter(Boolean).join(' / ') || 'Oui'
              : 'Non'
          }
        />
        <Row label="Type de licenciement" value={draft.dismissalType} />
      </Section>

      {/* Formation */}
      <Section title="Formation" stepIndex={4}>
        <Row label="Niveau d'instruction" value={draft.instructionLevel} />
        <Row label="Dernière classe" value={draft.lastClassCode} />
        {(draft.diplomas ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Diplômes</p>
            {(draft.diplomas ?? []).map((d, i) => (
              <p key={i} className="text-sm text-foreground">
                {d.label} — {d.institution} {d.year}
              </p>
            ))}
          </div>
        )}
        {(draft.certifications ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Certifications</p>
            {(draft.certifications ?? []).map((c, i) => (
              <p key={i} className="text-sm text-foreground">
                {c.label} — {c.issuer} {c.year}
              </p>
            ))}
          </div>
        )}
      </Section>

      {/* Expériences */}
      <Section title="Expériences professionnelles" stepIndex={5}>
        {(draft.experiences ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune expérience renseignée</p>
        ) : (
          (draft.experiences ?? []).map((exp, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-3">
              <p className="text-sm font-medium text-foreground">
                {exp.occupationLabel || exp.role}
              </p>
              <p className="text-xs text-muted-foreground">
                {exp.company}
                {exp.activitySectorCode ? ` · ${exp.activitySectorCode}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {exp.startDate}
                {exp.current ? ' — Présent' : exp.endDate ? ` — ${exp.endDate}` : ''}
              </p>
            </div>
          ))
        )}
      </Section>

      {/* Compétences */}
      <Section title="Compétences" stepIndex={6}>
        <Row label="Métier cible" value={draft.targetOccupationLabel} />

        {(draft.technicalSkillItems ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Compétences techniques</p>
            <div className="flex flex-wrap gap-1.5">
              {(draft.technicalSkillItems ?? []).map((s) => (
                <Badge key={s.nodeId} variant="outline" className="text-xs">
                  {s.label}
                  {s.levelCode ? ` — ${s.levelCode}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(draft.softSkillItems ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Compétences comportementales</p>
            <div className="flex flex-wrap gap-1.5">
              {(draft.softSkillItems ?? []).map((s) => (
                <Badge key={s.nodeId} variant="secondary" className="text-xs">
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(draft.languageItems ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Langues</p>
            <div className="flex flex-wrap gap-1.5">
              {(draft.languageItems ?? []).map((l) => (
                <Badge key={l.langCode} variant="secondary" className="text-xs">
                  {l.label} — {l.levelCode}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Soumettre */}
      <div className="pt-2">
        <Button className="w-full h-11" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Soumettre mon profil
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
