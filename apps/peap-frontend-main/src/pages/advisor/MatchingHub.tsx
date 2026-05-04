import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Brain,
    Briefcase,
    Info,
    SlidersHorizontal,
    UserRound,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useMatchingModelCriteriaQuery,
    useMatchingModelsQuery,
} from '@/services/api/queries';

function MatchingCard({
    title,
    description,
    icon: Icon,
    to,
    badge,
}: {
    title: string;
    description: string;
    icon: typeof Brain;
    to: string;
    badge: string;
}) {
    return (
        <Link to={to} className="block">
            <div className="panel h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-muted">
                            <Icon className="h-5 w-5 text-accent" />
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-foreground">{title}</h3>
                                <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                    {badge}
                                </span>
                            </div>

                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>

                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
            </div>
        </Link>
    );
}

export default function AdvisorMatchingHub() {
    const [selectedModelId, setSelectedModelId] = useState('');

    const modelsQuery = useMatchingModelsQuery();
    const models = modelsQuery.data ?? [];

    const selectedModel = useMemo(() => {
        if (selectedModelId) {
            return models.find((model) => model.id === selectedModelId) ?? models[0];
        }

        return models[0];
    }, [models, selectedModelId]);

    const publishedVersion =
        selectedModel?.versions.find((version) => version.status === 'PUBLISHED') ??
        selectedModel?.versions[0];

    const criteriaQuery = useMatchingModelCriteriaQuery(publishedVersion?.id);
    const criteria = criteriaQuery.data ?? publishedVersion?.criteria ?? [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Moteur de matching"
                description="Lancer un matching dans les deux sens et consulter le modèle, les critères et les poids utilisés."
            />

            <div className="grid gap-4 md:grid-cols-2">
                <MatchingCard
                    title="Matching offre → candidats"
                    description="Sélectionner une offre et trouver les candidats les plus compatibles selon un modèle de matching."
                    icon={Briefcase}
                    to="/advisor/matching/offer-candidates"
                    badge="Offre vers candidats"
                />

                <MatchingCard
                    title="Matching candidat → offres"
                    description="Sélectionner un candidat et trouver les offres les plus compatibles selon un modèle de matching."
                    icon={UserRound}
                    to="/advisor/matching/candidate-offers"
                    badge="Candidat vers offres"
                />
            </div>

            <div className="panel p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <SlidersHorizontal className="h-4 w-4 text-accent" />
                            Modèle de matching utilisé
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Visualisation du moteur, de sa version et des critères pondérés.
                        </p>
                    </div>

                    {selectedModel ? (
                        <StatusPill
                            label={selectedModel.active ? 'Actif' : 'Inactif'}
                            tone={selectedModel.active ? 'success' : 'neutral'}
                        />
                    ) : null}
                </div>

                {modelsQuery.isLoading ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                        Chargement des modèles de matching...
                    </div>
                ) : modelsQuery.isError ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-destructive">
                        Impossible de charger les modèles de matching.
                    </div>
                ) : models.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                        Aucun modèle de matching configuré.
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_160px]">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                                    Modèle
                                </label>

                                <Select
                                    value={selectedModel?.id ?? ''}
                                    onValueChange={setSelectedModelId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choisir un modèle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                    Direction
                                </p>
                                <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                                    {selectedModel?.direction ?? '—'}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                    Version
                                </p>
                                <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                                    {publishedVersion
                                        ? `v${publishedVersion.versionNumber} · ${publishedVersion.status}`
                                        : '—'}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <div className="flex items-start gap-2">
                                <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    {selectedModel?.description ||
                                        'Aucune description disponible pour ce modèle.'}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-muted text-xs text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Critère</th>
                                        <th className="px-4 py-3 text-left font-medium">Code</th>
                                        <th className="px-4 py-3 text-left font-medium">Poids</th>
                                        <th className="px-4 py-3 text-left font-medium">Obligatoire</th>
                                        <th className="px-4 py-3 text-left font-medium">Seuil</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {criteriaQuery.isLoading ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-4 py-6 text-sm text-muted-foreground"
                                            >
                                                Chargement des critères...
                                            </td>
                                        </tr>
                                    ) : criteria.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-4 py-6 text-sm text-muted-foreground"
                                            >
                                                Aucun critère configuré pour cette version.
                                            </td>
                                        </tr>
                                    ) : (
                                        criteria.map((criterion) => (
                                            <tr key={criterion.id} className="hover:bg-surface-muted">
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    {criterion.criterionLabel}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                    {criterion.criterionCode}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {Number(criterion.weight).toFixed(1)}%
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusPill
                                                        label={criterion.isMust ? 'Oui' : 'Non'}
                                                        tone={criterion.isMust ? 'warning' : 'neutral'}
                                                        dot={false}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    {criterion.minThreshold ?? '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}