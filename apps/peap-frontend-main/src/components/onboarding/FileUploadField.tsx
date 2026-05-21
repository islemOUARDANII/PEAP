import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FileUploadFieldProps {
  /** Libellé affiché au-dessus du champ. */
  label: string;
  /** Types de fichiers acceptés (ex : '.pdf,.jpg'). */
  accept?: string;
  /** Identifiant du fichier déjà uploadé (placeholder pour une intégration future). */
  fileId?: string;
  /** Nom du fichier affiché (si déjà uploadé). */
  fileName?: string;
  required?: boolean;
  className?: string;
  /**
   * TODO: Connecter à l'endpoint d'upload quand il sera disponible.
   * Pour l'instant, stocke uniquement le nom local du fichier.
   */
  onChange?: (fileId: string, fileName: string) => void;
}

export function FileUploadField({
  label,
  accept = '.pdf,.jpg,.jpeg,.png',
  fileId,
  fileName,
  required,
  className,
  onChange,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localFile, setLocalFile] = useState<string>(fileName ?? '');
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    setLocalFile(file.name);
    // TODO: appeler l'endpoint d'upload ici quand disponible
    // Exemple : const result = await uploadDocument(file);
    // onChange(result.fileId, file.name);
    onChange?.(fileId ?? '', file.name);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setLocalFile('');
    onChange?.('', '');
    if (inputRef.current) inputRef.current.value = '';
  };

  const displayName = localFile || fileName;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {displayName ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-foreground flex-1 truncate">{displayName}</span>
          <button
            type="button"
            onClick={clearFile}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-5 cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-surface',
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm text-foreground font-medium">
            Cliquer ou glisser un fichier
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {accept.replace(/\./g, '').replace(/,/g, ', ').toUpperCase()} — max 5 Mo
          </p>
          {/* TODO: upload effectif non implémenté — le fichier est seulement affiché localement */}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
