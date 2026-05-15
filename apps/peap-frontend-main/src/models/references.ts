// ─── Ref Group ────────────────────────────────────────────────────────────────

export interface RefGroup {
  id: string;
  code: string;
  label: string;
  description: string | null;
  domain: string | null;
  active: boolean;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RefGroupListResponse {
  total: number;
  items: RefGroup[];
}

export interface RefGroupCreatePayload {
  code: string;
  label: string;
  description?: string;
  domain?: string;
  active?: boolean;
  metadata_json?: Record<string, unknown>;
}

export interface RefGroupUpdatePayload {
  label?: string;
  description?: string;
  domain?: string;
  active?: boolean;
  metadata_json?: Record<string, unknown>;
}

// ─── Ref Value ────────────────────────────────────────────────────────────────

export interface RefValue {
  id: string;
  group_id: string;
  group_code: string | null;
  code: string;
  label: string;
  normalized_label: string;
  label_fr: string | null;
  label_en: string | null;
  label_ar: string | null;
  sort_order: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  source: string | null;
  external_code: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RefValueListResponse {
  total: number;
  items: RefValue[];
}

export interface RefValueCreatePayload {
  group_id: string;
  code: string;
  label: string;
  label_fr?: string;
  label_en?: string;
  label_ar?: string;
  sort_order?: number;
  active?: boolean;
  valid_from?: string;
  valid_to?: string;
  source?: string;
  external_code?: string;
  metadata_json?: Record<string, unknown>;
}

export interface RefValueUpdatePayload {
  label?: string;
  label_fr?: string;
  label_en?: string;
  label_ar?: string;
  sort_order?: number;
  active?: boolean;
  valid_from?: string;
  valid_to?: string;
  source?: string;
  external_code?: string;
  metadata_json?: Record<string, unknown>;
}
