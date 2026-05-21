import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthSession, LoginInput } from "@/models";
import { appEnv } from "@/config/env";
import { clearStoredSession, readStoredSession, writeStoredSession } from "@/services/auth/sessionStorage";
import { apiUnauthorizedEventName } from "@/services/api/client";
import { loginWithBackend, restoreBackendSession } from "@/services/auth/authApi";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
    status: AuthStatus;
    session: AuthSession | null;
    isAuthenticated: boolean;
    login: (input: LoginInput) => Promise<AuthSession>;
    /** Connecte directement avec une session déjà construite (ex: après vérification OTP). */
    loginWithSession: (session: AuthSession) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const inferDemoRole = (email: string): AuthSession["user"]["role"] => {
    const normalized = email.trim().toLowerCase();

    if (
        normalized.includes("provider") ||
        normalized.includes("employer") ||
        normalized.includes("company")
    ) {
        return "provider";
    }

    if (
        normalized.includes("advisor") ||
        normalized.includes("admin") ||
        normalized.includes("functional") ||
        normalized.includes("technical")
    ) {
        return "advisor";
    }

    return "candidate";
};

const displayNameFromEmail = (email: string): string => {
    const [localPart] = email.split("@");
    return localPart
        ? localPart
            .split(/[._-]/g)
            .filter(Boolean)
            .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
            .join(" ")
        : "Demo User";
};

const createDemoSession = (emailInput: string): AuthSession => {
    const email = emailInput.trim().toLowerCase() || "candidate@matchcore.demo";
    const role = inferDemoRole(email);
    const backendRoles =
        email.includes("technical")
            ? ["TECH_ADMIN"]
            : email.includes("functional")
                ? ["FUNCTIONAL_ADMIN"]
                : role === "provider"
                    ? ["EMPLOYER"]
                    : role === "candidate"
                        ? ["JOB_SEEKER"]
                        : ["ADVISOR"];
    return {
        token: `demo-${role}-token`,
        tokenHeader: appEnv.authHeader,
        createdAt: new Date().toISOString(),
        user: {
            email,
            role,
            backendRole: backendRoles[0],
            roles: backendRoles,
            name: displayNameFromEmail(email),
        },
    };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [session, setSession] = useState<AuthSession | null>(null);

    useEffect(() => {
        const storedSession = readStoredSession();
        if (!storedSession) {
            setSession(null);
            setStatus("unauthenticated");
            return;
        }

        if (appEnv.enableMockFallback) {
            setSession(storedSession);
            setStatus("authenticated");
            return;
        }

        const restore = async () => {
            try {
                const restored = await restoreBackendSession(storedSession.token);
                setSession(restored);
                writeStoredSession(restored);
                setStatus("authenticated");
            } catch {
                clearStoredSession();
                setSession(null);
                setStatus("unauthenticated");
            }
        };

        restore();
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => {
            clearStoredSession();
            setSession(null);
            setStatus("unauthenticated");
            queryClient.clear();
        };

        window.addEventListener(apiUnauthorizedEventName, handleUnauthorized);
        return () => {
            window.removeEventListener(apiUnauthorizedEventName, handleUnauthorized);
        };
    }, [queryClient]);

    const login = useCallback(async (input: LoginInput): Promise<AuthSession> => {
        const nextSession = appEnv.enableMockFallback
            ? createDemoSession(input.email)
            : await loginWithBackend(input);

        queryClient.clear();
        setSession(nextSession);
        writeStoredSession(nextSession);
        setStatus("authenticated");
        return nextSession;
    }, [queryClient]);

    const loginWithSession = useCallback((nextSession: AuthSession) => {
        queryClient.clear();
        setSession(nextSession);
        writeStoredSession(nextSession);
        setStatus("authenticated");
    }, [queryClient]);

    const logout = useCallback(() => {
        clearStoredSession();
        setSession(null);
        setStatus("unauthenticated");
        queryClient.clear();
    }, [queryClient]);

    const value = useMemo<AuthContextValue>(
        () => ({
            status,
            session,
            isAuthenticated: status === "authenticated" && !!session,
            login,
            loginWithSession,
            logout,
        }),
        [status, session, login, loginWithSession, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
}
export enum AuthStatusUser {
    Loading = "loading",
    Authenticated = "authenticated",
    Unauthenticated = "unauthenticated"
}
