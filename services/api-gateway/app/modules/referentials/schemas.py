from pydantic import BaseModel


class ReferentialItemResponse(BaseModel):
    code: str
    label: str


class DelegationItemResponse(ReferentialItemResponse):
    governorate_code: str | None = None


class ImadaItemResponse(ReferentialItemResponse):
    id: str
    delegation_code: str | None = None
    delegation_label: str | None = None
    governorate_code: str | None = None
    governorate_label: str | None = None


class PostalCodeItemResponse(BaseModel):
    id: str
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