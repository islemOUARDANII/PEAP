import { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useGeoCountriesQuery,
  useGeoAdminUnitsQuery,
  useGeoPostalCodesQuery,
} from '@/services/api/queries';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface GeoAddressValue {
  countryId: string | null;
  governorateUnitId: string | null;   // UUID geo.admin_unit niveau 1
  delegationUnitId: string | null;    // UUID geo.admin_unit niveau 2
  imadaUnitId: string | null;         // UUID geo.admin_unit niveau 3
  locationUnitId: string | null;      // calculé : imada > délégation > gouvernorat
  postalCodeId: string | null;        // UUID geo.postal_code
  postalCode: string;                 // valeur texte "1002"
  postalLocalityLabel: string;        // libellé localité postale
  addressLine: string;                // ligne d'adresse libre
}

export const emptyGeoAddress = (): GeoAddressValue => ({
  countryId: null,
  governorateUnitId: null,
  delegationUnitId: null,
  imadaUnitId: null,
  locationUnitId: null,
  postalCodeId: null,
  postalCode: '',
  postalLocalityLabel: '',
  addressLine: '',
});

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const unitLabel = (u: { label_fr: string | null; label: string }) =>
  u.label_fr ?? u.label;

const levelLabels = (iso2: string | null) => ({
  level1: iso2 === 'TN' ? 'Gouvernorat' : 'Région',
  level2: iso2 === 'TN' ? 'Délégation'  : 'District',
  level3: iso2 === 'TN' ? 'Imada'        : 'Commune',
});

