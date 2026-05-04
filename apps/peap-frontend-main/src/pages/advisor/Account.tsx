import { PageHeader } from '@/components/common/PageHeader';

export default function AdvisorAccount() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestion de votre compte"
                description="Informations du compte conseiller et paramètres personnels."
            />

            <div className="panel p-5">
                <p className="text-sm text-muted-foreground">
                    Cette page affichera les informations du conseiller connecté : nom,
                    email, rôle, agence ANETI, accès et préférences.
                </p>
            </div>
        </div>
    );
}