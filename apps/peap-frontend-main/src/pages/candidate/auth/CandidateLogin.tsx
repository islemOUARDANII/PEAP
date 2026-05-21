import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/app/auth';
import { roleHomePath } from '@/app/routeGuards';

export default function CandidateLogin() {
  const navigate = useNavigate();
  const { login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await login({ email: email.trim(), password });
      const home = roleHomePath(session.user.role, session.user.roles ?? []);
      navigate(home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 sm:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Connexion candidat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accédez à votre espace personnel et continuez votre parcours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pl-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          className="w-full h-11 mt-2"
          disabled={isSubmitting || status === 'loading'}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connexion…
            </>
          ) : (
            'Se connecter'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link to="/candidate/register" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
