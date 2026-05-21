import { Link } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import myImage from '@/assets/ANETI-RAW-LOGO-WHITE-ORANGE.png';

export default function CandidateAuthLayout() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-top-aneti-blue">
        <div className="relative p-4 flex w-full items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors rounded-md border border-border px-4 py-1 light-link-border-right-orange"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au portail
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Portail sécurisé
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[900px] items-stretch rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 card-border-top overflow-hidden">
          {/* Form panel */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>

          {/* Brand panel (desktop only) */}
          <aside className="hidden lg:flex relative overflow-hidden bg-primary text-primary-foreground w-[340px] shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent opacity-95" />
            <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-3xl" />

            <div className="relative z-10 flex flex-col p-10 w-full">
              <Link to="/" className="flex items-center gap-2.5 self-start">
                <img
                  src={myImage}
                  alt="ANETI"
                  className="h-[100px] w-full object-contain object-left"
                />
              </Link>

              <div className="mt-8">
                <blockquote className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 p-5 text-sm leading-relaxed">
                  La plateforme de l'ANETI est un espace digital dédié à la mise en relation
                  entre candidats, conseillers ANETI et employeurs en Tunisie.
                </blockquote>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
