import { apiJsonRequest } from '@/services/api/client';
import type { OnboardingDraft, VerificationMethod } from '@/types/candidateOnboarding';

/**
 * Convertit le draft onboarding en payload pour PATCH /candidates/me/profile.
 * Utilise les IDs canoniques pour tous les champs géographiques.
 */
export function mapOnboardingDraftToCandidateProfilePayload(
  draft: OnboardingDraft,
): Record<string, unknown> {
  return {
    // Identité
    civility: draft.civility || undefined,
    marital_status: draft.maritalStatus || undefined,
    first_name: draft.firstName || undefined,
    last_name: draft.lastName || undefined,
    gender: draft.gender || undefined,
    date_of_birth: draft.dateOfBirth || undefined,
    national_id: draft.nationalId || undefined,
    nationality_country_iso2: draft.nationalityCountryIso2 || undefined,

    // Contact
    email: draft.email || undefined,
    phone: draft.phone || undefined,

    // Adresse de résidence (IDs canoniques)
    address: draft.address || undefined,
    country_id: draft.countryId || undefined,
    governorate_unit_id: draft.governorateUnitId || undefined,
    delegation_unit_id: draft.delegationUnitId || undefined,
    imada_unit_id: draft.imadaUnitId || undefined,
    location_unit_id: draft.locationUnitId || undefined,
    postal_code_id: draft.postalCodeId || undefined,
    postal_code: draft.postalCode || undefined,

    // Lieu de naissance (IDs canoniques)
    birth_country_id: draft.birthCountryId || undefined,
    birth_governorate_unit_id: draft.birthGovernorateUnitId || undefined,
    birth_delegation_unit_id: draft.birthDelegationUnitId || undefined,
    birth_imada_unit_id: draft.birthImadaUnitId || undefined,

    // Consentements
    consent_data_processing: draft.consentDataProcessing || undefined,
    consent_marketing: draft.consentMarketing || undefined,

    // Infos complémentaires
    work_situation: draft.workSituation || undefined,
    current_occupation_node_id: draft.currentOccupationNodeId || undefined,
    has_driving_license: draft.hasDrivingLicense || undefined,
    driving_license_type_codes:
      (draft.drivingLicenseTypeCodes ?? []).length > 0
        ? draft.drivingLicenseTypeCodes
        : undefined,
    mobility_scope: draft.mobilityScope || undefined,
    has_disability: draft.hasDisability || undefined,
    handicap_type: draft.handicapType || undefined,
    handicap_degree: draft.handicapDegree || undefined,
    has_dismissal: draft.hasDismissal || undefined,
    dismissal_type: draft.dismissalType || undefined,

    // Formation
    instruction_level: draft.instructionLevel || undefined,
    last_class_code: draft.lastClassCode || undefined,
    diplomas:
      (draft.diplomas ?? []).length > 0
        ? (draft.diplomas ?? []).map((d) => ({
            label: d.label,
            year: d.year,
            institution: d.institution,
            diploma_code: d.diplomaCode || undefined,
            specialty_code: d.specialtyCode || undefined,
            country_iso2: d.countryIso2 || undefined,
          }))
        : undefined,
    certifications:
      (draft.certifications ?? []).length > 0
        ? (draft.certifications ?? []).map((c) => ({
            label: c.label,
            year: c.year,
            issuer: c.issuer,
            domain_code: c.domainCode || undefined,
          }))
        : undefined,

    // Expériences (IDs canoniques pour la géo)
    experiences:
      (draft.experiences ?? []).length > 0
        ? (draft.experiences ?? []).map((exp) => ({
            company: exp.company,
            role: exp.occupationLabel || exp.role,
            occupation_node_id: exp.occupationNodeId || undefined,
            start_date: exp.startDate || undefined,
            end_date: exp.current ? null : exp.endDate || undefined,
            current: exp.current,
            description: exp.description || undefined,
            experience_type_code: exp.experienceTypeCode || undefined,
            organization_type_code: exp.organizationTypeCode || undefined,
            activity_sector_code: exp.activitySectorCode || undefined,
            country_id: exp.countryId || undefined,
            governorate_unit_id: exp.governorateUnitId || undefined,
            delegation_unit_id: exp.delegationUnitId || undefined,
            imada_unit_id: exp.imadaUnitId || undefined,
            location_unit_id: exp.locationUnitId || undefined,
            postal_code_id: exp.postalCodeId || undefined,
            postal_code: exp.postalCode || undefined,
          }))
        : undefined,

    // Compétences
    target_occupation_node_id: draft.targetOccupationNodeId || undefined,
    target_occupation_label: draft.targetOccupationLabel || undefined,
    technical_skills:
      (draft.technicalSkillItems ?? []).length > 0
        ? (draft.technicalSkillItems ?? []).map((s) => ({
            node_id: s.nodeId,
            label: s.label,
            level_code: s.levelCode || undefined,
          }))
        : undefined,
    soft_skills:
      (draft.softSkillItems ?? []).length > 0
        ? (draft.softSkillItems ?? []).map((s) => ({
            node_id: s.nodeId,
            label: s.label,
          }))
        : undefined,
    digital_skills:
      (draft.digitalSkillItems ?? []).length > 0
        ? (draft.digitalSkillItems ?? []).map((s) => ({
            node_id: s.nodeId,
            label: s.label,
          }))
        : undefined,
    languages:
      (draft.languageItems ?? []).length > 0
        ? (draft.languageItems ?? []).map((l) => ({
            lang_code: l.langCode,
            label: l.label,
            level_code: l.levelCode,
          }))
        : undefined,

    registration_reasons:
      (draft.registrationReasons ?? []).length > 0 ? draft.registrationReasons : undefined,
  };
}

