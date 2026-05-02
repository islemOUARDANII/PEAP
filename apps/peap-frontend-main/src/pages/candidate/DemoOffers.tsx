import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MapPin, Search, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { SkillTag } from '@/components/common/SkillTag';
import { StatusPill } from '@/components/common/StatusPill';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchOffersSafe } from '@/services/api/demoGateway';
import { readDemoCandidateProfile } from '@/services/candidate/demoProfileSession';
import OfferCardCandidat from '@/components/common/OfferCardCandidat';

export default function DemoOffers() {
  const candidateProfile = readDemoCandidateProfile();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [contractType, setContractType] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');

  const offersQuery = useQuery({
    queryKey: [
      'demo',
      'candidate',
      'offers',
      {
        query,
        location,
        contractType,
        skillFilter,
        profile: candidateProfile.email,
        title: candidateProfile.title,
        skills: candidateProfile.skills.join('|'),
        languages: candidateProfile.languages.join('|'),
      },
    ],
    queryFn: () =>
      searchOffersSafe({
        query,
        location,
        contractType,
        skills: skillFilter === 'all' ? [] : [skillFilter],
        candidateProfile,
      }),
    staleTime: 30_000,
  });

  const offers = offersQuery.data?.data ?? [];
  const skillOptions = useMemo(
    () =>
      Array.from(
        new Set((offers ?? []).flatMap((offer) => offer.requiredSkills)),
      ).sort((left, right) => left.localeCompare(right)),
    [offers],
  );
  const contractOptions = useMemo(
    () =>
      Array.from(
        new Set((offers ?? []).map((offer) => offer.contractType)),
      ).sort(),
    [offers],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres"
        description="Recherchez des offres compatibles avec votre profil validé et ajustez les filtres en toute sécurité, même si le moteur de recherche ne répond pas."
        actions={
          <>
            {offersQuery.data?.demoMode ? (
              <StatusPill label="Mode démo" tone="accent" />
            ) : null}
            <StatusPill
              label={`${candidateProfile.firstName} ${candidateProfile.lastName}`}
              tone="info"
            />
          </>
        }
      />

      <section className="panel p-5 card-border-top-blue-aneti">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par titre, entreprise ou compétence..."
              className="h-10 bg-surface-muted pl-9"
            />
          </div>

          <Input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Localisation"
            className="h-10 bg-surface-muted"
          />

          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Contrat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les contrats</SelectItem>
              {(contractOptions ?? []).map((option) => (
                <SelectItem key={`contract-${option}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Compétence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les compétences</SelectItem>
              {(skillOptions ?? []).map((option) => (
                <SelectItem key={`skill-${option}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="rounded-3xl border border-border bg-primary-muted/20 px-4 py-3 text-sm text-foreground">
            Profil validé. Vous pouvez maintenant consulter les offres
            compatibles.
          </div>
        </div>

        {offersQuery.data?.errorMessage ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {offersQuery.data.errorMessage}
          </p>
        ) : null}
      </section>

      {offersQuery.isLoading ? (
        <section className="panel p-6 text-sm text-muted-foreground">
          Chargement des offres compatibles...
        </section>
      ) : offersQuery.isError ? (
        <section className="panel p-6 text-sm text-muted-foreground">
          La recherche d'offres n'est pas disponible pour le moment.
        </section>
      ) : offers.length === 0 ? (
        <section className="panel p-6 text-sm text-muted-foreground">
          Aucune offre ne correspond aux filtres actuels.
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(offers ?? []).map((offer) => (
            <OfferCardCandidat key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
