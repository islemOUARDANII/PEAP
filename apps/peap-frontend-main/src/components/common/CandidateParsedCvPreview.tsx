import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Code2,
  GraduationCap,
  Languages,
  Link2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";

import { mockParsedCv } from "@/mocks/mockParsedCv";
import { SkillTag } from "@/components/common/SkillTag";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDemoCvFileSize, useDemoCvUploadSession } from "@/services/candidate/demoCvSession";

interface CandidateParsedCvPreviewProps {
  className?: string;
}

interface CvSectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

function CvSection({ title, icon: Icon, children }: CvSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

const toLinkedinHref = (value: string) => (value.startsWith("http") ? value : `https://${value}`);

export function CandidateParsedCvPreview({ className }: CandidateParsedCvPreviewProps) {
  const session = useDemoCvUploadSession();

  return (
    <article className={cn("panel-elevated overflow-hidden", className)}>
      <div className="border-b border-border bg-gradient-to-br from-primary/[0.06] via-background to-accent-soft/50 px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Candidate profile</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {mockParsedCv.personal_info.full_name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {mockParsedCv.summary}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/90 p-4 shadow-sm lg:max-w-xs">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Uploaded document</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {session?.fileName ?? "Uploaded CV"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {session ? formatDemoCvFileSize(session.fileSize) : "CV document"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Location</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <MapPin className="h-4 w-4 text-accent" />
              {mockParsedCv.personal_info.location}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Email</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <Mail className="h-4 w-4 text-accent" />
              {mockParsedCv.personal_info.email}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <Phone className="h-4 w-4 text-accent" />
              {mockParsedCv.personal_info.phone}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">LinkedIn</p>
            <a
              href={toLinkedinHref(mockParsedCv.personal_info.linkedin)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-2 text-sm text-foreground transition-colors hover:text-accent"
            >
              <Link2 className="h-4 w-4 text-accent" />
              {mockParsedCv.personal_info.linkedin}
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6 py-7 sm:px-8">
        <CvSection title="Personal Information" icon={UserRound}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Full name</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{mockParsedCv.personal_info.full_name}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Location</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{mockParsedCv.personal_info.location}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Email</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{mockParsedCv.personal_info.email}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{mockParsedCv.personal_info.phone}</p>
            </div>
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Summary / Profile" icon={Sparkles}>
          <div className="rounded-2xl border border-border bg-surface-muted/40 p-5">
            <p className="text-sm leading-7 text-foreground">{mockParsedCv.summary}</p>
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Education" icon={GraduationCap}>
          <div className="space-y-4">
            {mockParsedCv.education.map((item) => (
              <article key={`${item.degree}-${item.institution}`} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">{item.degree}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{item.institution}</p>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {item.start_date} - {item.end_date}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Professional Experiences" icon={Briefcase}>
          <div className="space-y-4">
            {mockParsedCv.job_experiences.map((item) => (
              <article key={`${item.title}-${item.company}`} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{item.company}</p>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {item.start_date} - {item.end_date}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Internship Experiences" icon={Briefcase}>
          <div className="space-y-4">
            {mockParsedCv.internship_experiences.map((item) => (
              <article key={`${item.title}-${item.company}`} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{item.company}</p>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {item.start_date} - {item.end_date}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Skills" icon={Wrench}>
          <div className="rounded-2xl border border-border bg-surface-muted/40 p-5">
            <div className="flex flex-wrap gap-2">
              {mockParsedCv.skills.map((skill) => (
                <SkillTag key={skill} label={skill} className="rounded-full px-3 py-1 text-sm" />
              ))}
            </div>
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Coding Skills" icon={Code2}>
          <div className="rounded-2xl border border-border bg-surface-muted/40 p-5">
            <div className="flex flex-wrap gap-2">
              {mockParsedCv.coding_skills.map((skill) => (
                <SkillTag key={skill} label={skill} variant="matched" className="rounded-full px-3 py-1 text-sm" />
              ))}
            </div>
          </div>
        </CvSection>

        <Separator />

        <CvSection title="Languages / Certifications" icon={Languages}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Languages className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Languages</p>
              </div>
              <div className="space-y-3">
                {mockParsedCv.languages.map((language) => (
                  <div
                    key={language}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/40 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">{language}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluent</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Languages className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Certifications</p>
              </div>
              <div className="space-y-3">
                {mockParsedCv.certifications.map((item) => (
                  <div
                    key={`${item.name}-${item.issuer}`}
                    className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.year}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.issuer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CvSection>
      </div>
    </article>
  );
}
