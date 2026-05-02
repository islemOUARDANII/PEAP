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
