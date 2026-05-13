export type Role =
  | 'candidate'
  | 'provider'
  | 'advisor'
  | 'functionalAdmin'
  | 'techAdmin';

export interface RoleOption {
  id: Role;
  label: string;
  description: string;
}

export interface RoleProfile {
  role: Role;
  name: string;
  email: string;
  initials: string;
}
