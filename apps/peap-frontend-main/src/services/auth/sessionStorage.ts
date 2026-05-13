import type { AuthSession, AuthUser } from "@/models/auth";
import type { Role } from "@/models/role";
import { appEnv } from "@/config/env";
import { normalizeBackendRoles } from "./roleMapping";

const AUTH_SESSION_STORAGE_KEY = "matchcore.auth.session";
const LEGACY_AUTH_SESSION_STORAGE_KEY = "talentmesh.auth.session";
const VALID_ROLES: Role[] = ["candidate", "provider", "advisor"];

const canUseWindow = (): boolean => typeof window !== "undefined";
const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object";

const isRole = (value: unknown): value is Role =>
    typeof value === "string" && VALID_ROLES.includes(value as Role);

const displayNameFromEmail = (email: string): string => {
    const [localPart] = email.split("@");
    return localPart
        ? localPart
            .split(/[._-]/g)
            .filter(Boolean)
            .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
            .join(" ")
        : email;
};

export function readStoredSession(): AuthSession | null {
    if (!canUseWindow()) {
        return null;
    }

    const raw =
        window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<AuthSession>;
        if (!isRecord(parsed) || !isRecord(parsed.user)) {
            return null;
        }

        const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
        const tokenHeader =
            typeof parsed.tokenHeader === "string" && parsed.tokenHeader.trim()
                ? parsed.tokenHeader.trim()
                : appEnv.authHeader;
        const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : "";
        const user = parsed.user as Partial<AuthUser>;
        const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

        if (!token || !createdAt || !email || !isRole(user.role)) {
            return null;
        }

        return {
            token,
            tokenHeader,
            createdAt,
            user: {
                email,
                role: user.role,
                id: typeof user.id === "string" && user.id.trim() ? user.id.trim() : undefined,
                backendRole:
                    typeof user.backendRole === "string" && user.backendRole.trim()
                        ? user.backendRole.trim()
                        : user.role,
                roles: normalizeBackendRoles(user.roles).length > 0
                    ? normalizeBackendRoles(user.roles)
                    : [user.role.toUpperCase()],
                name:
                    typeof user.name === "string" && user.name.trim()
                        ? user.name.trim()
                        : displayNameFromEmail(email),
                status:
                    typeof user.status === "string" && user.status.trim()
                        ? user.status.trim()
                        : undefined,
                profile:
                    isRecord(user.profile)
                        ? {
                            type:
                                typeof user.profile.type === "string" ? user.profile.type : null,
                            id: typeof user.profile.id === "string" ? user.profile.id : null,
                            label:
                                typeof user.profile.label === "string" ? user.profile.label : null,
                        }
                        : null,
            },
        };
    } catch {
        return null;
    }
}

export function writeStoredSession(session: AuthSession): void {
    if (!canUseWindow()) {
        return;
    }

    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
}

export function clearStoredSession(): void {
    if (!canUseWindow()) {
        return;
    }

    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
}
