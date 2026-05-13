import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill, statusToTone } from '@/components/common/StatusPill';
import { Button } from '@/components/ui/button';
import { useProviderApplicationsQuery } from '@/services/api/queries';

export default function Applications() {
    const { data: applications = [], isLoading, isError, error } =
        useProviderApplicationsQuery();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Candidatures reçues"
                description="Consultez les candidats qui ont postulé à vos offres."
            />

            <div className="panel overflow-hidden">
                {isLoading ? (
                    <div className="p-6 text-sm text-muted-foreground">
                        Chargement des candidatures...
                    </div>
                ) : isError ? (
                    <div className="p-6 text-sm text-destructive">
                        {error instanceof Error
                            ? error.message
                            : 'Impossible de charger les candidatures.'}
                    </div>
                ) : applications.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">
                        Aucune candidature reçue pour le moment.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-xs text-muted-foreground">
                                    <th className="px-5 py-3 text-left font-medium">Candidat</th>
                                    <th className="px-3 py-3 text-left font-medium">Offre</th>
                                    <th className="px-3 py-3 text-left font-medium">Contact</th>
                                    <th className="px-3 py-3 text-left font-medium">Statut</th>
                                    <th className="px-3 py-3 text-left font-medium">Date</th>
                                    <th className="px-5 py-3 text-right font-medium">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border">
                                {applications.map((application) => (
                                    <tr key={application.id} className="hover:bg-surface-muted">
                                        <td className="px-5 py-3">
                                            <p className="font-medium text-foreground">
                                                {application.candidateName || 'Candidat sans nom'}
                                            </p>
                                            <p className="text-xs font-mono text-muted-foreground">
                                                {application.jobSeekerId}
                                            </p>
                                        </td>

                                        <td className="px-3 py-3">
                                            <Link
                                                to={`/provider/offers/${application.offerId}`}
                                                className="font-medium text-foreground hover:text-accent hover:underline"
                                            >
                                                {application.offerTitle || 'Offre sans titre'}
                                            </Link>
                                            <p className="text-xs font-mono text-muted-foreground">
                                                {application.offerAnetiIdentifier || '—'}
                                            </p>
                                        </td>

                                        <td className="px-3 py-3 text-xs text-muted-foreground">
                                            <p>{application.candidateEmail || 'Email indisponible'}</p>
                                            <p>{application.candidatePhone || 'Téléphone indisponible'}</p>
                                        </td>

                                        <td className="px-3 py-3">
                                            <StatusPill
                                                label={application.status}
                                                tone={statusToTone(application.status)}
                                            />
                                        </td>

                                        <td className="px-3 py-3 text-xs text-muted-foreground">
                                            {new Date(application.appliedAt).toLocaleDateString()}
                                        </td>

                                        <td className="px-5 py-3 text-right">
                                            <Button asChild variant="ghost" size="sm">
                                                <Link to={`/provider/candidates/${application.jobSeekerId}`}>
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}