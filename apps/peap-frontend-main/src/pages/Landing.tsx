import { Link } from "react-router-dom";
import { useRolesQuery } from "@/services/api/queries";
import { ArrowRight, Briefcase, Network, Users } from "lucide-react";

const roleIcons = {
  candidate: Users,
  provider: Briefcase,
  advisor: Network,
};

export default function Landing() {
  const { data: roles = [] } = useRolesQuery();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-white px-2 py-1 shadow-xs">
              <img
                src="/matchcore-logo.svg"
                alt="MatchCore"
                className="h-8 w-32 object-contain object-left"
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">MatchCore</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plateforme intelligente de matching</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Tous les systemes sont operationnels
            </span>
            <span className="font-mono">v0.4.2</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 pt-20 pb-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Choisissez votre espace pour continuer
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl font-semibold text-foreground leading-[1.05]">
              Connectez les talents et les opportunites grace au{" "}
              <span className="text-accent">matching explicable</span>.
            </h1>
            <p className="mt-5 text-base text-muted-foreground max-w-2xl leading-relaxed">
              MatchCore integre les CV et les offres d'emploi, les enrichit avec une taxonomie
              metier structuree et fait ressortir les meilleures correspondances en indiquant
              clairement ce qui a compte et ce qui manque.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-24">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Se connecter en tant que
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((r) => {
              const Icon = roleIcons[r.id];
              return (
                <Link
                  key={r.id}
                  to={`/${r.id}`}
                  className="group panel-elevated p-6 hover:border-accent hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-muted text-primary group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{r.label}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">/{r.id}</span>
                    <span className="text-accent font-medium">Entrer dans l'espace</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {[
              { v: "1,284", l: "Candidats actifs" },
              { v: "342", l: "Offres ouvertes" },
              { v: "8,510", l: "Noeuds de taxonomie" },
              { v: "99.7%", l: "Disponibilite du pipeline" },
            ].map((s) => (
              <div key={s.l} className="bg-surface p-5">
                <p className="text-2xl font-semibold text-foreground">{s.v}</p>
                <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; 2026 MatchCore. Tous droits reserves.</span>
          <span className="font-mono">region: eu-west-3</span>
        </div>
      </footer>
    </div>
  );
}
