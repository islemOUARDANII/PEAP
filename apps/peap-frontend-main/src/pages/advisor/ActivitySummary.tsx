import { Activity, Search, Brain, Clock } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';

const activityItems = [
    {
        title: 'Dernières recherches',
        description: 'Recherches candidats et offres effectuées par le conseiller.',
        icon: Search,
    },
    {
        title: 'Derniers matchings',
        description: 'Matchings lancés récemment et résultats consultés.',
        icon: Brain,
    },
    {
        title: 'Activité récente',
        description: 'Actions effectuées dans l’espace conseiller.',
        icon: Clock,
    },
];

export default function AdvisorActivitySummary() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Sommaire d’activité"
                description="Vue synthétique de l’activité récente du conseiller."
            />

            <div className="grid gap-4 md:grid-cols-3">
                {activityItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <div key={item.title} className="panel p-5">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
                                <Icon className="h-5 w-5 text-accent" />
                            </div>

                            <h3 className="font-semibold text-foreground">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {item.description}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="panel p-5">
                <div className="flex items-start gap-3">
                    <Activity className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Les données réelles d’activité seront branchées ensuite sur les logs
                        d’audit et les historiques de recherche/matching.
                    </p>
                </div>
            </div>
        </div>
    );
}