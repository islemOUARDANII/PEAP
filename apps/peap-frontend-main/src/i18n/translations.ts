export type Locale = 'en' | 'fr';
export const DEFAULT_LOCALE: Locale = 'fr';

const frExact: Record<string, string> = {
  Candidate: 'Candidat',
  'Job Provider': 'Recruteur',
  Advisor: 'Conseiller',
  Dashboard: 'Tableau de bord',
  'My Profile': 'Mon profil',
  Overview: "Vue d'ensemble",
  Opportunities: 'Opportunites',
  Offers: 'Offres',
  'Candidate Portal': 'Portail candidat',
  'Provider Console': 'Espace recruteur',
  'Advisor Backoffice': 'Backoffice conseiller',
  'Knowledge Graph': 'Graphe de connaissances',
  Governance: 'Gouvernance',
  'Taxonomy Manager': 'Gestionnaire de taxonomie',
  'Pipeline Monitoring': 'Suivi du pipeline',
  Users: 'Utilisateurs',
  'Provider Requests': 'Demandes recruteur',
  'Audit Logs': "Journaux d'audit",
  'Search in this portal': 'Rechercher dans ce portail',
  'Log out': 'Se deconnecter',
  'Active offers': 'Offres actives',
  'Matched candidates': 'Candidats correspondants',
  'New applications': 'Nouvelles candidatures',
  'Avg. match quality': 'Qualite moyenne du matching',
  'last 7 days': '7 derniers jours',
  'Upload CV': 'Importer le CV',
  'Uploading...': 'Import en cours...',
  'Extracting your CV...': 'Extraction du CV...',
  'Preparing your profile...': 'Preparation de votre profil...',
  'Profile setup': 'Configuration du profil',
  'Welcome to MatchCore': 'Bienvenue sur MatchCore',
  'First profile setup': 'Premiere configuration du profil',
  'Upload your CV': 'Importer le CV',
  'Replace file': 'Remplacer le fichier',
  'Current status': 'Statut actuel',
  'Uploaded document': 'Document importe',
  'Candidate profile': 'Profil candidat',
  'Profile ready': 'Profil pret',
  'MatchCore creates your profile': 'MatchCore cree votre profil',
  'Your job matches become available':
    'Vos correspondances deviennent disponibles',
  'Do not upload another CV while extraction is running.':
    "N'importez pas un autre CV pendant l'extraction.",
  'PDF, DOC, DOCX, PNG, JPG, or JPEG accepted':
    'PDF, DOC, DOCX, PNG, JPG ou JPEG acceptes',
  'Your CV is being extracted': "Votre CV est en cours d'extraction",
  'Loading offers...': 'Chargement des offres...',
  'No CV session found': 'Aucune session CV trouvee',
  'Open profile': 'Ouvrir le profil',
  Refresh: 'Actualiser',
  'No offers are available for your current profile.':
    "Aucune offre n'est disponible pour votre profil actuel.",
  'Computing...': 'Calcul en cours...',
  'Score being calculated...': 'Score en cours de calcul...',
  Final: 'Score final',
  'Sub-scores': 'Sous-scores',
  'Required skills': 'Competences obligatoires',
  'Nice to have': 'Competences souhaitees',
  'Languages not specified': 'Langues non specifiees',
  'View details': 'Voir les details',
  'Edit profile': 'Modifier le profil',
  Cancel: 'Annuler',
  Save: 'Enregistrer',
  Saving: 'Enregistrement...',
  'Detected occupation': 'Metier detecte',
  Years: 'Annees',
  Skills: 'Competences',
  Experience: 'Experience',
  Education: 'Formation',
  Languages: 'Langues',
  'Core skills (extracted)': 'Competences principales (extraites)',
  'Secondary skills': 'Competences secondaires',
  'Suggested to add': 'Suggestions a ajouter',
  'Personal information': 'Informations personnelles',
  'Full name': 'Nom complet',
  Email: 'Email',
  Phone: 'Telephone',
  Location: 'Localisation',
  'Primary language': 'Langue principale',
  Headline: 'Titre du profil',
  'Linked documents': 'Documents lies',
  'Candidate profile updated': 'Profil candidat mis a jour',
  'Email not available': 'Email indisponible',
  'Phone not available': 'Telephone indisponible',
  'Primary language not specified': 'Langue principale non specifiee',
  'No extracted skills are available yet.':
    "Aucune competence extraite n'est encore disponible.",
  'No secondary skills are available yet.':
    "Aucune competence secondaire n'est encore disponible.",
  'No additional skill suggestions are available yet.':
    "Aucune suggestion supplementaire n'est encore disponible.",
  'No experience rows are available yet.':
    "Aucune experience n'est encore disponible.",
  'Year not specified': 'Annee non specifiee',
  'No education rows are available yet.':
    "Aucune formation n'est encore disponible.",
  'No language rows are available yet.':
    "Aucune langue n'est encore disponible.",
  'Upload date unavailable': "Date d'import indisponible",
  'Unknown type': 'Type inconnu',
  'No linked candidate documents are available yet.':
    "Aucun document candidat lie n'est encore disponible.",
  'Sign in': 'Se connecter',
  'Sign up': "S'inscrire",
  'Sign in to MatchCore': 'Se connecter a MatchCore',
  'Candidates, providers, admins, and advisors use secure sign in.':
    'Les candidats, recruteurs, administrateurs et conseillers utilisent une connexion securisee.',
  'Sign-in failed': 'Connexion echouee',
  'Email verification': "Verification de l'email",
  'Email verification failed': "Echec de la verification de l'email",
  Password: 'Mot de passe',
  'Enter your password': 'Saisissez votre mot de passe',
  'Signing in...': 'Connexion en cours...',
  'Create MatchCore access': 'Creer un acces MatchCore',
  'Candidate self-service and provider registration are available here.':
    "L'espace candidat et la demande d'acces recruteur sont disponibles ici.",
  'Create candidate account': 'Creer un compte candidat',
  'Verification required': 'Verification requise',
  'Sign-up needs attention': 'Inscription a verifier',
  'Passwords do not match.': 'Les mots de passe ne correspondent pas.',
  'Use at least 8 characters for your password.':
    'Utilisez au moins 8 caracteres pour votre mot de passe.',
  'Confirm password': 'Confirmer le mot de passe',
  'Create password': 'Creer un mot de passe',
  'Candidate account already exists. Sign in instead.':
    'Le compte candidat existe deja. Connectez-vous.',
  'Job provider': 'Recruteur',
  'Contact name': 'Nom du contact',
  'Job title': 'Intitule du poste',
  Company: 'Entreprise',
  'Business email': 'Email professionnel',
  Website: 'Site web',
  'Company size': "Taille de l'entreprise",
  'Hiring needs': 'Besoins de recrutement',
  'Send provider request': 'Envoyer la demande recruteur',
  'Sending request...': 'Envoi de la demande...',
  'Request failed': 'Echec de la demande',
  'Search jobs, matches, skills...':
    'Rechercher des offres, correspondances, competences...',
  'Search offers or candidates...': 'Rechercher des offres ou des candidats...',
  'Search taxonomy, users, audit...':
    "Rechercher dans la taxonomie, les utilisateurs, l'audit...",
  'Back to offers': 'Retour aux offres',
  'Open offers': 'Ouvrir les offres',
  'Choose file': 'Choisir un fichier',
  'Selected file': 'Fichier selectionne',
  'No file selected yet': 'Aucun fichier selectionne',
  'Upload and parse': 'Importer et analyser',
  'Upload failed': "Echec de l'import",
  'View offers': 'Voir les offres',
  'Open CV': 'Ouvrir le CV',
  Postulate: 'Postuler',
  Accepted: 'Accepte',
  'Export page': 'Exporter la page',
  Action: 'Action',
  'Entity type': "Type d'entite",
  'All results': 'Tous les resultats',
  Occurred: 'Date',
  'Actor User ID': 'ID utilisateur acteur',
  Entity: 'Entite',
  'Trace ID': 'ID de trace',
  Result: 'Resultat',
  ID: 'ID',
  'Provider registration requests': "Demandes d'inscription recruteur",
  Status: 'Statut',
  Pending: 'En attente',
  Approved: 'Approuve',
  Rejected: 'Rejete',
  Reviewed: 'Examine',
  New: 'Nouveau',
  Shortlisted: 'Preselectionne',
  Active: 'Actif',
  Inactive: 'Inactif',
  Disabled: 'Desactive',
  Employer: 'Employeur',
  Provider: 'Recruteur',
  Admin: 'Administrateur',
  'Secure portal': 'Portail securise',
  'Back to Portal': 'Retour au portail',
  'Welcome Back': '',
  'Sign in to access your dashboard and continue your workflow.':
    'Connectez-vous pour acceder a votre tableau de bord et poursuivre votre travail.',
  'Username or email': "Nom d'utilisateur ou email",
  'Enter your email': 'Saisissez votre email',
  'Hide password': 'Masquer le mot de passe',
  'Show password': 'Afficher le mot de passe',
  'Remember me': 'Se souvenir de moi',
  'Forgot Password?': 'Mot de passe oublie ?',
  'Invalid email or password.': 'Email ou mot de passe invalide.',
  'Sign In': 'Se connecter',
  'Signing inâ€¦': 'Connexion en cours...',
  'Powered By': 'Propulse par',
  'Simplify your workflow with smart tools.':
    'Simplifiez votre travail avec des outils intelligents.',
  'A unified workspace built for advisors, managers and operations teams â€” designed to surface the right candidate at the right moment.':
    'Un espace de travail unifie pour les conseillers, responsables et equipes operationnelles, concu pour faire ressortir le bon candidat au bon moment.',
  '"This platform helps our team stay efficient and deliver high-quality results. The matching intelligence cut our screening time in half."':
    'La plateforme de l’ANETI est un espace digital dédié à la mise en relation entre candidats, conseillers ANETI et employeurs en Tunisie. Elle facilite la recherche d’emploi, l’accompagnement professionnel et le recrutement grâce à des outils intelligents et personnalisés.',
  'Platform User': 'Utilisateur de la plateforme',
  'MatchCore home': 'Accueil MatchCore',
  'Expand sidebar (Ctrl+B)': 'Developper la barre laterale (Ctrl+B)',
  'Collapse sidebar (Ctrl+B)': 'Reduire la barre laterale (Ctrl+B)',
  Collapse: 'Reduire',
  'Find the Right Candidates': 'Trouver les bons candidats',
  Filters: 'Filtres',
  Keyword: 'Mot-cle',
  Search: 'Rechercher',
  'Name, role, or skill...': 'Nom, role ou competence...',
  'Name, role, skillâ€¦': 'Nom, role ou competence...',
  'Min experience': 'Experience min.',
  'Minimum match': 'Matching minimum',
  'Reset filters': 'Reinitialiser les filtres',
  'Search candidates by name, skills, or experience...':
    'Rechercher des candidats par nom, competences ou experience...',
  'Grid view': 'Vue grille',
  'List view': 'Vue liste',
  'Loading indexed candidates...': 'Chargement des candidats indexes...',
  'No candidates found.': 'Aucun candidat trouve.',
  'Indexed candidate': 'Candidat indexe',
  'Location not specified': 'Localisation non specifiee',
  'Candidate profile loaded from the search index.':
    "Profil candidat charge depuis l'index de recherche.",
  'Score search': 'Score de recherche',
  'Select an employer offer': 'Selectionner une offre employeur',
  'No explicit skill requirements': 'Aucune competence requise explicite',
  'Create or load an employer offer first to scope the candidate search.':
    "Creez ou chargez d'abord une offre employeur pour cadrer la recherche de candidats.",
  'Loading employer offers...': 'Chargement des offres employeur...',
  'Searching indexed candidates...': 'Recherche des candidats indexes...',
  'No indexed results. Try syncing the search index first.':
    "Aucun resultat indexe. Essayez d'abord de synchroniser l'index de recherche.",
  'Search the real candidate index through `/search/candidates`, scoped by one of your real employer offers.':
    "Rechercher dans l'index reel des candidats via `/search/candidates`, filtre par l'une de vos offres employeur.",
  'Search candidates and rank them by their match against a selected offer.':
    "Rechercher des candidats et les classer selon leur correspondance avec l'offre selectionnee.",
  'Export shortlist': 'Exporter la preselection',
  'Offer deleted': 'Offre supprimee',
  'The offer has been removed from the provider dashboard.':
    "L'offre a ete retiree du tableau de bord recruteur.",
  'Delete failed': 'Echec de la suppression',
  'Unable to delete this offer.': 'Impossible de supprimer cette offre.',
  Delete: 'Supprimer',
  'Delete this offer?': 'Supprimer cette offre ?',
  'This will remove the offer from the provider dashboard.':
    "Cela supprimera l'offre du tableau de bord recruteur.",
  'Candidate data and match history remain stored for auditability.':
    "Les donnees candidat et l'historique de matching resteront conserves pour l'audit.",
  'Deleting...': 'Suppression en cours...',
  'Delete offer': "Supprimer l'offre",
  'Offer details': "Details de l'offre",
  'Offer ID': "ID de l'offre",
  Level: 'Niveau',
  Posted: 'Publiee',
  'No required skills found.': 'Aucune competence requise trouvee.',
  'Preferred skills': 'Competences preferees',
  'No preferred skills found.': 'Aucune competence preferee trouvee.',
  Candidates: 'Candidats',
  'For now this list is built from match results. When a real application table is added, this page can switch to true applicants.':
    "Pour l'instant, cette liste est construite a partir des resultats de matching. Lorsqu'une vraie table de candidatures sera ajoutee, cette page pourra afficher les candidats reels.",
  'Candidates linked to this offer': 'Candidats lies a cette offre',
  'Applied candidates with their score and profile preview.':
    'Candidats associes avec leur score et un apercu du profil.',
  'No candidate has been linked to this offer yet.':
    "Aucun candidat n'est encore lie a cette offre.",
  Occupation: 'Metier',
  View: 'Voir',
  'Search result:': 'Resultat de recherche :',
  Open: 'Ouvert',
  Immediate: 'Immediat',
  '1 month': '1 mois',
  '2-3 months': '2-3 mois',
  'All roles': 'Tous les roles',
  'All statuses': 'Tous les statuts',
  'All locations': 'Toutes les localisations',
  'All contracts': 'Tous les contrats',
  'All occupations': 'Tous les metiers',
  'Any score': 'Tout score',
  'Apply filters': 'Appliquer',
  'No offers found. Try adjusting your filters.':
    "Aucune offre trouvee. Essayez d'ajuster vos filtres.",
  'Search by name, skill, role...': 'Rechercher par nom, competence, role...',
  'Matched Candidates': 'Candidats correspondants',
  'Offer not specified': 'Offre non precisee',
  'Company not specified': 'Entreprise non precisee',
  'No skill labels available.': 'Aucune competence disponible.',
  'No candidates matched to provider offers for the current filters.':
    'Aucun candidat ne correspond aux offres recruteur pour les filtres actuels.',
  'View profile': 'Voir le profil',
  'Provider Registration Requests': "Demandes d'inscription recruteur",
  'Back to users': 'Retour aux utilisateurs',
  Request: 'Demande',
  Contact: 'Contact',
  Created: 'Cree le',
  'Search company, contact, email, phone or request id...':
    'Rechercher une entreprise, un contact, un email, un telephone ou un identifiant de demande...',
  'Search id, actor, trace or entity...':
    'Rechercher un identifiant, un acteur, une trace ou une entite...',
  'No audit logs match the selected filters.':
    "Aucune entree d'audit ne correspond aux filtres selectionnes.",
  'Tech Admin Diagnostics': 'Diagnostic administrateur technique',
  'Real API Gateway diagnostics, downstream service health, search sync, and an authenticated API Playground.':
    "Diagnostics reels de l'API Gateway, sante des services aval, synchronisation de la recherche et playground API authentifie.",
  'Services registered': 'Services enregistres',
  'Services up': 'Services disponibles',
  'Services degraded': 'Services degrades',
  'JWT in session': 'JWT en session',
  Yes: 'Oui',
  No: 'Non',
  'Gateway status': 'Statut de la passerelle',
  Unknown: 'Inconnu',
  'Service health': 'Sante des services',
  Service: 'Service',
  Detail: 'Detail',
  'No additional detail returned.': 'Aucun detail supplementaire retourne.',
  'Health summaries': 'Resumes de sante',
  'Parsing service': 'Service de parsing',
  'Matching service': 'Service de matching',
  'Search service': 'Service de recherche',
  'Raw diagnostics payloads': 'Charges utiles brutes de diagnostic',
  'API Playground': 'Playground API',
  'Requests are sent through the central API client, so the current JWT token is reused automatically.':
    'Les requetes sont envoyees via le client API central, le jeton JWT courant est donc reutilise automatiquement.',
  Method: 'Methode',
  Path: 'Chemin',
  'JSON body': 'Corps JSON',
  'Sending...': 'Envoi en cours...',
  'Send request': 'Envoyer la requete',
  Headers: 'En-tetes',
  Body: 'Corps',
  'No detail returned.': 'Aucun detail retourne.',
  'Loading tech-admin diagnostics...':
    'Chargement du diagnostic administrateur technique...',
  'Search sync triggered through the API Gateway.':
    "Synchronisation de la recherche declenchee via l'API Gateway.",
  'Search sync failed.': 'Echec de la synchronisation de la recherche.',
  'Registration requests': "Demandes d'inscription",
  'Add provider': 'Ajouter un recruteur',
  'Create provider account': 'Creer un compte recruteur',
  'This creates an active employer/provider account. The provider can sign in immediately with the password you set.':
    'Cela cree un compte employeur/recruteur actif. Le recruteur peut se connecter immediatement avec le mot de passe defini.',
  'Temporary password': 'Mot de passe temporaire',
  'Company name': "Nom de l'entreprise",
  'Create provider': 'Creer le recruteur',
  'Creating...': 'Creation en cours...',
  'Search id, email, role or status...':
    'Rechercher un identifiant, un email, un role ou un statut...',
  Role: 'Role',
  'Provider account created': 'Compte recruteur cree',
  'Creation failed': 'Echec de la creation',
  'Matching Configuration': 'Configuration du matching',
  'Manage criteria, models, versions, version criteria, and hard filters through the real matching-config endpoints.':
    'Gerer les criteres, modeles, versions, criteres de version et filtres stricts via les endpoints reels de matching-config.',
  Criteria: 'Criteres',
  'Data type': 'Type de donnee',
  Description: 'Description',
  'Update criterion': 'Mettre a jour le critere',
  'Create criterion': 'Creer le critere',
  Reset: 'Reinitialiser',
  Edit: 'Modifier',
  'Models & versions': 'Modeles et versions',
  Direction: 'Direction',
  'Update model': 'Mettre a jour le modele',
  'Create model': 'Creer le modele',
  'Selected model': 'Modele selectionne',
  'Select a model': 'Selectionner un modele',
  'Version number': 'Numero de version',
  'Update version': 'Mettre a jour la version',
  'Create version': 'Creer la version',
  Publish: 'Publier',
  Archive: 'Archiver',
  'Model criteria': 'Criteres du modele',
  Criterion: 'Critere',
  'Select a criterion': 'Selectionner un critere',
  Weight: 'Poids',
  'Min threshold': 'Seuil min.',
  'Logic operator': 'Operateur logique',
  'Is must': 'Obligatoire',
  'Update model criterion': 'Mettre a jour le critere du modele',
  'Add model criterion': 'Ajouter un critere au modele',
  Must: 'Obligatoire',
  Optional: 'Optionnel',
  'Hard filters': 'Filtres stricts',
  'Rule operator': 'Operateur de regle',
  'Rule value': 'Valeur de regle',
  'Rejection reason': 'Motif de rejet',
  'Update hard filter': 'Mettre a jour le filtre strict',
  'Add hard filter': 'Ajouter un filtre strict',
  'No rejection reason': 'Aucun motif de rejet',
  'Matching criterion saved.': 'Critere de matching enregistre.',
  'Matching criterion deleted.': 'Critere de matching supprime.',
  'Matching model saved.': 'Modele de matching enregistre.',
  'Matching model deleted.': 'Modele de matching supprime.',
  'Model version saved.': 'Version du modele enregistree.',
  'Version published.': 'Version publiee.',
  'Version archived.': 'Version archivee.',
  'Model criterion saved.': 'Critere du modele enregistre.',
  'Model criterion deleted.': 'Critere du modele supprime.',
  'Hard filter saved.': 'Filtre strict enregistre.',
  'Hard filter deleted.': 'Filtre strict supprime.',
  'Loading matching configuration...':
    'Chargement de la configuration du matching...',
  'Fast supervision view for taxonomy coverage, unresolved codes, and lazy node review.':
    'Vue rapide de supervision de la couverture taxonomique, des codes non resolus et de la revue des noeuds.',
  Nodes: 'Noeuds',
  Labels: 'Libelles',
  Aliases: 'Alias',
  Relations: 'Relations',
  Unresolved: 'Non resolus',
  Models: 'Modeles',
  'Node Type Distribution': 'Repartition par type de noeud',
  'Current taxonomy nodes by business domain':
    'Noeuds de taxonomie actuels par domaine metier',
  'Taxonomy / Model Distribution': 'Repartition taxonomie / modele',
  'Nodes grouped by model version': 'Noeuds groupes par version de modele',
  'Occupation Breakdown': 'Repartition des metiers',
  'Occupation nodes grouped by parent family':
    'Noeuds metier groupes par famille parente',
  'Search code, label or alias...':
    'Rechercher un code, un libelle ou un alias...',
  All: 'Tous',
  'No nodes match the current filters.':
    'Aucun noeud ne correspond aux filtres actuels.',
  'Select a node to load details.':
    'Selectionnez un noeud pour charger ses details.',
  General: 'General',
  Source: 'Source',
  'Preferred label': 'Libelle prefere',
  'French label': 'Libelle francais',
  'English label': 'Libelle anglais',
  Domain: 'Domaine',
  Model: 'Modele',
  'Model version': 'Version du modele',
  'Parent code': 'Code parent',
  Deprecated: 'Obsolete',
  Updated: 'Mis a jour',
  'No aliases returned for this node.': 'Aucun alias retourne pour ce noeud.',
  Relation: 'Relation',
  Target: 'Cible',
  'Unresolved Codes Review': 'Revue des codes non resolus',
  'Read-only queue from canonical.unresolved_code, structured for future review actions.':
    'File en lecture seule issue de canonical.unresolved_code, structuree pour de futures actions de revue.',
  'All aggregates': 'Tous les agregats',
  'Job offer': "Offre d'emploi",
  Resolved: 'Resolus',
  'All states': 'Tous les etats',
  Code: 'Code',
  Context: 'Contexte',
  Aggregate: 'Agregat',
  Suggestion: 'Suggestion',
  Note: 'Note',
  'Search-service': 'Service de recherche',
  'Find roles matched to your profile and skills.':
    'Trouver des offres correspondant a votre profil et a vos competences.',
  'Post offers and discover qualified candidates.':
    'Publier des offres et decouvrir des candidats qualifies.',
  'Govern taxonomy, monitor pipelines and audits.':
    'Gouverner la taxonomie et surveiller les pipelines et les audits.',
  'Full-time': 'Temps plein',
  'Part-time': 'Temps partiel',
  Contract: 'Contrat',
  Internship: 'Stage',
  Junior: 'Junior',
  Mid: 'Intermediaire',
  Senior: 'Senior',
  Lead: 'Lead',
  Advanced: 'Avance',
  Intermediate: 'Intermediaire',
  Draft: 'Brouillon',
  Paused: 'En pause',
  Archived: 'Archive',
  'Senior Backend Engineer': 'Ingenieur backend senior',
  'Data Engineer': 'Ingenieur data',
  'ML Engineer': 'Ingenieur ML',
  'Frontend Engineer': 'Ingenieur frontend',
  'DevOps Engineer': 'Ingenieur DevOps',
  'Solution Architect': 'Architecte solution',
  'Product Manager': 'Chef de produit',
  'Data Scientist': 'Data scientist',
  'Cloud Engineer': 'Ingenieur cloud',
  'QA Engineer': 'Ingenieur QA',
  'Engineering Manager': "Responsable d'ingenierie",
  'Software Engineer': 'Ingenieur logiciel',
  'Cloud Architect': 'Architecte cloud',
  'Advanced Kubernetes Operators': 'Operateurs Kubernetes avances',
  'PostgreSQL Performance Tuning': 'Optimisation des performances PostgreSQL',
  'Production-Grade FastAPI': 'FastAPI de niveau production',
  'Distributed Systems Patterns': 'Patterns des systemes distribues',
  Strong: 'Fort',
  Moderate: 'Modere',
  Weak: 'Faible',
  Shortlist: 'Preselectionner',
  Profile: 'Profil',
};

