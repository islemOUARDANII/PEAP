import { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTaxonomyAutocompleteQuery } from '@/services/api/queries';
import { cn } from '@/lib/utils';

type TaxonomyNodeType = 'OCCUPATION' | 'SKILL' | 'SOFT_SKILL' | 'DIGITAL_SKILL';

interface TaxonomyAutocompleteProps {
  /** Type de nœud taxonomy à rechercher. */
  nodeType: TaxonomyNodeType;
  /** ID du nœud sélectionné. */
  nodeId: string;
  /** Libellé actuellement sélectionné. */
  labelValue: string;
  /** Libellé du champ (affiché au-dessus). */
  displayLabel?: string;
  placeholder?: string;
  required?: boolean;
  onChange: (nodeId: string, label: string) => void;
  className?: string;
}

export function TaxonomyAutocomplete({
  nodeType,
  nodeId,
  labelValue,
  displayLabel,
  placeholder = 'Rechercher…',
  required,
  onChange,
  className,
}: TaxonomyAutocompleteProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useTaxonomyAutocompleteQuery(q, nodeType);
  const results = data?.items ?? [];

  const hasSelection = Boolean(nodeId || labelValue);

  const handleSelect = (id: string, label: string) => {
    onChange(id, label);
    setQ('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('', '');
    setQ('');
  };

  return (
    <div className={cn('space-y-1.5', className)} ref={containerRef}>
      {displayLabel && (
        <Label className="text-sm text-foreground">
          {displayLabel}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      {/* Sélection courante */}
      {hasSelection && q === '' ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm text-foreground flex-1 truncate">{labelValue}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={q}
            placeholder={placeholder}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="h-10"
          />

          {open && q.trim().length >= 2 && (
            <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">
                  Aucun résultat trouvé
                </div>
              ) : (
                results.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(node.id, node.preferred_label);
                    }}
                  >
                    {node.preferred_label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {q === '' && !hasSelection && (
        <p className="text-xs text-muted-foreground">
          Saisissez au moins 2 caractères pour rechercher.
        </p>
      )}
    </div>
  );
}