/**
 * Convertit la réponse GET /candidates/me/profile en draft onboarding.
 */
export function mapCandidateProfileResponseToOnboardingDraft(
  profile: Record<string, unknown>,
): Partial<OnboardingDraft> {
  const safeStr = (v: unknown): string => (typeof v === 'string' ? v : '');
  const safeNullStr = (v: unknown): string | null =>
    typeof v === 'string' && v ? v : null;
  const safeBool = (v: unknown): boolean => Boolean(v);
  const safeArr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    civility: safeStr(profile.civility),
    maritalStatus: safeStr(profile.marital_status),
    firstName: safeStr(profile.first_name),
    lastName: safeStr(profile.last_name),
    gender: safeStr(profile.gender),
    dateOfBirth: safeStr(profile.date_of_birth),
    nationalId: safeStr(profile.national_id),
    nationalityCountryIso2: safeStr(profile.nationality_country_iso2),
    email: safeStr(profile.email),
    phone: safeStr(profile.phone),
    address: safeStr(profile.address),

    // Adresse de résidence (IDs canoniques)
    countryId: safeNullStr(profile.country_id),
    governorateUnitId: safeNullStr(profile.governorate_unit_id),
    delegationUnitId: safeNullStr(profile.delegation_unit_id),
    imadaUnitId: safeNullStr(profile.imada_unit_id),
    locationUnitId: safeNullStr(profile.location_unit_id),
    postalCodeId: safeNullStr(profile.postal_code_id),
    postalCode: safeStr(profile.postal_code),
    postalLocalityLabel: safeStr(profile.postal_locality_label),

    // Lieu de naissance (IDs canoniques)
    birthCountryId: safeNullStr(profile.birth_country_id),
    birthGovernorateUnitId: safeNullStr(profile.birth_governorate_unit_id),
    birthDelegationUnitId: safeNullStr(profile.birth_delegation_unit_id),
    birthImadaUnitId: safeNullStr(profile.birth_imada_unit_id),

    consentDataProcessing: safeBool(profile.consent_data_processing),
    consentMarketing: safeBool(profile.consent_marketing),
    workSituation: safeStr(profile.work_situation),
    currentOccupationNodeId: safeStr(profile.current_occupation_node_id),
    currentOccupationLabel: safeStr(profile.current_occupation_label),
    hasDrivingLicense: safeBool(profile.has_driving_license),
    drivingLicenseTypeCodes: safeArr(profile.driving_license_type_codes),
    mobilityScope: safeStr(profile.mobility_scope),
    hasDisability: safeBool(profile.has_disability),
    handicapType: safeStr(profile.handicap_type),
    handicapDegree: safeStr(profile.handicap_degree),
    hasDismissal: safeBool(profile.has_dismissal),
    dismissalType: safeStr(profile.dismissal_type),
    instructionLevel: safeStr(profile.instruction_level),
    lastClassCode: safeStr(profile.last_class_code),
    diplomas: safeArr(profile.diplomas),
    certifications: safeArr(profile.certifications),
    experiences: safeArr(profile.experiences),
    targetOccupationNodeId: safeStr(profile.target_occupation_node_id),
    targetOccupationLabel: safeStr(profile.target_occupation_label),
    technicalSkillItems: safeArr(profile.technical_skills),
    softSkillItems: safeArr(profile.soft_skills),
    digitalSkillItems: safeArr(profile.digital_skills),
    languageItems: safeArr(profile.languages),
    registrationReasons: safeArr(profile.registration_reasons),
  };
}

/**
 * Soumet le profil onboarding via PATCH /candidates/me/profile.
 */
export async function submitCandidateOnboardingProfile(
  payload: Record<string, unknown>,
): Promise<void> {
  await apiJsonRequest<unknown>('/candidates/me/profile', 'PATCH', payload);
}

/**
 * TODO: implémenter quand l'endpoint d'envoi OTP sera disponible.
 */
export async function sendVerificationCode(_params: {
  method: VerificationMethod;
  email?: string;
  phone?: string;
}): Promise<{ message: string }> {
  throw new Error('OTP send endpoint not yet implemented. Connect to backend when ready.');
}

/**
 * TODO: implémenter quand l'endpoint de vérification OTP sera disponible.
 */
export async function verifyOtpCode(_params: {
  code: string;
  method: VerificationMethod;
  identifier: string;
}): Promise<{ message: string }> {
  throw new Error('OTP verify endpoint not yet implemented. Connect to backend when ready.');
}
