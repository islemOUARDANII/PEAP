import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { verifyEmailOtp, resendEmailOtp } from '@/services/auth/authApi';
import { useAuth } from '@/app/auth';

interface VerifyCodeLocationState {
  email?: string;
  firstName?: string;
}

const CODE_LENGTH = 6;

export default function CandidateVerifyCode() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithSession } = useAuth();
  const state = (location.state ?? {}) as VerifyCodeLocationState;

  const email = state.email ?? '';
  const firstName = state.firstName ?? '';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== '');

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    setError(null);
    setSuccessMessage(null);
    setIsVerifying(true);

    try {
      const session = await verifyEmailOtp({ email, code });
      loginWithSession(session);
      setSuccessMessage('Votre email a été vérifié avec succès. Redirection…');
      setTimeout(() => {
        navigate('/candidate/onboarding/reasons', { replace: true });
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Code incorrect ou expiré. Veuillez réessayer.',
      );
      // Vider les champs pour une nouvelle saisie
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await resendEmailOtp(email);
      startCooldown();
      setSuccessMessage('Un nouveau code a été envoyé à votre adresse email.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de renvoyer le code. Veuillez réessayer.',
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="p-8 sm:p-10">
      <div className="mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground">Vérification de votre email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un code de vérification à {CODE_LENGTH} chiffres a été envoyé par email
          {email && (
            <>
              {' '}à <span className="font-medium text-foreground">{email}</span>
            </>
          )}
          .
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="mb-5 border-success/35 bg-success-soft text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle>Succès</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Champs OTP */}
      <div className="flex gap-2 justify-center mb-6">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => updateDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'h-14 w-12 rounded-md border text-center text-2xl font-semibold bg-background transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
              digit ? 'border-primary' : 'border-border',
            )}
          />
        ))}
      </div>

      <Button
        className="w-full h-11"
        onClick={handleVerify}
        disabled={!isComplete || isVerifying}
      >
        {isVerifying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Vérification en cours…
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Vérifier mon email
          </>
        )}
      </Button>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || resendCooldown > 0 || !email}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
            resendCooldown > 0 || !email
              ? 'text-muted-foreground cursor-not-allowed'
              : 'text-primary hover:underline',
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {isResending
            ? 'Envoi en cours…'
            : resendCooldown > 0
              ? `Renvoyer le code dans ${resendCooldown}s`
              : 'Renvoyer le code'}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Mauvaise adresse email ?{' '}
        <Link to="/candidate/register" className="text-primary hover:underline">
          Modifier mon adresse
        </Link>
      </p>
    </div>
  );
}
