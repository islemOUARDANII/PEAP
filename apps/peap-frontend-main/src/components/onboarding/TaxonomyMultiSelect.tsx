import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaxonomyAutocompleteQuery, useRefDropdownQuery } from '@/services/api/queries';
import { refLabel } from './ReferenceSelect';
import type { OnboardingSkillItem } from '@/types/candidateOnboarding';
import { cn } from '@/lib/utils';

type TaxonomyNodeType = 'OCCUPATION' | 'SKILL' | 'SOFT_SKILL' | 'DIGITAL_SKILL';

/** Niveaux de repli si le référentiel SKILL_LEVEL est vide. */
const FALLBACK_LEVELS = [
  { code: 'BEGINNER', label: 'Débutant' },
  { code: 'INTERMEDIATE', label: 'Intermédiaire' },
  { code: 'ADVANCED', label: 'Avancé' },
  { code: 'EXPERT', label: 'Expert' },
];

interface TaxonomyMultiSelectProps {
  nodeType: TaxonomyNodeType;
  items: OnboardingSkillItem[];
  onChange: (items: OnboardingSkillItem[]) => void;
  /** Afficher un sélecteur de niveau par compétence. */
  withLevel?: boolean;
  /** Code du groupe référentiel pour les niveaux. Défaut : 'SKILL_LEVEL'. */
  levelGroupCode?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function TaxonomyMultiSelect({
  nodeType,
  items,
  onChange,
  withLevel = false,
  levelGroupCode = 'SKILL_LEVEL',
  label,
  placeholder = 'Rechercher et ajouter…',
  className,
}: TaxonomyMultiSelectProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const { data: searchData } = useTaxonomyAutocompleteQuery(q, nodeType);
  const results = searchData?.items ?? [];

  const { data: levelData } = useRefDropdownQuery(levelGroupCode, withLevel);
  const rawLevels = levelData?.items ?? [];
  const levelOptions = rawLevels.length > 0
    ? rawLevels.map((l) => ({ code: l.code, label: refLabel(l) }))
    : FALLBACK_LEVELS;

  const alreadyAdded = (nodeId: string) => items.some((i) => i.nodeId === nodeId);

  const addItem = (nodeId: string, nodeLabel: string) => {
    if (alreadyAdded(nodeId)) return;
    onChange([...items, { nodeId, label: nodeLabel, levelCode: '' }]);
    setQ('');
    setOpen(false);
  };

  const removeItem = (nodeId: string) => {
    onChange(items.filter((i) => i.nodeId !== nodeId));
  };

  const updateLevel = (nodeId: string, levelCode: string) => {
    onChange(items.map((i) => (i.nodeId === nodeId ? { ...i, levelCode } : i)));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm text-foreground">{label}</Label>}

      {/* Champ de recherche */}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={q}
            placeholder={placeholder}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="h-9 flex-1"
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="h-9 px-3 rounded-md border border-border hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {open && q.trim().length >= 2 && (
          <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                Aucun résultat trouvé
              </div>
            ) : (
              results.map((node) => {
                const added = alreadyAdded(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    disabled={added}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addItem(node.id, node.preferred_label);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      added
                        ? 'text-muted-foreground cursor-default'
                        : 'hover:bg-surface-muted cursor-pointer',
                    )}
                  >
                    {node.preferred_label}
                    {added && <span className="ml-2 text-xs">(déjà ajouté)</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Items sélectionnés */}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun élément sélectionné.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.nodeId}
            className={cn(
              'flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2',
              withLevel && 'flex-wrap sm:flex-nowrap',
            )}
          >
            <Badge variant="secondary" className="flex-1 min-w-0 gap-1 pr-1">
              <span className="truncate">{item.label}</span>
              <button
                type="button"
                onClick={() => removeItem(item.nodeId)}
                className="hover:text-destructive transition-colors ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>

            {withLevel && (
              <Select
                value={item.levelCode || '__empty__'}
                onValueChange={(v) =>
                  updateLevel(item.nodeId, v === '__empty__' ? '' : v)
                }
              >
                <SelectTrigger className="h-8 w-[140px] shrink-0 text-xs">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Niveau</SelectItem>
                  {levelOptions.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
