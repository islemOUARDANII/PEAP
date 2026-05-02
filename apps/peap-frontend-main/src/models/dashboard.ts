import type { ActivityTimelineItem, DistributionPoint, MatchingActivityPoint, PipelineStatusPoint, ScoreDistributionPoint } from "./analytics";
import type { Candidate } from "./candidate";
import type { Job } from "./job";

export interface CandidateDashboardData {
  profileName: string;
  openOffers: number;
  profileCompletion: number;
  profileSections: Array<{ label: string; value: number }>;
  matchedJobs: number;
  averageMatchScore: number;
  recommendationCount: number;
  topMatches: Job[];
  matchingActivity: MatchingActivityPoint[];
  detectedSkills: string[];
  missingSkills: string[];
  activityTimeline: ActivityTimelineItem[];
  pipelineStatus: CandidatePipelineStatus;
}

export interface CandidateRecommendationsData {
  trainings: import("./training").Training[];
  relatedRoles: Job[];
  skillsToImprove: string[];
  actions: Array<{ id: string; reason: string; priority: number; createdAt?: string }>;
  learningPath: Array<{ id: string; period: string; title: string; description: string; status: string }>;
  limited?: boolean;
  limitedReason?: string;
}

export interface CandidatePipelineStep {
  label: string;
  status: "complete" | "pending" | "failed" | string;
  timestamp?: string | null;
}

export interface CandidatePipelineStatus {
  current?: Record<string, unknown> | null;
  lastUploadAt?: string | null;
  steps: CandidatePipelineStep[];
}

export interface ProviderDashboardData {
  activeOffers: Job[];
  topOffers: Job[];
  recentCandidates: Candidate[];
  matchingActivity: MatchingActivityPoint[];
  matchedCandidates: number;
  newApplications: number;
  averageMatchQuality: number;
}

export interface AdvisorDashboardStats {
  candidateDocuments: number;
  offerDocuments: number;
  taxonomyNodes: number;
  pipelineRuns: number;
  errorCount: number;
}

export interface AdvisorDashboardData {
  stats: AdvisorDashboardStats;
  matchingActivity: MatchingActivityPoint[];
  taxonomyDistribution: DistributionPoint[];
  pipelineStatuses: PipelineStatusPoint[];
  scoreDistribution: ScoreDistributionPoint[];
  recentWarnings: ActivityTimelineItem[];
}
