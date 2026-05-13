from pydantic import BaseModel


class AdvisorMeResponse(BaseModel):
    id: str
    user_id: str
    email: str
    roles: list[str]
    full_name: str
    position: str | None = None
    active: bool
    agency: dict | None = None


class AdvisorCreateCandidateRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    governorate_code: str | None = None
    delegation_code: str | None = None
    primary_language: str = "fr"


class AdvisorCreateCandidateResponse(BaseModel):
    candidate_id: str
    user_id: str
    email: str
    temporary_password: str
    first_name: str
    last_name: str


class EmployerListItemResponse(BaseModel):
    id: str
    legal_name: str
    commercial_name: str | None = None
    email: str | None = None


class AdvisorCreateOfferRequest(BaseModel):
    employer_id: str
    title: str
    description: str | None = None
    company_name: str | None = None
    contract_type: str | None = None
    work_mode: str | None = None
    governorate_code: str | None = None
    delegation_code: str | None = None
    number_of_positions: int = 1
    salary_min: float | None = None
    salary_max: float | None = None
    deadline_at: str | None = None
