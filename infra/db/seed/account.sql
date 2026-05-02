BEGIN;

-- =========================================================
-- SEED USERS / PROFILES - ANETI
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 2. Créer une agence ANETI de test
-- =========================================================
INSERT INTO aneti.aneti_agency (
    code,
    name,
    governorate,
    delegation,
    address,
    active
)
VALUES (
    'AG-SOUSSE-001',
    'Bureau ANETI Sousse',
    'SOUSSE',
    'HAMMAM SOUSSE',
    'Tunisie',
    TRUE
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    governorate = EXCLUDED.governorate,
    delegation = EXCLUDED.delegation,
    address = EXCLUDED.address,
    active = EXCLUDED.active;

-- =========================================================
-- 3. Créer les users
-- Mot de passe temporaire : Password123!
-- =========================================================
INSERT INTO iam.auth_user (
    email,
    password_hash,
    phone,
    status
)
VALUES
    (
        'tech.admin@aneti.tn',
        crypt('Azerty09++', gen_salt('bf')),
        '+21600000001',
        'ACTIVE'
    ),
    (
        'functional.admin@aneti.tn',
        crypt('Azerty09++', gen_salt('bf')),
        '+21600000002',
        'ACTIVE'
    ),
    (
        'advisor.sousse@aneti.tn',
        crypt('Azerty09++', gen_salt('bf')),
        '+21600000003',
        'ACTIVE'
    ),
    (
        'candidate.demo@aneti.tn',
        crypt('Password123!', gen_salt('bf')),
        '+21600000004',
        'ACTIVE'
    ),
    (
        'employer.demo@aneti.tn',
        crypt('Azerty09++', gen_salt('bf')),
        '+21600000005',
        'ACTIVE'
    )
ON CONFLICT (email) DO UPDATE
SET
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    updated_at = now();

-- =========================================================
-- 4. Assigner les rôles
-- =========================================================

-- TECH_ADMIN
INSERT INTO iam.auth_user_role (user_id, role_id)
SELECT u.id, r.id
FROM iam.auth_user u
JOIN iam.auth_role r ON r.code = 'TECH_ADMIN'
WHERE u.email = 'tech.admin@aneti.tn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- FUNCTIONAL_ADMIN
INSERT INTO iam.auth_user_role (user_id, role_id)
SELECT u.id, r.id
FROM iam.auth_user u
JOIN iam.auth_role r ON r.code = 'FUNCTIONAL_ADMIN'
WHERE u.email = 'functional.admin@aneti.tn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ANETI_ADVISOR
INSERT INTO iam.auth_user_role (user_id, role_id)
SELECT u.id, r.id
FROM iam.auth_user u
JOIN iam.auth_role r ON r.code = 'ANETI_ADVISOR'
WHERE u.email = 'advisor.sousse@aneti.tn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- JOB_SEEKER
INSERT INTO iam.auth_user_role (user_id, role_id)
SELECT u.id, r.id
FROM iam.auth_user u
JOIN iam.auth_role r ON r.code = 'JOB_SEEKER'
WHERE u.email = 'candidate.demo@aneti.tn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- EMPLOYER
INSERT INTO iam.auth_user_role (user_id, role_id)
SELECT u.id, r.id
FROM iam.auth_user u
JOIN iam.auth_role r ON r.code = 'EMPLOYER'
WHERE u.email = 'employer.demo@aneti.tn'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =========================================================
-- 5. Créer le profil conseiller
-- =========================================================
INSERT INTO aneti.advisor_profile (
    user_id,
    agency_id,
    full_name,
    position,
    active
)
SELECT
    u.id,
    a.id,
    'Conseiller Sousse',
    'Conseiller emploi',
    TRUE
FROM iam.auth_user u
JOIN aneti.aneti_agency a ON a.code = 'AG-SOUSSE-001'
WHERE u.email = 'advisor.sousse@aneti.tn'
ON CONFLICT (user_id) DO UPDATE
SET
    agency_id = EXCLUDED.agency_id,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    active = EXCLUDED.active,
    updated_at = now();

COMMIT;









