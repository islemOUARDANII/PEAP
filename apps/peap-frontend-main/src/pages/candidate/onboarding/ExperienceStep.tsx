import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ReferenceSelect } from '@/components/onboarding/ReferenceSelect';
import { TaxonomyAutocomplete } from '@/components/onboarding/TaxonomyAutocomplete';
import { FileUploadField } from '@/components/onboarding/FileUploadField';
import { GeoAddressFields, emptyGeoAddress } from '@/pages/candidate/profile/GeoAddressFields';
import type { GeoAddressValue } from '@/pages/candidate/profile/GeoAddressFields';
import type { OnboardingDraftExperience } from '@/types/candidateOnboarding';
import { useOnboardingContext } from './CandidateOnboardingLayout';

const emptyExperience = (): OnboardingDraftExperience => ({
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
  experienceTypeCode: '',
  organizationTypeCode: '',
  activitySectorCode: '',
  occupationNodeId: '',
  occupationLabel: '',
  countryId: null,
  governorateUnitId: null,
  delegationUnitId: null,
  imadaUnitId: null,
  locationUnitId: null,
  postalCodeId: null,
  postalCode: '',
  postalLocalityLabel: '',
  attestationFileId: '',
});

export default function ExperienceStep() {
  const { draft, updateDraft } = useOnboardingContext();
  const experiences = draft.experiences ?? [];

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<OnboardingDraftExperience>(emptyExperience);

  const updateForm = (patch: Partial<OnboardingDraftExperience>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleGeoChange = (geo: GeoAddressValue) => {
    updateForm({
      countryId:          geo.countryId,
      governorateUnitId:  geo.governorateUnitId,
      delegationUnitId:   geo.delegationUnitId,
      imadaUnitId:        geo.imadaUnitId,
      locationUnitId:     geo.locationUnitId,
      postalCodeId:       geo.postalCodeId,
      postalCode:         geo.postalCode,
      postalLocalityLabel:geo.postalLocalityLabel,
    });
  };

  const expGeo: GeoAddressValue = {
    countryId:          form.countryId          ?? null,
    governorateUnitId:  form.governorateUnitId  ?? null,
    delegationUnitId:   form.delegationUnitId   ?? null,
    imadaUnitId:        form.imadaUnitId         ?? null,
    locationUnitId:     form.locationUnitId      ?? null,
    postalCodeId:       form.postalCodeId        ?? null,
    postalCode:         form.postalCode          ?? '',
    postalLocalityLabel:form.postalLocalityLabel ?? '',
    addressLine:        '',
  };

  const save = () => {
    if (!form.company.trim() && !form.role.trim()) return;
    updateDraft({ experiences: [...experiences, { ...form }] });
    setForm(emptyExperience());
    setAdding(false);
  };

  const remove = (index: number) => {
    updateDraft({ experiences: experiences.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Expériences professionnelles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez vos expériences les plus récentes en premier.
        </p>
      </div>

      {/* Liste */}
      {experiences.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune expérience renseignée. Ajoutez votre première expérience.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {experiences.map((exp, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {exp.occupationLabel || exp.role}
                </p>
                <p className="text-sm text-muted-foreground">{exp.company}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {exp.startDate}
                  {exp.current ? ' — Présent' : exp.endDate ? ` — ${exp.endDate}` : ''}
                </p>
                {exp.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {exp.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire d'ajout */}
      {adding && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Nouvelle expérience</h3>

          {/* Intitulé du poste via taxonomy */}
          <TaxonomyAutocomplete
            nodeType="OCCUPATION"
            nodeId={form.occupationNodeId}
            labelValue={form.occupationLabel}
            displayLabel="Intitulé du poste"
            placeholder="Rechercher un métier…"
            onChange={(nodeId, label) =>
              updateForm({ occupationNodeId: nodeId, occupationLabel: label, role: label })
            }
          />

          {/* Si aucune sélection taxonomy, saisie libre */}
          {!form.occupationNodeId && (
            <div className="space-y-1.5">
              <Label>Intitulé libre (si non trouvé ci-dessus)</Label>
              <Input
                value={form.role}
                onChange={(e) => updateForm({ role: e.target.value })}
                placeholder="Ex: Développeur web"
                className="h-10"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Entreprise / Organisme <span className="text-destructive">*</span></Label>
            <Input
              value={form.company}
              onChange={(e) => updateForm({ company: e.target.value })}
              placeholder="Nom de l'entreprise"
              className="h-10"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReferenceSelect
              groupCode="EXPERIENCE_TYPE"
              value={form.experienceTypeCode}
              onChange={(code) => updateForm({ experienceTypeCode: code })}
              label="Type d'expérience"
              placeholder="Sélectionner"
            />

            <ReferenceSelect
              groupCode="ORGANIZATION_TYPE"
              value={form.organizationTypeCode}
              onChange={(code) => updateForm({ organizationTypeCode: code })}
              label="Type d'organisation"
              placeholder="Sélectionner"
            />

            <ReferenceSelect
              groupCode="ACTIVITY_SECTOR"
              value={form.activitySectorCode}
              onChange={(code) => updateForm({ activitySectorCode: code })}
              label="Secteur d'activité"
              placeholder="Sélectionner"
              className="sm:col-span-2"
            />

            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input
                type="month"
                value={form.startDate}
                onChange={(e) => updateForm({ startDate: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="month"
                value={form.endDate}
                onChange={(e) => updateForm({ endDate: e.target.value })}
                disabled={form.current}
                className="h-10"
              />
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <Checkbox
                  checked={form.current}
                  onCheckedChange={(v) =>
                    updateForm({ current: v === true, endDate: '' })
                  }
                />
                <span className="text-xs text-muted-foreground">Poste actuel</span>
              </label>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Décrivez vos principales missions et réalisations…"
                className="resize-none min-h-[80px]"
              />
            </div>
          </div>

          {/* Localisation de l'expérience */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
              Localisation
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <GeoAddressFields value={expGeo} onChange={handleGeoChange} />
            </div>
          </div>

          {/* Attestation */}
          <FileUploadField
            label="Attestation de travail (optionnel)"
            accept=".pdf,.jpg,.jpeg,.png"
            fileId={form.attestationFileId}
            onChange={(fileId) => updateForm({ attestationFileId: fileId })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!form.company.trim() && !form.role.trim() && !form.occupationLabel.trim()}
            >
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setAdding(true)}
          className="gap-2 w-full"
        >
          <Plus className="h-4 w-4" />
          Ajouter une expérience
        </Button>
      )}
    </div>
  );
}
