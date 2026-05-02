import { FileText } from "lucide-react";

import { CandidateCvDemoUploadPanel } from "@/components/common/CandidateCvDemoUploadPanel";
import { cn } from "@/lib/utils";
import { getDemoCvUploadStep, isDemoCvUploadBusy, useDemoCvUploadSession } from "@/services/candidate/demoCvSession";

interface CandidateOnboardingEmptyStateProps {
  className?: string;
}

export function CandidateOnboardingEmptyState({ className }: CandidateOnboardingEmptyStateProps) {
  const session = useDemoCvUploadSession();
  const currentStep = getDemoCvUploadStep(session?.stage);
  const isProcessing = isDemoCvUploadBusy(session);

  return (
    <section className={cn("panel overflow-hidden", className)}>
      <div className="h-1 bg-accent" />
      <div className="p-6 sm:p-8">
        <div className="space-y-6">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-accent/20 bg-accent-soft text-accent">
            <FileText className="h-7 w-7" />
          </div>
          <p className="stat-label mb-2 text-accent">Profile setup</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {isProcessing ? currentStep.label : "Upload your CV"}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {isProcessing
              ? "We are processing your CV and preparing your profile. This may take a few moments."
              : "Upload your latest CV to create your profile and review your experience, education, and skills in one place."}
          </p>
          <CandidateCvDemoUploadPanel className="border-0 shadow-none" />
        </div>
      </div>
    </section>
  );
}
