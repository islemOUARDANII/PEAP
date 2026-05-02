import { Navigate, useLocation } from "react-router-dom";
import type { AuthUser, Role } from "@/models";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "./auth";
import { homePathForRoles } from "@/services/auth/roleMapping";

export const roleHomePath = (role: Role, backendRoles: string[] = []): string => {
    return homePathForRoles(backendRoles, role);
};

export const userHomePath = (user: AuthUser): string => {
    return roleHomePath(user.role, user.roles);
};

export function AuthIndexRedirect() {
    const { status, session } = useAuth();

    if (status === "loading") {
        return <div className="min-h-screen bg-background" />;
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <Navigate to={userHomePath(session.user)} replace />;
}

interface RequireAuthProps {
    allowedRoles?: Role[];
    children: JSX.Element;
}

export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
    const location = useLocation();
    const { status, session } = useAuth();

    if (status === "loading") {
        return (
            <div className="min-h-screen w-full bg-background p-6">
                <div aria-hidden className="mx-auto max-w-3xl panel p-6">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="mt-3 h-4 w-72 max-w-full" />
                </div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
        return <Navigate to={userHomePath(session.user)} replace />;
    }

    return children;
}