const frRules: Array<[RegExp, (...groups: string[]) => string]> = [
  [
    /^Search "(.+)" in (.+)$/,
    (_match, query, target) =>
      `Rechercher "${query}" dans ${translateText(target, 'fr')}`,
  ],
  [
    /^Signing in as (.+)$/,
    (_match, role) => `Connexion en tant que ${translateText(role, 'fr')}`,
  ],
  [
    /^Failed to load users: (.+)$/,
    (_match, detail) => `Impossible de charger les utilisateurs : ${detail}`,
  ],
  [
    /^Failed to load provider requests: (.+)$/,
    (_match, detail) =>
      `Impossible de charger les demandes recruteur : ${detail}`,
  ],
  [
    /^Failed to load taxonomy summary: (.+)$/,
    (_match, detail) =>
      `Impossible de charger le resume de taxonomie : ${detail}`,
  ],
  [
    /^Failed to load taxonomy nodes: (.+)$/,
    (_match, detail) =>
      `Impossible de charger les noeuds de taxonomie : ${detail}`,
  ],
  [
    /^Failed to load node detail: (.+)$/,
    (_match, detail) => `Impossible de charger le detail du noeud : ${detail}`,
  ],
  [
    /^Failed to load unresolved codes: (.+)$/,
    (_match, detail) =>
      `Impossible de charger les codes non resolus : ${detail}`,
  ],
  [
    /^Failed to load offer: (.+)$/,
    (_match, detail) => `Impossible de charger l'offre : ${detail}`,
  ],
  [
    /^Unable to load indexed candidates\.$/,
    () => 'Impossible de charger les candidats indexes.',
  ],
  [
    /^Unable to load employer offers\.$/,
    () => 'Impossible de charger les offres employeur.',
  ],
  [
    /^Unable to load service health\.$/,
    () => 'Impossible de charger la sante des services.',
  ],
  [
    /^Unable to create provider account\.$/,
    () => 'Impossible de creer le compte recruteur.',
  ],
  [
    /^Unable to save the criterion\.$/,
    () => "Impossible d'enregistrer le critere.",
  ],
  [
    /^Unable to delete the criterion\.$/,
    () => 'Impossible de supprimer le critere.',
  ],
  [/^Unable to save the model\.$/, () => "Impossible d'enregistrer le modele."],
  [
    /^Unable to delete the model\.$/,
    () => 'Impossible de supprimer le modele.',
  ],
  [
    /^Unable to save the version\.$/,
    () => "Impossible d'enregistrer la version.",
  ],
  [
    /^Unable to publish the version\.$/,
    () => 'Impossible de publier la version.',
  ],
  [
    /^Unable to archive the version\.$/,
    () => "Impossible d'archiver la version.",
  ],
  [
    /^Unable to save the model criterion\.$/,
    () => "Impossible d'enregistrer le critere du modele.",
  ],
  [
    /^Unable to delete the model criterion\.$/,
    () => 'Impossible de supprimer le critere du modele.',
  ],
  [
    /^Unable to save the hard filter\.$/,
    () => "Impossible d'enregistrer le filtre strict.",
  ],
  [
    /^Unable to delete the hard filter\.$/,
    () => 'Impossible de supprimer le filtre strict.',
  ],
  [
    /^(.+) real accounts from audit\.user_account$/,
    (_match, total) => `${total} comptes reels depuis audit.user_account`,
  ],
  [
    /^(\d+) candidates matched to your offers$/,
    (_match, total) => `${total} candidats correspondent a vos offres`,
  ],
  [
    /^(\d+) canonical match results? stored for your candidate profile$/,
    (_match, total) =>
      `${total} resultats de matching enregistres pour votre profil candidat`,
  ],
  [
    /^(\d+) of (\d+) nodes in current query$/,
    (_match, shown, total) =>
      `${shown} sur ${total} noeuds dans la requete courante`,
  ],
  [/^Candidate (.+)$/, (_match, id) => `Candidat ${id}`],
  [
    /^Page (\d+) \/ (\d+)$/,
    (_match, current, total) => `Page ${current} / ${total}`,
  ],
  [/^(\d+)d ago$/, (_match, days) => `il y a ${days} j`],
  [/^Posted (\d+)d ago$/, (_match, days) => `Publiee il y a ${days} j`],
  [/^(\d+)y exp$/, (_match, years) => `${years} ans d'exp.`],
  [/^(\d+)% or more$/, (_match, score) => `${score}% ou plus`],
  [/^(\d+) candidates$/, (_match, count) => `${count} candidats`],
  [/^(.+) candidate$/, (_match, value) => `${value} candidat`],
  [/^(.+) candidates$/, (_match, value) => `${value} candidats`],
  [
    /^No users match the selected filters\.$/,
    () => 'Aucun utilisateur ne correspond aux filtres selectionnes.',
  ],
  [
    /^No provider registration requests match the selected filters\.$/,
    () => 'Aucune demande recruteur ne correspond aux filtres selectionnes.',
  ],
  [
    /^(.+) can now sign in as a provider\.$/,
    (_match, email) =>
      `${email} peut maintenant se connecter en tant que recruteur.`,
  ],
  [/^(\d+)h ago$/, (_match, hours) => `il y a ${hours} h`],
  [/^Yesterday$/, () => 'Hier'],
  [/^(\d+) days ago$/, (_match, days) => `il y a ${days} j`],
  [/^(\d+) week ago$/, (_match, weeks) => `il y a ${weeks} semaine`],
  [
    /^New match: (.+) at (.+) \((\d+)% score\)$/,
    (_match, title, company, score) =>
      `Nouveau matching : ${translateText(title, 'fr')} chez ${company} (${score}% de score)`,
  ],
  [
    /^CV parsing complete .+ (\d+) skills extracted$/,
    (_match, count) =>
      `Analyse du CV terminee - ${count} competences extraites`,
  ],
  [
    /^Profile updated: added (\d+) certifications$/,
    (_match, count) => `Profil mis a jour : ${count} certifications ajoutees`,
  ],
  [
    /^Application sent to (.+) .+ (.+)$/,
    (_match, company, title) =>
      `Candidature envoyee a ${company} - ${translateText(title, 'fr')}`,
  ],
  [
    /^Recommendation: complete '(.+)' training$/,
    (_match, training) =>
      `Recommandation : suivre la formation '${translateText(training, 'fr')}'`,
  ],
  [
    /^(\d+) live session offers$/,
    (_match, count) => `${count} offres de session actives`,
  ],
  [
    /^(\d+) live session offer$/,
    (_match, count) => `${count} offre de session active`,
  ],
  [/^(\d+) scored$/, (_match, count) => `${count} scores calcules`],
  [
    /^Scoring in progress - (\d+) offers being computed\. This page refreshes automatically\.$/,
    (_match, count) =>
      `Calcul en cours - ${count} offres sont en cours de calcul. Cette page s'actualise automatiquement.`,
  ],
  [
    /^Scoring in progress - (\d+) offer being computed\. This page refreshes automatically\.$/,
    (_match, count) =>
      `Calcul en cours - ${count} offre est en cours de calcul. Cette page s'actualise automatiquement.`,
  ],
  [
    /^Failed to load offers: (.+)$/,
    (_match, detail) => `Impossible de charger les offres : ${detail}`,
  ],
  [
    /^Failed to load candidate profile: (.+)$/,
    (_match, detail) => `Impossible de charger le profil candidat : ${detail}`,
  ],
  [
    /^CV uploaded\. Extraction has started\.$/,
    () => "CV importe. L'extraction a commence.",
  ],
  [
    /^CV processing failed\. Check pipeline monitoring for details\.$/,
    () =>
      'Le traitement du CV a echoue. Consultez le suivi du pipeline pour plus de details.',
  ],
  [
    /^CV processing finished and your candidate profile was refreshed\.$/,
    () =>
      'Le traitement du CV est termine et votre profil candidat a ete actualise.',
  ],
  [
    /^Your CV is still extracting\. Please keep this page open; the profile will refresh automatically when it finishes\.$/,
    () =>
      "Votre CV est toujours en cours d'extraction. Laissez cette page ouverte ; le profil sera actualise automatiquement a la fin.",
  ],
  [
    /^No uploaded CV session is available yet\. Upload your CV first\.$/,
    () =>
      "Aucune session CV n'est encore disponible. Importez d'abord votre CV.",
  ],
  [
    /^Upload your CV from the profile page to open a temporary smart-matching session and score the current offer catalog automatically\.$/,
    () =>
      "Importez votre CV depuis la page profil pour ouvrir une session temporaire de matching intelligent et scorer automatiquement le catalogue actuel d'offres.",
  ],
  [
    /^Smart Offers uses your current uploaded CV session token\. Scores are computed live by the matching service and may refresh automatically while calculations finish\.$/,
    () =>
      "Les offres intelligentes utilisent le jeton de session de votre CV importe. Les scores sont calcules en direct par le service de matching et peuvent s'actualiser automatiquement pendant le calcul.",
  ],
  [
    /^It looks like you're new here\. Start by uploading your CV and MatchCore will create your candidate profile, extract your skills, and prepare personalized job matches\.$/,
    () =>
      'Il semble que vous soyez nouveau ici. Commencez par importer votre CV et MatchCore creera votre profil candidat, extraira vos competences et preparera des correspondances personnalisees.',
  ],
  [
    /^Thank you for your patience\. MatchCore is extracting your CV, creating your candidate profile, and preparing your first job matches\. This page will refresh automatically when the extraction is complete\.$/,
    () =>
      "Merci pour votre patience. MatchCore extrait votre CV, cree votre profil candidat et prepare vos premieres correspondances. Cette page s'actualisera automatiquement lorsque l'extraction sera terminee.",
  ],
  [
    /^Your detected occupation, extracted skills and parsed work history\.$/,
    () =>
      'Votre metier detecte, vos competences extraites et votre parcours professionnel analyse.',
  ],
  [/^(\d+) yr min$/, (_match, years) => `${years} an min`],
  [/^(\d+) yrs? min$/, (_match, years) => `${years} ans min`],
  [
    /^(.*) - (\d+)% confidence$/,
    (_match, label, confidence) => `${label} - ${confidence}% de confiance`,
  ],
  [/^Languages: (.+)$/, (_match, languages) => `Langues : ${languages}`],
  [
    /^(.+) requests from audit\.provider_registration_request$/,
    (_match, total) =>
      `${total} demandes depuis audit.provider_registration_request`,
  ],
];

export function translateText(text: string, locale: Locale): string {
  if (locale === 'en') {
    return text;
  }

  if (frExact[text]) {
    return frExact[text];
  }

  for (const [pattern, replacer] of frRules) {
    const match = text.match(pattern);
    if (match) {
      return replacer(...match);
    }
  }

  return text;
}
