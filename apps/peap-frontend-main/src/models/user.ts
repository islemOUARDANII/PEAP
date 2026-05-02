export type PlatformUserRole = string;
export type PlatformUserStatus = string;
export type PlatformAccountType = "SSO" | "Email" | "API";

export interface PlatformUser {
  id: string;
  name?: string;
  email: string;
  role: PlatformUserRole;
  status: PlatformUserStatus;
  created: string;
  createdAt: string;
}

export interface ProviderRegistrationRequestRecord {
  id: string;
  contactName: string;
  jobTitle: string;
  companyName: string;
  email: string;
  phone: string;
  website?: string | null;
  companySize: string;
  hiringNeeds: string;
  status: string;
  teamMessageId?: string | null;
  confirmationMessageId?: string | null;
  created: string;
  createdAt: string;
  updatedAt?: string | null;
}
