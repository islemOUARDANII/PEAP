import { useEffect, useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Globe2,
  Icon,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Phone,
  Quote,
  ShieldCheck,
  Sparkles,
  User,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AuthStatusUser, useAuth } from '@/app/auth';
import { roleHomePath } from '@/app/routeGuards';
import {
  registerCandidate,
  submitProviderRegistration,
  verifyCandidateEmail,
} from '@/services/auth/authApi';
import { cn } from '@/lib/utils';
import myImage from '@/assets/ANETI-RAW-LOGO-WHITE-ORANGE.png';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getPortalRole } from '@/lib/portalRoles';
import { stat } from 'fs';

interface LoginLocationState {
  from?: string;
}

type AuthMode = 'signin' | 'signup';
type SignupAudience = 'candidate' | 'provider';

interface ProviderRegistrationForm {
  contactName: string;
  jobTitle: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  companySize: string;
  hiringNeeds: string;
}

const contactEmail = 'contact@matchcore.io';

const emptyProviderForm: ProviderRegistrationForm = {
  contactName: '',
  jobTitle: '',
  companyName: '',
  email: '',
  phone: '',
  website: '',
  companySize: '',
  hiringNeeds: '',
};

const segmentClass = (isActive: boolean) =>
  cn(
    'inline-flex h-10 flex-1 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:bg-surface hover:text-foreground',
  );

