import { useMemo, useState } from 'react';
import { Briefcase, ChevronDown, Eye, MapPin, Search, UserRound, X } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSearchCandidatesQuery } from '@/services/api/queries';
import type { SearchCandidateResult } from '@/services/api/gateway';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TUNISIA_GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
  'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
  'Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
  'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;

const EDUCATION_LEVELS = [
  { value: 'bac', label: 'Bac' },
  { value: 'bac+2', label: 'Bac+2' },
  { value: 'bachelor', label: 'Licence (Bac+3)' },
  { value: 'master', label: 'Master (Bac+5)' },
  { value: 'engineer', label: 'Ingénieur' },
  { value: 'phd', label: 'Doctorat' },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: 'debutant', label: 'Débutant (0–2 ans)', years: 0 },
  { value: 'intermediaire', label: 'Intermédiaire (3–5 ans)', years: 3 },
  { value: 'senior', label: 'Sénior (5+ ans)', years: 5 },
] as const;

type ExperienceValue = 'debutant' | 'intermediaire' | 'senior' | '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRawString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function candidateName(c: SearchCandidateResult) {
  return (
    getRawString(c.raw, ['name', 'full_name', 'candidate_name', 'display_name']) ??
    `Candidat ${c.candidateId.slice(0, 8)}`
  );
}

function candidateOccupation(c: SearchCandidateResult) {
  return (
    getRawString(c.raw, ['occupation', 'job_title', 'headline', 'target_occupation', 'current_position']) ??
    'Profil candidat'
  );
}

function normalizeScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

// ---------------------------------------------------------------------------
// FilterSection
// ---------------------------------------------------------------------------

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-foreground"
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="mt-2.5 space-y-0.5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RadioItem
// ---------------------------------------------------------------------------

function RadioItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-surface-muted',
        selected && 'text-accent',
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-accent bg-accent' : 'border-border',
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CandidateDialog
// ---------------------------------------------------------------------------

