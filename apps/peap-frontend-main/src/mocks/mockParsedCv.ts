import { Candidate } from '@/models';

export interface MockParsedCvPersonInfo {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

export interface MockParsedCvEducationItem {
  degree: string;
  institution: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface MockParsedCvExperienceItem {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface MockParsedCvCertificationItem {
  name: string;
  issuer: string;
  year: string;
}

export interface MockParsedCv {
  personal_info: MockParsedCvPersonInfo;
  summary: string;
  education: MockParsedCvEducationItem[];
  job_experiences: MockParsedCvExperienceItem[];
  internship_experiences: MockParsedCvExperienceItem[];
  skills: string[];
  coding_skills: string[];
  languages: string[];
  certifications: MockParsedCvCertificationItem[];
}

export const mockParsedCv: MockParsedCv = {
  personal_info: {
    full_name: 'Islem Ouardani',
    email: 'islem.ouardani@email.com',
    phone: '+216 XX XXX XXX',
    location: 'Tunis, Tunisie',
    linkedin: 'linkedin.com/in/islem-ouardani',
  },
  summary:
    'Etudiante en derniere annee de genie logiciel, passionnee par la data, l IA et le developpement full stack. Experience dans la creation de plateformes pilotees par les donnees, d API, de tableaux de bord et de systemes de matching intelligents.',
  education: [
    {
      degree: 'Diplome en genie logiciel',
      institution: 'ISSAT Sousse',
      start_date: '2021',
      end_date: '2026',
      description:
        'Specialisation en genie logiciel, systemes de donnees et applications intelligentes.',
    },
  ],
  job_experiences: [
    {
      title: 'Developpeuse logiciel',
      company: 'Freelance / Projets academiques',
      start_date: '2024',
      end_date: '2025',
      description:
        'Developpement d applications web, d API backend, de modeles de donnees et d interfaces frontend pour plusieurs projets academiques et professionnels.',
    },
  ],
  internship_experiences: [
    {
      title: 'Stagiaire Data & IA',
      company: 'Deloitte Tunisie',
      start_date: '2026-02',
      end_date: 'Aujourd hui',
      description:
        'Participation a une plateforme de matching CV/offres avec pipelines de donnees, integration du parsing, modelisation canonique et preparation du matching explicable.',
    },
  ],
  skills: [
    'Ingenierie des donnees',
    'Developpement backend',
    'Developpement frontend',
    'Integration d API',
    'Modelisation de donnees',
    'ETL',
    'UI/UX',
  ],
  coding_skills: [
    'Python',
    'TypeScript',
    'JavaScript',
    'SQL',
    'FastAPI',
    'React',
    'Next.js',
    'PostgreSQL',
  ],
  languages: ['Arabe', 'Francais', 'Anglais'],
  certifications: [
    {
      name: 'Fondamentaux de l ingenierie des donnees',
      issuer: 'Coursera',
      year: '2025',
    },
    {
      name: 'Parcours developpeur React',
      issuer: 'Meta',
      year: '2024',
    },
  ],
};

export const mockDataChart = [
  { offerId: 'AA-JOB-0001', matches: 78, applications: 45 },
  { offerId: 'AA-JOB-0002', matches: 52, applications: 30 },
  { offerId: 'AA-JOB-0003', matches: 91, applications: 67 },
  { offerId: 'AA-JOB-0004', matches: 10, applications: 30 },
];

export const mockCandidates: Candidate[] = [
  {
    id: 'cand-001',
    name: 'Ahmed Ben Salah',
    initials: 'ABS',
    occupation: 'Developpeur frontend',
    location: 'Tunis, Tunisie',
    experienceYears: 3,
    score: 90,
    topSkills: ['React', 'TypeScript', 'Tailwind'],
    missing: ['Next.js', 'Testing'],
    summary: 'Developpeur frontend concevant des applications web modernes.',
    status: 'Shortlisted',
    email: 'ahmed.bensalah@email.com',
    phone: '+21620000001',
    offerId: 'offer-001',
    offerTitle: 'Ingenieur frontend',
    company: 'TechCorp',
    rank: 2,
    codingSkills: ['JavaScript', 'TypeScript'],

    experiences: [
      {
        company: 'Webify',
        role: 'Developpeur frontend',
        years: '2022 - Aujourd hui',
        description: 'Creation de composants UI evolutifs avec React.',
      },
    ],

    internshipExperiences: [
      {
        company: 'Startup Hub',
        role: 'Stagiaire frontend',
        years: '2021',
        description:
          'Travail sur des pages de presentation et des corrections UI.',
      },
    ],

    education: [
      {
        school: 'INSAT',
        degree: 'Diplome d ingenierie en informatique',
        years: '2018 - 2022',
      },
    ],

    languages: [
      { label: 'Arabe', level: 'Langue maternelle' },
      { label: 'Francais', level: 'Professionnel' },
      { label: 'Anglais', level: 'Intermediaire' },
    ],

    documents: [
      {
        id: 'doc-001',
        docType: 'CV',
        filename: 'ahmed_cv.pdf',
        mimeType: 'application/pdf',
        uploadedAt: '2026-05-01',
      },
    ],
  },

  {
    id: 'cand-002',
    name: 'Sonia Trabelsi',
    initials: 'ST',
    occupation: 'Developpeur backend',
    location: 'Sfax, Tunisie',
    experienceYears: 5,
    score: 91,
    topSkills: ['Node.js', 'Express', 'MongoDB'],
    missing: ['Docker'],
    summary: 'Ingenieure backend specialisee dans les API et la performance.',
    status: 'Reviewed',
    email: 'sonia@email.com',
    offerTitle: 'Ingenieur backend',
    company: 'DataSoft',
    rank: 1,

    jobExperiences: [
      {
        company: 'DataSoft',
        role: 'Ingenieur backend',
        years: '2021 - Aujourd hui',
        description: 'Conception d API REST et de microservices.',
      },
      {
        company: 'DevSolutions',
        role: 'Developpeur backend junior',
        years: '2019 - 2021',
        description: 'Travail sur des services Node.js.',
      },
    ],

    education: [
      {
        school: 'ENIS',
        degree: 'Genie logiciel',
        years: '2016 - 2019',
      },
    ],

    languages: [
      { label: 'Arabe', level: 'Langue maternelle' },
      { label: 'Anglais', level: 'Avance' },
    ],
  },

  {
    id: 'cand-003',
    name: 'Youssef Khlifi',
    initials: 'YK',
    occupation: 'Developpeur full stack',
    location: 'Sousse, Tunisie',
    experienceYears: 4,
    score: 76,
    topSkills: ['React', 'Node.js', 'PostgreSQL'],
    missing: ['AWS'],
    summary: 'Developpeur full stack avec une forte orientation backend.',
    status: 'New',

    codingSkills: ['JavaScript', 'SQL'],

    offers: [
      {
        id: 'offer-001',
        title: 'Ingenieur full stack',
        company: 'InnovateX',
        score: 76,
        rank: 4,
      },
    ],
  },

  {
    id: 'cand-004',
    name: 'Mouna Gharbi',
    initials: 'MG',
    occupation: 'UI/UX Designer',
    location: 'Tunis, Tunisie',
    experienceYears: 2,
    score: 68,
    topSkills: ['Figma', 'Recherche utilisateur'],
    missing: ['Bases du frontend'],
    summary: 'Designer UX centree sur l utilisabilite et la recherche.',
    status: 'Rejected',

    education: [
      {
        school: 'ISAMM',
        degree: 'Design multimedia',
        years: '2019 - 2022',
      },
    ],
  },
  {
    id: 'cand-005',
    name: 'Karim Jebali',
    initials: 'KJ',
    occupation: 'Developpeur frontend',
    location: 'Nabeul, Tunisie',
    experienceYears: 2,
    score: 72,
    topSkills: ['Vue.js', 'JavaScript', 'CSS'],
    missing: ['TypeScript', 'Testing'],
    summary: 'Developpeur frontend specialise dans les interfaces dynamiques.',
    status: 'Reviewed',
    email: 'karim.jebali@email.com',
    phone: '+21620000005',
    offerId: 'offer-002',
    offerTitle: 'Developpeur frontend',
    company: 'WebAgency',
    rank: 3,
    codingSkills: ['JavaScript'],

    experiences: [
      {
        company: 'WebAgency',
        role: 'Developpeur frontend',
        years: '2023 - Aujourd hui',
        description: 'Developpement d interfaces avec Vue.js.',
      },
    ],

    education: [
      {
        school: 'ISET Nabeul',
        degree: 'Licence en informatique',
        years: '2020 - 2023',
      },
    ],

    languages: [
      { label: 'Arabe', level: 'Langue maternelle' },
      { label: 'Francais', level: 'Intermediaire' },
    ],
  },
  {
    id: 'cand-006',
    name: 'Amira Ben Amor',
    initials: 'ABA',
    occupation: 'Data Analyst',
    location: 'Tunis, Tunisie',
    experienceYears: 4,
    score: 88,
    topSkills: ['Python', 'Pandas', 'SQL'],
    missing: ['Machine Learning'],
    summary:
      'Analyste de donnees specialisee dans la visualisation et l interpretation.',
    status: 'Shortlisted',
    email: 'amira@email.com',
    offerId: 'offer-003',
    offerTitle: 'Data Analyst',
    company: 'InsightCorp',
    rank: 1,

    jobExperiences: [
      {
        company: 'InsightCorp',
        role: 'Data Analyst',
        years: '2022 - Aujourd hui',
        description: 'Analyse de donnees et creation de dashboards.',
      },
    ],

    education: [
      {
        school: 'IHEC',
        degree: 'Master en Data Science',
        years: '2019 - 2021',
      },
    ],

    languages: [
      { label: 'Anglais', level: 'Avance' },
      { label: 'Francais', level: 'Professionnel' },
    ],
  },
  {
    id: 'cand-007',
    name: 'Hatem Zouari',
    initials: 'HZ',
    occupation: 'DevOps Engineer',
    location: 'Sousse, Tunisie',
    experienceYears: 6,
    score: 93,
    topSkills: ['Docker', 'Kubernetes', 'CI/CD'],
    missing: ['Terraform'],
    summary: 'Ingenieur DevOps specialise dans l automatisation et le cloud.',
    status: 'Shortlisted',
    email: 'hatem@email.com',
    offerTitle: 'DevOps Engineer',
    company: 'Cloudify',
    rank: 1,

    jobExperiences: [
      {
        company: 'Cloudify',
        role: 'DevOps Engineer',
        years: '2020 - Aujourd hui',
        description: 'Mise en place de pipelines CI/CD.',
      },
    ],

    codingSkills: ['Bash', 'Python'],
  },
  {
    id: 'cand-008',
    name: 'Salma Chaari',
    initials: 'SC',
    occupation: 'Developpeur mobile',
    location: 'Monastir, Tunisie',
    experienceYears: 3,
    score: 81,
    topSkills: ['Flutter', 'Dart'],
    missing: ['iOS natif'],
    summary: 'Developpeuse mobile cree des applications multiplateformes.',
    status: 'Reviewed',
    email: 'salma@email.com',
    offerId: 'offer-004',
    offerTitle: 'Developpeur mobile',
    company: 'AppFactory',
    rank: 2,

    experiences: [
      {
        company: 'AppFactory',
        role: 'Developpeur Flutter',
        years: '2022 - Aujourd hui',
        description: 'Developpement d applications mobiles cross-platform.',
      },
    ],
  },
  {
    id: 'cand-009',
    name: 'Omar Feki',
    initials: 'OF',
    occupation: 'QA Engineer',
    location: 'Tunis, Tunisie',
    experienceYears: 5,
    score: 79,
    topSkills: ['Selenium', 'Cypress'],
    missing: ['Performance testing'],
    summary: 'Ingenieur QA specialise dans les tests automatises.',
    status: 'New',
    email: 'omar@email.com',
    offerTitle: 'QA Engineer',
    company: 'QualitySoft',
    rank: 3,

    jobExperiences: [
      {
        company: 'QualitySoft',
        role: 'QA Engineer',
        years: '2021 - Aujourd hui',
        description: 'Automatisation des tests fonctionnels.',
      },
    ],
  },
  {
    id: 'cand-010',
    name: 'Rania Kallel',
    initials: 'RK',
    occupation: 'Product Manager',
    location: 'Tunis, Tunisie',
    experienceYears: 7,
    score: 85,
    topSkills: ['Agile', 'Scrum', 'Roadmapping'],
    missing: ['Technical background'],
    summary: 'Product manager experimentee dans les produits digitaux.',
    status: 'Reviewed',
    email: 'rania@email.com',
    offerTitle: 'Product Manager',
    company: 'TechVision',
    rank: 2,

    jobExperiences: [
      {
        company: 'TechVision',
        role: 'Product Manager',
        years: '2019 - Aujourd hui',
        description: 'Gestion du cycle de vie produit.',
      },
    ],
  },
];
