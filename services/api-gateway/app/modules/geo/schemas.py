from pydantic import BaseModel


class GeoCountryResponse(BaseModel):
    id: str
    iso2: str
    iso3: str | None = None
    name_fr: str
    name_en: str | None = None
    name_ar: str | None = None
    phone_prefix: str | None = None
    currency_code: str | None = None
    active: bool


class GeoAdminUnitResponse(BaseModel):
    id: str
    country_id: str
    parent_id: str | None = None
    code: str
    label: str
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None
    admin_level: int
    unit_type: str
    active: bool


class GeoPostalCodeResponse(BaseModel):
    id: str
    country_id: str
    postal_code: str
    label: str | None = None
    locality_label: str | None = None
    locality_label_ar: str | None = None
    admin_unit_id: str | None = None
    admin_level: int | None = None
    unit_type: str | None = None
    admin_unit_label_fr: str | None = None
    confidence: float | None = None
    active: bool
