export interface GeoCountry {
  id: string;
  iso2: string;
  iso3: string | null;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  phone_prefix: string | null;
  currency_code: string | null;
  active: boolean;
}

export interface GeoAdminUnit {
  id: string;
  country_id: string;
  parent_id: string | null;
  code: string;
  label: string;
  label_fr: string | null;
  label_en: string | null;
  label_ar: string | null;
  admin_level: number;
  unit_type: string;
  active: boolean;
}

export interface GeoPostalCode {
  id: string;
  country_id: string;
  postal_code: string;
  label: string | null;
  locality_label: string | null;
  locality_label_ar: string | null;
  admin_unit_id: string | null;
  admin_level: number | null;
  unit_type: string | null;
  admin_unit_label_fr: string | null;
  confidence: number | null;
  active: boolean;
}
