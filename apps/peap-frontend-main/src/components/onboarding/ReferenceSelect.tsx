import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRefDropdownQuery } from '@/services/api/queries';
import { cn } from '@/lib/utils';
import type { RefValue } from '@/models/references';

/** Retourne le libellé français en priorité, puis label, puis code. */
export function refLabel(item: RefValue): string {
  return item.label_fr ?? item.label ?? item.code;
}

interface ReferenceSelectProps {
  /** Code du groupe référentiel (ex : 'CIVILITY', 'MARITAL_STATUS'). */
  groupCode: string;
  /** Valeur sélectionnée — stocke ref_value.code. */
  value: string;
  onChange: (code: string, label: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ReferenceSelect({
  groupCode,
  value,
  onChange,
  label,
  placeholder = 'Sélectionner',
  required,
  disabled,
  className,
}: ReferenceSelectProps) {
  const { data, isLoading, isError } = useRefDropdownQuery(groupCode, Boolean(groupCode));
  const items = data?.items ?? [];

  let triggerPlaceholder = placeholder;
  if (isLoading) triggerPlaceholder = 'Chargement…';
  if (isError) triggerPlaceholder = 'Impossible de charger les données';
  if (!isLoading && !isError && items.length === 0) triggerPlaceholder = 'Aucune donnée disponible';

  const isDisabled = disabled || isLoading || (items.length === 0 && !isError);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label className="text-sm text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <Select
        value={value || '__empty__'}
        onValueChange={(v) => {
          if (v === '__empty__') {
            onChange('', '');
            return;
          }
          const item = items.find((i) => i.code === v);
          onChange(v, item ? refLabel(item) : v);
        }}
        disabled={isDisabled}
      >
        <SelectTrigger className="h-10">
          <SelectValue placeholder={triggerPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">{placeholder}</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {refLabel(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="text-xs text-destructive">Impossible de charger les données.</p>
      )}
    </div>
  );
}
