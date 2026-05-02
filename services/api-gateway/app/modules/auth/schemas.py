from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    type: str | None = None
    id: str | None = None
    label: str | None = None


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    status: str
    roles: list[str]
    profile: UserProfileResponse | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: CurrentUserResponse