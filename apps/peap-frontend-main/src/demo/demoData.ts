export type DemoEducationLevel = "Bac" | "Licence" | "Master";
export type DemoLanguageLevel = "A2" | "B1" | "B2" | "C1";

export interface DemoMatchingCriterionWeight {
  label: string;
  weight: number;
  isMust: boolean;
}

export interface DemoMatchingModel {
  id: string;
  modelId: string;
  name: string;
  direction: string;
  versionId: string;
  version: string;
  status: string;
  criteriaWeights: DemoMatchingCriterionWeight[];
}

export interface DemoOffer {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  contractType: string;
  workMode: string;
  salaryMin: number;
  salaryMax: number;
  salaryLabel: string;
  numberOfPositions: number;
  status: string;
  requirements: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  educationLevel: DemoEducationLevel;
  minExperienceYears: number;
  maxDistanceKm: number;
  languageLevel: DemoLanguageLevel;
  minScore: number;
}

export interface DemoCandidateLanguage {
  name: string;
  level: DemoLanguageLevel;
}

export interface DemoCandidate {
  id: string;
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  educationLevel: DemoEducationLevel;
  yearsExperience: number;
  skills: string[];
  languages: DemoCandidateLanguage[];
  distanceKm: number;
  summary: string;
}

export interface DemoMatchingCriterion {
  label: string;
  score: number;
  matched: boolean;
  details: string;
}

export interface DemoMatchingResult {
  id: string;
  rank: number;
  candidateId: string;
  candidateName: string;
  title: string;
  location: string;
  distanceKm: number;
  educationLevel: DemoEducationLevel;
  yearsExperience: number;
  skills: string[];
  languages: string[];
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  gaps: string[];
  status: string;
  matchedItems: string[];
  missingItems: string[];
  recommendation: string;
  criteria: DemoMatchingCriterion[];
}

export interface DemoParsedCvResult {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  summary: string;
  education: string;
  experience: string;
  skills: string[];
  languages: string[];
}

export interface DemoParsedOfferResult {
  title: string;
  description: string;
  location: string;
  contractType: string;
  workMode: string;
  salaryMin: number;
  salaryMax: number;
  salaryLabel: string;
  numberOfPositions: number;
  requirements: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  educationLevel: DemoEducationLevel;
  minExperienceYears: number;
  maxDistanceKm: number;
  languageLevel: DemoLanguageLevel;
  minScore: number;
}

export interface RealDemoMatchingScenario {
  offerId?: string;
  modelVersionId?: string;
  candidateIds?: string[];
}

export const realDemoMatchingScenario: RealDemoMatchingScenario = {
  offerId: "",
  modelVersionId: "",
  candidateIds: [],
};

const educationLevelOrder: Record<DemoEducationLevel, number> = {
  Bac: 1,
  Licence: 2,
  Master: 3,
};

const languageLevelOrder: Record<DemoLanguageLevel, number> = {
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
};

const demoCityDistances: Record<string, Record<string, number>> = {
  Tunis: {
    Tunis: 12,
    Sousse: 110,
    Sfax: 130,
    Nabeul: 70,
    Monastir: 125,
  },
  Sousse: {
    Tunis: 110,
    Sousse: 18,
    Sfax: 95,
    Nabeul: 115,
    Monastir: 20,
  },
  Sfax: {
    Tunis: 130,
    Sousse: 95,
    Sfax: 14,
    Nabeul: 130,
    Monastir: 100,
  },
  Nabeul: {
    Tunis: 70,
    Sousse: 115,
    Sfax: 130,
    Nabeul: 16,
    Monastir: 130,
  },
  Monastir: {
    Tunis: 125,
    Sousse: 20,
    Sfax: 100,
    Nabeul: 130,
    Monastir: 22,
  },
};

