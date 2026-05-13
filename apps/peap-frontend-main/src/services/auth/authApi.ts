import type {
    AuthMessageResponse,
    AuthSession,
    BackendUserProfile,
    CandidateSignupInput,
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
    if (!localPart) {
        return email;
    }

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

const buildSession = (
    token: string,
    user: BackendCurrentUserResponse,
): AuthSession => {
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
        {
            email: input.email,
            password: input.password,
        },
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

export async function registerCandidate(input: CandidateSignupInput): Promise<AuthMessageResponse> {
    if (appEnv.enableMockFallback) {
        return { message: `Demo account ready for ${input.email}. You can sign in now.` };
    }

    return apiRequest<AuthMessageResponse>(
        "/auth/register/candidate",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: input.email,
                password: input.password,
            }),
        },
        { skipAuth: true },
    );
}

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
