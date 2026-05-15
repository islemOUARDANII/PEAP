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
