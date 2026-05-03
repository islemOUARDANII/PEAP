const EMPTY_TEXT_PATTERN =
  /^(non specifie|non spécifié|not specified|null|undefined|n\/a|\[object object\])$/i;

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  freelance: 'Freelance',
  interim: 'Intérim',
  alternance: 'Alternance',
  stage: 'Stage',
  internship: 'Stage',
  part_time: 'Temps partiel',
  full_time: 'Temps plein',
};

const WORK_MODE_LABELS: Record<string, string> = {
  remote: 'Télétravail',
  hybrid: 'Hybride',
  onsite: 'Sur site',
  on_site: 'Sur site',
  presential: 'Sur site',
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values));

const humanizeCode = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (part) => part.toUpperCase());

const pushText = (values: string[], value: unknown) => {
  const normalized = cleanText(value);
  if (normalized) {
    values.push(normalized);
  }
};

const extractStructuredTexts = (value: unknown, values: string[]) => {
  if (Array.isArray(value)) {
    value.forEach((item) => extractStructuredTexts(item, values));
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    pushText(values, value);
    return;
  }

  const record = toRecord(value);
  if (!record) {
    return;
  }

  const directLabel =
    cleanText(record.label) ??
    cleanText(record.name) ??
    cleanText(record.skill) ??
    cleanText(record.title) ??
    cleanText(record.nodeLabel) ??
    cleanText(record.node_label) ??
    cleanText(record.rawValue) ??
    cleanText(record.raw_value) ??
    cleanText(record.code);

  if (directLabel) {
    values.push(directLabel);
    return;
  }

  [
    'skills',
    'required_skills',
    'skill_labels',
    'requirements',
    'keywords',
    'technologies',
  ].forEach((key) => {
    if (key in record) {
      extractStructuredTexts(record[key], values);
    }
  });
};

export const cleanText = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || EMPTY_TEXT_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const normalizePercent = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
};

export const formatContractType = (value: unknown): string | null => {
  const normalized = cleanText(value)?.toLowerCase();

  if (!normalized) {
    return null;
  }

  return CONTRACT_TYPE_LABELS[normalized] ?? humanizeCode(normalized);
};

export const formatWorkMode = (value: unknown): string | null => {
  const normalized = cleanText(value)?.toLowerCase();

  if (!normalized) {
    return null;
  }

  return WORK_MODE_LABELS[normalized] ?? humanizeCode(normalized);
};

export const formatDate = (value: unknown): string | null => {
  const normalized = cleanText(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('fr-FR');
};

export const formatLocation = (...parts: unknown[]): string | null => {
  const values: string[] = [];

  parts.forEach((part) => {
    if (Array.isArray(part)) {
      part.forEach((item) => pushText(values, item));
      return;
    }

    const record = toRecord(part);
    if (record) {
      [
        record.location,
        record.locationLabel,
        record.location_label,
        record.delegationLabel,
        record.delegation_label,
        record.governorateLabel,
        record.governorate_label,
        record.country,
      ].forEach((item) => pushText(values, item));
      return;
    }

    pushText(values, part);
  });

  const uniqueValues = uniqueStrings(values);
  return uniqueValues.length > 0 ? uniqueValues.join(', ') : null;
};

export const extractOfferSkills = (value: unknown): string[] => {
  const values: string[] = [];
  const record = toRecord(value);

  if (!record) {
    extractStructuredTexts(value, values);
    return uniqueStrings(values);
  }

  [
    record.skills,
    record.requiredSkills,
    record.required_skills,
    record.skillLabels,
    record.skill_labels,
    record.requirements,
  ].forEach((item) => extractStructuredTexts(item, values));

  const raw = toRecord(record.raw);
  if (raw) {
    [
      raw.skills,
      raw.required_skills,
      raw.skill_labels,
      raw.requirements,
      raw.keywords,
      raw.technologies,
    ].forEach((item) => extractStructuredTexts(item, values));
  }

  return uniqueStrings(values);
};

export const extractTextList = (
  record: Record<string, unknown>,
  keys: string[],
): string[] => {
  const values: string[] = [];

  keys.forEach((key) => {
    if (key in record) {
      extractStructuredTexts(record[key], values);
    }
  });

  return uniqueStrings(values);
};
