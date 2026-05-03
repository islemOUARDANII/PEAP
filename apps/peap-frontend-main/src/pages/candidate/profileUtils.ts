import type {
  CandidateCvParseResult,
  CandidateEducationRecord,
  CandidateExperienceRecord,
  CandidateLanguageRecord,
  CandidateSkillRecord,
} from '@/services/api/gateway';

export type DisplayEducationItem = {
  degree: string | null;
  diplomaLabel: string | null;
  levelCode: string | null;
  specialty: string | null;
  institution: string | null;
  startDate: string | null;
  endDate: string | null;
  graduationYear: string | null;
  location: string | null;
  honors: string | null;
  gpa: string | null;
};

export type DisplayProjectItem = {
  name: string | null;
  description: string | null;
  technologies: string[];
  url: string | null;
};

export type DisplayExperienceItem = {
  title: string | null;
  company: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  durationMonths: number | null;
  durationYears: number | null;
  description: string | null;
  responsibilities: string[];
  technologies: string[];
  projects: DisplayProjectItem[];
  entryType: string | null;
};

export type DisplaySkillItem = {
  label: string;
  category: string;
};

export type DisplayLanguageItem = {
  name: string;
  level: string | null;
};

export type DisplayCertificationItem = {
  name: string | null;
  issuer: string | null;
  date: string | null;
};

type PatchItem = Record<string, unknown>;

const EMPTY_VALUE_PATTERN =
  /^(non specifie|non spécifié|not specified|null|undefined|n\/a)$/i;

const CATEGORY_LABELS: Record<string, string> = {
  language: 'Langages',
  languages: 'Langages',
  programming_language: 'Langages',
  framework: 'Frameworks / bibliothèques',
  frameworks: 'Frameworks / bibliothèques',
  library: 'Frameworks / bibliothèques',
  libraries: 'Frameworks / bibliothèques',
  database: 'Bases de données',
  databases: 'Bases de données',
  db: 'Bases de données',
  devops: 'DevOps',
  cloud: 'DevOps',
  infra: 'DevOps',
  data: 'Data / IA',
  ai: 'Data / IA',
  ml: 'Data / IA',
  analytics: 'Data / IA',
  other: 'Autres',
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  ar: 'Arabe',
  de: 'Allemand',
  es: 'Espagnol',
  it: 'Italien',
  zh: 'Chinois',
  ja: 'Japonais',
  ko: 'Coréen',
  pt: 'Portugais',
  ru: 'Russe',
  tr: 'Turc',
};

