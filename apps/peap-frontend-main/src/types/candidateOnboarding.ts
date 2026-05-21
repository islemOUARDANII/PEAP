// ─── Primitives ───────────────────────────────────────────────────────────────

export type VerificationMethod = 'EMAIL' | 'SMS';
export type CvChoice = 'upload' | 'manual' | '';

/** Compétence liée à un nœud taxonomy avec niveau optionnel */
export interface OnboardingSkillItem {
  nodeId: string;     // taxonomy_node.id
  label: string;      // preferred_label affiché
  levelCode: string;  // code ref SKILL_LEVEL (vide si non sélectionné)
}

/** Langue avec niveau issu des référentiels */
export interface OnboardingLanguageItem {
  langCode: string;   // code ref LANGUAGE
  label: string;      // libellé affiché
  levelCode: string;  // code ref LANGUAGE_LEVEL
}

// ─── Sous-structures de l'étape formation ────────────────────────────────────

export interface OnboardingDraftDiploma {
  label: string;
  year: string;
  institution: string;
  diplomaCode: string;    // code ref DIPLOMA
  specialtyCode: string;  // code ref SPECIALTY
  countryIso2: string;    // pays de l'établissement (ISO2, champ séparé de la géo résidence)
  fileId: string;
}

export interface OnboardingDraftCertification {
  label: string;
  year: string;
  issuer: string;
  domainCode: string;     // code ref CERTIFICATION
  fileId: string;
}

// ─── Sous-structure expérience ───────────────────────────────────────────────

export interface OnboardingDraftExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  experienceTypeCode: string;     // code ref EXPERIENCE_TYPE
  organizationTypeCode: string;   // code ref ORGANIZATION_TYPE
  activitySectorCode: string;     // code ref ACTIVITY_SECTOR
  occupationNodeId: string;       // taxonomy_node.id (OCCUPATION)
  occupationLabel: string;
  // Géo de l'expérience (IDs canoniques)
  countryId: string | null;
  governorateUnitId: string | null;
  delegationUnitId: string | null;
  imadaUnitId: string | null;
  locationUnitId: string | null;
  postalCodeId: string | null;
  postalCode: string;
  postalLocalityLabel: string;
  attestationFileId: string;
}

// ─── Draft principal ─────────────────────────────────────────────────────────

export interface OnboardingDraft {
  // Étape 1 — Raisons d'inscription (codes ref REGISTRATION_REASON)
  registrationReasons: string[];

  // Étape 2 — Choix CV
  cvChoice: CvChoice;

  // Étape 3 — Informations personnelles : identité
  civility: string;                // code ref CIVILITY
  maritalStatus: string;           // code ref MARITAL_STATUS
  firstName: string;
  lastName: string;
  gender: string;                  // code ref GENDER (ou 'M'/'F')
  dateOfBirth: string;
  nationalId: string;
  nationalityCountryIso2: string;  // pays de nationalité (ISO2, champ d'identité)

  // Contact
  email: string;
  phone: string;

  // Adresse de résidence (IDs canoniques)
  address: string;
  countryId: string | null;
  governorateUnitId: string | null;
  delegationUnitId: string | null;
  imadaUnitId: string | null;
  locationUnitId: string | null;
  postalCodeId: string | null;
  postalCode: string;
  postalLocalityLabel: string;

  // Lieu de naissance (IDs canoniques)
  birthCountryId: string | null;
  birthGovernorateUnitId: string | null;
  birthDelegationUnitId: string | null;
  birthImadaUnitId: string | null;

  // Consentements
  consentDataProcessing: boolean;
  consentMarketing: boolean;

  // Fichiers identité
  cinFileId: string;
  photoFileId: string;

  // Étape 4 — Informations complémentaires
  workSituation: string;              // code ref WORK_SITUATION
  currentOccupationNodeId: string;    // taxonomy id OCCUPATION
  currentOccupationLabel: string;
  hasDrivingLicense: boolean;
  drivingLicenseTypeCodes: string[];  // codes ref PERMIT_TYPE
  mobilityScope: string;              // code ref MOBILITY_SCOPE
  hasDisability: boolean;
  handicapType: string;               // code ref HANDICAP_TYPE
  handicapDegree: string;             // code ref HANDICAP_DEGREE
  handicapCardFileId: string;
  hasDismissal: boolean;
  dismissalType: string;              // code ref DISMISSAL_TYPE

  // Étape 5 — Formation
  instructionLevel: string;           // code ref EDUCATION_LEVEL
  lastClassCode: string;              // code ref LAST_CLASS
  diplomas: OnboardingDraftDiploma[];
  certifications: OnboardingDraftCertification[];

  // Étape 6 — Expériences
  experiences: OnboardingDraftExperience[];

  // Étape 7 — Compétences
  targetOccupationNodeId: string;
  targetOccupationLabel: string;
  technicalSkillItems: OnboardingSkillItem[];
  softSkillItems: OnboardingSkillItem[];
  digitalSkillItems: OnboardingSkillItem[];
  languageItems: OnboardingLanguageItem[];
}

// ─── Valeurs initiales ───────────────────────────────────────────────────────

export const initialOnboardingDraft: OnboardingDraft = {
  registrationReasons: [],
  cvChoice: '',
  civility: '',
  maritalStatus: '',
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  nationalId: '',
  nationalityCountryIso2: '',
  email: '',
  phone: '',
  address: '',
  countryId: null,
  governorateUnitId: null,
  delegationUnitId: null,
  imadaUnitId: null,
  locationUnitId: null,
  postalCodeId: null,
  postalCode: '',
  postalLocalityLabel: '',
  birthCountryId: null,
  birthGovernorateUnitId: null,
  birthDelegationUnitId: null,
  birthImadaUnitId: null,
  consentDataProcessing: false,
  consentMarketing: false,
  cinFileId: '',
  photoFileId: '',
  workSituation: '',
  currentOccupationNodeId: '',
  currentOccupationLabel: '',
  hasDrivingLicense: false,
  drivingLicenseTypeCodes: [],
  mobilityScope: '',
  hasDisability: false,
  handicapType: '',
  handicapDegree: '',
  handicapCardFileId: '',
  hasDismissal: false,
  dismissalType: '',
  instructionLevel: '',
  lastClassCode: '',
  diplomas: [],
  certifications: [],
  experiences: [],
  targetOccupationNodeId: '',
  targetOccupationLabel: '',
  technicalSkillItems: [],
  softSkillItems: [],
  digitalSkillItems: [],
  languageItems: [],
};

// ─── Étapes du wizard ────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { key: 'reasons', label: 'Raisons', path: '/candidate/onboarding/reasons' },
  { key: 'cv-choice', label: 'CV', path: '/candidate/onboarding/cv-choice' },
  { key: 'personal-info', label: 'Infos personnelles', path: '/candidate/onboarding/personal-info' },
  { key: 'additional-info', label: 'Infos complémentaires', path: '/candidate/onboarding/additional-info' },
  { key: 'education', label: 'Formation', path: '/candidate/onboarding/education' },
  { key: 'experience', label: 'Expérience', path: '/candidate/onboarding/experience' },
  { key: 'skills', label: 'Compétences', path: '/candidate/onboarding/skills' },
  { key: 'review', label: 'Récapitulatif', path: '/candidate/onboarding/review' },
] as const;

export type OnboardingStepKey = typeof ONBOARDING_STEPS[number]['key'];
