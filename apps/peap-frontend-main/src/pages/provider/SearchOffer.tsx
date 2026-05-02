import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import {
  CheckCircle2,
  Download,
  Eye,
  Grid3x3,
  List,
  Mail,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { candidates, jobs, locations, skills } from '@/services/api/mockData';
import SearchCandidateCard from '@/components/common/SearchCandidateCard';
import SearchCandidateRow from '@/components/common/SearchCandidateRow';
import SearchOfferCard from '@/components/common/SearchOfferCard';
import SearchOfferRow from '@/components/common/SearchOfferRow';

const educationLevels = [
  'Bachelor',
  'Master',
  'PhD',
  'Bootcamp',
  'Self-taught',
];
const availabilities = ['Immediate', '1 month', '2-3 months', 'Open'];
const languages = ['English', 'French', 'Spanish', 'German', 'Portuguese'];

function matchTone(score: number) {
  if (score >= 80) return { label: 'Strong', tone: 'success' as const };
  if (score >= 50) return { label: 'Moderate', tone: 'warning' as const };
  return { label: 'Weak', tone: 'destructive' as const };
}

function FiltersPanel({
  query,
  setQuery,
  selSkills,
  toggleSkill,
  minExp,
  setMinExp,
  edu,
  toggleEdu,
  loc,
  setLoc,
  avail,
  toggleAvail,
  langs,
  toggleLang,
  minScore,
  setMinScore,
  onReset,
}: {
  query: string;
  setQuery: (v: string) => void;
  selSkills: string[];
  toggleSkill: (v: string) => void;
  minExp: number;
  setMinExp: (v: number) => void;
  edu: string[];
  toggleEdu: (v: string) => void;
  loc: string;
  setLoc: (v: string) => void;
  avail: string[];
  toggleAvail: (v: string) => void;
  langs: string[];
  toggleLang: (v: string) => void;
  minScore: number;
  setMinScore: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="stat-label">Keyword</Label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, role, skill…"
            className="h-9 pl-9 bg-surface-muted"
          />
        </div>
      </div>

      <div>
        <Label className="stat-label">Skills</Label>
        <div className="mt-2 flex flex-wrap gap-1">
          {skills.slice(0, 14).map((s) => {
            const active = selSkills.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSkill(s)}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-secondary text-secondary-foreground border-border hover:border-accent/40'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="stat-label">Min experience</Label>
          <span className="text-xs font-mono text-foreground">
            {minExp}+ yrs
          </span>
        </div>
        <Slider
          value={[minExp]}
          onValueChange={(v) => setMinExp(v[0])}
          min={0}
          max={15}
          step={1}
          className="mt-3"
        />
      </div>

      <div>
        <Label className="stat-label">Education level</Label>
        <div className="mt-2 flex flex-col gap-1.5">
          {/* {educationLevels.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={edu.includes(e)}
                onCheckedChange={() => toggleEdu(e)}
              />
              {e}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <Label className="stat-label">Location</Label>
        <Select value={loc} onValueChange={setLoc}>
          <SelectTrigger className="h-9 mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="stat-label">Availability</Label>
        <div className="mt-2 flex flex-col gap-1.5">
          {/* {availabilities.map((a) => (
            <label
              key={a}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={avail.includes(a)}
                onCheckedChange={() => toggleAvail(a)}
              />
              {a}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <Label className="stat-label">Languages</Label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {/* {languages.map((l) => (
            <label
              key={l}
              className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
            >
              <Checkbox
                checked={langs.includes(l)}
                onCheckedChange={() => toggleLang(l)}
              />
              {l}
            </label>
          ))} */}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="stat-label">Minimum match</Label>
          <span className="text-xs font-mono text-foreground">{minScore}%</span>
        </div>
        <Slider
          value={[minScore]}
          onValueChange={(v) => setMinScore(v[0])}
          min={0}
          max={100}
          step={5}
          className="mt-3"
        />
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button size="sm" className="flex-1">
          Apply filters
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

export default function SearchOffer() {
  const [query, setQuery] = useState('');
  const [selSkills, setSelSkills] = useState<string[]>([]);
  const [minExp, setMinExp] = useState(0);
  const [edu, setEdu] = useState<string[]>([]);
  const [loc, setLoc] = useState('all');
  const [avail, setAvail] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shortlisted, setShortlisted] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState(jobs[0].id);
  const [sort, setSort] = useState<
    'recherche-semantique' | 'recherche-phrase-exacte'
  >('recherche-semantique');

  const [contract, setContract] = useState<string[]>([]);
  const [level, setLevel] = useState<string[]>([]);
  const [industry, setIndustry] = useState<string[]>([]);
  const [postedWithin, setPostedWithin] = useState('any');
  const [saved, setSaved] = useState<string[]>([]);

  const job = jobs.find((j) => j.id === activeJob)!;
  const required = job.required;

  const toggle =
    (list: string[], setList: (v: string[]) => void) => (v: string) =>
      setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const reset = () => {
    setQuery('');
    setSelSkills([]);
    setMinExp(0);
    setEdu([]);
    setLoc('all');
    setAvail([]);
    setLangs([]);
    setMinScore(0);
  };

  //   const filtered = useMemo(() => {
  //     let list = candidates.filter((c) => {
  //       if (
  //         query &&
  //         !`${c.name} ${c.occupation} ${c.topSkills.join(' ')}`
  //           .toLowerCase()
  //           .includes(query.toLowerCase())
  //       )
  //         return false;
  //       if (loc !== 'all' && c.location !== loc) return false;
  //       if (c.experienceYears < minExp) return false;
  //       if (c.score < minScore) return false;
  //       if (selSkills.length && !selSkills.some((s) => c.topSkills.includes(s)))
  //         return false;
  //       return true;
  //     });
  //     if (sort === 'match') list = list.sort((a, b) => b.score - a.score);
  //     if (sort === 'experience')
  //       list = list.sort((a, b) => b.experienceYears - a.experienceYears);
  //     return list;
  //   }, [query, loc, minExp, minScore, selSkills, sort]);

  //   const filtersProps = {
  //     query,
  //     setQuery,
  //     selSkills,
  //     toggleSkill: toggle(selSkills, setSelSkills),
  //     minExp,
  //     setMinExp,
  //     edu,
  //     toggleEdu: toggle(edu, setEdu),
  //     loc,
  //     setLoc,
  //     avail,
  //     toggleAvail: toggle(avail, setAvail),
  //     langs,
  //     toggleLang: toggle(langs, setLangs),
  //     minScore,
  //     setMinScore,
  //     onReset: reset,
  //   };

  const filtered = useMemo(() => {
    let list = jobs.filter((j) => {
      if (
        query &&
        !`${j.title} ${j.company} ${j.required.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      if (loc === 'remote' && !j.location.toLowerCase().includes('remote'))
        return false;
      if (loc !== 'all' && loc !== 'remote' && j.location !== loc) return false;
      if (contract.length && !contract.includes(j.contract)) return false;
      if (level.length && !level.includes(j.level)) return false;
      if ((j.score ?? 0) < minScore) return false;
      if (postedWithin !== 'any' && j.postedDays > Number(postedWithin))
        return false;
      if (selSkills.length && !selSkills.some((s) => j.required.includes(s)))
        return false;
      return true;
    });
    if (sort === 'match')
      list = list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (sort === 'recent')
      list = list.sort((a, b) => a.postedDays - b.postedDays);
    if (sort === 'salary')
      list = list.sort((a, b) => b.applicants - a.applicants);
    return list;
  }, [
    query,
    loc,
    contract,
    level,
    industry,
    selSkills,
    minScore,
    postedWithin,
    sort,
  ]);

  const filtersProps = {
    query,
    setQuery,
    loc,
    setLoc,
    contract,
    toggleContract: toggle(contract, setContract),
    level,
    toggleLevel: toggle(level, setLevel),
    industry,
    toggleIndustry: toggle(industry, setIndustry),
    selSkills,
    toggleSkill: toggle(selSkills, setSelSkills),
    minScore,
    setMinScore,
    postedWithin,
    setPostedWithin,
    onReset: reset,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find the Right Candidates"
        description="Search candidates and rank them by their match against a selected offer."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={shortlisted.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export shortlist (
            {shortlisted.length})
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="panel p-4 sticky top-4 card-border-top-blue-aneti">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </p>
              <button
                onClick={reset}
                className="text-xs text-accent hover:underline"
              >
                Reset
              </button>
            </div>
            <FiltersPanel {...filtersProps} />
          </div>
        </aside>

        <div className="space-y-4">
          {/* Top bar */}
          <div className="panel p-3 flex flex-wrap items-center gap-2 card-border-top-blue-aneti">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search candidates by name, skills, or experience…"
                className="h-9 pl-9 bg-surface-muted"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) =>
                setSort(v as 'recherche-semantique' | 'recherche-phrase-exacte')
              }
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recherche-semantique">Semantique</SelectItem>
                <SelectItem value="recherche-phrase-exacte">
                  Phrase exacte
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                aria-label="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                {/* <FiltersPanel {...filtersProps} /> */}
              </SheetContent>
            </Sheet>
          </div>

          {/* Context bar: matching against */}
          <div className="panel px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Search result:</span>
            <span className="ml-auto text-muted-foreground">
              <span className="font-semibold text-foreground">
                {filtered.length}
              </span>{' '}
              offers
              {/* offers · {required.length} required skills */}
            </span>
          </div>

          {/* Candidate cards */}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((j, i) => {
                const isSaved = saved.includes(j.id);
                return (
                  <SearchOfferCard key={j.id} offer={j} isSaved={isSaved} />
                );
              })}
            </div>
          ) : (
            <div className="panel divide-y divide-border">
              {filtered.map((j) => {
                const matchedCount = j.matchedSkills?.length ?? 0;
                return (
                  <SearchOfferRow
                    key={j.id}
                    offer={j}
                    matchedCount={matchedCount}
                  />
                );
              })}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="panel p-12 text-center text-sm text-muted-foreground">
              No offers match your filters. Try resetting some of them.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
