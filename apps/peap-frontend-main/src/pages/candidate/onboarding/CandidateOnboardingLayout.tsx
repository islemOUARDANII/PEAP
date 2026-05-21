import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import myImage from '@/assets/ANETI-RAW-LOGO-WHITE-ORANGE.png';
import {
  initialOnboardingDraft,
  ONBOARDING_STEPS,
  type OnboardingDraft,
} from '@/types/candidateOnboarding';

const DRAFT_STORAGE_KEY = 'peap:candidate:onboarding_draft';

// ─── Context ────────────────────────────────────────────────────────────────

interface OnboardingContextValue {
  draft: OnboardingDraft;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  saveDraft: () => void;
  goNext: () => void;
  goBack: () => void;
  currentStepIndex: number;
  totalSteps: number;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext must be used inside CandidateOnboardingLayout');
  }
  return ctx;
}

// ─── Draft persistence helpers ───────────────────────────────────────────────

function loadDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { ...initialOnboardingDraft };
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return { ...initialOnboardingDraft, ...parsed };
  } catch {
    return { ...initialOnboardingDraft };
  }
}

function persistDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // storage might be full — fail silently
  }
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function CandidateOnboardingLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<OnboardingDraft>(loadDraft);

  // Persist draft whenever it changes
  useEffect(() => {
    persistDraft(draft);
  }, [draft]);

  const updateDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveDraft = useCallback(() => {
    persistDraft(draft);
  }, [draft]);

  // Determine current step from pathname
  const currentStepIndex = useMemo(() => {
    const idx = ONBOARDING_STEPS.findIndex((s) => location.pathname.endsWith(s.key));
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);

  const totalSteps = ONBOARDING_STEPS.length;

  const goNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      navigate(ONBOARDING_STEPS[currentStepIndex + 1].path);
    }
  }, [currentStepIndex, navigate, totalSteps]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      navigate(ONBOARDING_STEPS[currentStepIndex - 1].path);
    }
  }, [currentStepIndex, navigate]);

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({ draft, updateDraft, saveDraft, goNext, goBack, currentStepIndex, totalSteps }),
    [draft, updateDraft, saveDraft, goNext, goBack, currentStepIndex, totalSteps],
  );

  const progressPct = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const isLastStep = currentStepIndex === totalSteps - 1;
  const currentStep = ONBOARDING_STEPS[currentStepIndex];

  return (
    <OnboardingContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* ── Header ── */}
        <header className="bg-surface border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={myImage} alt="ANETI" className="h-10 w-auto object-contain" />
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Étape{' '}
                <span className="font-semibold text-foreground">{currentStepIndex + 1}</span>
                {' / '}
                {totalSteps}
              </span>
              <Link
                to="/candidate"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Quitter
              </Link>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-1 bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {/* ── Stepper (desktop) ── */}
        <div className="hidden sm:block border-b border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <ol className="flex items-center gap-1">
              {ONBOARDING_STEPS.map((step, i) => {
                const isDone = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <li key={step.key} className="flex items-center">
                    {i > 0 && (
                      <div
                        className={cn(
                          'h-px w-6 mx-1',
                          isDone ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => i < currentStepIndex && navigate(step.path)}
                      disabled={i >= currentStepIndex}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                        isCurrent
                          ? 'text-primary font-semibold'
                          : isDone
                            ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                            : 'text-muted-foreground/50 cursor-default',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border',
                          isCurrent
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isDone
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground',
                        )}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      <span className="hidden lg:inline">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* ── Mobile step label ── */}
        <div className="sm:hidden px-4 py-2 bg-surface border-b border-border">
          <p className="text-sm font-medium text-foreground">
            {currentStep?.label}
          </p>
        </div>

        {/* ── Step content ── */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <Outlet />
          </div>
        </main>

        {/* ── Footer navigation ── */}
        <footer className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentStepIndex === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={saveDraft} className="gap-2 hidden sm:inline-flex">
                <Save className="h-4 w-4" />
                Sauvegarder
              </Button>

              {isLastStep ? (
                <Button onClick={goNext} className="gap-2">
                  Terminer
                  <Check className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={goNext} className="gap-2">
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </OnboardingContext.Provider>
  );
}
