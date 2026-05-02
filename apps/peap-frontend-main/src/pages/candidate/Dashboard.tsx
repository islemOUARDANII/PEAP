import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, FileText, FileUp, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { StatCard } from "@/components/common/StatCard";
import { StatusPill, statusToTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { gatewayApi, inferCandidateDisplayName, inferCandidateLocation, inferSkillLabel } from "@/services/api/gateway";

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
};

export default function CandidateDashboard() {
  const bundleQuery = useQuery({
    queryKey: ["candidate", "bundle"],
    queryFn: () => gatewayApi.candidate.getBundle(),
  });

  const offersQuery = useQuery({
    queryKey: ["search", "offers", "candidate-dashboard"],
    queryFn: () => gatewayApi.search.offers({ query: "", size: 4 }),
    staleTime: 30_000,
  });

  const bundle = bundleQuery.data;
  const offers = offersQuery.data?.results ?? [];

  const profileCompletion = useMemo(() => {
    if (!bundle) {
      return 0;
    }

    const checkpoints = [
      Boolean(bundle.identity),
      Boolean(bundle.contact),
      bundle.skills.length > 0,
      bundle.languages.length > 0,
      bundle.education.length > 0,
      bundle.experience.length > 0,
      Boolean(bundle.currentCv),
    ];

    const completed = checkpoints.filter(Boolean).length;
    return Math.round((completed / checkpoints.length) * 100);
  }, [bundle]);

  const displayName = bundle ? inferCandidateDisplayName(bundle) : "Candidate";
  const firstName = displayName.split(" ")[0] || displayName;
  const displayLocation = bundle ? inferCandidateLocation(bundle) : "";
  const topSkills = bundle?.skills.map(inferSkillLabel) ?? [];
  const averageScore =
    offers.length > 0
      ? Math.round(
          offers.reduce((total, item) => total + (item.score <= 1 ? item.score * 100 : item.score), 0) /
            offers.length,
        )
      : 0;

  if (bundleQuery.isLoading) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        Loading candidate dashboard...
      </div>
    );
  }

  if (bundleQuery.isError) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        {bundleQuery.error instanceof Error
          ? bundleQuery.error.message
          : "Unable to load the candidate dashboard."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your candidate profile, CV parsing status, and indexed offers are now loaded from the real API Gateway."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/candidate/upload-cv">
                <FileUp className="h-4 w-4" />
                Manage CV
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/candidate/profile">Open profile</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Profile completion" value={`${profileCompletion}%`} icon={FileText} />
        <StatCard label="CV records" value={bundle?.cvRecords.length ?? 0} icon={FileUp} />
        <StatCard label="Indexed offers" value={offersQuery.data?.total ?? 0} icon={Briefcase} />
        <StatCard label="Average offer score" value={`${averageScore}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Top indexed offers</h2>
              <p className="text-xs text-muted-foreground">
                Powered by <code>/search/offers</code> through the API Gateway.
              </p>
            </div>
            <Link to="/candidate/offers" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {offersQuery.isError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive-soft p-4 text-sm text-destructive">
              {offersQuery.error instanceof Error
                ? offersQuery.error.message
                : "Unable to load indexed offers."}
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              No indexed results. Try syncing the search index first.
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => {
                const normalizedScore = offer.score <= 1 ? Math.round(offer.score * 100) : Math.round(offer.score);
                return (
                  <Link
                    key={offer.offerId}
                    to={`/candidate/offers/${offer.offerId}`}
                    className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:border-accent/40 hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{offer.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[offer.location, offer.contractType, offer.workMode].filter(Boolean).join(" • ")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {offer.skills.slice(0, 5).map((skill) => (
                            <SkillTag key={skill} label={skill} variant="matched" />
                          ))}
                        </div>
                      </div>
                      <ScoreBadge score={normalizedScore} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Current profile snapshot</h2>
            <div className="mt-4 grid gap-3">
              <Info label="Candidate" value={displayName} />
              <Info label="Location" value={displayLocation || "Location not specified"} />
              <Info label="Primary language" value={bundle?.primaryLanguage ?? "Not specified"} />
              <Info label="Current CV parsing status" value={bundle?.currentCv?.parsingStatus ?? "No current CV"} />
              <Info label="Last upload" value={formatDate(bundle?.currentCv?.uploadedAt)} />
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Detected skills</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {topSkills.length > 0 ? (
                topSkills.slice(0, 16).map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)
              ) : (
                <p className="text-sm text-muted-foreground">
                  No skills stored yet. Upload and parse a CV or add skills from the profile page.
                </p>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Recent CV activity</h2>
            <div className="mt-4 space-y-3">
              {(bundle?.cvRecords ?? []).slice(0, 4).map((record) => (
                <div key={record.id} className="rounded-md bg-surface-muted p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {record.originalFilename ?? record.blobName}
                    </p>
                    <StatusPill label={record.parsingStatus} tone={statusToTone(record.parsingStatus)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uploaded {formatDate(record.uploadedAt)}
                  </p>
                </div>
              ))}
              {(bundle?.cvRecords ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No CV activity yet. Use the CV page to upload your first file.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
