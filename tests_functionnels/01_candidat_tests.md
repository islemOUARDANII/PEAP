# Tests fonctionnels — Rôle Candidat

## Objectif général

Valider toutes les fonctionnalités accessibles au candidat :

1. Upload du CV.
2. Stockage du CV dans Azure Blob.
3. Déclenchement automatique du parsing via Kafka après upload.
4. Parsing du CV.
5. Remplissage automatique du profil candidat.
6. Affichage et modification du profil.
7. Consultation du CV en PDF.
8. Recherche d’offres par mots-clés via search-service.
9. Recommandations d’offres par score via matching-service.
10. Modification du seuil de recommandation.
11. Consultation de toutes les offres.
12. Candidature à une offre.

---

## Données de test

### Compte candidat de test

| Champ        | Valeur                     |
|--------------|----------------------------|
| Email        | candidate001.demo@aneti.tn |
| Mot de passe | Password123!               |
| Rôle attendu | JOB_SEEKER                 |

### CV de test 1 — Développeur

| Élément     | Résultat attendu                  |
|-------------|-----------------------------------|
| Nom         | À vérifier selon le CV            |
| Email       | À vérifier selon le CV            |
| Téléphone   | À vérifier selon le CV            |
| Compétences | Python, React, SQL, Git           |
| Formation   | Licence ou Master                 |
| Expérience  | Stage ou expérience développement |
| Langues     | Français, Anglais                 |

### Offre cible pour matching

| Élément      | Valeur attendue               |
|--------------|-------------------------------|
| Titre        | Développeur Full Stack Junior |
| Compétences  | Python, React, SQL, Git       |
| Niveau       | Licence                       |
| Contrat      | CDI / Full-time               |
| Localisation | Sousse / Tunis / TN           |

---

# CAND-001 — Connexion candidat

## Objectif

Vérifier que le candidat peut se connecter et récupérer son profil utilisateur.

## Préconditions

- API Gateway démarré.
- Compte candidat existant.
- Base de données accessible.

## Endpoint principal

http
POST /auth/login
GET /auth/me

## Résultat obtenu

{
    "id": "4a5e88a2-57be-44d1-b5ba-b5530360e5d6",
    "email": "candidate.demo@aneti.tn",
    "status": "ACTIVE",
    "roles": [
        "JOB_SEEKER"
    ],
    "profile": {
        "type": "JOB_SEEKER",
        "id": "ff99b2c0-1747-4374-9992-cfd054fa2066",
        "label": "GHOFRANE JOMNI"
    }
}

## Statut

OK ✅

# CAND-002 — Upload du CV
## Objectif

Vérifier que le candidat peut uploader un CV PDF et que le fichier est enregistré.

## Préconditions

- Candidat connecté.
- Token disponible.
- CV PDF de test disponible.
- Azure Blob configuré.

## Endpoint principal

POST /candidates/me/cv

## Résultat obtenu 

{
    "id": "0c25b974-b854-4345-8940-cc3445cf4151",
    "cv_id": "cv_06bb5f86def549a4902e39de23fa7979",
    "storage_provider": "AZURE_BLOB",
    "container_name": "cv-raw",
    "blob_name": "job_seekers/ff99b2c0-1747-4374-9992-cfd054fa2066/cv_06bb5f86def549a4902e39de23fa7979_Islem_Ouardani_CV_2_.pdf",
    "storage_key": "job_seekers/ff99b2c0-1747-4374-9992-cfd054fa2066/cv_06bb5f86def549a4902e39de23fa7979_Islem_Ouardani_CV_2_.pdf",
    "blob_url": "https://matchingsotrage.blob.core.windows.net/cv-raw/job_seekers/ff99b2c0-1747-4374-9992-cfd054fa2066/cv_06bb5f86def549a4902e39de23fa7979_Islem_Ouardani_CV_2_.pdf",
    "original_filename": "Islem_Ouardani_CV (2).pdf",
    "mime_type": "application/pdf",
    "file_size_bytes": 272090,
    "status": "AVAILABLE",
    "is_current": true,
    "parsed_resume_id": null,
    "parsing_status": "NOT_PARSED",
    "uploaded_by_user_id": "4a5e88a2-57be-44d1-b5ba-b5530360e5d6",
    "uploaded_at": "2026-05-01T17:00:47.683701Z",
    "created_at": "2026-05-01T17:00:47.683701Z",
    "updated_at": "2026-05-01T17:00:47.683701Z"
}

## Status

OK ✅

# CAND-003 — Vérification de la liste des CV

## Objectif

Vérifier que le CV uploadé apparaît dans la liste des CV du candidat.

# Endpoint principal
GET /candidates/me/cv

## Status 

ok ✅


CAND-002 : Event Kafka déclenché après upload
CAND-003 : Parsing automatique après upload