export const demoMatchingModels: DemoMatchingModel[] = [
  {
    id: "demo-model-card-1",
    modelId: "demo-model-offer",
    name: "Modèle Offre vers Candidats",
    direction: "OFFER_TO_CANDIDATES",
    versionId: "demo-version-offer-v3",
    version: "v3",
    status: "Actif",
    criteriaWeights: [
      { label: "Compétences", weight: 40, isMust: true },
      { label: "Expérience", weight: 20, isMust: true },
      { label: "Niveau d'étude", weight: 15, isMust: false },
      { label: "Distance", weight: 15, isMust: false },
      { label: "Langue", weight: 10, isMust: false },
    ],
  },
  {
    id: "demo-model-card-2",
    modelId: "demo-model-balanced",
    name: "Modèle Équilibré ANETI",
    direction: "OFFER_TO_CANDIDATES",
    versionId: "demo-version-balanced-v2",
    version: "v2",
    status: "Pilote",
    criteriaWeights: [
      { label: "Compétences", weight: 35, isMust: true },
      { label: "Expérience", weight: 20, isMust: false },
      { label: "Niveau d'étude", weight: 15, isMust: false },
      { label: "Distance", weight: 15, isMust: true },
      { label: "Langue", weight: 15, isMust: false },
    ],
  },
  {
    id: "demo-model-card-3",
    modelId: "demo-model-proximity",
    name: "Modèle Proximité & Insertion",
    direction: "OFFER_TO_CANDIDATES",
    versionId: "demo-version-proximity-v1",
    version: "v1",
    status: "Bêta",
    criteriaWeights: [
      { label: "Compétences", weight: 30, isMust: true },
      { label: "Expérience", weight: 15, isMust: false },
      { label: "Niveau d'étude", weight: 10, isMust: false },
      { label: "Distance", weight: 30, isMust: true },
      { label: "Langue", weight: 15, isMust: false },
    ],
  },
];

export const demoOffers: DemoOffer[] = [
  {
    id: "demo-offer-fullstack",
    title: "Développeur Full Stack Python React",
    company: "Innov TN",
    description:
      "Renforcer l'équipe produit sur une plateforme d'intermédiation emploi avec API Python, interfaces React et intégration SQL.",
    location: "Tunis",
    contractType: "CDI",
    workMode: "Hybride",
    salaryMin: 2500,
    salaryMax: 3500,
    salaryLabel: "2 500 - 3 500 TND",
    numberOfPositions: 2,
    status: "Publié",
    requirements: [
      "Licence ou Master en informatique",
      "2 ans d'expérience minimum",
      "Python, React, SQL, Git",
      "Français B2 minimum",
      "Distance recommandée : 60 km",
    ],
    requiredSkills: ["Python", "React", "SQL", "Git"],
    preferredSkills: ["FastAPI", "Docker"],
    educationLevel: "Licence",
    minExperienceYears: 2,
    maxDistanceKm: 60,
    languageLevel: "B2",
    minScore: 70,
  },
  {
    id: "demo-offer-analyst",
    title: "Data Analyst Power BI SQL",
    company: "Insight BI",
    description:
      "Créer des tableaux de bord, consolider les données métier et accompagner les équipes sur le reporting.",
    location: "Sousse",
    contractType: "CDI",
    workMode: "Présentiel",
    salaryMin: 2000,
    salaryMax: 2800,
    salaryLabel: "2 000 - 2 800 TND",
    numberOfPositions: 1,
    status: "Publié",
    requirements: [
      "Licence ou Master en data / gestion",
      "1 an d'expérience minimum",
      "Power BI, SQL, Excel",
      "Français B2 minimum",
      "Distance recommandée : 80 km",
    ],
    requiredSkills: ["Power BI", "SQL", "Excel"],
    preferredSkills: ["Python", "DAX"],
    educationLevel: "Licence",
    minExperienceYears: 1,
    maxDistanceKm: 80,
    languageLevel: "B2",
    minScore: 68,
  },
  {
    id: "demo-offer-network",
    title: "Technicien Réseaux",
    company: "NetPro Services",
    description:
      "Assurer le support réseau, la maintenance des équipements et les interventions sur site client.",
    location: "Sfax",
    contractType: "CDI",
    workMode: "Présentiel",
    salaryMin: 1600,
    salaryMax: 2200,
    salaryLabel: "1 600 - 2 200 TND",
    numberOfPositions: 2,
    status: "Publié",
    requirements: [
      "Bac ou Bac+2 technique",
      "2 ans d'expérience minimum",
      "Cisco, TCP/IP, Windows Server",
      "Français B1 minimum",
      "Distance recommandée : 100 km",
    ],
    requiredSkills: ["Cisco", "TCP/IP", "Windows Server"],
    preferredSkills: ["Support", "Linux"],
    educationLevel: "Bac",
    minExperienceYears: 2,
    maxDistanceKm: 100,
    languageLevel: "B1",
    minScore: 62,
  },
  {
    id: "demo-offer-rh",
    title: "Assistant RH",
    company: "Cap Emploi",
    description:
      "Soutenir les recrutements, la gestion des dossiers salariés et la préparation des reportings RH.",
    location: "Nabeul",
    contractType: "CDD",
    workMode: "Présentiel",
    salaryMin: 1200,
    salaryMax: 1600,
    salaryLabel: "1 200 - 1 600 TND",
    numberOfPositions: 1,
    status: "Publié",
    requirements: [
      "Licence en RH ou gestion",
      "1 an d'expérience minimum",
      "Recrutement, Excel, Communication",
      "Français C1 minimum",
      "Distance recommandée : 70 km",
    ],
    requiredSkills: ["Recrutement", "Excel", "Communication"],
    preferredSkills: ["SIRH", "Paie"],
    educationLevel: "Licence",
    minExperienceYears: 1,
    maxDistanceKm: 70,
    languageLevel: "C1",
    minScore: 64,
  },
  {
    id: "demo-offer-sales",
    title: "Commercial B2B",
    company: "Maghreb Connect",
    description:
      "Développer un portefeuille clients, piloter la prospection terrain et suivre les opportunités dans le CRM.",
    location: "Monastir",
    contractType: "CDI",
    workMode: "Terrain / Hybride",
    salaryMin: 1500,
    salaryMax: 2500,
    salaryLabel: "1 500 - 2 500 TND + primes",
    numberOfPositions: 3,
    status: "Publié",
    requirements: [
      "Bac+3 commercial ou gestion",
      "0 à 1 an d'expérience accepté",
      "Vente, CRM, Négociation",
      "Français B2 minimum",
      "Distance recommandée : 90 km",
    ],
    requiredSkills: ["Vente", "CRM", "Négociation"],
    preferredSkills: ["Prospection", "Reporting"],
    educationLevel: "Licence",
    minExperienceYears: 0,
    maxDistanceKm: 90,
    languageLevel: "B2",
    minScore: 60,
  },
];

