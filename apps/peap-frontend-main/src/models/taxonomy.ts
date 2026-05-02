export type TaxonomyType =
  | "Occupation"
  | "Skill"
  | "Technology"
  | "Tool"
  | "Knowledge"
  | "Ability"
  | "Work Activity"
  | "Task";

export interface TaxonomyNode {
  id: string;
  code: string;
  label: string;
  type: TaxonomyType;
  aliases?: string[];
  aliasCount?: number;
  relationCount?: number;
  source: "ESCO" | "O*NET" | "Internal";
  related?: string[];
  description: string;
  updated: string;
  domain?: string;
  taxonomyName?: string;
  modelName?: string;
  modelVersion?: string;
  parentCode?: string;
  labelFr?: string;
  labelEn?: string;
  status?: string;
  isLeaf?: boolean;
  isDeprecated?: boolean;
  raw?: Record<string, unknown>;
}

export interface TaxonomySummaryMetrics {
  total_nodes: number;
  total_labels: number;
  total_aliases: number;
  total_relations: number;
  unresolved_codes: number;
  taxonomy_models: number;
}

export interface TaxonomySummary {
  metrics: TaxonomySummaryMetrics;
  node_type_distribution: Array<{ name: string; value: number }>;
  taxonomy_distribution: Array<{ name: string; value: number }>;
  occupation_breakdown: Array<{ name: string; value: number }>;
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

export interface TaxonomyAlias {
  id: string;
  lang: string;
  alias: string;
  alias_type: string;
  source?: string | null;
  is_preferred: boolean;
}

export interface TaxonomyRelation {
  id: string;
  direction: "incoming" | "outgoing";
  relation_type: string;
  src_node_id: string;
  src_code: string;
  src_label: string;
  dst_node_id: string;
  dst_code: string;
  dst_label: string;
  score_forward?: number | string | null;
  score_backward?: number | string | null;
  confidence?: number | string | null;
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
