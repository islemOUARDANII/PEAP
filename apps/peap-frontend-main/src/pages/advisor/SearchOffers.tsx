import { useMemo, useState } from 'react';
import { Building2, Calendar, Eye, MapPin, Search } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSearchOffersQuery } from '@/services/api/queries';
import type { SearchOfferResult } from '@/services/api/gateway';

function normalizeScore(value: number | null | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function OfferDialog({
    offer,
    onClose,
}: {
    offer: SearchOfferResult | null;
    onClose: () => void;
}) {
    if (!offer) return null;

    return (
        <Dialog open={Boolean(offer)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{offer.title || 'Offre sans titre'}</DialogTitle>
                    <DialogDescription>
                        {offer.companyName || 'Entreprise non précisée'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-xs text-muted-foreground">Score search</p>
                            <p className="mt-1 text-xl font-semibold">
                                {normalizeScore(offer.score || offer.searchScore)}%
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-xs text-muted-foreground">Contrat</p>
                            <p className="mt-1 text-sm font-semibold">
                                {offer.contractType || '—'}
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-xs text-muted-foreground">Mode</p>
                            <p className="mt-1 text-sm font-semibold">
                                {offer.workMode || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Localisation</p>
                                <p className="text-sm font-medium">
                                    {offer.location || 'Non précisée'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                            <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Publication</p>
                                <p className="text-sm font-medium">
                                    {offer.publishedAt
                                        ? new Date(offer.publishedAt).toLocaleDateString()
                                        : '—'}
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
                            <p className="text-sm text-muted-foreground">
                                Aucune compétence disponible.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {offer.skills.map((skill) => (
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
                        <p className="text-xs text-muted-foreground">ID offre</p>
                        <p className="mt-1 break-all font-mono text-xs">{offer.offerId}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function AdvisorSearchOffers() {
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [selectedOffer, setSelectedOffer] =
        useState<SearchOfferResult | null>(null);

    const offersQuery = useSearchOffersQuery({
        query: submittedQuery.trim() || undefined,
        size: 50,
    });

    const offers = useMemo(
        () => offersQuery.data?.results ?? [],
        [offersQuery.data?.results],
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Recherche offres"
                description="Rechercher les offres indexées via le search-service."
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
                        placeholder="Métier, compétence, entreprise, localisation..."
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
                    {offersQuery.data?.total ?? offers.length}
                </span>{' '}
                offre(s) trouvée(s)
            </div>

            {offersQuery.isLoading ? (
                <div className="panel p-6 text-sm text-muted-foreground">
                    Chargement des offres...
                </div>
            ) : offersQuery.isError ? (
                <div className="panel p-6 text-sm text-destructive">
                    {offersQuery.error instanceof Error
                        ? offersQuery.error.message
                        : 'Impossible de charger les offres.'}
                </div>
            ) : offers.length === 0 ? (
                <div className="panel p-6 text-sm text-muted-foreground">
                    Aucune offre trouvée.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {offers.map((offer) => (
                        <article key={offer.offerId} className="panel space-y-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted">
                                        <Building2 className="h-5 w-5 text-accent" />
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-foreground">
                                            {offer.title || 'Offre sans titre'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {offer.companyName || 'Entreprise non précisée'}
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedOffer(offer)}
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </div>

                            <p className="line-clamp-2 text-sm text-muted-foreground">
                                {offer.description || 'Aucune description disponible.'}
                            </p>

                            <div className="flex flex-wrap gap-2 text-xs">
                                <StatusPill
                                    label={offer.status || 'UNKNOWN'}
                                    tone={statusToTone(offer.status || 'UNKNOWN')}
                                />
                                {offer.contractType ? (
                                    <StatusPill
                                        label={offer.contractType}
                                        tone="neutral"
                                        dot={false}
                                    />
                                ) : null}
                                {offer.workMode ? (
                                    <StatusPill
                                        label={offer.workMode}
                                        tone="info"
                                        dot={false}
                                    />
                                ) : null}
                            </div>

                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {offer.location || 'Localisation non précisée'}
                            </p>

                            <div className="flex flex-wrap gap-1.5">
                                {offer.skills.slice(0, 6).map((skill) => (
                                    <span
                                        key={skill}
                                        className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <OfferDialog offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
        </div>
    );
}