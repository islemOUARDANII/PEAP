import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Search, ChevronDown, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role, RoleProfile } from '@/models';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/app/auth';
import { searchTargetsByRole, type SearchTarget } from '@/config/navigation';
import { UserRole } from '@/app/constants';

const roleLabels: Record<Role, string> = {
  candidate: 'Candidat',
  provider: 'Employeur',
  advisor: 'Conseiller',
  functionalAdmin: 'Admin fonctionnel',
  techAdmin: 'Admin technique',
};

const fallbackProfiles: Record<Role, RoleProfile> = {
  candidate: {
    role: 'candidate',
    name: 'Candidat',
    email: 'candidate@aneti.tn',
    initials: 'CA',
  },
  provider: {
    role: 'provider',
    name: 'Employeur',
    email: 'employeur@aneti.tn',
    initials: 'EM',
  },
  advisor: {
    role: 'advisor',
    name: 'Conseiller',
    email: 'advisor@aneti.tn',
    initials: 'CA',
  },
  functionalAdmin: {
    role: 'functionalAdmin',
    name: 'Admin fonctionnel',
    email: 'functional.admin@aneti.tn',
    initials: 'AF',
  },
  techAdmin: {
    role: 'techAdmin',
    name: 'Admin technique',
    email: 'tech.admin@aneti.tn',
    initials: 'AT',
  },
};

const searchPlaceholders: Record<Role, string> = {
  candidate: 'Rechercher des offres, compétences...',
  provider: 'Rechercher offres ou candidats...',
  advisor: 'Rechercher moteurs, candidats, offres...',
  functionalAdmin: 'Rechercher modèles, critères, règles...',
  techAdmin: 'Rechercher logs, services, pipelines...',
};

interface TopbarProps {
  role: Role;
}

export function Topbar({ role }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const profile = session
    ? {
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        initials: session.user.name
          .split(' ')
          .map((chunk) => chunk[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      }
    : fallbackProfiles[role];

  useEffect(() => {
    const currentQuery = new URLSearchParams(location.search).get('q') ?? '';
    setQuery(currentQuery);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const targets = searchTargetsByRole[role];
  const visibleTargets = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const matches = targets.filter((target) => {
      const searchable = [target.label, target.description, ...target.keywords]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });

    return (matches.length > 0 ? matches : targets).slice(0, 4);
  }, [normalizedQuery, targets]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navigateToSearch = (target: SearchTarget) => {
    if (!trimmedQuery) {
      return;
    }

    const params = new URLSearchParams({ q: trimmedQuery });
    navigate(`${target.to}?${params.toString()}`);
    setIsSearchOpen(false);
    inputRef.current?.blur();
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [target] = visibleTargets.length > 0 ? visibleTargets : targets;
    navigateToSearch(target);
  };

  return (
    <header className="matchcore-topbar sticky top-0 z-30 border-b border-border/80 backdrop-blur">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          to="/landing"
          className="flex h-10 w-36 shrink-0 items-center rounded-md border border-border/70 bg-white px-2 shadow-xs lg:hidden"
          aria-label="MatchCore home"
        >
          <img
            src="/matchcore-logo.svg"
            alt="MatchCore"
            className="h-8 w-full object-contain object-left"
          />
        </Link>

        {role !== UserRole.Candidate && (
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="relative min-w-0 flex-1 lg:max-w-xl xl:max-w-2xl"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() =>
                window.setTimeout(() => setIsSearchOpen(false), 120)
              }
              placeholder={searchPlaceholders[role]}
              className="h-10 rounded-md border-border bg-surface-muted/75 pl-9 pr-16 shadow-xs focus-visible:ring-accent"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border border-border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground xl:inline-flex">
              Ctrl K
            </kbd>
            {isSearchOpen && trimmedQuery && (
              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Search in this portal
                </div>
                {visibleTargets.map((target) => (
                  <button
                    key={target.to}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      navigateToSearch(target);
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-muted"
                  >
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        Search "{trimmedQuery}" in {target.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {target.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-border/80 pl-3 sm:pl-4">
          <span className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-xs sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {roleLabels[role]}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex max-w-[240px] items-center gap-2 rounded-md border border-transparent p-1 pr-2 transition-colors hover:border-border hover:bg-surface-muted">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-accent/20">
                  {profile.initials}
                </span>
                <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
                  <span className="max-w-36 truncate text-xs font-semibold text-foreground">
                    {profile.name}
                  </span>
                  <span className="max-w-40 truncate text-[10px] text-muted-foreground">
                    {profile.email}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{profile.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
