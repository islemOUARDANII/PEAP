// ─── Canonical API types (match the /taxonomy/* endpoints exactly) ────────────

export interface TaxonomyModel {
  id: string;
  code: string;
  label: string;
  version: string | null;
  source: string | null;
  is_active: boolean;
  is_default: boolean;
  released_at: string | null;
  imported_at: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface TaxonomySummary {
  total_models: number;
  active_models: number;
  total_nodes: number;
  active_nodes: number;
  total_aliases: number;
  total_relations: number;
  total_crosswalks: number;
}

export interface TaxonomyNode {
  id: string;
  model_id: string;
  parent_id: string | null;
  external_code: string | null;
  external_uri: string | null;
  node_type: string;
  preferred_label: string;
  normalized_label: string | null;
  description: string | null;
  language_code: string | null;
  active: boolean;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TaxonomyNodeListResponse {
  total: number;
  items: TaxonomyNode[];
}

export interface TaxonomyAlias {
  id: string;
  node_id: string;
  alias: string;
  normalized_alias: string | null;
  language_code: string | null;
  source: string | null;
  confidence: number | null;
  active: boolean;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface TaxonomyRelation {
  id: string;
  model_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type: string;
  weight: number | null;
  confidence: number | null;
  active: boolean;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface TaxonomyCrosswalkReviewItem {
  id: string;
  import_batch_id: string | null;
  source_node_id: string;
  target_node_id: string;
  mapping_type: string | null;
  confidence: number | null;
  method: string | null;
  validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TaxonomyCrosswalkListResponse {
  total: number;
  items: TaxonomyCrosswalkReviewItem[];
}

export interface CrosswalkValidatePayload {
  mapping_type?: string;
  confidence?: number;
  note?: string;
}

export interface CrosswalkRejectPayload {
  reason: string;
}

// ─── Legacy types kept for models/index.ts re-export compatibility ────────────
// These are no longer produced by the canonical API hooks but remain so that
// the barrel export in index.ts (which is not in scope to modify) keeps compiling.

export type TaxonomyType =
  | "Occupation"
  | "Skill"
  | "Technology"
  | "Tool"
  | "Knowledge"
  | "Ability"
  | "Work Activity"
  | "Task";

export interface TaxonomySummaryMetrics {
  total_nodes: number;
  total_labels: number;
  total_aliases: number;
  total_relations: number;
  unresolved_codes: number;
  taxonomy_models: number;
}

export interface TaxonomyLabel {
  id: string;
  lang: string;
  label: string;
  description?: string | null;
  label_type?: string;
  is_preferred?: boolean;
  source?: string | null;
}

export interface TaxonomyNodeDetail {
  node: TaxonomyNode;
  labels: TaxonomyLabel[];
  aliases: TaxonomyAlias[];
  relations: TaxonomyRelation[];
}

export interface UnresolvedCode {
  id: string;
  code: string;
  context: string;
  aggregate_type: string;
  aggregate_id: string;
  user_suggestion: string | null;
  created_at: string;
  created_by: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}
