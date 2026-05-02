from pydantic import BaseModel


class ReferentialItemResponse(BaseModel):
    code: str
    label: str


class DelegationItemResponse(ReferentialItemResponse):
    governorate_code: str | None = None
