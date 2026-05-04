import { useMemo, useState } from 'react';
import { Briefcase, Eye, MapPin, Search, UserRound } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSearchCandidatesQuery } from '@/services/api/queries';
import type { SearchCandidateResult } from '@/services/api/gateway';

function getRawString(raw: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = raw[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

function candidateName(candidate: SearchCandidateResult) {
    return (
        getRawString(candidate.raw, [
            'name',
            'full_name',
            'candidate_name',
            'display_name',
        ]) ?? `Candidat ${candidate.candidateId.slice(0, 8)}`
    );
}

function candidateOccupation(candidate: SearchCandidateResult) {
    return (
        getRawString(candidate.raw, [
            'occupation',
            'job_title',
            'headline',
            'target_occupation',
            'current_position',
        ]) ?? 'Profil candidat'
    );
}

function candidateSummary(candidate: SearchCandidateResult) {
    return (
        getRawString(candidate.raw, ['summary', 'description', 'profile_summary']) ??
        'Aucun résumé disponible dans l’index.'
    );
}

function normalizeScore(value: number | null | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

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
    const summary = candidateSummary(candidate);
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
                            <p className="text-xs text-muted-foreground">Score search</p>
                            <p className="mt-1 text-xl font-semibold">{score}%</p>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-xs text-muted-foreground">Expérience</p>
                            <p className="mt-1 text-xl font-semibold">
                                {candidate.yearsExperience} ans
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-xs text-muted-foreground">Langue principale</p>
                            <p className="mt-1 text-sm font-semibold">
                                {candidate.primaryLang || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Localisation</p>
                                <p className="text-sm font-medium">
                                    {candidate.location || 'Non précisée'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                            <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Formation</p>
                                <p className="text-sm font-medium">
                                    {candidate.education || 'Non précisée'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-semibold">Résumé</p>
                        <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                            {summary}
                        </p>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-semibold">Compétences</p>
                        {candidate.skills.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Aucune compétence disponible.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {candidate.skills.map((skill) => (
                                    <span
                                        key={skill}
                                        className="rounded-full border border-border px-3 py-1 text-xs"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">ID candidat</p>
                        <p className="mt-1 break-all font-mono text-xs">
                            {candidate.candidateId}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function AdvisorSearchCandidates() {
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [selectedCandidate, setSelectedCandidate] =
        useState<SearchCandidateResult | null>(null);

    const candidatesQuery = useSearchCandidatesQuery({
        filters: {
            query: submittedQuery.trim() || undefined,
            size: 50,
        },
    });

    const candidates = useMemo(
        () => candidatesQuery.data?.results ?? [],
        [candidatesQuery.data?.results],
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Recherche candidats"
                description="Rechercher les candidats indexés via le search-service."
            />

            <form
                className="panel flex flex-wrap items-center gap-3 p-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    setSubmittedQuery(query);
                }}
            >
                <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Nom, compétence, métier, localisation..."
                        className="pl-9"
                    />
                </div>

                <Button type="submit">
                    <Search className="mr-2 h-4 w-4" />
                    Rechercher
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setQuery('');
                        setSubmittedQuery('');
                    }}
                >
                    Réinitialiser
                </Button>
            </form>

            <div className="panel px-4 py-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                    {candidatesQuery.data?.total ?? candidates.length}
                </span>{' '}
                candidat(s) trouvé(s)
            </div>

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
                            <article key={candidate.candidateId} className="panel space-y-4 p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted">
                                            <UserRound className="h-5 w-5 text-accent" />
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-foreground">{name}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {occupation}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setSelectedCandidate(candidate)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="rounded-lg bg-surface-muted p-2">
                                        <p className="text-muted-foreground">Score</p>
                                        <p className="font-semibold">{score}%</p>
                                    </div>

                                    <div className="rounded-lg bg-surface-muted p-2">
                                        <p className="text-muted-foreground">Exp.</p>
                                        <p className="font-semibold">
                                            {candidate.yearsExperience} ans
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-surface-muted p-2">
                                        <p className="text-muted-foreground">Langue</p>
                                        <p className="font-semibold">
                                            {candidate.primaryLang || '—'}
                                        </p>
                                    </div>
                                </div>

                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {candidate.location || 'Localisation non précisée'}
                                </p>

                                <div className="flex flex-wrap gap-1.5">
                                    {candidate.skills.slice(0, 6).map((skill) => (
                                        <span
                                            key={skill}
                                            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <CandidateDialog
                candidate={selectedCandidate}
                onClose={() => setSelectedCandidate(null)}
            />
        </div>
    );
}