import { useRef, type ChangeEvent } from "react";
import { Loader2, RefreshCcw, UploadCloud } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  getDemoCvUploadStep,
  isDemoCvUploadBusy,
  startDemoCvUpload,
  useDemoCvUploadSession,
} from "@/services/candidate/demoCvSession";

type CandidateCvUploadButtonProps = Pick<ButtonProps, "variant" | "size" | "className">;

const acceptedFileTypes = ".pdf,.doc,.docx,.png,.jpg,.jpeg";

export function CandidateCvUploadButton({
  variant = "outline",
  size = "sm",
  className,
}: CandidateCvUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const session = useDemoCvUploadSession();
  const currentStep = getDemoCvUploadStep(session?.stage);
  const isBusy = isDemoCvUploadBusy(session);
  const isComplete = session?.stage === "done";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }

    startDemoCvUpload(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedFileTypes}
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-busy={isBusy}
        onClick={() => inputRef.current?.click()}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isComplete ? (
          <RefreshCcw className="h-4 w-4" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        {isComplete ? "Upload another CV" : currentStep.label}
      </Button>
    </>
  );
}
