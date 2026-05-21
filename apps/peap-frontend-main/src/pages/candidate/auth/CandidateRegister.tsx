import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { registerCandidateOtp } from '@/services/auth/authApi';

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (password.length < 6) return { level: 1, label: 'Très faible', color: 'bg-destructive' };
  if (password.length < 8) return { level: 2, label: 'Faible', color: 'bg-orange-500' };

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length >= 12 && score >= 3)
    return { level: 4, label: 'Très fort', color: 'bg-success' };
  if (password.length >= 8 && score >= 2) return { level: 3, label: 'Fort', color: 'bg-green-500' };
  return { level: 2, label: 'Moyen', color: 'bg-yellow-500' };
}

export default function CandidateRegister() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCandidateOtp({
        email: email.trim(),
        password,
        password_confirm: confirmPassword,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        national_id: identifier.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      navigate('/candidate/verify-code', {
        state: { email: email.trim(), firstName: firstName.trim() },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création du compte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 sm:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Créer un compte candidat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rejoignez la plateforme ANETI et commencez votre parcours.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identifiant */}
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Numéro CIN / Passeport</Label>
          <Input
            id="identifier"
            placeholder="12345678"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-11"
          />
        </div>

        {/* Prénom / Nom */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Prénom <span className="text-destructive">*</span></Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="firstName"
                required
                placeholder="Votre prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nom <span className="text-destructive">*</span></Label>
            <Input
              id="lastName"
              required
              placeholder="Votre nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email <span className="text-destructive">*</span></Label>
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
          <p className="text-xs text-muted-foreground">
            Un code de vérification sera envoyé à cette adresse.
          </p>
        </div>

        {/* Téléphone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Numéro de téléphone <span className="text-muted-foreground">(optionnel)</span></Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+216 XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        {/* Mot de passe */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="Créer un mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pl-9 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-1 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        n <= strength.level ? strength.color : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="Répéter le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 pl-9 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Les mots de passe ne correspondent pas.</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full h-11 mt-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création en cours…
            </>
          ) : (
            'Créer mon compte'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link to="/candidate/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
