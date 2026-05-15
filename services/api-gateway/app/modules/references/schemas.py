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