export default function Login() {
  const { roleId } = useParams<{ roleId: string }>();
  const role = getPortalRole(roleId ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useAuth();

  const fromPath = (location.state as LoginLocationState | undefined)?.from;

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [signupAudience, setSignupAudience] =
    useState<SignupAudience>('candidate');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');
  const [candidateConfirmPassword, setCandidateConfirmPassword] = useState('');
  const [candidateSignupError, setCandidateSignupError] = useState<
    string | null
  >(null);
  const [candidateSignupMessage, setCandidateSignupMessage] = useState<
    string | null
  >(null);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);

  const [providerForm, setProviderForm] =
    useState<ProviderRegistrationForm>(emptyProviderForm);
  const [providerSuccess, setProviderSuccess] = useState(false);
  const [providerSuccessMessage, setProviderSuccessMessage] = useState<
    string | null
  >(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('verify');
    if (!token) {
      return;
    }

    let isCurrent = true;
    setAuthMode('signin');
    setSubmitError(null);
    setVerificationError(null);
    setVerificationMessage('Verifying your email...');

    verifyCandidateEmail(token)
      .then((response) => {
        if (isCurrent) {
          setVerificationMessage(response.message);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setVerificationMessage(null);
          setVerificationError(
            error instanceof Error ? error.message : 'Unable to verify email',
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          navigate('/login', { replace: true });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [location.search, navigate]);

  const handleModeChange = (nextMode: AuthMode) => {
    setAuthMode(nextMode);
    setSubmitError(null);
    setCandidateSignupError(null);
    setProviderError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const session = await login({
        email: email.trim(),
        password,
      });

      const canReturnToRequestedRoute =
        fromPath?.startsWith(`/${session.user.role}`) ?? false;

      const target = canReturnToRequestedRoute
        ? fromPath!
        : roleHomePath(session.user.role);

      navigate(target, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCandidateSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCandidateSignupError(null);
    setCandidateSignupMessage(null);
    setIsSignupSubmitting(true);

    if (candidatePassword.length < 8) {
      setCandidateSignupError('Use at least 8 characters for your password.');
      setIsSignupSubmitting(false);
      return;
    }

    if (candidatePassword !== candidateConfirmPassword) {
      setCandidateSignupError('Passwords do not match.');
      setIsSignupSubmitting(false);
      return;
    }

    try {
      const normalizedCandidateEmail = candidateEmail.trim();
      const response = await registerCandidate({
        email: normalizedCandidateEmail,
        password: candidatePassword,
      });
      setCandidateSignupMessage(response.message);
      setEmail(normalizedCandidateEmail);
      setCandidateEmail('');
      setCandidatePassword('');
      setCandidateConfirmPassword('');
    } catch (error) {
      setCandidateSignupError(
        error instanceof Error ? error.message : 'Candidate sign-up failed',
      );
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const updateProviderForm = (
    field: keyof ProviderRegistrationForm,
    value: string,
  ) => {
    setProviderForm((current) => ({ ...current, [field]: value }));
  };

  const handleProviderSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProviderError(null);
    setProviderSuccess(false);
    setProviderSuccessMessage(null);

    const trimmedForm = {
      contactName: providerForm.contactName.trim(),
      jobTitle: providerForm.jobTitle.trim(),
      companyName: providerForm.companyName.trim(),
      email: providerForm.email.trim(),
      phone: providerForm.phone.trim(),
      website: providerForm.website.trim() || undefined,
      companySize: providerForm.companySize.trim(),
      hiringNeeds: providerForm.hiringNeeds.trim(),
    };

    if (trimmedForm.contactName.length < 2) {
      setProviderError('Contact name must contain at least 2 characters.');
      return;
    }

    if (trimmedForm.jobTitle.length < 2) {
      setProviderError('Job title must contain at least 2 characters.');
      return;
    }

    if (trimmedForm.companyName.length < 2) {
      setProviderError('Company name must contain at least 2 characters.');
      return;
    }

    if (trimmedForm.phone.length < 4) {
      setProviderError('Phone must contain at least 4 characters.');
      return;
    }

    if (!trimmedForm.companySize) {
      setProviderError('Company size is required.');
      return;
    }

    if (trimmedForm.hiringNeeds.length < 10) {
      setProviderError(
        'Hiring needs must contain at least 10 characters. Example: roles, hiring volume, and target timeline.',
      );
      return;
    }

    setIsSignupSubmitting(true);
    try {
      const response = await submitProviderRegistration(trimmedForm);
      setProviderSuccess(true);
      setProviderSuccessMessage(
        `${response.message} Request id: ${response.request_id}`,
      );
      setProviderForm(emptyProviderForm);
    } catch (error) {
      setProviderError(
        error instanceof Error ? error.message : 'Provider request failed',
      );
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const roleLabel = role?.label ?? "Platform User";

  return (
    <main className="min-h-screen bg-background flex flex-col ">
      <header className="bg-surface border-top-aneti-blue">
        <div className="relative p-4 flex w-full items-center justify-between">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors rounded-md border border-border px-4 py-1 light-link-border-right-orange"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </Link>
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                TalentMesh
              </span>
            </Link>
          </div>
          <div className="relative">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Secure portal
            </span>
          </div>
        </div>
      </header>

      <div className="grid flex-1">
        {/* <section className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary))_62%,hsl(var(--sidebar-accent))_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(hsl(var(--primary-foreground)/0.14)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary-foreground)/0.14)_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-12 py-10 text-center">
            <Link
              to="/landing"
              className="inline-flex items-center justify-center"
            >
              <img
                src="/matchcore-logo-white.svg"
                alt="MatchCore"
                className="h-60 w-auto object-contain"
              />
            </Link>

            <p className="mt-8 max-w-md text-lg leading-8 text-white/80">
              Enterprise-grade access for candidates, job providers, and
              advisors.
            </p>
          </div>
        </section> */}

        {/* <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
                    <div className="w-full max-w-[560px]">
                        <div className="mb-6 flex items-center gap-3 lg:hidden">
                            <div className="rounded-md bg-white px-2.5 py-2 shadow-sm">
                                <img
                                    src="/matchcore-logo.svg"
                                    alt="MatchCore"
                                    className="h-9 w-36 object-contain object-left"
                                />
                            </div>
                        </div>

                        <section className="panel-elevated overflow-hidden">
                            <div className="border-b border-border bg-surface px-5 py-5 sm:px-7">
                                <div className="inline-flex w-full rounded-lg border border-border bg-surface-muted p-1">
                                    <button
                                        type="button"
                                        className={segmentClass(authMode === "signin")}
                                        onClick={() => handleModeChange("signin")}
                                    >
                                        Sign in
                                    </button>
                                    <button
                                        type="button"
                                        className={segmentClass(authMode === "signup")}
                                        onClick={() => handleModeChange("signup")}
                                    >
                                        Sign up
                                    </button>
                                </div>
                            </div>

                            {authMode === "signin" ? (
                                <div className="px-5 py-6 sm:px-7 sm:py-7">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                                            <LogIn className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold text-foreground">
                                                Sign in to MatchCore
                                            </h2>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Candidates, providers, admins, and advisors use secure sign in.
                                            </p>
                                        </div>
                                    </div>

                                    {submitError && (
                                        <Alert variant="destructive" className="mt-5">
                                            <AlertTitle>Sign-in failed</AlertTitle>
                                            <AlertDescription>{submitError}</AlertDescription>
                                        </Alert>
                                    )}

                                    {verificationMessage && (
                                        <Alert className="mt-5 border-success/35 bg-success-soft text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-success" />
                                            <AlertTitle>Email verification</AlertTitle>
                                            <AlertDescription>{verificationMessage}</AlertDescription>
                                        </Alert>
                                    )}

                                    {verificationError && (
                                        <Alert variant="destructive" className="mt-5">
                                            <AlertTitle>Email verification failed</AlertTitle>
                                            <AlertDescription>{verificationError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                                        <div>
                                            <Label htmlFor="email" className="text-xs text-muted-foreground">
                                                Email
                                            </Label>
                                            <div className="relative mt-1.5">
                                                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    value={email}
                                                    onChange={(event) => setEmail(event.target.value)}
                                                    placeholder="name@company.com"
                                                    className="h-11 pl-9"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <Label
                                                htmlFor="password"
                                                className="text-xs text-muted-foreground"
                                            >
                                                Password
                                            </Label>
                                            <div className="relative mt-1.5">
                                                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    value={password}
                                                    onChange={(event) => setPassword(event.target.value)}
                                                    placeholder="Enter your password"
                                                    className="h-11 pl-9"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="h-11 w-full"
                                            disabled={isSubmitting || status === "loading"}
                                        >
                                            <LogIn className="mr-2 h-4 w-4" />
                                            {isSubmitting ? "Signing in..." : "Sign in"}
                                        </Button>
                                    </form>
                                </div>
                            ) : (
                                <div className="px-5 py-6 sm:px-7 sm:py-7">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                                            <UserRound className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold text-foreground">
                                                Create MatchCore access
                                            </h2>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Candidate self-service and provider registration are available here.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 inline-flex w-full rounded-lg border border-border bg-surface-muted p-1">
                                        <button
                                            type="button"
                                            className={segmentClass(signupAudience === "candidate")}
                                            onClick={() => {
                                                setSignupAudience("candidate");
                                                setCandidateSignupError(null);
                                                setProviderError(null);
                                            }}
                                        >
                                            <User className="mr-2 h-4 w-4" />
                                            Candidate
                                        </button>
                                        <button
                                            type="button"
                                            className={segmentClass(signupAudience === "provider")}
                                            onClick={() => {
                                                setSignupAudience("provider");
                                                setProviderError(null);
                                                setCandidateSignupError(null);
                                            }}
                                        >
                                            <BriefcaseBusiness className="mr-2 h-4 w-4" />
                                            Job provider
                                        </button>
                                    </div>

                                    {signupAudience === "candidate" ? (
                                        <form onSubmit={handleCandidateSignup} className="mt-6 space-y-4">
                                            {candidateSignupError && (
                                                <Alert variant="destructive">
                                                    <AlertTitle>Sign-up needs attention</AlertTitle>
                                                    <AlertDescription>{candidateSignupError}</AlertDescription>
                                                </Alert>
                                            )}

                                            {candidateSignupMessage && (
                                                <Alert className="border-success/35 bg-success-soft text-foreground">
                                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                                    <AlertTitle>Verification required</AlertTitle>
                                                    <AlertDescription>{candidateSignupMessage}</AlertDescription>
                                                </Alert>
                                            )}

                                            <div>
                                                <Label htmlFor="candidate-email" className="text-xs text-muted-foreground">
                                                    Email
                                                </Label>
                                                <div className="relative mt-1.5">
                                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        id="candidate-email"
                                                        type="email"
                                                        autoComplete="email"
                                                        value={candidateEmail}
                                                        onChange={(event) => setCandidateEmail(event.target.value)}
                                                        placeholder="candidate@email.com"
                                                        className="h-11 pl-9"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="candidate-password" className="text-xs text-muted-foreground">
                                                        Password
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="candidate-password"
                                                            type="password"
                                                            autoComplete="new-password"
                                                            value={candidatePassword}
                                                            onChange={(event) => setCandidatePassword(event.target.value)}
                                                            placeholder="Create password"
                                                            className="h-11 pl-9"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label htmlFor="candidate-confirm-password" className="text-xs text-muted-foreground">
                                                        Confirm password
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="candidate-confirm-password"
                                                            type="password"
                                                            autoComplete="new-password"
                                                            value={candidateConfirmPassword}
                                                            onChange={(event) => setCandidateConfirmPassword(event.target.value)}
                                                            placeholder="Confirm password"
                                                            className="h-11 pl-9"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button type="submit" className="h-11 w-full" disabled={isSignupSubmitting}>
                                                {isSignupSubmitting ? "Preparing verification..." : "Create candidate account"}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleProviderSignup} className="mt-6 space-y-4">
                                            {providerError && (
                                                <Alert variant="destructive">
                                                    <AlertTitle>Request failed</AlertTitle>
                                                    <AlertDescription>{providerError}</AlertDescription>
                                                </Alert>
                                            )}

                                            {providerSuccess && (
                                                <Alert className="border-success/35 bg-success-soft text-foreground">
                                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                                    <AlertTitle>Demande envoy&eacute;e</AlertTitle>
                                                    <AlertDescription>
                                                        {providerSuccessMessage || "Vos informations ont ete envoyees avec succes. Un conseiller examinera votre demande."} Pour toute question compl&eacute;mentaire, veuillez nous contacter &agrave;{" "}
                                                        <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                                                            {contactEmail}
                                                        </a>
                                                        .
                                                    </AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="provider-name" className="text-xs text-muted-foreground">
                                                        Contact name
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="provider-name"
                                                            value={providerForm.contactName}
                                                            onChange={(event) => updateProviderForm("contactName", event.target.value)}
                                                            placeholder="Full name"
                                                            className="h-11 pl-9"
                                                            minLength={2}
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label htmlFor="provider-title" className="text-xs text-muted-foreground">
                                                        Job title
                                                    </Label>
                                                    <Input
                                                        id="provider-title"
                                                        value={providerForm.jobTitle}
                                                        onChange={(event) => updateProviderForm("jobTitle", event.target.value)}
                                                        placeholder="HR manager"
                                                        className="mt-1.5 h-11"
                                                        minLength={2}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="provider-company" className="text-xs text-muted-foreground">
                                                    Company
                                                </Label>
                                                <div className="relative mt-1.5">
                                                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        id="provider-company"
                                                        value={providerForm.companyName}
                                                        onChange={(event) => updateProviderForm("companyName", event.target.value)}
                                                        placeholder="Company name"
                                                        className="h-11 pl-9"
                                                        minLength={2}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="provider-email" className="text-xs text-muted-foreground">
                                                        Business email
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="provider-email"
                                                            type="email"
                                                            autoComplete="email"
                                                            value={providerForm.email}
                                                            onChange={(event) => updateProviderForm("email", event.target.value)}
                                                            placeholder="name@company.com"
                                                            className="h-11 pl-9"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label htmlFor="provider-phone" className="text-xs text-muted-foreground">
                                                        Phone
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="provider-phone"
                                                            type="tel"
                                                            autoComplete="tel"
                                                            value={providerForm.phone}
                                                            onChange={(event) => updateProviderForm("phone", event.target.value)}
                                                            placeholder="+216 00 000 000"
                                                            className="h-11 pl-9"
                                                            minLength={4}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label htmlFor="provider-website" className="text-xs text-muted-foreground">
                                                        Website
                                                    </Label>
                                                    <div className="relative mt-1.5">
                                                        <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="provider-website"
                                                            type="url"
                                                            value={providerForm.website}
                                                            onChange={(event) => updateProviderForm("website", event.target.value)}
                                                            placeholder="https://company.com"
                                                            className="h-11 pl-9"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label htmlFor="provider-size" className="text-xs text-muted-foreground">
                                                        Company size
                                                    </Label>
                                                    <Input
                                                        id="provider-size"
                                                        value={providerForm.companySize}
                                                        onChange={(event) => updateProviderForm("companySize", event.target.value)}
                                                        placeholder="51-200"
                                                        className="mt-1.5 h-11"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="provider-needs" className="text-xs text-muted-foreground">
                                                    Hiring needs
                                                </Label>
                                                <Textarea
                                                    id="provider-needs"
                                                    value={providerForm.hiringNeeds}
                                                    onChange={(event) => updateProviderForm("hiringNeeds", event.target.value)}
                                                    placeholder="Roles, hiring volume, and target timeline"
                                                    className="mt-1.5 min-h-24 resize-none"
                                                    minLength={10}
                                                    required
                                                />
                                            </div>

                                            <Button type="submit" className="h-11 w-full" disabled={isSignupSubmitting}>
                                                {isSignupSubmitting ? "Sending request..." : "Send provider request"}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                </section> */}
        {/* Centered card */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 card-border-top">
            <div className="w-full max-w-[440px]">
              <div className="p-8 sm:p-10">
                {/* Role chip */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 mb-6">
                  {/* <Icon className="h-3.5 w-3.5 text-primary" /> */}
                  <span className="text-[16px] font-medium text-muted-foreground">
                    Signing in as{' '}
                    <span className="text-foreground font-semibold text-primary">
                      {roleLabel}
                    </span>
                  </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  Welcome Back
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to access your dashboard and continue your workflow.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Username or email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={remember}
                        onCheckedChange={(v) => setRemember(v === true)}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {submitError && (
                    <p className="text-sm text-destructive">
                      Invalid email or password.
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 mt-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </div>
            </div>
            {/* RIGHT — Brand panel */}
            <aside className="hidden lg:flex relative overflow-hidden bg-primary text-primary-foreground rounded-2xl-right">
              {/* Decorative gradients */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent opacity-95" />
              <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
              <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-3xl" />

              <div className="relative z-10 flex flex-col justify-between p-10 w-full">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-2.5 self-start">
                  <div className="flex items-center gap-2.5 ">
                    <div className="">
                      <img
                        src={myImage}
                        alt="Logo"
                        className="h-16 w-full object-contain object-left"
                      />
                    </div>
                  </div>
                </Link>

                {/* Headline + testimonial */}
                <div className="mt-5 max-w-md">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm px-2 py-1 mb-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium tracking-wider">
                        Powered By
                      </span>
                      <span className="text-[11px] font-bold tracking-wider">
                        MatchCore Engine
                      </span>
                    </div>
                    <h2 className="text-4xl font-semibold tracking-tight leading-[1.15]">
                      Simplify your workflow with smart tools.
                    </h2>
                    <p className="my-4 text-base opacity-80 leading-relaxed">
                      A unified workspace built for advisors, managers and
                      operations teams — designed to surface the right candidate
                      at the right moment.
                    </p>
                  </div>

                  <figure className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 p-6">
                    <Quote className="h-5 w-5 opacity-60 mb-3" />
                    <blockquote className="text-sm leading-relaxed">
                      "This platform helps our team stay efficient and deliver
                      high-quality results. The matching intelligence cut our
                      screening time in half."
                    </blockquote>
                    {/* <figcaption className="mt-5 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-semibold">
                        CL
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Camille Laurent</p>
                        <p className="text-xs opacity-70">
                          Head of Talent · Pôle Emploi Innovation
                        </p>
                      </div>
                    </figcaption> */}
                  </figure>
                </div>

                {/* Bottom meta */}
                <div className="flex items-center justify-between text-[11px] opacity-70 font-mono mt-8">
                  <span>env: sandbox</span>
                  <span>version: 0.15.2</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
