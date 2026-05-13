export interface MatchingActivityPoint {
  day: string;
  matches: number;
  applications: number;
}

export interface DistributionPoint {
  name: string;
  value: number;
}

export interface ScoreDistributionPoint {
  bucket: string;
  count: number;
}

export interface PipelineStatusPoint {
  name: string;
  value: number;
}

export interface ActivityTimelineItem {
  id: number | string;
  time: string;
  text: string;
}
