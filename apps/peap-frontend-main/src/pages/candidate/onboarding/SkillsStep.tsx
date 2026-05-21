import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaxonomyAutocomplete } from '@/components/onboarding/TaxonomyAutocomplete';
import { TaxonomyMultiSelect } from '@/components/onboarding/TaxonomyMultiSelect';
import { ReferenceSelect } from '@/components/onboarding/ReferenceSelect';
import { useRefDropdownQuery } from '@/services/api/queries';
import { refLabel } from '@/components/onboarding/ReferenceSelect';
import type { OnboardingLanguageItem } from '@/types/candidateOnboarding';
import { useOnboardingContext } from './CandidateOnboardingLayout';

export default function SkillsStep() {
  const { draft, updateDraft } = useOnboardingContext();

  const { data: langData } = useRefDropdownQuery('LANGUAGE');
  const langItems = langData?.items ?? [];

  const { data: levelData } = useRefDropdownQuery('LANGUAGE_LEVEL');
  const levelItems = levelData?.items ?? [];

  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLevel, setNewLangLevel] = useState('');
  const [newLangSearch, setNewLangSearch] = useState('');

  const languageItems = draft.languageItems ?? [];

  // Filtrage local de la liste des langues (si longue)
  const filteredLangs = newLangSearch.trim().length > 0
    ? langItems.filter((l) =>
        refLabel(l).toLowerCase().includes(newLangSearch.toLowerCase())
      )
    : langItems;

  const addLanguage = () => {
    if (!newLangCode || !newLangLevel) return;
    const langItem = langItems.find((l) => l.code === newLangCode);
    if (!langItem) return;
    const alreadyAdded = languageItems.some((l) => l.langCode === newLangCode);
    if (alreadyAdded) return;

    const newItem: OnboardingLanguageItem = {
      langCode: newLangCode,
      label: refLabel(langItem),
      levelCode: newLangLevel,
    };
    updateDraft({ languageItems: [...languageItems, newItem] });
    setNewLangCode('');
    setNewLangLevel('');
    setNewLangSearch('');
  };

  const removeLanguage = (langCode: string) => {
    updateDraft({ languageItems: languageItems.filter((l) => l.langCode !== langCode) });
  };

  const levelLabel = (code: string) => {
    const item = levelItems.find((l) => l.code === code);
    return item ? refLabel(item) : code;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Compétences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez votre métier cible, vos compétences et les langues que vous maîtrisez.
        </p>
      </div>

      {/* Métier / occupation cible */}
      <TaxonomyAutocomplete
        nodeType="OCCUPATION"
        nodeId={draft.targetOccupationNodeId ?? ''}
        labelValue={draft.targetOccupationLabel ?? ''}
        displayLabel="Métier / occupation recherché(e)"
        placeholder="Rechercher un métier…"
        onChange={(nodeId, label) =>
          updateDraft({ targetOccupationNodeId: nodeId, targetOccupationLabel: label })
        }
      />

      {/* Compétences techniques */}
      <TaxonomyMultiSelect
        nodeType="SKILL"
        items={draft.technicalSkillItems ?? []}
        onChange={(items) => updateDraft({ technicalSkillItems: items })}
        withLevel
        levelGroupCode="SKILL_LEVEL"
        label="Compétences techniques"
        placeholder="Rechercher une compétence…"
      />

      {/* Compétences comportementales */}
      <TaxonomyMultiSelect
        nodeType="SOFT_SKILL"
        items={draft.softSkillItems ?? []}
        onChange={(items) => updateDraft({ softSkillItems: items })}
        withLevel={false}
        label="Compétences comportementales"
        placeholder="Rechercher une compétence…"
      />

      {/* Compétences numériques */}
      <TaxonomyMultiSelect
        nodeType="DIGITAL_SKILL"
        items={draft.digitalSkillItems ?? []}
        onChange={(items) => updateDraft({ digitalSkillItems: items })}
        withLevel={false}
        label="Compétences numériques"
        placeholder="Rechercher une compétence numérique…"
      />

      {/* Langues */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Langues</p>

        {languageItems.length > 0 && (
          <div className="space-y-2">
            {languageItems.map((lang) => (
              <div
                key={lang.langCode}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{lang.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {levelLabel(lang.levelCode)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.langCode)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ajout d'une langue */}
        <div className="rounded-md border border-border bg-surface p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Ajouter une langue</p>

          <div className="flex gap-2">
            {/* Recherche dans la liste des langues */}
            <Input
              value={newLangSearch}
              onChange={(e) => setNewLangSearch(e.target.value)}
              placeholder="Filtrer les langues…"
              className="h-9 flex-1"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {/* Sélection de la langue */}
            <ReferenceSelect
              groupCode="LANGUAGE"
              value={newLangCode}
              onChange={(code) => setNewLangCode(code)}
              placeholder="Choisir une langue"
            />

            {/* Niveau de langue */}
            <ReferenceSelect
              groupCode="LANGUAGE_LEVEL"
              value={newLangLevel}
              onChange={(code) => setNewLangLevel(code)}
              placeholder="Niveau"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLanguage}
            disabled={!newLangCode || !newLangLevel}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter la langue
          </Button>
        </div>
      </div>
    </div>
  );
}
