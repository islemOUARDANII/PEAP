import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReferenceSelect } from '@/components/onboarding/ReferenceSelect';
import { FileUploadField } from '@/components/onboarding/FileUploadField';
import { useGeoCountriesQuery } from '@/services/api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OnboardingDraftDiploma, OnboardingDraftCertification } from '@/types/candidateOnboarding';
import { useOnboardingContext } from './CandidateOnboardingLayout';

const emptyDiploma = (): OnboardingDraftDiploma => ({
  label: '',
  year: '',
  institution: '',
  diplomaCode: '',
  specialtyCode: '',
  countryIso2: 'TN',
  fileId: '',
});

const emptyCertification = (): OnboardingDraftCertification => ({
  label: '',
  year: '',
  issuer: '',
  domainCode: '',
  fileId: '',
});

export default function EducationStep() {
  const { draft, updateDraft } = useOnboardingContext();
  const countriesQuery = useGeoCountriesQuery();
  const countries = countriesQuery.data ?? [];

  const diplomas = draft.diplomas ?? [];
  const certifications = draft.certifications ?? [];

  const [addingDiploma, setAddingDiploma] = useState(false);
  const [newDiploma, setNewDiploma] = useState<OnboardingDraftDiploma>(emptyDiploma);

  const [addingCert, setAddingCert] = useState(false);
  const [newCert, setNewCert] = useState<OnboardingDraftCertification>(emptyCertification);

  const saveDiploma = () => {
    if (!newDiploma.label.trim()) return;
    updateDraft({ diplomas: [...diplomas, { ...newDiploma }] });
    setNewDiploma(emptyDiploma());
    setAddingDiploma(false);
  };

  const removeDiploma = (index: number) => {
    updateDraft({ diplomas: diplomas.filter((_, i) => i !== index) });
  };

  const saveCertification = () => {
    if (!newCert.label.trim()) return;
    updateDraft({ certifications: [...certifications, { ...newCert }] });
    setNewCert(emptyCertification());
    setAddingCert(false);
  };

  const removeCertification = (index: number) => {
    updateDraft({ certifications: certifications.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Formation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez votre niveau d'instruction, vos diplômes et certifications.
        </p>
      </div>

      {/* Niveau d'instruction */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ReferenceSelect
          groupCode="EDUCATION_LEVEL"
          value={draft.instructionLevel ?? ''}
          onChange={(code) => updateDraft({ instructionLevel: code })}
          label="Niveau d'instruction"
          placeholder="Sélectionner votre niveau"
        />

        <ReferenceSelect
          groupCode="LAST_CLASS"
          value={draft.lastClassCode ?? ''}
          onChange={(code) => updateDraft({ lastClassCode: code })}
          label="Dernière classe fréquentée"
          placeholder="Sélectionner"
        />
      </div>

      {/* ── Diplômes ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Diplômes</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddingDiploma(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>

        {diplomas.length === 0 && !addingDiploma && (
          <p className="text-sm text-muted-foreground">Aucun diplôme renseigné.</p>
        )}

        <div className="space-y-2">
          {diplomas.map((d, i) => (
            <div
              key={i}
              className="flex items-start justify-between rounded-md border border-border bg-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground">
                  {d.institution}{d.year ? ` — ${d.year}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeDiploma(i)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {addingDiploma && (
          <div className="rounded-md border border-border bg-surface p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReferenceSelect
                groupCode="DIPLOMA"
                value={newDiploma.diplomaCode}
                onChange={(code, lbl) =>
                  setNewDiploma((d) => ({ ...d, diplomaCode: code, label: lbl || d.label }))
                }
                label="Type de diplôme"
                placeholder="Sélectionner"
                className="sm:col-span-2"
              />

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Intitulé précis</Label>
                <Input
                  value={newDiploma.label}
                  onChange={(e) => setNewDiploma((d) => ({ ...d, label: e.target.value }))}
                  placeholder="Ex: Licence en Informatique"
                  className="h-10"
                />
              </div>

              <ReferenceSelect
                groupCode="SPECIALTY"
                value={newDiploma.specialtyCode}
                onChange={(code) => setNewDiploma((d) => ({ ...d, specialtyCode: code }))}
                label="Spécialité"
                placeholder="Sélectionner"
              />

              <div className="space-y-1.5">
                <Label>Établissement</Label>
                <Input
                  value={newDiploma.institution}
                  onChange={(e) => setNewDiploma((d) => ({ ...d, institution: e.target.value }))}
                  placeholder="Ex: FSEG Tunis"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Pays de l'établissement</Label>
                <Select
                  value={newDiploma.countryIso2 || '__empty__'}
                  onValueChange={(v) =>
                    setNewDiploma((d) => ({ ...d, countryIso2: v === '__empty__' ? '' : v }))
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Sélectionner</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.iso2} value={c.iso2}>
                        {c.name_fr ?? c.iso2}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Année d'obtention</Label>
                <Input
                  value={newDiploma.year}
                  onChange={(e) => setNewDiploma((d) => ({ ...d, year: e.target.value }))}
                  placeholder="2020"
                  maxLength={4}
                  className="h-10"
                />
              </div>

              <div className="sm:col-span-2">
                <FileUploadField
                  label="Document du diplôme (optionnel)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  fileId={newDiploma.fileId}
                  onChange={(fileId) => setNewDiploma((d) => ({ ...d, fileId }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingDiploma(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={saveDiploma} disabled={!newDiploma.label.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Certifications ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddingCert(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>

        {certifications.length === 0 && !addingCert && (
          <p className="text-sm text-muted-foreground">Aucune certification renseignée.</p>
        )}

        <div className="space-y-2">
          {certifications.map((c, i) => (
            <div
              key={i}
              className="flex items-start justify-between rounded-md border border-border bg-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  {c.issuer}{c.year ? ` — ${c.year}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeCertification(i)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {addingCert && (
          <div className="rounded-md border border-border bg-surface p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Intitulé de la certification</Label>
                <Input
                  value={newCert.label}
                  onChange={(e) => setNewCert((c) => ({ ...c, label: e.target.value }))}
                  placeholder="Ex: AWS Certified Developer"
                  className="h-10"
                />
              </div>

              <ReferenceSelect
                groupCode="CERTIFICATION"
                value={newCert.domainCode}
                onChange={(code) => setNewCert((c) => ({ ...c, domainCode: code }))}
                label="Domaine de certification"
                placeholder="Sélectionner"
              />

              <div className="space-y-1.5">
                <Label>Organisme certificateur</Label>
                <Input
                  value={newCert.issuer}
                  onChange={(e) => setNewCert((c) => ({ ...c, issuer: e.target.value }))}
                  placeholder="Ex: Amazon Web Services"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Année</Label>
                <Input
                  value={newCert.year}
                  onChange={(e) => setNewCert((c) => ({ ...c, year: e.target.value }))}
                  placeholder="2023"
                  maxLength={4}
                  className="h-10"
                />
              </div>

              <div className="sm:col-span-2">
                <FileUploadField
                  label="Document de certification (optionnel)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  fileId={newCert.fileId}
                  onChange={(fileId) => setNewCert((c) => ({ ...c, fileId }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingCert(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={saveCertification} disabled={!newCert.label.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
