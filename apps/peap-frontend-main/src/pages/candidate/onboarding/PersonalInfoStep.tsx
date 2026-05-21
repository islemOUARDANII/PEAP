import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ReferenceSelect } from '@/components/onboarding/ReferenceSelect';
import { FileUploadField } from '@/components/onboarding/FileUploadField';
import { GeoAddressFields } from '@/pages/candidate/profile/GeoAddressFields';
import type { GeoAddressValue } from '@/pages/candidate/profile/GeoAddressFields';
import { useGeoCountriesQuery } from '@/services/api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOnboardingContext } from './CandidateOnboardingLayout';
import type { OnboardingDraft } from '@/types/candidateOnboarding';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide pt-4 pb-1 border-b border-border mb-3">
      {children}
    </h3>
  );
}

export default function PersonalInfoStep() {
  const { draft, updateDraft } = useOnboardingContext();
  const countriesQuery = useGeoCountriesQuery();
  const countries = countriesQuery.data ?? [];

  // Adaptateur GeoAddressFields — adresse de résidence
  const residenceGeo: GeoAddressValue = {
    countryId:          draft.countryId           ?? null,
    governorateUnitId:  draft.governorateUnitId   ?? null,
    delegationUnitId:   draft.delegationUnitId    ?? null,
    imadaUnitId:        draft.imadaUnitId          ?? null,
    locationUnitId:     draft.locationUnitId       ?? null,
    postalCodeId:       draft.postalCodeId         ?? null,
    postalCode:         draft.postalCode           ?? '',
    postalLocalityLabel:draft.postalLocalityLabel  ?? '',
    addressLine:        draft.address              ?? '',
  };

  const handleResidenceGeoChange = (next: GeoAddressValue) => {
    updateDraft({
      countryId:           next.countryId,
      governorateUnitId:   next.governorateUnitId,
      delegationUnitId:    next.delegationUnitId,
      imadaUnitId:         next.imadaUnitId,
      locationUnitId:      next.locationUnitId,
      postalCodeId:        next.postalCodeId,
      postalCode:          next.postalCode,
      postalLocalityLabel: next.postalLocalityLabel,
    });
  };

  // Adaptateur GeoAddressFields — lieu de naissance
  const birthGeo: GeoAddressValue = {
    countryId:          draft.birthCountryId           ?? null,
    governorateUnitId:  draft.birthGovernorateUnitId   ?? null,
    delegationUnitId:   draft.birthDelegationUnitId    ?? null,
    imadaUnitId:        draft.birthImadaUnitId          ?? null,
    locationUnitId:     null,
    postalCodeId:       null,
    postalCode:         '',
    postalLocalityLabel:'',
    addressLine:        '',
  };

  const handleBirthGeoChange = (next: GeoAddressValue) => {
    updateDraft({
      birthCountryId:          next.countryId,
      birthGovernorateUnitId:  next.governorateUnitId,
      birthDelegationUnitId:   next.delegationUnitId,
      birthImadaUnitId:        next.imadaUnitId,
    } as Partial<OnboardingDraft>);
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Informations personnelles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez votre identité, vos coordonnées et votre adresse de résidence.
        </p>
      </div>

      {/* ── Identité ── */}
      <SectionTitle>Identité</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReferenceSelect
          groupCode="CIVILITY"
          value={draft.civility ?? ''}
          onChange={(code) => updateDraft({ civility: code })}
          label="Civilité"
          placeholder="Sélectionner"
        />

        <ReferenceSelect
          groupCode="MARITAL_STATUS"
          value={draft.maritalStatus ?? ''}
          onChange={(code) => updateDraft({ maritalStatus: code })}
          label="État civil"
          placeholder="Sélectionner"
        />

        <div className="space-y-1.5">
          <Label>Prénom <span className="text-destructive">*</span></Label>
          <Input
            value={draft.firstName ?? ''}
            onChange={(e) => updateDraft({ firstName: e.target.value })}
            placeholder="Votre prénom"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input
            value={draft.lastName ?? ''}
            onChange={(e) => updateDraft({ lastName: e.target.value })}
            placeholder="Votre nom"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Date de naissance</Label>
          <Input
            type="date"
            value={draft.dateOfBirth ?? ''}
            onChange={(e) => updateDraft({ dateOfBirth: e.target.value })}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Numéro CIN / Passeport</Label>
          <Input
            value={draft.nationalId ?? ''}
            onChange={(e) => updateDraft({ nationalId: e.target.value })}
            placeholder="12345678"
            className="h-10"
          />
        </div>

        {/* Nationalité */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nationalité</Label>
          <Select
            value={draft.nationalityCountryIso2 || '__empty__'}
            onValueChange={(v) =>
              updateDraft({ nationalityCountryIso2: v === '__empty__' ? '' : v })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sélectionnez un pays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Sélectionnez un pays</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.iso2} value={c.iso2}>
                  {c.name_fr ?? c.iso2}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Coordonnées ── */}
      <SectionTitle>Coordonnées</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Adresse email <span className="text-destructive">*</span></Label>
          <Input
            type="email"
            value={draft.email ?? ''}
            onChange={(e) => updateDraft({ email: e.target.value })}
            placeholder="votre@email.com"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Numéro de téléphone</Label>
          <Input
            type="tel"
            value={draft.phone ?? ''}
            onChange={(e) => updateDraft({ phone: e.target.value })}
            placeholder="+216 XX XXX XXX"
            className="h-10"
          />
        </div>
      </div>

      {/* ── Adresse de résidence ── */}
      <SectionTitle>Adresse de résidence</SectionTitle>
      <div className="space-y-1.5 mb-4">
        <Label>Adresse (rue, numéro)</Label>
        <Input
          value={draft.address ?? ''}
          onChange={(e) => updateDraft({ address: e.target.value })}
          placeholder="Rue, numéro..."
          className="h-10"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-2">
        <GeoAddressFields
          value={residenceGeo}
          onChange={handleResidenceGeoChange}
        />
      </div>

      {/* ── Lieu de naissance ── */}
      <SectionTitle>Lieu de naissance</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <GeoAddressFields
          value={birthGeo}
          onChange={handleBirthGeoChange}
          hidePostalCode
        />
      </div>

      {/* ── Documents ── */}
      <SectionTitle>Documents d'identité</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FileUploadField
          label="Copie CIN / Carte de séjour"
          accept=".pdf,.jpg,.jpeg,.png"
          fileId={draft.cinFileId}
          onChange={(fileId) => updateDraft({ cinFileId: fileId })}
        />

        <FileUploadField
          label="Photo d'identité"
          accept=".jpg,.jpeg,.png"
          fileId={draft.photoFileId}
          onChange={(fileId) => updateDraft({ photoFileId: fileId })}
        />
      </div>

      {/* ── Consentements ── */}
      <SectionTitle>Consentements</SectionTitle>
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={draft.consentDataProcessing ?? false}
            onCheckedChange={(v) => updateDraft({ consentDataProcessing: v === true })}
            className="mt-0.5"
          />
          <span className="text-sm text-foreground">
            J'accepte le traitement de mes données personnelles à des fins de mise en relation
            avec des employeurs.{' '}
            <span className="text-destructive">*</span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={draft.consentMarketing ?? false}
            onCheckedChange={(v) => updateDraft({ consentMarketing: v === true })}
            className="mt-0.5"
          />
          <span className="text-sm text-muted-foreground">
            J'accepte de recevoir des communications et des offres d'emploi par email.
          </span>
        </label>
      </div>
    </div>
  );
}
