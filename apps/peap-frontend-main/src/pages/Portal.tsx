import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { portalRoles } from '@/lib/portalRoles';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import myImage from '@/assets/ANETI-RAW-LOGO.png';

export default function Portal() {
  return (
    <div className="min-h-screen bg-background flex flex-col ">
      <header className="border-b border-border bg-surface border-top-aneti-blue">
        <div className="relative mx-auto max-w-7xl px-6 h-16 flex items-center justify-center">
          <div className="flex items-center gap-2.5 ">
            <div className="">
              <img
                src={myImage}
                alt="Logo"
                className="h-12 w-full object-contain object-left"
              />
            </div>
          </div>
          <span className="hidden card-action sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Portail securise
          </span>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-8 pb-8 text-center">
          <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.05]">
            Bienvenue sur le portail d’accès ANETI.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Merci de sélectionner votre profil parmi les rôles disponibles afin
            d’accéder à votre espace professionnel.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-2 pb-10">
          <Card className="relative card-border-top">
            <div className="card-action p-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Acces par role
              </span>
            </div>
            <CardHeader>
              <CardTitle className="justify-center text-sm flex items-center gap-2">
                Veuillez selectionner votre role pour acceder a votre espace dedie.
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {portalRoles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <Link
                      key={r.id}
                      to={`/login/${r.id}`}
                      className="group panel-elevated p-4 card-border-left  hover:border-accent border-10 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-4 justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md shadow-sm border bg-primary-muted/10 text-primary group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">
                              {r.label}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 italic">
                              {r.subtitle}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {r.description}
                      </p>
                      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono">/login/{r.id}</span>
                        <span className="text-accent font-medium">
                          Continuer
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 h-12 flex items-center justify-center text-xs text-muted-foreground text-center">
          Vous serez redirige de maniere securisee vers la page de connexion appropriee.
        </div>
      </footer>
    </div>
  );
}
