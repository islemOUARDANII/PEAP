import { PageHeader } from "@/components/common/PageHeader";
import { CandidateOnboardingEmptyState } from "@/components/common/CandidateOnboardingEmptyState";
import { RecommendationsSkeleton } from "@/components/common/PageSkeletons";
import { SkillTag } from "@/components/common/SkillTag";
import { isMissingCandidateProfileError } from "@/services/api/errors";
import { useCandidateRecommendationsQuery } from "@/services/api/queries";
import { GraduationCap, Briefcase, Sparkles, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Recommendations() {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useCandidateRecommendationsQuery();

  if (isLoading) {
    return <RecommendationsSkeleton />;
  }

  if (isError) {
    if (isMissingCandidateProfileError(error)) {
      return <CandidateOnboardingEmptyState />;
    }

    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load learning paths: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  const trainings = data?.trainings ?? [];
  const relatedRoles = data?.relatedRoles ?? [];
  const skillsToImprove = data?.skillsToImprove ?? [];
  const learningPath = data?.learningPath ?? [];
  const actions = data?.actions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Paths"
        description="Training options and skill upgrades from recommendation and gap-analysis data."
      />

      {data?.limited && (
        <div className="panel p-4 text-sm text-muted-foreground">
          {data.limitedReason || "Learning path data is limited for this candidate."}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Available trainings</h2>
          </div>
          <div className="divide-y divide-border">
            {trainings.map((training) => (
              <div key={training.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{training.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{training.provider} - <Clock className="inline h-3 w-3" /> {training.duration} - {training.level}</p>
                </div>
                <span className="shrink-0 inline-flex h-7 items-center rounded-md bg-accent-soft px-2 text-xs font-mono font-medium text-accent">
                  {training.relevance}%
                </span>
              </div>
            ))}
            {trainings.length === 0 && <p className="text-xs text-muted-foreground">No training rows are available yet.</p>}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Related roles to explore</h2>
          </div>
          <div className="divide-y divide-border">
            {relatedRoles.map((job) => (
              <Link key={job.id} to={`/candidate/matches/${job.id}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-surface-muted -mx-2 px-2 rounded-md">
                <div>
                  <p className="text-sm font-medium text-foreground">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.company} - {job.location}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            {relatedRoles.length === 0 && <p className="text-xs text-muted-foreground">No related matched roles are available yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Skills to improve</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Derived from gap analysis and unmatched offer requirements.</p>
          <div className="flex flex-wrap gap-1.5">
            {skillsToImprove.map((skill) => <SkillTag key={skill} label={`+ ${skill}`} variant="outline" />)}
            {skillsToImprove.length === 0 && <p className="text-xs text-muted-foreground">No skill gaps are available yet.</p>}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Improvement actions</h2>
          <div className="space-y-2">
            {actions.map((action) => (
              <div key={action.id} className="rounded-md bg-surface-muted p-3 text-xs text-foreground">
                {action.reason}
              </div>
            ))}
            {actions.length === 0 && <p className="text-xs text-muted-foreground">No action rows are available yet.</p>}
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Suggested learning path</h2>
        <p className="text-xs text-muted-foreground mb-5">Built from available training rows.</p>
        <ol className="relative">
          {learningPath.map((step, index) => (
            <li key={step.id} className="flex gap-4 pb-5 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">{index + 1}</span>
                {index < learningPath.length - 1 && <span className="flex-1 w-px bg-border mt-1" />}
              </div>
              <div className="pb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{step.period}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
              {index === 0 && <span className="ml-auto self-start inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Available</span>}
            </li>
          ))}
          {learningPath.length === 0 && <p className="text-xs text-muted-foreground">No learning path can be built until training data is available.</p>}
        </ol>
      </div>
    </div>
  );
}
