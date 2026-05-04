import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Brain,
    Eye,
    Loader2,
    PlayCircle,
    Search,
    UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { StatusPill } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useMatchingModelsQuery,
    useSearchCandidatesQuery,
} from '@/services/api/queries';
import {
    gatewayApi,
    type MatchingResultRecord,
    type SearchCandidateResult,
} from '@/services/api/gateway';

function getCandidateName(candidate: SearchCandidateResult) {
    const raw = candidate.raw ?? {};
    const name =
        raw.name ||
        raw.full_name ||
        raw.candidate_name ||
        raw.display_name ||
        null;

    return typeof name === 'string' && name.trim()
        ? name.trim()
        : `Candidat ${candidate.candidateId.slice(0, 8)}`;
}

function getCandidateDescription(candidate: SearchCandidateResult) {
    const raw = candidate.raw ?? {};
    const value =
        raw.occupation ||
        raw.job_title ||
        raw.headline ||
        raw.target_occupation ||
        raw.current_position ||
        null;

    return typeof value === 'string' && value.trim()
        ? value.trim()
        : 'Profil candidat';
}

export default function AdvisorCandidateToOffersMatching() {
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [selectedCandidateId, setSelectedCandidateId] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [results, setResults] = useState<MatchingResultRecord[]>([]);
    const [selectedResult, setSelectedResult] =
        useState<MatchingResultRecord | null>(null);

    const candidatesQuery = useSearchCandidatesQuery({
        filters: {
            query: submittedQuery.trim() || undefined,
            size: 50,
        },
    });

    const modelsQuery = useMatchingModelsQuery();

    const candidates = candidatesQuery.data?.results ?? [];
    const models = useMemo(() => {
        return (modelsQuery.data ?? []).filter((model) =>
            model.direction.toUpperCase().includes('CANDIDATE'),
        );
    }, [modelsQuery.data]);

    const selectedCandidate = candidates.find(
        (candidate) => candidate.candidateId === selectedCandidateId,
    );

    const selectedModel = models.find((model) => model.id === selectedModelId);
    const selectedVersion =
        selectedModel?.versions.find((version) => version.status === 'PUBLISHED') ??
        selectedModel?.versions[0];

    const launchMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCandidate) {
                throw new Error('Veuillez sélectionner un candidat.');
            }

            if (!selectedVersion || !selectedModel) {
                throw new Error('Veuillez sélectionner un modèle de matching.');
            }

            const run = await gatewayApi.matching.createRun({
                run_type: 'MANUAL',
                direction: selectedModel.direction,
                model_version_id: selectedVersion.id,
                source_entity_type: 'CANDIDATE',
                source_entity_id: selectedCandidate.candidateId,
                parameters_json: {
                    min_score: 0,
                },
            });

            await gatewayApi.matching.executeRun(run.id, {});
            return gatewayApi.matching.listResults(run.id);
        },
        onSuccess: (data) => {
            setResults(data);
            toast.success('Matching candidat → offres terminé.');
        },
        onError: (error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Impossible de lancer le matching.',
            );
        },
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Matching candidat → offres"
                description="Sélectionner un candidat, choisir un modèle, puis lancer le matching vers les offres."
            />

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-4">
                    <div className="panel p-4">
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            1. Rechercher un candidat
                        </h2>

                        <form
                            className="flex gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                setSubmittedQuery(query);
                            }}
                        >
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Nom, compétence, métier..."
                                    className="pl-9"
                                />
                            </div>

                            <Button type="submit" size="sm">
                                Search
                            </Button>
                        </form>

                        <div className="mt-4 max-h-[320px] space-y-2 overflow-auto">
                            {candidatesQuery.isLoading ? (
                                <p className="text-sm text-muted-foreground">
                                    Chargement des candidats...
                                </p>
                            ) : candidates.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Aucun candidat trouvé.
                                </p>
                            ) : (
                                candidates.map((candidate) => {
                                    const selected = candidate.candidateId === selectedCandidateId;

                                    return (
                                        <button
                                            key={candidate.candidateId}
                                            type="button"
                                            onClick={() => setSelectedCandidateId(candidate.candidateId)}
                                            className={`w-full rounded-xl border p-3 text-left transition ${selected
                                                ? 'border-accent bg-accent/10'
                                                : 'border-border hover:bg-surface-muted'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                                                    <UserRound className="h-4 w-4 text-accent" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {getCandidateName(candidate)}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {getCandidateDescription(candidate)}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="panel p-4">
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            2. Choisir le modèle
                        </h2>

                        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Modèle candidat → offres" />
                            </SelectTrigger>

                            <SelectContent>
                                {models.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>
                                        {model.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedModel ? (
                            <div className="mt-3 rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">
                                    {selectedModel.label}
                                </p>
                                <p className="mt-1">{selectedModel.description || '—'}</p>
                                <p className="mt-2 text-xs">
                                    Version :{' '}
                                    {selectedVersion
                                        ? `v${selectedVersion.versionNumber} · ${selectedVersion.status}`
                                        : '—'}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <Button
                        className="w-full"
                        disabled={
                            !selectedCandidateId ||
                            !selectedModelId ||
                            launchMutation.isPending
                        }
                        onClick={() => launchMutation.mutate()}
                    >
                        {launchMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        Lancer le matching
                    </Button>
                </div>

                <div className="panel overflow-hidden">
                    <div className="border-b border-border px-5 py-4">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Brain className="h-4 w-4 text-accent" />
                            Résultats offres recommandées
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Résultats produits par le matching-service.
                        </p>
                    </div>

                    {results.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">
                            Aucun résultat pour le moment. Sélectionnez un candidat et lancez
                            le matching.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-surface-muted text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Rang</th>
                                    <th className="px-4 py-3 text-left font-medium">Offre</th>
                                    <th className="px-4 py-3 text-left font-medium">Score</th>
                                    <th className="px-4 py-3 text-left font-medium">Éligibilité</th>
                                    <th className="px-4 py-3 text-right font-medium">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border">
                                {results.map((result) => (
                                    <tr key={result.id} className="hover:bg-surface-muted">
                                        <td className="px-4 py-3 font-mono text-xs">
                                            #{result.rank}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-foreground">
                                                {result.offerTitle || result.offerId || 'Offre'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {result.explanationShort || '—'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <ScoreBadge value={result.scoreGlobal} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusPill
                                                label={result.eligibilityStatus}
                                                tone={
                                                    result.eligibilityStatus === 'ELIGIBLE'
                                                        ? 'success'
                                                        : 'warning'
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSelectedResult(result)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Dialog
                open={Boolean(selectedResult)}
                onOpenChange={(open) => !open && setSelectedResult(null)}
            >
                <DialogContent className="max-w-2xl">
                    {selectedResult ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {selectedResult.offerTitle || 'Résultat de matching'}
                                </DialogTitle>
                                <DialogDescription>
                                    Score global : {selectedResult.scoreGlobal}%
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="rounded-xl border border-border bg-surface-muted p-3">
                                    <p className="text-sm text-muted-foreground">
                                        {selectedResult.explanationShort ||
                                            'Aucune explication courte disponible.'}
                                    </p>
                                </div>

                                <pre className="max-h-[360px] overflow-auto rounded-xl border border-border bg-background p-3 text-xs">
                                    {JSON.stringify(selectedResult.explanationJson, null, 2)}
                                </pre>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}