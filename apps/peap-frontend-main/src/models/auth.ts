import type { Role } from "./role";

export interface BackendUserProfile {
    type?: string | null;
    id?: string | null;
    label?: string | null;
}

export interface AuthUser {
    id?: string;
    email: string;
    role: Role;
    backendRole: string;
    roles?: string[];
    name: string;
    status?: string;
    profile?: BackendUserProfile | null;
}

export interface AuthSession {
    token: string;
    tokenHeader: string;
    user: AuthUser;
    createdAt: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: {
        id: string;
        email: string;
        status: string;
        roles: string[];
        profile?: BackendUserProfile | null;
    };
}

export interface CandidateSignupInput {
    email: string;
    password: string;
}

/** Inscription candidat OTP — champs envoyés au backend */
export interface CandidateRegisterInput {
    email: string;
    password: string;
    password_confirm: string;
    first_name?: string;
    last_name?: string;
    national_id?: string;
    phone?: string;
}

export interface CandidateRegisterStartResponse {
    message: string;
    email: string;
}

export interface CandidateVerifyEmailInput {
    email: string;
    code: string;
}

export interface CandidateResendCodeInput {
    email: string;
}

export interface CandidateResendCodeResponse {
    message: string;
}

export interface ProviderRegistrationInput {
    contactName: string;
    jobTitle: string;
    companyName: string;
    email: string;
    phone: string;
    website?: string;
    companySize: string;
    hiringNeeds: string;
}

export interface AuthMessageResponse {
    message: string;
}

export interface ProviderRegistrationResponse extends AuthMessageResponse {
    request_id: string;
}