const LEVEL_LABELS: Record<string, string> = {
  native: 'Langue maternelle',
  fluent: 'Courant',
  advanced: 'Avancé',
  intermediate: 'Intermédiaire',
  beginner: 'Débutant',
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const cleanText = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || EMPTY_VALUE_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const cleanDisplayText = (
  value: unknown,
  fallback = 'Non renseigné',
): string => cleanText(value) ?? fallback;

const extractText = (value: unknown, keys: string[]): string | null => {
  const direct = cleanText(value);
  if (direct) {
    return direct;
  }

  const record = toRecord(value);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const candidate = cleanText(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const toStringList = (value: unknown, keys: string[] = ['label', 'name', 'title', 'raw_value', 'value']): string[] =>
  Array.from(
    new Set(
      toArray(value)
        .map((item) => extractText(item, keys))
        .filter((item): item is string => Boolean(item)),
    ),
  );

const uniqueBy = <T>(items: T[], buildKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = buildKey(item);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
};

const buildCvData = (
  parseResult?: CandidateCvParseResult | null,
): Record<string, unknown> => {
  const parsedPayload = parseResult?.parsedPayload ?? {};
  const cvData = toRecord(parsedPayload.cv_data);
  return cvData ?? {};
};

const buildEducationFromRecord = (
  item: CandidateEducationRecord,
): DisplayEducationItem => ({
  degree: cleanText(item.degree),
  diplomaLabel: cleanText(item.diplomaLabel),
  levelCode: cleanText(item.levelCode),
  specialty: cleanText(item.specialty),
  institution: cleanText(item.institution),
  startDate: cleanText(item.startDate),
  endDate: cleanText(item.endDate),
  graduationYear:
    item.graduationYear == null ? null : String(item.graduationYear),
  location: cleanText(item.location),
  honors: cleanText(item.honors),
  gpa: cleanText(item.gpa),
});

const buildEducationFromPatch = (item: PatchItem): DisplayEducationItem => ({
  degree: extractText(item.degree ?? item.raw_degree, ['label', 'name']),
  diplomaLabel: extractText(
    item.diploma_label ?? item.diplomaLabel ?? item.degree ?? item.raw_degree,
    ['label', 'name'],
  ),
  levelCode: cleanText(item.level_code ?? item.levelCode),
  specialty: extractText(item.specialty ?? item.field ?? item.specialty_label, [
    'label',
    'name',
  ]),
  institution: extractText(item.institution, ['label', 'name']),
  startDate: cleanText(item.start_date ?? item.startDate),
  endDate: cleanText(item.end_date ?? item.endDate),
  graduationYear: extractText(
    item.graduation_year ?? item.graduationYear,
    ['label', 'name'],
  ),
  location: extractText(item.location, ['label', 'name']),
  honors: extractText(item.honors, ['label', 'name']),
  gpa: extractText(item.gpa, ['label', 'name']),
});

const buildProject = (value: unknown): DisplayProjectItem | null => {
  const record = toRecord(value);

  if (!record) {
    const name = cleanText(value);
    return name
      ? { name, description: null, technologies: [], url: null }
      : null;
  }

  const project = {
    name: extractText(record.name ?? record.title, ['label']),
    description: extractText(record.description ?? record.summary, ['label']),
    technologies: toStringList(record.technologies ?? record.tech_stack),
    url: extractText(record.url ?? record.link ?? record.website, ['label']),
  };

  return project.name || project.description || project.technologies.length > 0
    ? project
    : null;
};

const buildExperienceFromRecord = (
  item: CandidateExperienceRecord,
): DisplayExperienceItem => ({
  title: cleanText(item.jobTitleRaw),
  company: cleanText(item.companyName),
  location: cleanText(item.location),
  startDate: cleanText(item.startDate),
  endDate: cleanText(item.endDate),
  isCurrent: item.isCurrent ?? false,
  durationMonths: item.durationMonths ?? null,
  durationYears: item.durationYears ?? null,
  description: cleanText(item.description),
  responsibilities: toStringList(item.responsibilities),
  technologies: toStringList(item.technologies),
  projects: toArray(item.projects).map(buildProject).filter((item): item is DisplayProjectItem => Boolean(item)),
  entryType: cleanText(item.entryType),
});

const buildExperienceFromPatch = (
  item: PatchItem,
  forcedEntryType?: string,
): DisplayExperienceItem => ({
  title: extractText(item.title ?? item.job_title ?? item.jobTitleRaw, ['label', 'name']),
  company: extractText(item.company ?? item.company_name, ['label', 'name']),
  location: extractText(item.location, ['label', 'name']),
  startDate: cleanText(item.start_date ?? item.startDate),
  endDate: cleanText(item.end_date ?? item.endDate),
  isCurrent: item.is_current === true,
  durationMonths: toNumber(item.duration_months ?? item.durationMonths),
  durationYears: toNumber(item.duration_years ?? item.durationYears),
  description: extractText(item.description, ['label', 'name']),
  responsibilities: toStringList(item.responsibilities),
  technologies: toStringList(item.technologies ?? item.tools),
  projects: toArray(item.projects).map(buildProject).filter((project): project is DisplayProjectItem => Boolean(project)),
  entryType: cleanText(forcedEntryType ?? item.entry_type ?? item.entryType),
});

const inferExperienceType = (item: DisplayExperienceItem): string => {
  const normalizedEntryType = cleanText(item.entryType)?.toLowerCase();
  if (normalizedEntryType) {
    return normalizedEntryType;
  }

  const haystack = [
    item.title,
    item.company,
    item.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(stage|internship|intern)\b/.test(haystack)
    ? 'internship'
    : 'experience';
};

const inferSkillCategory = (label: string, rawCategory?: string | null): string => {
  const normalizedCategory = cleanText(rawCategory)?.toLowerCase();
  if (normalizedCategory) {
    return CATEGORY_LABELS[normalizedCategory] ?? 'Autres';
  }

  const normalizedLabel = label.toLowerCase();
  if (/(python|java|javascript|typescript|c\+\+|c#|php|ruby|go|rust|sql)/i.test(normalizedLabel)) {
    return 'Langages';
  }
  if (/(react|angular|vue|django|flask|spring|laravel|next|node|express|pandas)/i.test(normalizedLabel)) {
    return 'Frameworks / bibliothèques';
  }
  if (/(postgres|mysql|mongodb|oracle|redis|sqlite|cassandra|elasticsearch)/i.test(normalizedLabel)) {
    return 'Bases de données';
  }
  if (/(docker|kubernetes|terraform|jenkins|gitlab|github actions|aws|azure|gcp|linux)/i.test(normalizedLabel)) {
    return 'DevOps';
  }
  if (/(power bi|tableau|langchain|machine learning|deep learning|tensorflow|pytorch|scikit|data|spark|hadoop)/i.test(normalizedLabel)) {
    return 'Data / IA';
  }
  return 'Autres';
};

const looksLikeLanguageSkill = (label: string): boolean => {
  const normalized = label.trim().toLowerCase();
  return (
    /^(a1|a2|b1|b2|c1|c2)$/.test(normalized) ||
    /^(fr|en|ar|de|es|it|zh|ja|ko|pt|ru|tr)$/.test(normalized) ||
    /^(français|anglais|arabe|allemand|espagnol|italien|chinois|japonais|coréen|portugais|russe|turc)\s*[:\-]\s*/i.test(
      normalized,
    )
  );
};

const buildSkillFromRecord = (item: CandidateSkillRecord): DisplaySkillItem | null => {
  const label = cleanText(item.skillNodeLabel ?? item.skillLabelRaw ?? item.skillId);
  if (!label || looksLikeLanguageSkill(label)) {
    return null;
  }

  return {
    label,
    category: inferSkillCategory(label, item.category),
  };
};

const buildSkillFromPatch = (item: PatchItem): DisplaySkillItem | null => {
  const metadata = toRecord(item.metadata);
  const label = extractText(
    item.skill_label_raw ?? item.name ?? item.label ?? item.skill,
    ['label', 'name', 'title', 'raw_value'],
  );

  if (!label || looksLikeLanguageSkill(label)) {
    return null;
  }

  return {
    label,
    category: inferSkillCategory(
      label,
      cleanText(item.category) ?? cleanText(metadata?.category),
    ),
  };
};

const buildLanguageFromRecord = (
  item: CandidateLanguageRecord,
): DisplayLanguageItem | null => {
  const name = formatLanguageLabel(
    item.languageCode,
    item.languageLabelFr ?? item.languageLabelEn,
  );

  if (!name) {
    return null;
  }

  return {
    name,
    level: formatLevelLabel(item.level, item.levelLabelFr ?? item.levelLabelEn),
  };
};

const buildLanguageFromPatch = (item: PatchItem): DisplayLanguageItem | null => {
  const name = formatLanguageLabel(
    extractText(item.language_code ?? item.code ?? item.name, ['label', 'name']) ?? '',
    extractText(item.language_label ?? item.label ?? item.name, ['label', 'name']),
  );

  if (!name) {
    return null;
  }

  return {
    name,
    level: formatLevelLabel(
      extractText(item.level, ['label', 'name']) ?? '',
      extractText(item.level_label, ['label', 'name']),
    ),
  };
};

const buildCertification = (value: unknown): DisplayCertificationItem | null => {
  const record = toRecord(value);

  if (!record) {
    const name = cleanText(value);
    return name ? { name, issuer: null, date: null } : null;
  }

  const certification = {
    name: extractText(record.name ?? record.title, ['label']),
    issuer: extractText(record.issuer ?? record.organization, ['label', 'name']),
    date: extractText(record.date ?? record.year, ['label', 'name']),
  };

  return certification.name || certification.issuer || certification.date
    ? certification
    : null;
};

const extractSectionArray = (
  parseResult: CandidateCvParseResult | null | undefined,
  ...keys: string[]
): unknown[] => {
  const cvData = buildCvData(parseResult);

  for (const key of keys) {
    const topLevel = toArray(parseResult?.parsedPayload?.[key]);
    if (topLevel.length > 0) {
      return topLevel;
    }

    const nested = toArray(cvData[key]);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
};

export const buildEducationItems = (
  education: CandidateEducationRecord[],
  parseResult?: CandidateCvParseResult | null,
  preferParsed = false,
): DisplayEducationItem[] => {
  const apiItems = education.map(buildEducationFromRecord);
  const parsedItems = (
    parseResult?.extractedProfilePatch.education ??
    extractSectionArray(parseResult, 'education')
  )
    .map((item) => buildEducationFromPatch((toRecord(item) ?? {}) as PatchItem))
    .filter(
      (item) => item.degree || item.diplomaLabel || item.institution || item.specialty,
    );

  const source = preferParsed && parsedItems.length > 0 ? parsedItems : apiItems;
  return uniqueBy(source, (item) =>
    [
      item.degree,
      item.diplomaLabel,
      item.institution,
      item.startDate,
      item.endDate,
      item.graduationYear,
    ]
      .filter(Boolean)
      .join('|')
      .toLowerCase(),
  );
};

export const buildExperienceSections = (
  experience: CandidateExperienceRecord[],
  parseResult?: CandidateCvParseResult | null,
  preferParsed = false,
): {
  professional: DisplayExperienceItem[];
  internships: DisplayExperienceItem[];
} => {
  const apiItems = experience.map(buildExperienceFromRecord);
  const parsedExperience = (parseResult?.extractedProfilePatch.experience ?? [])
    .map((item) => buildExperienceFromPatch(item))
    .filter((item) => item.title || item.company || item.description);
  const parsedStages = (parseResult?.extractedProfilePatch.stages ?? [])
    .map((item) => buildExperienceFromPatch(item, 'internship'))
    .filter((item) => item.title || item.company || item.description);

  const source = preferParsed
    ? uniqueBy([...parsedExperience, ...parsedStages], (item) =>
        [
          item.title,
          item.company,
          item.startDate,
          item.endDate,
          item.entryType,
        ]
          .filter(Boolean)
          .join('|')
          .toLowerCase(),
      )
    : apiItems;

  const professional = source.filter(
    (item) => inferExperienceType(item) !== 'internship',
  );
  const internships = uniqueBy(
    [
      ...source.filter((item) => inferExperienceType(item) === 'internship'),
      ...(!preferParsed ? parsedStages : []),
    ],
    (item) =>
      [
        item.title,
        item.company,
        item.startDate,
        item.endDate,
        item.entryType,
      ]
        .filter(Boolean)
        .join('|')
        .toLowerCase(),
  );

  return { professional, internships };
};

export const buildSkillItems = (
  skills: CandidateSkillRecord[],
  parseResult?: CandidateCvParseResult | null,
  preferParsed = false,
): DisplaySkillItem[] => {
  const apiItems = skills
    .map(buildSkillFromRecord)
    .filter((item): item is DisplaySkillItem => Boolean(item));
  const parsedItems = (parseResult?.extractedProfilePatch.skills ?? [])
    .map(buildSkillFromPatch)
    .filter((item): item is DisplaySkillItem => Boolean(item));

  const source = preferParsed && parsedItems.length > 0 ? parsedItems : apiItems;
  return uniqueBy(source, (item) => item.label.toLowerCase());
};

export const buildLanguageItems = (
  languages: CandidateLanguageRecord[],
  parseResult?: CandidateCvParseResult | null,
  preferParsed = false,
): DisplayLanguageItem[] => {
  const apiItems = languages
    .map(buildLanguageFromRecord)
    .filter((item): item is DisplayLanguageItem => Boolean(item));
  const parsedItems = (parseResult?.extractedProfilePatch.languages ?? [])
    .map(buildLanguageFromPatch)
    .filter((item): item is DisplayLanguageItem => Boolean(item));

  const source = preferParsed && parsedItems.length > 0 ? parsedItems : apiItems;
  return uniqueBy(source, (item) =>
    `${item.name.toLowerCase()}|${(item.level ?? '').toLowerCase()}`,
  );
};

export const buildCertificationItems = (
  parseResult?: CandidateCvParseResult | null,
): DisplayCertificationItem[] =>
  uniqueBy(
    [
      ...(parseResult?.extractedProfilePatch.certifications ?? []),
      ...extractSectionArray(parseResult, 'certifications'),
    ]
      .map(buildCertification)
      .filter((item): item is DisplayCertificationItem => Boolean(item)),
    (item) =>
      [item.name, item.issuer, item.date]
        .filter(Boolean)
        .join('|')
        .toLowerCase(),
  );

export const buildProjectItems = (
  parseResult?: CandidateCvParseResult | null,
): DisplayProjectItem[] =>
  uniqueBy(
    [
      ...(parseResult?.extractedProfilePatch.projects ?? []),
      ...extractSectionArray(parseResult, 'projects'),
    ]
      .map(buildProject)
      .filter((item): item is DisplayProjectItem => Boolean(item)),
    (item) =>
      [item.name, item.description, item.url]
        .filter(Boolean)
        .join('|')
        .toLowerCase(),
  );

export const buildInterestKeywords = (
  parseResult?: CandidateCvParseResult | null,
): string[] =>
  uniqueBy(
    [
      ...(parseResult?.extractedProfilePatch.interests ?? []),
      ...extractSectionArray(parseResult, 'interests', 'keywords'),
    ]
      .map((item) => extractText(item, ['label', 'name', 'title', 'raw_value', 'value']))
      .filter((item): item is string => Boolean(item)),
    (item) => item.toLowerCase(),
  );

export const groupSkillsByCategory = (
  skills: DisplaySkillItem[],
): Array<{ category: string; items: string[] }> => {
  const groups = new Map<string, string[]>();

  for (const skill of skills) {
    const category = skill.category || 'Autres';
    const currentGroup = groups.get(category) ?? [];
    currentGroup.push(skill.label);
    groups.set(category, currentGroup);
  }

  return Array.from(groups.entries())
    .map(([category, items]) => ({
      category,
      items: Array.from(new Set(items)).sort((left, right) =>
        left.localeCompare(right, 'fr'),
      ),
    }))
    .sort((left, right) => left.category.localeCompare(right.category, 'fr'));
};

export const formatDate = (value: unknown): string | null => {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString('fr-FR');
};

export const formatDateRange = (
  startDate: unknown,
  endDate: unknown,
  isCurrent = false,
): string | null => {
  const start = formatDate(startDate);
  const end = isCurrent ? 'Présent' : formatDate(endDate);

  if (!start && !end) {
    return null;
  }

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end;
};

export const formatDurationLabel = (
  durationMonths: unknown,
  durationYears: unknown,
): string | null => {
  const months = toNumber(durationMonths);
  const years = toNumber(durationYears);

  if (years && years > 0) {
    return years > 1 ? `${years} ans` : `${years} an`;
  }

  if (months && months > 0) {
    return months > 1 ? `${months} mois` : `${months} mois`;
  }

  return null;
};

export const formatLanguageLabel = (
  code: string,
  label?: string | null,
): string | null => {
  const explicitLabel = cleanText(label);
  if (explicitLabel) {
    return explicitLabel;
  }

  const normalizedCode = cleanText(code)?.toLowerCase();
  if (!normalizedCode) {
    return null;
  }

  return LANGUAGE_LABELS[normalizedCode] ?? normalizedCode.toUpperCase();
};

export const formatLevelLabel = (
  level: string,
  label?: string | null,
): string | null => {
  const explicitLabel = cleanText(label);
  if (explicitLabel) {
    return explicitLabel;
  }

  const normalizedLevel = cleanText(level);
  if (!normalizedLevel) {
    return null;
  }

  const upperLevel = normalizedLevel.toUpperCase();
  if (/^(A1|A2|B1|B2|C1|C2)$/.test(upperLevel)) {
    return upperLevel;
  }

  return LEVEL_LABELS[normalizedLevel.toLowerCase()] ?? normalizedLevel;
};
