import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  getCandidatePortalErrorMessage,
  invalidateCandidatePortalQueries,
  uploadAndParseCandidateCv,
} from '@/services/candidate/candidateProfileOnboarding';

interface CandidateProfileOnboardingCardProps {
  title?: string;
  description?: string;
  helperText?: string;
  buttonLabel?: string;
  className?: string;
  compact?: boolean;
}

type UploadStep = 'idle' | 'uploading' | 'parsing';

export default function CandidateProfileOnboardingCard({
  title = "Bienvenue à la Plateforme de l'Emploi et de l'Accompagnement Professionnel de l'ANETI",
  description = "Il semble que ce soit votre première inscription. Veuillez téléverser votre CV afin de créer votre profil candidat. Une fois le CV analysé, votre profil sera automatiquement prérempli et vous pourrez le compléter ou le corriger.",
  helperText = 'Formats acceptés : PDF, DOC ou DOCX.',
  buttonLabel = 'Uploader mon CV',
  className,
  compact = false,
}: CandidateProfileOnboardingCardProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');

  const isBusy = uploadStep !== 'idle';
  const buttonText =
    uploadStep === 'uploading'
      ? 'Import du CV...'
      : uploadStep === 'parsing'
        ? 'Analyse du CV...'
        : buttonLabel;

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setUploadStep('uploading');

    try {
      await uploadAndParseCandidateCv(file, {
        onUploaded: () => {
          setUploadStep('parsing');
        },
      });

      await invalidateCandidatePortalQueries(queryClient);
      toast.success(
        'Votre CV a été analysé. Votre profil candidat est en cours de mise à jour.',
      );
    } catch (error) {
      toast.error(
        getCandidatePortalErrorMessage(
          error,
          "Impossible d'uploader ou d'analyser le CV",
        ),
      );
    } finally {
      setUploadStep('idle');

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <section
      className={cn('panel overflow-hidden card-border-top p-0', className)}
    >
      <div className="h-1 bg-accent" />
      <div className={cn('space-y-6', compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8')}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
          <FileText className="h-7 w-7" />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Première inscription
          </p>
          <h1
            className={cn(
              'font-semibold text-foreground',
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
            )}
          >
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(event) =>
              void handleUpload(event.target.files?.[0] ?? null)
            }
          />

          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {buttonText}
          </Button>

          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      </div>
    </section>
  );
}