function computeLocationUnitId(
  governorateUnitId: string | null,
  delegationUnitId: string | null,
  imadaUnitId: string | null,
): string | null {
  return imadaUnitId ?? delegationUnitId ?? governorateUnitId ?? null;
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface GeoAddressFieldsProps {
  value: GeoAddressValue;
  onChange: (next: GeoAddressValue) => void;
  hidePostalCode?: boolean;
  hideImada?: boolean;
}

export function GeoAddressFields({
  value,
  onChange,
  hidePostalCode = false,
  hideImada = false,
}: GeoAddressFieldsProps) {
  const countriesQuery = useGeoCountriesQuery();
  const countries = countriesQuery.data ?? [];

  const selectedCountry = countries.find((c) => c.id === value.countryId);
  const countryIso2 = selectedCountry?.iso2 ?? null;

  // Niveau 1 — gouvernorats
  const level1Query = useGeoAdminUnitsQuery(value.countryId ?? undefined, 1);
  const level1Units = level1Query.data ?? [];

  // Niveau 2 — délégations (requiert un gouvernorat)
  const level2Query = useGeoAdminUnitsQuery(
    value.countryId ?? undefined,
    2,
    value.governorateUnitId ?? undefined,
  );
  const level2Units = level2Query.data ?? [];

  // Niveau 3 — imadas (requiert une délégation)
  const level3Query = useGeoAdminUnitsQuery(
    value.countryId ?? undefined,
    3,
    value.delegationUnitId ?? undefined,
  );
  const level3Units = level3Query.data ?? [];

  // Codes postaux liés à l'imada ou à la délégation
  const postalParentId = value.imadaUnitId ?? value.delegationUnitId;
  const postalQuery = useGeoPostalCodesQuery(postalParentId ?? undefined, undefined);
  const postalCodes = postalQuery.data ?? [];

  // Auto-sélection si un seul code postal disponible
  const lastAutoParent = useRef<string | null>(null);
  useEffect(() => {
    if (
      !hidePostalCode &&
      postalCodes.length === 1 &&
      postalParentId &&
      lastAutoParent.current !== postalParentId &&
      !value.postalCodeId
    ) {
      lastAutoParent.current = postalParentId;
      const pc = postalCodes[0];
      onChange({
        ...value,
        postalCodeId: pc.id,
        postalCode: pc.postal_code,
        postalLocalityLabel: pc.locality_label ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCodes.length, postalParentId, hidePostalCode]);

  const hasLevel1 = level1Units.length > 0;
  const hasLevel2 = level2Units.length > 0 && Boolean(value.governorateUnitId);
  const hasLevel3 = !hideImada && level3Units.length > 0 && Boolean(value.delegationUnitId);
  const showPostal = !hidePostalCode && Boolean(value.delegationUnitId);

  const labels = levelLabels(countryIso2);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCountryChange = (id: string) => {
    lastAutoParent.current = null;
    onChange({
      ...emptyGeoAddress(),
      countryId: id === '__empty__' ? null : id,
    });
  };

  const handleUnit1Change = (id: string) => {
    lastAutoParent.current = null;
    const unitId = id === '__empty__' ? null : id;
    onChange({
      ...value,
      governorateUnitId: unitId,
      delegationUnitId: null,
      imadaUnitId: null,
      locationUnitId: unitId,
      postalCodeId: null,
      postalCode: '',
      postalLocalityLabel: '',
    });
  };

  const handleUnit2Change = (id: string) => {
    lastAutoParent.current = null;
    const unitId = id === '__empty__' ? null : id;
    onChange({
      ...value,
      delegationUnitId: unitId,
      imadaUnitId: null,
      locationUnitId: computeLocationUnitId(value.governorateUnitId, unitId, null),
      postalCodeId: null,
      postalCode: '',
      postalLocalityLabel: '',
    });
  };

  const handleUnit3Change = (id: string) => {
    lastAutoParent.current = null;
    const unitId = id === '__empty__' ? null : id;
    onChange({
      ...value,
      imadaUnitId: unitId,
      locationUnitId: computeLocationUnitId(value.governorateUnitId, value.delegationUnitId, unitId),
      postalCodeId: null,
      postalCode: '',
      postalLocalityLabel: '',
    });
  };

  const handlePostalChange = (postalId: string) => {
    const pc = postalCodes.find((p) => p.id === postalId);
    onChange({
      ...value,
      postalCodeId: postalId === '__empty__' ? null : postalId,
      postalCode: pc?.postal_code ?? '',
      postalLocalityLabel: pc?.locality_label ?? '',
    });
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pays */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Pays</Label>
        <Select
          value={value.countryId ?? '__empty__'}
          onValueChange={handleCountryChange}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Sélectionnez un pays" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">Sélectionnez un pays</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name_fr ?? c.iso2}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Niveau 1 — Gouvernorat */}
      {hasLevel1 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{labels.level1}</Label>
          <Select
            value={value.governorateUnitId ?? '__empty__'}
            onValueChange={handleUnit1Change}
            disabled={level1Query.isLoading}
          >
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={
                  level1Query.isLoading
                    ? 'Chargement...'
                    : `Sélectionnez un ${labels.level1.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">
                Sélectionnez un {labels.level1.toLowerCase()}
              </SelectItem>
              {level1Units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {unitLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Niveau 2 — Délégation */}
      {hasLevel2 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{labels.level2}</Label>
          <Select
            value={value.delegationUnitId ?? '__empty__'}
            onValueChange={handleUnit2Change}
            disabled={level2Query.isLoading}
          >
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={
                  level2Query.isLoading
                    ? 'Chargement...'
                    : `Sélectionnez une ${labels.level2.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">
                Sélectionnez une {labels.level2.toLowerCase()}
              </SelectItem>
              {level2Units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {unitLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Niveau 3 — Imada */}
      {hasLevel3 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{labels.level3}</Label>
          <Select
            value={value.imadaUnitId ?? '__empty__'}
            onValueChange={handleUnit3Change}
            disabled={level3Query.isLoading}
          >
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={
                  level3Query.isLoading
                    ? 'Chargement...'
                    : `Sélectionnez une ${labels.level3.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">
                Sélectionnez une {labels.level3.toLowerCase()}
              </SelectItem>
              {level3Units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {unitLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Code postal */}
      {showPostal && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Code postal</Label>
          {postalQuery.isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Chargement...</p>
          ) : postalCodes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Aucun code postal disponible
            </p>
          ) : (
            <Select
              value={value.postalCodeId ?? '__empty__'}
              onValueChange={handlePostalChange}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sélectionnez un code postal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">Sélectionnez un code postal</SelectItem>
                {postalCodes.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>
                    {pc.postal_code}
                    {pc.locality_label ? ` — ${pc.locality_label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </>
  );
}
