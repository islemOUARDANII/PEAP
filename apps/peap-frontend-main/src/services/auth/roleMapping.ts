import type { Role } from "@/models";

const hasRole = (roles: string[], target: string): boolean =>
  roles.some((role) => role.trim().toUpperCase() === target);

export const normalizeBackendRoles = (roles: unknown): string[] => {
  if (!Array.isArray(roles)) {
    return [];
  }

  return Array.from(
    new Set(
      roles
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
};

export const mapBackendRolesToPortalRole = (roles: string[]): Role => {
  if (hasRole(roles, "JOB_SEEKER")) {
    return "candidate";
  }

  if (hasRole(roles, "EMPLOYER")) {
    return "provider";
  }

  return "advisor";
};

export const homePathForRoles = (roles: string[], fallbackRole?: Role): string => {
  const normalizedRoles = normalizeBackendRoles(roles);
  const role = fallbackRole ?? mapBackendRolesToPortalRole(normalizedRoles);

  if (role === "candidate") {
    return "/candidate";
  }

  if (role === "provider") {
    return "/provider";
  }

  if (hasRole(normalizedRoles, "TECH_ADMIN")) {
    return "/advisor/tech-admin";
  }

  if (hasRole(normalizedRoles, "FUNCTIONAL_ADMIN")) {
    return "/advisor/settings";
  }

  return "/advisor";
};