function CandidateDialog({
  candidate,
  onClose,
}: {
  candidate: SearchCandidateResult | null;
  onClose: () => void;
}) {
  if (!candidate) return null;
  const name = candidateName(candidate);
  const occupation = candidateOccupation(candidate);
  const score = normalizeScore(candidate.score);

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{occupation}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="mt-1 text-xl font-semibold">{score}%</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Expérience</p>
              <p className="mt-1 text-xl font-semibold">{candidate.yearsExperience} ans</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Langue</p>
              <p className="mt-1 text-sm font-semibold">{candidate.primaryLang || '—'}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-border p-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Localisation</p>
                <p className="text-sm font-medium">{candidate.location || 'Non précisée'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-border p-3">
              <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Formation</p>
                <p className="text-sm font-medium">{candidate.education || 'Non précisée'}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Compétences</p>
            {candidate.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune compétence disponible.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-border px-3 py-1 text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">ID candidat</p>
            <p className="mt-1 break-all font-mono text-xs">{candidate.candidateId}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdvisorSearchCandidates() {
  const [textDraft, setTextDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [skillDraft, setSkillDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [education, setEducation] = useState('');
  const [experienceRange, setExperienceRange] = useState<ExperienceValue>('');
  const [govSearch, setGovSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<SearchCandidateResult | null>(null);

  const yearsExperience = experienceRange
    ? EXPERIENCE_OPTIONS.find((o) => o.value === experienceRange)?.years
    : undefined;

  const candidatesQuery = useSearchCandidatesQuery({
    filters: {
      query: appliedQuery || undefined,
      skills: skills.length > 0 ? skills : undefined,
      location: location || undefined,
      education: education || undefined,
      years_experience: yearsExperience,
      size: 50,
    },
  });

  const candidates = useMemo(
    () => candidatesQuery.data?.results ?? [],
    [candidatesQuery.data?.results],
  );

  const hasFilters = Boolean(skills.length || location || education || experienceRange);

  function clearFilters() {
    setSkills([]);
    setLocation('');
    setEducation('');
    setExperienceRange('');
  }

  function addSkill() {
    const s = skillDraft.trim();
    if (s && !skills.includes(s)) setSkills((prev) => [...prev, s]);
    setSkillDraft('');
  }

  const filteredGovs = TUNISIA_GOVERNORATES.filter((g) =>
    g.toLowerCase().includes(govSearch.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recherche candidats"
        description="Rechercher les candidats indexés dans le moteur de recherche."
      />

      {/* ── Top search bar ── */}
      <form
        className="panel flex items-center gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQuery(textDraft.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder="Nom, compétence, métier, localisation..."
            className="pl-9 bg-primary input-search"
          />
        </div>
        {appliedQuery && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setTextDraft(''); setAppliedQuery(''); }}
          >
            <X className="h-3.5 w-3.5" />
            Effacer
          </button>
        )}
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Rechercher
        </Button>
      </form>

      {/* ── Main layout: sidebar + results ── */}
      <div className="flex items-start gap-5">

        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filtres
              </p>
              {hasFilters && (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={clearFilters}
                >
                  Effacer tout
                </button>
              )}
            </div>

            {/* Compétences */}
            <FilterSection title="Compétences" defaultOpen={false}>
              <div className="flex gap-1.5">
                <Input
                  placeholder="ex. Python..."
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  className="h-7 text-xs"
                />
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addSkill}>
                  +
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                    >
                      {s}
                      <button
                        onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                        className="rounded-full p-0.5 hover:bg-accent/20"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </FilterSection>

            {/* Localisation */}
            <FilterSection title="Localisation" defaultOpen={false}>
              <Input
                placeholder="Rechercher..."
                value={govSearch}
                onChange={(e) => setGovSearch(e.target.value)}
                className="mb-2 h-7 text-xs"
              />
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {filteredGovs.map((g) => (
                  <RadioItem
                    key={g}
                    label={g}
                    selected={location === g}
                    onClick={() => setLocation(location === g ? '' : g)}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Niveau d'étude */}
            <FilterSection title="Niveau d'étude" defaultOpen={false}>
              {EDUCATION_LEVELS.map((opt) => (
                <RadioItem
                  key={opt.value}
                  label={opt.label}
                  selected={education === opt.value}
                  onClick={() => setEducation(education === opt.value ? '' : opt.value)}
                />
              ))}
            </FilterSection>

            {/* Expérience */}
            <FilterSection title="Expérience" defaultOpen={false}>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <RadioItem
                  key={opt.value}
                  label={opt.label}
                  selected={experienceRange === opt.value}
                  onClick={() =>
                    setExperienceRange(experienceRange === opt.value ? '' : opt.value)
                  }
                />
              ))}
            </FilterSection>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {candidates.length}
            </span>{' '}
            candidat(s) trouvé(s)
          </p>

          {candidatesQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Chargement des candidats...
            </div>
          ) : candidatesQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {candidatesQuery.error instanceof Error
                ? candidatesQuery.error.message
                : 'Impossible de charger les candidats.'}
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Aucun candidat trouvé.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {candidates.map((candidate) => {
                const name = candidateName(candidate);
                const occupation = candidateOccupation(candidate);
                const score = normalizeScore(candidate.score);
                return (
                  <article key={candidate.candidateId} className="panel flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                          <UserRound className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold leading-tight text-foreground">
                            {name}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{occupation}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => setSelectedCandidate(candidate)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <div className="rounded-lg bg-surface-muted p-2">
                        <p className="text-muted-foreground">Score</p>
                        <p className="font-semibold">{score}%</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted p-2">
                        <p className="text-muted-foreground">Exp.</p>
                        <p className="font-semibold">{candidate.yearsExperience} ans</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted p-2">
                        <p className="text-muted-foreground">Langue</p>
                        <p className="font-semibold">{candidate.primaryLang || '—'}</p>
                      </div>
                    </div>

                    {/* Location */}
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {candidate.location || 'Localisation non précisée'}
                    </p>

                    {/* Education */}
                    {candidate.education && (
                      <p className="text-xs text-muted-foreground">
                        🎓 {candidate.education}
                      </p>
                    )}

                    {/* Skills */}
                    {candidate.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{candidate.skills.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CandidateDialog
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
}
