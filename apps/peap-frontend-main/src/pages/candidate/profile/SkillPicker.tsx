import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaxonomyAutocompleteQuery } from '@/services/api/queries';

export interface SkillDraftRow {
  id?: string;
  skillNodeId: string;
  skillLabelRaw: string;
  skillNodeType: string;
  level: string;
  years: string;
  evidence: string;
}

const LEVEL_OPTIONS = [
  { code: 'beginner', label: 'Débutant' },
  { code: 'intermediate', label: 'Intermédiaire' },
  { code: 'advanced', label: 'Avancé' },
  { code: 'expert', label: 'Expert' },
];

export function SkillPicker({
  item,
  update,
  nodeType = 'SKILL',
}: {
  item: SkillDraftRow;
  update: (next: SkillDraftRow) => void;
  nodeType?: 'SKILL' | 'SOFT_SKILL';
}) {
  const [q, setQ] = useState('');
  const { data: results } = useTaxonomyAutocompleteQuery(q, nodeType);

  const skillLabel = nodeType === 'SOFT_SKILL' ? 'Compétence transversale' : 'Compétence technique';

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">{skillLabel}</label>
        <Input
          value={q !== '' ? q : item.skillLabelRaw}
          placeholder="Rechercher…"
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) {
              update({ ...item, skillNodeId: '', skillLabelRaw: '' });
            }
          }}
          className="h-9"
        />
        {q.trim().length >= 2 && (
          <div className="z-10 relative border border-border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
            {(results?.items ?? []).length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Aucun résultat — saisie libre acceptée
              </div>
            ) : (
              (results?.items ?? []).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted"
                  onClick={() => {
                    update({
                      ...item,
                      skillNodeId: node.id,
                      skillLabelRaw: node.preferred_label,
                      skillNodeType: nodeType,
                    });
                    setQ('');
                  }}
                >
                  {node.preferred_label}
                </button>
              ))
            )}
          </div>
        )}
        {item.skillLabelRaw && q === '' && (
          <p className="text-xs text-muted-foreground truncate">
            {item.skillNodeId ? '✓ ' : ''}{item.skillLabelRaw}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Niveau</Label>
        <Select
          value={item.level || '__empty__'}
          onValueChange={(v) =>
            update({ ...item, level: v === '__empty__' ? '' : v })
          }
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Choisir un niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">Choisir un niveau</SelectItem>
            {LEVEL_OPTIONS.map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
