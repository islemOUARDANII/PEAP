from pydantic import BaseModel, EmailStr, Field


# ─── Login ────────────────────────────────────────────────────────────────────

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


# ─── Inscription candidat avec OTP email ─────────────────────────────────────

class CandidateRegisterStartRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str
    first_name: str | None = None
    last_name: str | None = None
    national_id: str | None = None
    phone: str | None = None


class CandidateRegisterStartResponse(BaseModel):
    message: str
    email: str


class CandidateVerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class CandidateResendCodeRequest(BaseModel):
    email: EmailStr


class CandidateResendCodeResponse(BaseModel):
    message: str
