import { useState } from "react";
import { Eye, FileText } from "lucide-react";
import { toast } from "sonner";

import type { CandidateDocument } from "@/models";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { talentApi } from "@/services/api/talentApi";

interface PdfPreviewDialogProps {
  document: CandidateDocument;
  label?: string;
}

const pdfViewerUrl = (url: string) =>
  url.includes("#") ? url : `${url}#toolbar=0&navpanes=0&scrollbar=1`;

const isFresh = (expiresAt?: string): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires - Date.now() > 30_000;
};

export function PdfPreviewDialog({ document, label = "Open CV" }: PdfPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<{ url: string; expiresAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPdf =
    document.mimeType?.toLowerCase().includes("pdf") ||
    document.filename.toLowerCase().endsWith(".pdf");
  const canRequestAccess = Boolean(document.id);

  const resolveAccess = async () => {
    if (access && isFresh(access.expiresAt)) {
      return access.url;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextAccess = await talentApi.documents.getAccess(document.id, document.accessUrl);
      setAccess({ url: nextAccess.url, expiresAt: nextAccess.expiresAt });
      return nextAccess.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document access failed";
      setErrorMessage(message);
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && isPdf) {
      void resolveAccess();
    }
  };

  const handleExternalOpen = async () => {
    const target = window.open("about:blank", "_blank");
    try {
      const url = await resolveAccess();
      if (target) {
        target.opener = null;
        target.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      target?.close();
    }
  };

  if (!isPdf) {
    return (
      <Button variant="outline" size="sm" disabled={!canRequestAccess || isLoading} onClick={handleExternalOpen}>
        <Eye className="mr-1.5 h-4 w-4" />
        {isLoading ? "Opening" : label}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!canRequestAccess || isLoading}>
          <Eye className="mr-1.5 h-4 w-4" />
          {isLoading ? "Opening" : label}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[88vh] max-w-5xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-accent" />
            <DialogTitle className="truncate text-base">{document.filename}</DialogTitle>
          </div>
          <DialogDescription>
            {document.docType} - {document.uploadedAt ? document.uploadedAt.slice(0, 10) : "Upload date unavailable"}
          </DialogDescription>
        </DialogHeader>

        {access?.url ? (
          <iframe
            title={document.filename}
            src={pdfViewerUrl(access.url)}
            className="min-h-0 flex-1 border-0 bg-surface-muted"
          />
        ) : isLoading ? (
          <div className="flex flex-1 items-center justify-center bg-surface-muted p-6 text-sm text-muted-foreground">
            Opening document...
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-surface-muted p-6 text-sm text-muted-foreground">
            {errorMessage || "PDF preview is not available for this document."}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
