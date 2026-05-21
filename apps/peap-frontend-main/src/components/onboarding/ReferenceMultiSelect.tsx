import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useRefDropdownQuery } from '@/services/api/queries';
import { refLabel } from './ReferenceSelect';
import { cn } from '@/lib/utils';

interface ReferenceMultiSelectProps {
  /** Code du groupe référentiel (ex : 'REGISTRATION_REASON'). */
  groupCode: string;
  /** Codes sélectionnés. */
  values: string[];
  onChange: (codes: string[]) => void;
  label?: string;
  required?: boolean;
  className?: string;
  /** Affichage en grille de cartes plutôt qu'en liste de cases à cocher. */
  cardGrid?: boolean;
}

export function ReferenceMultiSelect({
  groupCode,
  values,
  onChange,
  label,
  required,
  className,
  cardGrid = false,
}: ReferenceMultiSelectProps) {
  const { data, isLoading, isError } = useRefDropdownQuery(groupCode, Boolean(groupCode));
  const items = data?.items ?? [];

  const toggle = (code: string) => {
    if (values.includes(code)) {
      onChange(values.filter((c) => c !== code));
    } else {
      onChange([...values, code]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">Impossible de charger les données.</p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
      )}

      {!isLoading && items.length > 0 && (
        cardGrid ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const isSelected = values.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggle(item.code)}
                  className={cn(
                    'flex flex-col items-start rounded-lg border p-4 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40 hover:bg-surface',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {refLabel(item)}
                    </span>
                    <span
                      className={cn(
                        'h-4 w-4 rounded-full border-2 transition-colors shrink-0',
                        isSelected ? 'border-primary bg-primary' : 'border-border',
                      )}
                    />
                  </div>
                  {item.label_fr && item.label && item.label_fr !== item.label && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <label
                key={item.code}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={values.includes(item.code)}
                  onCheckedChange={() => toggle(item.code)}
                />
                <span className="text-sm text-foreground">{refLabel(item)}</span>
              </label>
            ))}
          </div>
        )
      )}
    </div>
  );
}
