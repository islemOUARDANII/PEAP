import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTaxonomyAutocompleteQuery } from '@/services/api/queries';

export interface SkillRequirement {
  taxonomyNodeId: string;
  rawValue: string;
  isMust: boolean;
  weight: number | null;
}

export function emptySkillRequirement(isMust = false): SkillRequirement {
  return { taxonomyNodeId: '', rawValue: '', isMust, weight: null };
}

function SkillRequirementRow({
  item,
  update,
  onRemove,
  nodeType,
}: {
  item: SkillRequirement;
  update: (next: SkillRequirement) => void;
  onRemove: () => void;
  nodeType: 'SKILL' | 'SOFT_SKILL';
}) {
  const [q, setQ] = useState('');
  const { data: results } = useTaxonomyAutocompleteQuery(q, nodeType);

  return (
    <div className="grid gap-2 rounded-xl border border-border bg-background p-3 md:grid-cols-[1fr_auto] border-color-aneti-blue border-left-aneti">
      <div className="space-y-1 relative">
        <Input
          value={q !== '' ? q : item.rawValue}
          placeholder={nodeType === 'SOFT_SKILL' ? 'Soft skill…' : 'Compétence technique…'}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) update({ ...item, taxonomyNodeId: '', rawValue: '' });
            else update({ ...item, rawValue: e.target.value });
          }}
          className="h-9"
        />
        {q.trim().length >= 2 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-full border border-border rounded-md bg-popover shadow-md max-h-44 overflow-y-auto">
            {(results?.items ?? []).length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Aucun résultat — saisie libre acceptée
              </div>
            ) : (
              (results?.items ?? []).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted"
                  onClick={() => {
                    update({ ...item, taxonomyNodeId: node.id, rawValue: node.preferred_label });
                    setQ('');
                  }}
                >
                  {node.preferred_label}
                </button>
              ))
            )}
          </div>
        )}
        {item.rawValue && q === '' && (
          <p className="text-xs text-muted-foreground truncate">
            {item.taxonomyNodeId ? '✓ ' : ''}{item.rawValue}
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SkillRequirementList({
  label,
  description,
  items,
  onChange,
  nodeType,
  isMust = false,
}: {
  label: string;
  description?: string;
  items: SkillRequirement[];
  onChange: (next: SkillRequirement[]) => void;
  nodeType: 'SKILL' | 'SOFT_SKILL';
  isMust?: boolean;
}) {
  const update = (index: number, next: SkillRequirement) =>
    onChange(items.map((item, i) => (i === index ? next : item)));

  const remove = (index: number) =>
    onChange(items.filter((_, i) => i !== index));

  const add = () => onChange([...items, emptySkillRequirement(isMust)]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-xs">{label}</Label>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Ajouter
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Aucune compétence renseignée.
        </div>
      ) : (
        items.map((item, index) => (
          <SkillRequirementRow
            key={index}
            item={item}
            update={(next) => update(index, next)}
            onRemove={() => remove(index)}
            nodeType={nodeType}
          />
        ))
      )}
    </div>
  );
}
