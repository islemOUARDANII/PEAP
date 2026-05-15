import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTaxonomyAutocompleteQuery } from '@/services/api/queries';

const SEARCHED_TYPES = ['OCCUPATION', 'SKILL', 'SOFT_SKILL'] as const;

function useMultiTypeAutocomplete(q: string) {
  const occupation = useTaxonomyAutocompleteQuery(q, 'OCCUPATION');
  const skill = useTaxonomyAutocompleteQuery(q, 'SKILL');
  const softSkill = useTaxonomyAutocompleteQuery(q, 'SOFT_SKILL');

  const isLoading = occupation.isLoading || skill.isLoading || softSkill.isLoading;

  const items = [
    ...(occupation.data?.items ?? []).slice(0, 6).map((n) => ({ ...n, _type: 'OCCUPATION' as const })),
    ...(skill.data?.items ?? []).slice(0, 5).map((n) => ({ ...n, _type: 'SKILL' as const })),
    ...(softSkill.data?.items ?? []).slice(0, 4).map((n) => ({ ...n, _type: 'SOFT_SKILL' as const })),
  ].slice(0, 12);

  return { items, isLoading };
}

const TYPE_BADGE: Record<string, string> = {
  OCCUPATION: 'Métier',
  SKILL: 'Compétence',
  SOFT_SKILL: 'Soft skill',
};

export function TaxonomyKeywordsEditor({
  keywords,
  onAdd,
  onRemove,
}: {
  keywords: string[];
  onAdd: (keyword: string) => void;
  onRemove: (keyword: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const { items, isLoading } = useMultiTypeAutocomplete(inputValue);

  const showDropdown = inputValue.trim().length >= 2;

  const handleAddRaw = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputValue('');
  };

  const handleSelectNode = (label: string) => {
    onAdd(label);
    setInputValue('');
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-5 space-y-3">
      {/* Tags */}
      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/30 px-3 py-1.5 text-sm text-foreground"
            >
              {keyword}
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground"
                onClick={() => onRemove(keyword)}
                aria-label={`Supprimer ${keyword}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Aucun domaine ou technologie renseigné.
        </p>
      )}

      {/* Input + button */}
      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <Input
            value={inputValue}
            placeholder="Rechercher un métier, compétence ou saisie libre…"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddRaw();
              }
            }}
            className="h-9"
          />
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 z-20 w-full border border-border rounded-md bg-popover shadow-md max-h-52 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Recherche…
                </div>
              ) : items.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Aucun résultat — appuyez sur Ajouter pour saisie libre
                </div>
              ) : (
                items.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted flex items-center justify-between gap-2"
                    onClick={() => handleSelectNode(node.preferred_label)}
                  >
                    <span>{node.preferred_label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {TYPE_BADGE[node._type] ?? node._type}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRaw}
          disabled={!inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sélectionnez dans la liste ou saisissez librement. Ces mots-clés servent à trouver des offres pertinentes.
      </p>
    </div>
  );
}
