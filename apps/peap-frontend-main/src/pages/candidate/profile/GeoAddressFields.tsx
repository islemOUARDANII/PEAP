import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGeoCountriesQuery, useGeoAdminUnitsQuery } from '@/services/api/queries';

export interface GeoAddressValue {
  countryIso2: string;     // e.g. 'TN'
  adminUnit1Code: string;  // level-1 code (governorate code)
  adminUnit1Label: string; // level-1 label for display/compose
  adminUnit2Code: string;  // level-2 code (delegation code)
  adminUnit2Label: string; // level-2 label for display/compose
}

export function GeoAddressFields({
  value,
  onChange,
}: {
  value: GeoAddressValue;
  onChange: (next: GeoAddressValue) => void;
}) {
  const countriesQuery = useGeoCountriesQuery();

  const selectedCountry = useMemo(
    () => (countriesQuery.data ?? []).find((c) => c.iso2 === value.countryIso2),
    [countriesQuery.data, value.countryIso2],
  );

  const level1Query = useGeoAdminUnitsQuery(selectedCountry?.id, 1);

  const selectedUnit1 = useMemo(
    () => (level1Query.data ?? []).find((u) => u.code === value.adminUnit1Code),
    [level1Query.data, value.adminUnit1Code],
  );

  const level2Query = useGeoAdminUnitsQuery(
    selectedCountry?.id,
    2,
    selectedUnit1?.id,
  );

  const hasLevel1 = (level1Query.data ?? []).length > 0;
  const hasLevel2 = (level2Query.data ?? []).length > 0;

  const unit1Label = value.countryIso2 === 'TN' ? 'Gouvernorat' : 'Région';
  const unit2Label = value.countryIso2 === 'TN' ? 'Délégation' : 'District';

  return (
    <>
      {/* Country */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Pays</Label>
        <Select
          value={value.countryIso2 || '__empty__'}
          onValueChange={(v) => {
            const iso2 = v === '__empty__' ? '' : v;
            const country = (countriesQuery.data ?? []).find((c) => c.iso2 === iso2);
            onChange({
              countryIso2: iso2,
              adminUnit1Code: '',
              adminUnit1Label: '',
              adminUnit2Code: '',
              adminUnit2Label: '',
            });
            void country; // label stored at parent if needed
          }}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Sélectionner un pays" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">Sélectionner un pays</SelectItem>
            {(countriesQuery.data ?? []).map((c) => (
              <SelectItem key={c.iso2} value={c.iso2}>
                {c.name_fr ?? c.iso2}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Admin level 1 */}
      {hasLevel1 ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{unit1Label}</Label>
          <Select
            value={value.adminUnit1Code || '__empty__'}
            onValueChange={(v) => {
              const code = v === '__empty__' ? '' : v;
              const unit = (level1Query.data ?? []).find((u) => u.code === code);
              onChange({
                ...value,
                adminUnit1Code: code,
                adminUnit1Label: unit ? (unit.label_fr ?? unit.label) : '',
                adminUnit2Code: '',
                adminUnit2Label: '',
              });
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Sélectionner</SelectItem>
              {(level1Query.data ?? []).map((u) => (
                <SelectItem key={u.code} value={u.code}>
                  {u.label_fr ?? u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Admin level 2 */}
      {hasLevel1 && value.adminUnit1Code ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{unit2Label}</Label>
          <Select
            value={value.adminUnit2Code || '__empty__'}
            onValueChange={(v) => {
              const code = v === '__empty__' ? '' : v;
              const unit = (level2Query.data ?? []).find((u) => u.code === code);
              onChange({
                ...value,
                adminUnit2Code: code,
                adminUnit2Label: unit ? (unit.label_fr ?? unit.label) : '',
              });
            }}
            disabled={!value.adminUnit1Code || level2Query.isLoading}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Sélectionner</SelectItem>
              {hasLevel2
                ? (level2Query.data ?? []).map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.label_fr ?? u.label}
                    </SelectItem>
                  ))
                : null}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  );
}
