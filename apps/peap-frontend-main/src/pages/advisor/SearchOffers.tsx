import { useMemo, useState } from 'react';
import { Building2, Calendar, ChevronDown, Eye, MapPin, Search, X } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSearchOffersQuery } from '@/services/api/queries';
import type { SearchOfferResult } from '@/services/api/gateway';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'SIVP', label: 'SIVP' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'KARAMA', label: 'Karama' },
] as const;

const WORK_MODES = [
  { value: 'ONSITE', label: 'Présentiel' },
  { value: 'REMOTE', label: 'Télétravail' },
  { value: 'HYBRID', label: 'Hybride' },
] as const;

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
  { value: 'debutant', label: 'Débutant (0–2 ans)' },
  { value: 'intermediaire', label: 'Intermédiaire (3–5 ans)' },
  { value: 'senior', label: 'Sénior (5+ ans)' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// OfferDialog
// ---------------------------------------------------------------------------

function OfferDialog({ offer, onClose }: { offer: SearchOfferResult | null; onClose: () => void }) {
  if (!offer) return null;
  return (
    <Dialog open={Boolean(offer)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{offer.title || 'Offre sans titre'}</DialogTitle>
          <DialogDescription>{offer.companyName || 'Entreprise non précisée'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="mt-1 text-xl font-semibold">{normalizeScore(offer.score)}%</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Contrat</p>
              <p className="mt-1 text-sm font-semibold">{offer.contractType || '—'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Mode</p>
              <p className="mt-1 text-sm font-semibold">{offer.workMode || '—'}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-border p-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Localisation</p>
                <p className="text-sm font-medium">{offer.location || 'Non précisée'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-border p-3">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Publication</p>
                <p className="text-sm font-medium">
                  {offer.publishedAt ? new Date(offer.publishedAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Description</p>
            <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
              {offer.description || 'Aucune description disponible.'}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Compétences</p>
            {offer.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune compétence disponible.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {offer.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-border px-3 py-1 text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">ID offre</p>
            <p className="mt-1 break-all font-mono text-xs">{offer.offerId}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdvisorSearchOffers() {
  const [textDraft, setTextDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [contractType, setContractType] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [salaryMinDraft, setSalaryMinDraft] = useState('');
  const [salaryMaxDraft, setSalaryMaxDraft] = useState('');
  const [salaryMin, setSalaryMin] = useState<number | null>(null);
  const [salaryMax, setSalaryMax] = useState<number | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<SearchOfferResult | null>(null);
  const [govSearch, setGovSearch] = useState('');

  const offersQuery = useSearchOffersQuery({
    query: appliedQuery || undefined,
    size: 50,
    contract_type: contractType || undefined,
    work_mode: workMode || undefined,
    governorate: governorate || undefined,
    salary_min: salaryMin ?? undefined,
    salary_max: salaryMax ?? undefined,
  });

  const offers = useMemo(() => offersQuery.data?.results ?? [], [offersQuery.data?.results]);

  const hasFilters = Boolean(contractType || workMode || governorate || salaryMin || salaryMax);

  function clearFilters() {
    setContractType('');
    setWorkMode('');
    setGovernorate('');
    setSalaryMinDraft('');
    setSalaryMaxDraft('');
    setSalaryMin(null);
    setSalaryMax(null);
  }

  const filteredGovs = TUNISIA_GOVERNORATES.filter((g) =>
    g.toLowerCase().includes(govSearch.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recherche offres"
        description="Rechercher les offres indexées dans le moteur de recherche."
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
            placeholder="Appellation, description, compétence..."
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

            <FilterSection title="Type de contrat" defaultOpen={false}>
              {CONTRACT_TYPES.map((opt) => (
                <RadioItem
                  key={opt.value}
                  label={opt.label}
                  selected={contractType === opt.value}
                  onClick={() => setContractType(contractType === opt.value ? '' : opt.value)}
                />
              ))}
            </FilterSection>

            <FilterSection title="Régime de travail" defaultOpen={false}>
              {WORK_MODES.map((opt) => (
                <RadioItem
                  key={opt.value}
                  label={opt.label}
                  selected={workMode === opt.value}
                  onClick={() => setWorkMode(workMode === opt.value ? '' : opt.value)}
                />
              ))}
            </FilterSection>

            <FilterSection title="Gouvernorat" defaultOpen={false}>
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
                    selected={governorate === g}
                    onClick={() => setGovernorate(governorate === g ? '' : g)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Salaire (DT)" defaultOpen={false}>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Minimum</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={salaryMinDraft}
                    onChange={(e) => setSalaryMinDraft(e.target.value)}
                    onBlur={() => {
                      const n = parseInt(salaryMinDraft, 10);
                      setSalaryMin(Number.isNaN(n) ? null : n);
                    }}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Maximum</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder="∞"
                    value={salaryMaxDraft}
                    onChange={(e) => setSalaryMaxDraft(e.target.value)}
                    onBlur={() => {
                      const n = parseInt(salaryMaxDraft, 10);
                      setSalaryMax(Number.isNaN(n) ? null : n);
                    }}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </FilterSection>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Results header */}
          {offersQuery.data && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {offers.length}
              </span>{' '}
              résultat(s)
            </p>
          )}

          {/* States */}
          {offersQuery.isLoading ? (
            <div className="panel p-6 text-sm text-muted-foreground">Chargement des offres...</div>
          ) : offersQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              {offersQuery.error instanceof Error
                ? offersQuery.error.message
                : 'Impossible de charger les offres.'}
            </div>
          ) : offers.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">Aucune offre trouvée.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => (
                <article key={offer.offerId} className="panel flex flex-col gap-3 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                        <Building2 className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold leading-tight text-foreground">
                          {offer.title || 'Offre sans titre'}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {offer.companyName || 'Entreprise non précisée'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => setSelectedOffer(offer)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill
                      label={offer.status || 'UNKNOWN'}
                      tone={statusToTone(offer.status || 'UNKNOWN')}
                    />
                    {offer.contractType && (
                      <StatusPill label={offer.contractType} tone="neutral" dot={false} />
                    )}
                    {offer.workMode && (
                      <StatusPill label={offer.workMode} tone="info" dot={false} />
                    )}
                  </div>

                  {/* Location + date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {offer.location || 'Non précisée'}
                    </span>
                    {offer.publishedAt && (
                      <span>{new Date(offer.publishedAt).toLocaleDateString('fr-TN')}</span>
                    )}
                  </div>

                  {/* Skills */}
                  {offer.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {offer.skills.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                      {offer.skills.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{offer.skills.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <OfferDialog offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
    </div>
  );
}
