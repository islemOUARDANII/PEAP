import type {
    AuthMessageResponse,
    AuthSession,
    BackendUserProfile,
    CandidateRegisterInput,
    CandidateRegisterStartResponse,
    CandidateResendCodeResponse,
    CandidateSignupInput,
    CandidateVerifyEmailInput,
    LoginInput,
    LoginResponse,
    ProviderRegistrationInput,
    ProviderRegistrationResponse,
} from "@/models";
import { appEnv } from "@/config/env";
import { apiJsonRequest, apiRequest, ApiServiceError } from "@/services/api/client";
import { mapBackendRolesToPortalRole, normalizeBackendRoles } from "./roleMapping";

const formatDisplayName = (email: string): string => {
    const [localPart] = email.split("@");
    if (!localPart) return email;
    return localPart
        .split(/[._-]/g)
        .filter(Boolean)
        .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
        .join(" ");
};

interface BackendCurrentUserResponse {
    id: string;
    email: string;
    status: string;
    roles: string[];
    profile?: BackendUserProfile | null;
}

const buildSession = (token: string, user: BackendCurrentUserResponse): AuthSession => {
    const roles = normalizeBackendRoles(user.roles);
    const role = mapBackendRolesToPortalRole(roles);
    const name = user.profile?.label?.trim() || formatDisplayName(user.email);
    return {
        token,
        tokenHeader: appEnv.authHeader,
        createdAt: new Date().toISOString(),
        user: {
            id: user.id,
            email: user.email.trim().toLowerCase(),
            role,
            backendRole: roles[0] ?? role.toUpperCase(),
            roles,
            name,
            status: user.status,
            profile: user.profile ?? null,
        },
    };
};

export async function fetchCurrentUser(token: string): Promise<AuthSession> {
    const user = await apiRequest<BackendCurrentUserResponse>(
        "/auth/me",
        { method: "GET" },
        { authToken: token, disable401Redirect: true },
    );
    if (!user?.email || !Array.isArray(user.roles)) {
        throw new ApiServiceError("Session payload is incomplete", 500, user);
    }
    return buildSession(token, user);
}

export async function loginWithBackend(input: LoginInput): Promise<AuthSession> {
    const data = await apiJsonRequest<LoginResponse>(
        "/auth/login",
        "POST",
        { email: input.email, password: input.password },
        { skipAuth: true, disable401Redirect: true },
    );
    if (!data?.access_token) {
        throw new ApiServiceError("Login response is incomplete", 500, data);
    }
    return fetchCurrentUser(data.access_token);
}

export async function restoreBackendSession(token: string): Promise<AuthSession> {
    return fetchCurrentUser(token);
}

// ─── Inscription candidat OTP ─────────────────────────────────────────────────

/**
 * Étape 1 — Démarrer l'inscription : crée le compte et envoie le code OTP.
 */
export async function registerCandidateOtp(
    input: CandidateRegisterInput,
): Promise<CandidateRegisterStartResponse> {
    if (appEnv.enableMockFallback) {
        return {
            message: `Code de vérification envoyé à ${input.email} (mode démo).`,
            email: input.email,
        };
    }
    return apiJsonRequest<CandidateRegisterStartResponse>(
        "/auth/candidate/register/start",
        "POST",
        {
            email: input.email,
            password: input.password,
            password_confirm: input.password_confirm,
            first_name: input.first_name || null,
            last_name: input.last_name || null,
            national_id: input.national_id || null,
            phone: input.phone || null,
        },
        { skipAuth: true },
    );
}

/**
 * Étape 2 — Vérifier le code OTP. Retourne une session authentifiée si succès.
 */
export async function verifyEmailOtp(
    input: CandidateVerifyEmailInput,
): Promise<AuthSession> {
    if (appEnv.enableMockFallback) {
        return buildSession("demo-candidate-token", {
            id: "demo-id",
            email: input.email,
            status: "ACTIVE",
            roles: ["JOB_SEEKER"],
        });
    }
    const data = await apiJsonRequest<LoginResponse>(
        "/auth/candidate/register/verify-email",
        "POST",
        { email: input.email, code: input.code },
        { skipAuth: true, disable401Redirect: true },
    );
    if (!data?.access_token) {
        throw new ApiServiceError("Réponse de vérification incomplète", 500, data);
    }
    return fetchCurrentUser(data.access_token);
}

/**
 * Renvoyer un nouveau code OTP.
 */
export async function resendEmailOtp(email: string): Promise<CandidateResendCodeResponse> {
    if (appEnv.enableMockFallback) {
        return { message: `Nouveau code envoyé à ${email} (mode démo).` };
    }
    return apiJsonRequest<CandidateResendCodeResponse>(
        "/auth/candidate/register/resend-code",
        "POST",
        { email },
        { skipAuth: true },
    );
}

// ─── Compatibilité ancienne API (gardée pour éviter de casser d'autres imports) ──

/** @deprecated Utiliser registerCandidateOtp */
export async function registerCandidate(input: CandidateSignupInput): Promise<AuthMessageResponse> {
    if (appEnv.enableMockFallback) {
        return { message: `Compte démo prêt pour ${input.email}.` };
    }
    return apiRequest<AuthMessageResponse>(
        "/auth/register/candidate",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: input.email, password: input.password }),
        },
        { skipAuth: true },
    );
}

/** @deprecated */
export async function verifyCandidateEmail(token: string): Promise<AuthMessageResponse> {
    if (appEnv.enableMockFallback) {
        return { message: "Demo email verified." };
    }
    return apiRequest<AuthMessageResponse>(
        "/auth/verify-email",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        },
        { skipAuth: true },
    );
}

/** @deprecated */
export async function resendCandidateVerification(email: string): Promise<AuthMessageResponse> {
    if (appEnv.enableMockFallback) {
        return { message: `Demo verification email sent to ${email}.` };
    }
    return apiRequest<AuthMessageResponse>(
        "/auth/resend-verification",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        },
        { skipAuth: true },
    );
}

// ─── Inscription employeur ─────────────────────────────────────────────────────

export async function submitProviderRegistration(
    input: ProviderRegistrationInput,
): Promise<ProviderRegistrationResponse> {
    if (appEnv.enableMockFallback) {
        return {
            message: `Demo provider request submitted for ${input.companyName}.`,
            request_id: `REQ-DEMO-${Date.now()}`,
        };
    }
    return apiRequest<ProviderRegistrationResponse>(
        "/auth/provider-requests",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contact_name: input.contactName,
                job_title: input.jobTitle,
                company_name: input.companyName,
                email: input.email,
                phone: input.phone,
                website: input.website || null,
                company_size: input.companySize,
                hiring_needs: input.hiringNeeds,
            }),
        },
        { skipAuth: true },
    );
}
