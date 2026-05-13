import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileBadge2, FileUp, Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatDemoCvFileSize,
  getDemoCvUploadStep,
  isDemoCvUploadBusy,
  startDemoCvUpload,
  useDemoCvUploadSession,
} from "@/services/candidate/demoCvSession";

interface CandidateCvDemoUploadPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

const acceptedFileTypes = ".pdf,.doc,.docx,.png,.jpg,.jpeg";

export function CandidateCvDemoUploadPanel({
  title = "Drop in your latest CV",
  description = "Choose a file or drag it here to build your profile and review extracted information.",
  className,
}: CandidateCvDemoUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const session = useDemoCvUploadSession();
  const [isDragging, setIsDragging] = useState(false);

  const currentStep = getDemoCvUploadStep(session?.stage);
  const isBusy = isDemoCvUploadBusy(session);

  const handleFile = (file: File | null) => {
    if (!file) {
      return;
    }

    startDemoCvUpload(file);
    setIsDragging(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <section className={cn("panel overflow-hidden", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedFileTypes}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="border-b border-border bg-gradient-to-r from-primary/5 via-accent-soft/60 to-background px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="h-4 w-4" />
            {session ? "Replace file" : "Choose file"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <div
          className={cn(
            "rounded-2xl border border-dashed bg-surface-muted/50 p-6 transition-colors",
            isDragging ? "border-accent bg-accent-soft/50" : "border-border",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              {isBusy ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                {isBusy ? currentStep.label : "Drag and drop your CV here"}
              </p>
              <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                Drop a PDF, DOC, DOCX, PNG, JPG, or JPEG file to start processing.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button type="button" onClick={() => inputRef.current?.click()}>
                <FileUp className="h-4 w-4" />
                Select CV
              </Button>
              <span className="text-xs text-muted-foreground">Accepted formats: PDF, DOC, DOCX, PNG, JPG, JPEG</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:max-w-sm">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <FileBadge2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Selected file</p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {session?.fileName ?? "No file selected yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {session ? formatDemoCvFileSize(session.fileSize) : acceptedFileTypes.replaceAll(",", " | ")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Current status</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{currentStep.label}</p>
              </div>
              <span className="text-sm font-semibold text-accent">{currentStep.progress}%</span>
            </div>
            <Progress value={currentStep.progress} className="h-2.5 bg-accent-soft/60" />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{currentStep.detail}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
