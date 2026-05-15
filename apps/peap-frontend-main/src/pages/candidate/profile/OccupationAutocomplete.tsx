import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTaxonomyAutocompleteQuery } from '@/services/api/queries';

export function OccupationAutocomplete({
  jobTitleRaw,
  occupationNodeId,
  label = 'Intitulé du poste',
  onChange,
}: {
  jobTitleRaw: string;
  occupationNodeId: string;
  label?: string;
  onChange: (nodeId: string, raw: string) => void;
}) {
  const [q, setQ] = useState('');
  const { data: results } = useTaxonomyAutocompleteQuery(q, 'OCCUPATION');

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={q !== '' ? q : jobTitleRaw}
        placeholder="Rechercher un poste RTMC…"
        onChange={(e) => {
          const val = e.target.value;
          setQ(val);
          // Keep raw text even when no taxonomy match
          onChange(occupationNodeId, val || jobTitleRaw);
          if (!val) onChange('', '');
        }}
        className="h-10"
      />
      {q.trim().length >= 2 && (
        <div className="z-10 relative border border-border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
          {(results?.items ?? []).length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Aucun résultat RTMC — saisie libre acceptée
            </div>
          ) : (
            (results?.items ?? []).map((node) => (
              <button
                key={node.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted"
                onClick={() => {
                  onChange(node.id, node.preferred_label);
                  setQ('');
                }}
              >
                {node.preferred_label}
              </button>
            ))
          )}
        </div>
      )}
      {jobTitleRaw && q === '' && (
        <p className="text-xs text-muted-foreground truncate">
          {occupationNodeId ? '✓ ' : ''}{jobTitleRaw}
        </p>
      )}
    </div>
  );
}
