import { CandidateCvUploadButton } from "@/components/common/CandidateCvUploadButton";
import { CandidateOnboardingEmptyState } from "@/components/common/CandidateOnboardingEmptyState";
import { CandidateParsedCvPreview } from "@/components/common/CandidateParsedCvPreview";
import { PageHeader } from "@/components/common/PageHeader";
import { useDemoCvUploadSession } from "@/services/candidate/demoCvSession";

interface CandidateCvDemoWorkspaceProps {
  title: string;
  description: string;
}

export function CandidateCvDemoWorkspace({ title, description }: CandidateCvDemoWorkspaceProps) {
  const session = useDemoCvUploadSession();
  const isComplete = session?.stage === "done";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<CandidateCvUploadButton />}
      />

      {isComplete ? <CandidateParsedCvPreview /> : <CandidateOnboardingEmptyState />}
    </div>
  );
}
