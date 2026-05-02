import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, FileText, GraduationCap, Languages, Mail, MapPin, Phone } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { DetailPageSkeleton } from "@/components/common/PageSkeletons";
import { PdfPreviewDialog } from "@/components/common/PdfPreviewDialog";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { SkillTag } from "@/components/common/SkillTag";
import { useProviderCandidateQuery } from "@/services/api/queries";

export default function CandidateDetails() {
  const { id } = useParams();
  const {
    data: candidate,
    isLoading,
    isError,
    error,
  } = useProviderCandidateQuery(id);

  if (!id) {
    return <div className="panel p-6 text-sm text-destructive">Candidate id is missing from route parameters.</div>;
  }

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load candidate details: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  if (!candidate) {
    return <div className="panel p-6 text-sm text-muted-foreground">No candidate details are available.</div>;
  }

  const offers = candidate.offers ?? [];
  const documents = candidate.documents ?? [];
  const experiences = candidate.experiences ?? [];
  const jobExperiences = candidate.jobExperiences ?? [];
  const internshipExperiences = candidate.internshipExperiences ?? [];
  const codingSkills = candidate.codingSkills ?? [];
  const education = candidate.education ?? [];
  const languages = candidate.languages ?? [];

  return (
    <div className="space-y-6">
      <Link to="/provider/candidates" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
      </Link>

      <PageHeader
        title={candidate.name}
        description={candidate.summary}
        actions={<ScoreBadge score={candidate.score} size="lg" />}
      />

      <div className="panel-elevated p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-semibold">{candidate.initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-mono">{candidate.id}</p>
            <h1 className="text-xl font-semibold text-foreground mt-0.5">{candidate.occupation}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{candidate.location}</span>
              <span>{candidate.experienceYears} years experience</span>
              {candidate.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{candidate.email}</span>}
              {candidate.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{candidate.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Matched provider offers</h2>
            </div>
            <div className="divide-y divide-border">
              {offers.map((offer) => (
                <div key={offer.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{offer.title}</p>
                    <p className="text-xs text-muted-foreground">{offer.company}{offer.rank ? ` - rank ${offer.rank}` : ""}</p>
                  </div>
                  <ScoreBadge score={offer.score} />
                </div>
              ))}
              {offers.length === 0 && <p className="text-xs text-muted-foreground">No scoped provider offer matches were returned.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Candidate CV and documents</h2>
            </div>
            <div className="divide-y divide-border">
              {documents.map((document) => (
                <div key={document.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">{document.docType} - {document.uploadedAt ? document.uploadedAt.slice(0, 10) : "Upload date unavailable"}</p>
                  </div>
                  <PdfPreviewDialog document={document} />
                </div>
              ))}
              {documents.length === 0 && <p className="text-xs text-muted-foreground">No linked CV documents are available for this candidate.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Parsed experience</h2>
            <div className="space-y-5">
              <div>
                <p className="stat-label mb-3">Professional experience</p>
                <div className="space-y-3">
                  {jobExperiences.map((experience, index) => (
                    <div key={`${experience.role}-${experience.years}-${index}`} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary"><Briefcase className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{experience.role}</p>
                        <p className="text-xs text-muted-foreground">{experience.company}</p>
                        <p className="text-xs text-muted-foreground mt-1">{experience.years || "Dates not specified"}</p>
                        <p className="text-xs text-foreground mt-1.5 leading-relaxed">{experience.description}</p>
                      </div>
                    </div>
                  ))}
                  {jobExperiences.length === 0 && <p className="text-xs text-muted-foreground">No professional experience rows were extracted.</p>}
                </div>
              </div>

              <div>
                <p className="stat-label mb-3">Internships</p>
                <div className="space-y-3">
                  {internshipExperiences.map((experience, index) => (
                    <div key={`${experience.role}-${experience.years}-${index}`} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary"><Briefcase className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{experience.role}</p>
                        <p className="text-xs text-muted-foreground">{experience.company}</p>
                        <p className="text-xs text-muted-foreground mt-1">{experience.years || "Dates not specified"}</p>
                        <p className="text-xs text-foreground mt-1.5 leading-relaxed">{experience.description}</p>
                      </div>
                    </div>
                  ))}
                  {internshipExperiences.length === 0 && <p className="text-xs text-muted-foreground">No internship rows were extracted.</p>}
                </div>
              </div>

              {jobExperiences.length === 0 && internshipExperiences.length === 0 && experiences.length > 0 && (
                <div>
                  <p className="stat-label mb-3">Legacy experience</p>
                  <div className="space-y-3">
                    {experiences.map((experience, index) => (
                      <div key={`${experience.role}-${experience.years}-${index}`} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary"><Briefcase className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{experience.role}</p>
                          <p className="text-xs text-muted-foreground">{experience.company}</p>
                          <p className="text-xs text-muted-foreground mt-1">{experience.years || "Dates not specified"}</p>
                          <p className="text-xs text-foreground mt-1.5 leading-relaxed">{experience.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {jobExperiences.length === 0 && internshipExperiences.length === 0 && experiences.length === 0 && (
                <p className="text-xs text-muted-foreground">No experience rows were extracted.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="stat-label mb-3">Coding skills</p>
            <div className="flex flex-wrap gap-1.5">
              {codingSkills.map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)}
              {codingSkills.length === 0 && <p className="text-xs text-muted-foreground">No coding skills were identified for this profile.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <p className="stat-label mb-3">Top skills</p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.topSkills.map((skill) => <SkillTag key={skill} label={skill} variant="matched" />)}
              {candidate.topSkills.length === 0 && <p className="text-xs text-muted-foreground">No skill labels available.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <p className="stat-label mb-3 flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-accent" /> Education</p>
            <div className="space-y-3">
              {education.map((item, index) => (
                <div key={`${item.degree}-${index}`}>
                  <p className="text-sm font-medium text-foreground">{item.degree}</p>
                  <p className="text-xs text-muted-foreground">{item.school} {item.years ? `- ${item.years}` : ""}</p>
                </div>
              ))}
              {education.length === 0 && <p className="text-xs text-muted-foreground">No education rows were extracted.</p>}
            </div>
          </div>

          <div className="panel p-5">
            <p className="stat-label mb-3 flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-accent" /> Languages</p>
            <div className="space-y-2">
              {languages.map((language) => (
                <div key={language.label} className="flex items-center justify-between rounded-md bg-surface-muted p-2 text-xs">
                  <span className="text-foreground">{language.label}</span>
                  <span className="text-muted-foreground">{language.level || "Level not specified"}</span>
                </div>
              ))}
              {languages.length === 0 && <p className="text-xs text-muted-foreground">No language rows were extracted.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
