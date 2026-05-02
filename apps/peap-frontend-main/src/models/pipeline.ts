export interface PipelineSummaryCards {
  total_pipeline_items: number;
  currently_failed: number;
  parsed: number;
  canonicalized: number;
  search_ready: number;
  recent_events_count: number;
}

export interface PipelineSummary {
  overall: Record<string, number>;
  by_entity_type: Record<string, Record<string, number>>;
  cards: PipelineSummaryCards;
  status_distribution: Array<{ name: string; value: number }>;
  events_over_time: Array<{ name: string; value: number }>;
  failures_by_stage: Array<{ name: string; value: number }>;
  entity_type_distribution: Array<{ name: string; value: number }>;
}

export interface PipelineItem {
  trace_id: string;
  entity_type: string;
  source_id: string;
  status: string;
  current_status?: string;
  error_stage: string | null;
  error_message: string | null;
  canonical_entity_id: string | null;
  ingestion_event_id: string | null;
  parsed_event_id: string | null;
  current_run_id?: string | null;
  source_container?: string | null;
  source_blob_name?: string | null;
  source_blob_url?: string | null;
  source_storage_key?: string | null;
  created_at: string;
  updated_at: string;
  stored_at: string | null;
  parsed_at: string | null;
  canonicalized_at: string | null;
  search_ready_at: string | null;
  failed_at: string | null;
}

export interface PipelineRun extends PipelineItem {
  run_id: string;
}

export interface PipelineItemDetail {
  current: PipelineItem | null;
  history: PipelineRun[];
}