export const demoCandidates: DemoCandidate[] = [
  {
    id: "demo-candidate-amira",
    name: "Amira Ben Salem",
    title: "Développeuse Full Stack Junior",
    location: "Tunis",
    email: "amira.bensalem@demo.tn",
    phone: "+216 55 210 411",
    educationLevel: "Licence",
    yearsExperience: 2,
    skills: ["Python", "React", "SQL", "Git", "FastAPI", "Docker"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B1" },
      { name: "Arabe", level: "C1" },
    ],
    distanceKm: 18,
    summary:
      "Développeuse web avec expérience sur des interfaces React et des API Python orientées data.",
  },
  {
    id: "demo-candidate-youssef",
    name: "Youssef Gharbi",
    title: "Data Analyst",
    location: "Sousse",
    email: "youssef.gharbi@demo.tn",
    phone: "+216 52 300 197",
    educationLevel: "Master",
    yearsExperience: 3,
    skills: ["Power BI", "SQL", "Excel", "Python", "DAX"],
    languages: [
      { name: "Français", level: "C1" },
      { name: "Anglais", level: "B2" },
    ],
    distanceKm: 35,
    summary:
      "Analyste data orienté reporting, KPIs métier et automatisation de tableaux de bord Power BI.",
  },
  {
    id: "demo-candidate-marwa",
    name: "Marwa Trabelsi",
    title: "Technicienne Réseaux",
    location: "Sfax",
    email: "marwa.trabelsi@demo.tn",
    phone: "+216 54 108 770",
    educationLevel: "Bac",
    yearsExperience: 4,
    skills: ["Cisco", "TCP/IP", "Windows Server", "Support", "Sécurité réseau"],
    languages: [
      { name: "Français", level: "B1" },
      { name: "Anglais", level: "A2" },
    ],
    distanceKm: 22,
    summary:
      "Technicienne confirmée pour la maintenance réseau, le support utilisateurs et les interventions terrain.",
  },
  {
    id: "demo-candidate-hichem",
    name: "Hichem Saidi",
    title: "Assistant RH",
    location: "Nabeul",
    email: "hichem.saidi@demo.tn",
    phone: "+216 58 440 266",
    educationLevel: "Licence",
    yearsExperience: 2,
    skills: ["Recrutement", "Excel", "Communication", "SIRH", "Paie"],
    languages: [
      { name: "Français", level: "C1" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 14,
    summary:
      "Profil RH polyvalent habitué au suivi des candidatures, entretiens et tableaux de bord sociaux.",
  },
  {
    id: "demo-candidate-ons",
    name: "Ons Khelifi",
    title: "Commerciale B2B",
    location: "Monastir",
    email: "ons.khelifi@demo.tn",
    phone: "+216 50 728 014",
    educationLevel: "Licence",
    yearsExperience: 5,
    skills: ["Vente", "CRM", "Négociation", "Prospection", "Reporting"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 28,
    summary:
      "Commerciale terrain avec forte capacité de prospection, relance et closing sur cycles B2B.",
  },
  {
    id: "demo-candidate-fares",
    name: "Fares Jebali",
    title: "Développeur Backend Python",
    location: "Tunis",
    email: "fares.jebali@demo.tn",
    phone: "+216 23 414 215",
    educationLevel: "Master",
    yearsExperience: 4,
    skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "Linux", "Redis"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B2" },
    ],
    distanceKm: 12,
    summary:
      "Développeur backend spécialisé dans les API performantes, l'intégration de données et les déploiements conteneurisés.",
  },
  {
    id: "demo-candidate-salma",
    name: "Salma Ayari",
    title: "Business Intelligence Analyst",
    location: "Sousse",
    email: "salma.ayari@demo.tn",
    phone: "+216 26 370 199",
    educationLevel: "Licence",
    yearsExperience: 1,
    skills: ["Power BI", "SQL", "Excel", "Tableau", "Communication"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 47,
    summary:
      "Jeune analyste BI très à l'aise sur la préparation de données et la restitution visuelle.",
  },
  {
    id: "demo-candidate-mohamed",
    name: "Mohamed Hammami",
    title: "Technicien Support & Réseaux",
    location: "Nabeul",
    email: "mohamed.hammami@demo.tn",
    phone: "+216 27 882 960",
    educationLevel: "Bac",
    yearsExperience: 1,
    skills: ["Support", "Réseaux", "Cisco", "Windows", "Helpdesk"],
    languages: [
      { name: "Français", level: "B1" },
      { name: "Anglais", level: "A2" },
    ],
    distanceKm: 64,
    summary:
      "Profil support avec bases solides en réseau local, assistance poste de travail et suivi tickets.",
  },
  {
    id: "demo-candidate-ines",
    name: "Ines Jlassi",
    title: "Développeuse React",
    location: "Sfax",
    email: "ines.jlassi@demo.tn",
    phone: "+216 94 700 143",
    educationLevel: "Licence",
    yearsExperience: 2,
    skills: ["React", "JavaScript", "TypeScript", "CSS", "Git", "API"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B2" },
    ],
    distanceKm: 91,
    summary:
      "Développeuse front orientée composants réutilisables, intégration API et expérience utilisateur.",
  },
  {
    id: "demo-candidate-walid",
    name: "Walid Ben Mahmoud",
    title: "Chargé RH Junior",
    location: "Tunis",
    email: "walid.benmahmoud@demo.tn",
    phone: "+216 28 605 771",
    educationLevel: "Master",
    yearsExperience: 0,
    skills: ["RH", "Communication", "Excel", "Reporting", "Organisation"],
    languages: [
      { name: "Français", level: "C1" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 52,
    summary:
      "Jeune diplômé RH motivé, avec stage en recrutement et forte aisance relationnelle.",
  },
  {
    id: "demo-candidate-ahmed",
    name: "Ahmed Gdira",
    title: "Ingénieur Réseaux",
    location: "Monastir",
    email: "ahmed.gdira@demo.tn",
    phone: "+216 21 773 058",
    educationLevel: "Master",
    yearsExperience: 5,
    skills: ["Cisco", "Firewall", "TCP/IP", "Linux", "Sécurité réseau"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 110,
    summary:
      "Ingénieur réseaux avec expérience avancée en sécurité, administration et exploitation d'infrastructure.",
  },
  {
    id: "demo-candidate-rim",
    name: "Rim Bouzid",
    title: "Analyste CRM & Vente",
    location: "Sousse",
    email: "rim.bouzid@demo.tn",
    phone: "+216 99 124 882",
    educationLevel: "Licence",
    yearsExperience: 3,
    skills: ["CRM", "Vente", "Excel", "Négociation", "Power BI"],
    languages: [
      { name: "Français", level: "B2" },
      { name: "Anglais", level: "B1" },
    ],
    distanceKm: 130,
    summary:
      "Profil orienté vente et pilotage CRM, avec bonne capacité d'analyse commerciale et de reporting.",
  },
];

export const demoParsedCvResult: DemoParsedCvResult = {
  firstName: "Amira",
  lastName: "Ben Salem",
  email: "amira.bensalem@demo.tn",
  phone: "+216 55 210 411",
  location: "Tunis",
  title: "Développeuse Full Stack Junior",
  summary:
    "Jeune développeuse orientée produits numériques avec une expérience concrète sur Python, React et SQL.",
  education: "Licence en Informatique appliquée",
  experience: "2 ans d'expérience en développement web et API",
  skills: ["Python", "React", "SQL", "Git", "FastAPI", "Docker"],
  languages: ["Français B2", "Anglais B1", "Arabe C1"],
};

export const demoParsedOfferResult: DemoParsedOfferResult = {
  title: "Développeur Full Stack Python React",
  description:
    "Développer des APIs Python, maintenir des interfaces React et participer à l'amélioration continue d'une plateforme emploi.",
  location: "Tunis",
  contractType: "CDI",
  workMode: "Hybride",
  salaryMin: 2500,
  salaryMax: 3500,
  salaryLabel: "2 500 - 3 500 TND",
  numberOfPositions: 2,
  requirements: [
    "Python",
    "React",
    "SQL",
    "Git",
    "Licence minimum",
    "Français B2 minimum",
  ],
  requiredSkills: ["Python", "React", "SQL", "Git"],
  preferredSkills: ["FastAPI", "Docker"],
  educationLevel: "Licence",
  minExperienceYears: 2,
  maxDistanceKm: 60,
  languageLevel: "B2",
  minScore: 70,
};

const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

export const getLanguageLabel = (language: DemoCandidateLanguage): string =>
  `${language.name} ${language.level}`.trim();

export const extractLanguageLevel = (value: string): DemoLanguageLevel => {
  const normalized = value.toUpperCase();
  if (normalized.includes("C1")) {
    return "C1";
  }
  if (normalized.includes("B2")) {
    return "B2";
  }
  if (normalized.includes("B1")) {
    return "B1";
  }
  return "A2";
};

export const getCandidateDistanceForOffer = (
  candidate: DemoCandidate,
  offer: DemoOffer,
): number => {
  const sameCityDistance =
    demoCityDistances[candidate.location]?.[offer.location] ??
    demoCityDistances[offer.location]?.[candidate.location];

  if (typeof sameCityDistance === "number") {
    if (candidate.location === offer.location) {
      return candidate.distanceKm;
    }
    return sameCityDistance;
  }

  return candidate.distanceKm;
};

export const buildDemoProfileCandidate = (
  profile: DemoParsedCvResult,
  id = "demo-current-candidate",
): DemoCandidate => ({
  id,
  name: `${profile.firstName} ${profile.lastName}`.trim(),
  title: profile.title,
  location: profile.location,
  email: profile.email,
  phone: profile.phone,
  educationLevel: profile.education.toLowerCase().includes("master")
    ? "Master"
    : profile.education.toLowerCase().includes("licence")
      ? "Licence"
      : "Bac",
  yearsExperience: Number.parseInt(profile.experience, 10) || 0,
  skills: profile.skills,
  languages: profile.languages.map((language) => {
    const [name] = language.split(/\s+(?:A2|B1|B2|C1)/i);
    return {
      name: name.trim() || "Français",
      level: extractLanguageLevel(language),
    };
  }),
  distanceKm: 18,
  summary: profile.summary,
});

export const scoreOfferAgainstCandidate = (
  offer: DemoOffer,
  candidate: DemoCandidate,
): number => {
  const result = buildDemoMatchingResult(offer, candidate, 1);
  return result.score;
};

export function buildDemoMatchingResult(
  offer: DemoOffer,
  candidate: DemoCandidate,
  rank = 1,
): DemoMatchingResult {
  const matchedSkills = offer.requiredSkills.filter((skill) => candidate.skills.includes(skill));
  const missingSkills = offer.requiredSkills.filter((skill) => !candidate.skills.includes(skill));
  const distanceKm = getCandidateDistanceForOffer(candidate, offer);
  const candidateLanguageLevel = candidate.languages.reduce<DemoLanguageLevel>(
    (current, language) =>
      languageLevelOrder[language.level] > languageLevelOrder[current]
        ? language.level
        : current,
    "A2",
  );

  const skillScore = clampScore(
    (matchedSkills.length / Math.max(1, offer.requiredSkills.length)) * 100,
  );
  const educationScore = clampScore(
    educationLevelOrder[candidate.educationLevel] >= educationLevelOrder[offer.educationLevel]
      ? 100
      : 55,
  );
  const experienceScore = clampScore(
    offer.minExperienceYears === 0
      ? 100
      : (Math.min(candidate.yearsExperience, offer.minExperienceYears + 1) /
          offer.minExperienceYears) *
          100,
  );
  const distanceScore = clampScore(
    distanceKm <= offer.maxDistanceKm
      ? 100 - (distanceKm / Math.max(offer.maxDistanceKm, 1)) * 20
      : 85 - ((distanceKm - offer.maxDistanceKm) / 70) * 60,
  );
  const languageScore = clampScore(
    languageLevelOrder[candidateLanguageLevel] >= languageLevelOrder[offer.languageLevel]
      ? 100
      : 55,
  );

  const globalScore = clampScore(
    skillScore * 0.4 +
      educationScore * 0.15 +
      experienceScore * 0.2 +
      distanceScore * 0.15 +
      languageScore * 0.1,
  );

  const gaps = [
    ...missingSkills.map((skill) => `Compétence manquante : ${skill}`),
    ...(candidate.yearsExperience < offer.minExperienceYears
      ? [`Expérience inférieure au minimum (${offer.minExperienceYears} ans)`]
      : []),
    ...(distanceKm > offer.maxDistanceKm
      ? [`Distance supérieure au seuil (${offer.maxDistanceKm} km)`]
      : []),
    ...(educationLevelOrder[candidate.educationLevel] < educationLevelOrder[offer.educationLevel]
      ? [`Niveau d'étude inférieur à ${offer.educationLevel}`]
      : []),
    ...(languageLevelOrder[candidateLanguageLevel] < languageLevelOrder[offer.languageLevel]
      ? [`Niveau de langue inférieur à ${offer.languageLevel}`]
      : []),
  ];

  const matchedItems = [
    ...matchedSkills,
    candidate.educationLevel,
    `${candidate.yearsExperience} ans d'expérience`,
    `${distanceKm} km`,
  ];
  const missingItems = gaps.length > 0 ? gaps : ["Aucun écart bloquant détecté"];

  return {
    id: `${offer.id}-${candidate.id}`,
    rank,
    candidateId: candidate.id,
    candidateName: candidate.name,
    title: candidate.title,
    location: candidate.location,
    distanceKm,
    educationLevel: candidate.educationLevel,
    yearsExperience: candidate.yearsExperience,
    skills: candidate.skills,
    languages: candidate.languages.map(getLanguageLabel),
    score: globalScore,
    matchedSkills,
    missingSkills,
    gaps,
    status:
      globalScore >= 80
        ? "Très compatible"
        : globalScore >= 65
          ? "Compatible"
          : "À revoir",
    matchedItems,
    missingItems,
    recommendation:
      globalScore >= 80
        ? "À contacter en priorité pour entretien."
        : globalScore >= 65
          ? "Profil intéressant avec quelques points à vérifier."
          : "Prévoir une vérification manuelle avant shortlist.",
    criteria: [
      {
        label: "Compétences",
        score: skillScore,
        matched: missingSkills.length <= 1,
        details:
          matchedSkills.length > 0
            ? matchedSkills.join(", ")
            : "Aucune compétence clé détectée",
      },
      {
        label: "Niveau d'étude",
        score: educationScore,
        matched:
          educationLevelOrder[candidate.educationLevel] >=
          educationLevelOrder[offer.educationLevel],
        details: candidate.educationLevel,
      },
      {
        label: "Expérience",
        score: experienceScore,
        matched: candidate.yearsExperience >= offer.minExperienceYears,
        details: `${candidate.yearsExperience} an(s)`,
      },
      {
        label: "Distance",
        score: distanceScore,
        matched: distanceKm <= offer.maxDistanceKm,
        details: `${distanceKm} km`,
      },
      {
        label: "Langue",
        score: languageScore,
        matched:
          languageLevelOrder[candidateLanguageLevel] >=
          languageLevelOrder[offer.languageLevel],
        details: candidate.languages.map(getLanguageLabel).join(", "),
      },
    ],
  };
}

export const buildDemoMatchingResultsForOffer = (
  offer: DemoOffer,
  candidates: DemoCandidate[] = demoCandidates,
): DemoMatchingResult[] =>
  [...candidates]
    .map((candidate) => buildDemoMatchingResult(offer, candidate))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));

export const demoMatchingResults: DemoMatchingResult[] = buildDemoMatchingResultsForOffer(
  demoOffers[0],
);
