import { Checkbox } from '@/components/ui/checkbox';
import { ReferenceSelect } from '@/components/onboarding/ReferenceSelect';
import { ReferenceMultiSelect } from '@/components/onboarding/ReferenceMultiSelect';
import { TaxonomyAutocomplete } from '@/components/onboarding/TaxonomyAutocomplete';
import { FileUploadField } from '@/components/onboarding/FileUploadField';
import { useOnboardingContext } from './CandidateOnboardingLayout';

export default function AdditionalInfoStep() {
  const { draft, updateDraft } = useOnboardingContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Informations complémentaires</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ces informations permettent de mieux cibler les offres correspondant à votre situation.
        </p>
      </div>

      {/* Situation professionnelle actuelle */}
      <ReferenceSelect
        groupCode="WORK_SITUATION"
        value={draft.workSituation ?? ''}
        onChange={(code) => updateDraft({ workSituation: code })}
        label="Situation professionnelle actuelle"
        placeholder="Sélectionner votre situation"
      />

      {/* Métier actuel */}
      <TaxonomyAutocomplete
        nodeType="OCCUPATION"
        nodeId={draft.currentOccupationNodeId ?? ''}
        labelValue={draft.currentOccupationLabel ?? ''}
        displayLabel="Métier actuel (optionnel)"
        placeholder="Rechercher un métier…"
        onChange={(nodeId, label) =>
          updateDraft({ currentOccupationNodeId: nodeId, currentOccupationLabel: label })
        }
      />

      {/* Permis de conduire */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={draft.hasDrivingLicense ?? false}
            onCheckedChange={(v) =>
              updateDraft({
                hasDrivingLicense: v === true,
                drivingLicenseTypeCodes: v === true ? (draft.drivingLicenseTypeCodes ?? []) : [],
              })
            }
          />
          <span className="text-sm font-medium text-foreground">Permis de conduire</span>
        </label>

        {draft.hasDrivingLicense && (
          <div className="ml-7">
            <ReferenceMultiSelect
              groupCode="PERMIT_TYPE"
              values={draft.drivingLicenseTypeCodes ?? []}
              onChange={(codes) => updateDraft({ drivingLicenseTypeCodes: codes })}
              label="Types de permis"
            />
          </div>
        )}
      </div>

      {/* Mobilité */}
      <ReferenceSelect
        groupCode="MOBILITY_SCOPE"
        value={draft.mobilityScope ?? ''}
        onChange={(code) => updateDraft({ mobilityScope: code })}
        label="Rayon de mobilité"
        placeholder="Sélectionner votre mobilité"
      />

      {/* Handicap */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={draft.hasDisability ?? false}
            onCheckedChange={(v) =>
              updateDraft({
                hasDisability: v === true,
                handicapType: v === true ? (draft.handicapType ?? '') : '',
                handicapDegree: v === true ? (draft.handicapDegree ?? '') : '',
              })
            }
          />
          <span className="text-sm font-medium text-foreground">
            Situation de handicap reconnue
          </span>
        </label>

        {draft.hasDisability && (
          <div className="ml-7 grid gap-4 sm:grid-cols-2">
            <ReferenceSelect
              groupCode="HANDICAP_TYPE"
              value={draft.handicapType ?? ''}
              onChange={(code) => updateDraft({ handicapType: code })}
              label="Type de handicap"
              placeholder="Sélectionner"
            />

            <ReferenceSelect
              groupCode="HANDICAP_DEGREE"
              value={draft.handicapDegree ?? ''}
              onChange={(code) => updateDraft({ handicapDegree: code })}
              label="Degré de handicap"
              placeholder="Sélectionner"
            />

            <div className="sm:col-span-2">
              <FileUploadField
                label="Carte de handicap (optionnel)"
                accept=".pdf,.jpg,.jpeg,.png"
                fileId={draft.handicapCardFileId}
                onChange={(fileId) => updateDraft({ handicapCardFileId: fileId })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Licenciement */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={draft.hasDismissal ?? false}
            onCheckedChange={(v) =>
              updateDraft({
                hasDismissal: v === true,
                dismissalType: v === true ? (draft.dismissalType ?? '') : '',
              })
            }
          />
          <span className="text-sm font-medium text-foreground">
            Licencié(e) ou fin de contrat involontaire
          </span>
        </label>

        {draft.hasDismissal && (
          <div className="ml-7">
            <ReferenceSelect
              groupCode="DISMISSAL_TYPE"
              value={draft.dismissalType ?? ''}
              onChange={(code) => updateDraft({ dismissalType: code })}
              label="Type de licenciement"
              placeholder="Sélectionner"
            />
          </div>
        )}
      </div>
    </div>
  );
}
