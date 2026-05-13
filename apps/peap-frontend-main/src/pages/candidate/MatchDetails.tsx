import { PageHeader } from "@/components/common/PageHeader";
import { CandidateOnboardingEmptyState } from "@/components/common/CandidateOnboardingEmptyState";
import { DetailPageSkeleton } from "@/components/common/PageSkeletons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { Progress } from "@/components/ui/progress";
import { isMissingCandidateProfileError } from "@/services/api/errors";
import { useCandidateMatchQuery } from "@/services/api/queries";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

export default function MatchDetails() {
  const { id } = useParams();
  const {
    data: job,
    isLoading,
    isError,
    error,
  } = useCandidateMatchQuery(id);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (isError) {
    if (isMissingCandidateProfileError(error)) {
      return <CandidateOnboardingEmptyState />;
    }

    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load match details: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  if (!job) {
    return <div className="panel p-6 text-sm text-muted-foreground">No match details are available.</div>;
  }

  const breakdown = job.scoreBreakdown?.length
    ? job.scoreBreakdown.map((item) => ({ label: item.label, value: item.score }))
    : [
        { label: "Overall match score", value: job.score ?? 0 },
        {
          label: "Skill coverage",
          value: Math.round(((job.matchedSkills?.length ?? 0) / Math.max(1, (job.required.length + job.preferred.length))) * 100),
        },
      ];
  const missingSkills = job.missingSkills ?? [];
  const matchedSkills = job.matchedSkills ?? [];

  return (
    <div className="space-y-6">
      <Link to="/candidate/matches" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matches
      </Link>

      <div className="panel-elevated p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-muted text-primary text-sm font-semibold">
              {job.company.split(" ").map((segment) => segment[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{job.company} - <span className="font-mono">{job.id}</span></p>
              <h1 className="text-xl font-semibold text-foreground mt-0.5">{job.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                <span>-</span><span>{job.contract}</span>
                <span>-</span><span>{job.level}</span>
                <span>-</span><span>Posted {job.postedDays}d ago</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ScoreBadge score={job.score ?? 0} size="lg" />
          </div>
        </div>
      </div>

      <PageHeader
        title="Match evidence"
        description="Scores, requirements and gaps are loaded from canonical match results."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Score breakdown</h2>
            <div className="space-y-3">
              {breakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-foreground">{item.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Why this match</h2>
            <p className="text-xs text-muted-foreground mb-3">Generated from your profile and the offer requirements.</p>
            <div className="space-y-2.5 text-sm text-foreground leading-relaxed">
              <p>
                This offer has an overall match score of <span className="font-medium">{job.score ?? 0}%</span>.
                {matchedSkills.length > 0 && <> The strongest overlaps are <span className="font-medium">{matchedSkills.slice(0, 4).join(", ")}</span>.</>}
              </p>
              {missingSkills.length > 0 ? (
                <p>Missing or improvement areas found for this offer: <span className="font-medium">{missingSkills.slice(0, 5).join(", ")}</span>.</p>
              ) : (
                <p>No missing skill labels are available for this match.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="panel p-5">
              <p className="stat-label mb-3">Matched skills</p>
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)}
                {matchedSkills.length === 0 && <p className="text-xs text-muted-foreground">No matched skill labels available.</p>}
              </div>
            </div>
            <div className="panel p-5">
              <p className="stat-label mb-3">Missing skills</p>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((skill) => <SkillTag key={skill} label={skill} variant="missing" />)}
                {missingSkills.length === 0 && <p className="text-xs text-muted-foreground">No missing skill labels available.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Required skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {job.required.map((skill) => <SkillTag key={skill} label={skill} />)}
              {job.required.length === 0 && <p className="text-xs text-muted-foreground">No required skill labels available.</p>}
            </div>
            <h3 className="stat-label mt-5 mb-2">Preferred</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.preferred.map((skill) => <SkillTag key={skill} label={skill} variant="outline" />)}
              {job.preferred.length === 0 && <p className="text-xs text-muted-foreground">No preferred skill labels available.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Skill improvements</h2>
            </div>
            <div className="space-y-2 text-xs text-foreground">
              {missingSkills.slice(0, 3).map((skill) => (
                <div key={skill} className="p-2.5 rounded-md bg-accent-soft border border-accent/20">
                  Improve {skill} to strengthen this match.
                </div>
              ))}
              {missingSkills.length === 0 && <p className="text-xs text-muted-foreground">No gap-driven learning actions are available for this match.</p>}
              <Link to="/candidate/offers" className="inline-flex items-center text-accent font-medium hover:underline">
                Compare with smart offers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
