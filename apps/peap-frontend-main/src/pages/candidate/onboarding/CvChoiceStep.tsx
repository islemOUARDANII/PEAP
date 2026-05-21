import { FileText, PenLine, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CvChoice } from '@/types/candidateOnboarding';
import { useOnboardingContext } from './CandidateOnboardingLayout';

const OPTIONS: { value: CvChoice; icon: React.ReactNode; label: string; description: string }[] =
  [
    {
      value: 'upload',
      icon: <Upload className="h-6 w-6" />,
      label: 'Importer mon CV',
      description:
        'Importez votre CV existant (PDF, Word). Nous extrairons automatiquement vos informations.',
    },
    {
      value: 'manual',
      icon: <PenLine className="h-6 w-6" />,
      label: 'Saisir manuellement',
      description:
        'Renseignez vos informations étape par étape via le formulaire de saisie guidée.',
    },
  ];

export default function CvChoiceStep() {
  const { draft, updateDraft, goNext } = useOnboardingContext();

  const handleSelect = (choice: CvChoice) => {
    updateDraft({ cvChoice: choice });
    // Auto-advance when choice is made
    goNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Comment souhaitez-vous renseigner votre profil ?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez la méthode qui vous convient le mieux. Vous pourrez modifier votre profil plus
          tard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ value, icon, label, description }) => {
          const isSelected = draft.cvChoice === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              className={cn(
                'flex flex-col items-start rounded-xl border p-6 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-surface hover:shadow-sm',
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg mb-4 transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {icon}
              </div>
              <p className="text-base font-semibold text-foreground">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>

              {value === 'upload' && (
                <div className="mt-4 w-full">
                  {/* TODO: wire to CandidateCvUploadButton when cvChoice === 'upload' */}
                  <div className="rounded-md border-2 border-dashed border-border p-4 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">PDF, DOC, DOCX — max 5 Mo</p>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
