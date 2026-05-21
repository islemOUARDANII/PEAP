from datetime import date, datetime

from pydantic import BaseModel


# ─── Ref Group ────────────────────────────────────────────────────────────────

class RefGroupResponse(BaseModel):
    id: str
    code: str
    label: str
    description: str | None = None
    domain: str | None = None
    active: bool
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime


class RefGroupListResponse(BaseModel):
    total: int
    items: list[RefGroupResponse]


class RefGroupCreateRequest(BaseModel):
    code: str
    label: str
    description: str | None = None
    domain: str | None = None
    active: bool = True
    metadata_json: dict | None = None


class RefGroupUpdateRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    domain: str | None = None
    active: bool | None = None
    metadata_json: dict | None = None


# ─── Ref Value ────────────────────────────────────────────────────────────────

class RefValueResponse(BaseModel):
    id: str
    group_id: str
    group_code: str | None = None
    code: str
    label: str
    normalized_label: str
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None
    sort_order: int
    active: bool
    valid_from: date | None = None
    valid_to: date | None = None
    source: str | None = None
    external_code: str | None = None
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime


class RefValueListResponse(BaseModel):
    total: int
    items: list[RefValueResponse]


class RefValueCreateRequest(BaseModel):
    group_id: str
    code: str
    label: str
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None
    sort_order: int = 0
    active: bool = True
    valid_from: date | None = None
    valid_to: date | None = None
    source: str | None = None
    external_code: str | None = None
    metadata_json: dict | None = None


class RefValueUpdateRequest(BaseModel):
    label: str | None = None
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None
    sort_order: int | None = None
    active: bool | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    source: str | None = None
    external_code: str | None = None
    metadata_json: dict | None = None


# ─── Public dropdown ──────────────────────────────────────────────────────────

class RefDropdownItem(BaseModel):
    id: str
    code: str
    label: str
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None
    sort_order: int

class ImadaDropdownItem(BaseModel):
    id: str
    code: str
    label: str
    label_fr: str | None = None
    label_en: str | None = None
    label_ar: str | None = None

    delegation_id: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None

    governorate_id: str | None = None
    governorate_code: str | None = None
    governorate_label: str | None = None

    country_id: str | None = None
    active: bool


class PostalCodeDropdownItem(BaseModel):
    id: str
    country_id: str | None = None

    postal_code: str
    label: str | None = None
    locality_label: str | None = None
    locality_label_ar: str | None = None

    admin_unit_id: str | None = None
    admin_unit_code: str | None = None
    admin_unit_label: str | None = None
    admin_level: int | None = None
    unit_type: str | None = None

    delegation_code: str | None = None
    delegation_label: str | None = None

    governorate_code: str | None = None
    governorate_label: str | None = None

    active: bool