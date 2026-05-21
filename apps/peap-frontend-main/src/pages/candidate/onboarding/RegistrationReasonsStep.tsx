import { ReferenceMultiSelect } from '@/components/onboarding/ReferenceMultiSelect';
import { useOnboardingContext } from './CandidateOnboardingLayout';

/**
 * Codes référentiels à essayer dans l'ordre.
 * Le premier non-vide est utilisé.
 * TODO: confirmer le code exact avec l'équipe backend.
 */
const GROUP_CODE = 'REGISTRATION_REASON';

export default function RegistrationReasonsStep() {
  const { draft, updateDraft } = useOnboardingContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Pourquoi vous inscrivez-vous ?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sélectionnez une ou plusieurs raisons. Cela nous aide à personnaliser votre expérience.
        </p>
      </div>

      <ReferenceMultiSelect
        groupCode={GROUP_CODE}
        values={draft.registrationReasons ?? []}
        onChange={(codes) => updateDraft({ registrationReasons: codes })}
        cardGrid
      />

      {(draft.registrationReasons ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sélectionnez au moins une raison pour continuer.
        </p>
      )}
    </div>
  );
}
