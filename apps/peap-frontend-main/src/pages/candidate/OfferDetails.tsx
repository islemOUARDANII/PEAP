import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { gatewayApi } from "@/services/api/gateway";

const normalizeScore = (value: number): number => (value <= 1 ? Math.round(value * 100) : Math.round(value));

export default function CandidateOfferDetails() {
  const { id } = useParams<{ id: string }>();

  const offerQuery = useQuery({
    queryKey: ["search", "offers", "detail", id],
    queryFn: () => gatewayApi.search.offerDetail(id as string),
    enabled: Boolean(id),
  });

  if (!id) {
    return <div className="panel p-6 text-sm text-destructive">Offer id is missing from the route.</div>;
  }

  if (offerQuery.isLoading) {
    return <div className="panel p-6 text-sm text-muted-foreground">Loading indexed offer details...</div>;
  }

  if (offerQuery.isError || !offerQuery.data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/candidate/offers">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to offers
          </Link>
        </Button>
        <div className="panel p-6 text-sm text-destructive">
          {offerQuery.error instanceof Error
            ? offerQuery.error.message
            : "Unable to load indexed offer details."}
        </div>
      </div>
    );
  }

  const offer = offerQuery.data;
  const score = normalizeScore(offer.score);

  return (
    <div className="space-y-6">
      <PageHeader
        title={offer.title}
        description="Offer detail loaded from `/search/offers/{offer_id}`."
        actions={
          <div className="flex items-center gap-2">
            <ScoreBadge score={score} size="lg" />
            <Button asChild variant="outline" size="sm">
              <Link to="/candidate/offers">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            {offer.status ? <StatusPill label={offer.status} dot={false} /> : null}
            {offer.contractType ? <StatusPill label={offer.contractType} tone="info" dot={false} /> : null}
            {offer.workMode ? <StatusPill label={offer.workMode} tone="accent" dot={false} /> : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Info label="Offer ID" value={offer.offerId} mono />
            <Info label="Score" value={`${score}%`} />
            <Info label="Location" value={offer.location ?? "Location not specified"} />
            <Info label="Created at" value={offer.createdAt ?? "-"} />
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {offer.description || "No indexed description is available for this offer."}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Indexed skills</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {offer.skills.length > 0 ? (
                offer.skills.map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)
              ) : (
                <p className="text-sm text-muted-foreground">No indexed skill labels are available.</p>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Indexed summary</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <Info label="Company reference" value={offer.companyId ?? "Not provided"} />
              <Info label="Search status" value={offer.status ?? "Unknown"} />
              <Info label="Contract type" value={offer.contractType ?? "Not specified"} />
              <Info label="Work mode" value={offer.workMode ?? "Not specified"} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground">Raw indexed payload</h2>
            <pre className="mt-4 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
              {JSON.stringify(offer.raw, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm text-foreground ${mono ? "font-mono break-all" : "font-medium"}`}>
        {value}
      </p>
    </div>
  );
}
