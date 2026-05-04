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
    location: 'Tunis, Tunisia',
    linkedin: 'linkedin.com/in/islem-ouardani',
  },
  summary:
    'Final-year software engineering student passionate about Data, AI, and full-stack development. Experienced in building data-driven platforms, APIs, dashboards, and intelligent matching systems.',
  education: [
    {
      degree: 'Software Engineering Degree',
      institution: 'ISSAT Sousse',
      start_date: '2021',
      end_date: '2026',
      description:
        'Specialization in software engineering, data systems, and intelligent applications.',
    },
  ],
  job_experiences: [
    {
      title: 'Software Developer',
      company: 'Freelance / Academic Projects',
      start_date: '2024',
      end_date: '2025',
      description:
        'Developed web applications, backend APIs, database models, and frontend interfaces for several academic and professional projects.',
    },
  ],
  internship_experiences: [
    {
      title: 'Data & AI Intern',
      company: 'Deloitte Tunisia',
      start_date: '2026-02',
      end_date: 'Present',
      description:
        'Worked on a CV/job offer matching platform involving data pipelines, parsing integration, canonical data modeling, and explainable matching preparation.',
    },
  ],
  skills: [
    'Data Engineering',
    'Backend Development',
    'Frontend Development',
    'API Integration',
    'Database Modeling',
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
  languages: ['Arabic', 'French', 'English'],
  certifications: [
    {
      name: 'Data Engineering Foundations',
      issuer: 'Coursera',
      year: '2025',
    },
    {
      name: 'React Developer Path',
      issuer: 'Meta',
      year: '2024',
    },
  ],
};

export const mockDataChart = [
  { offerId: 'OFF-001', matches: 78, applications: 45 },
  { offerId: 'OFF-002', matches: 52, applications: 30 },
  { offerId: 'OFF-003', matches: 91, applications: 67 },
  { offerId: 'OFF-004', matches: 34, applications: 12 },
  { offerId: 'OFF-005', matches: 66, applications: 40 },
  { offerId: 'OFF-006', matches: 85, applications: 73 },
  { offerId: 'OFF-007', matches: 49, applications: 25 },
  { offerId: 'OFF-008', matches: 72, applications: 58 },
];

export const mockCandidates: Candidate[] = [
  {
    id: 'cand-001',
    name: 'Ahmed Ben Salah',
    initials: 'ABS',
    occupation: 'Frontend Developer',
    location: 'Tunis, Tunisia',
    experienceYears: 3,
    score: null,
    topSkills: ['React', 'TypeScript', 'Tailwind'],
    missing: ['Next.js', 'Testing'],
    summary: 'Frontend developer building modern SPAs.',
    status: 'Shortlisted',
    email: 'ahmed.bensalah@email.com',
    phone: '+21620000001',
    offerId: 'offer-001',
    offerTitle: 'Frontend Engineer',
    company: 'TechCorp',
    rank: 2,
    codingSkills: ['JavaScript', 'TypeScript'],

    experiences: [
      {
        company: 'Webify',
        role: 'Frontend Developer',
        years: '2022 - Present',
        description: 'Built scalable UI components with React.',
      },
    ],

    internshipExperiences: [
      {
        company: 'Startup Hub',
        role: 'Frontend Intern',
        years: '2021',
        description: 'Worked on landing pages and UI fixes.',
      },
    ],

    education: [
      {
        school: 'INSAT',
        degree: 'Engineering in Computer Science',
        years: '2018 - 2022',
      },
    ],

    languages: [
      { label: 'Arabic', level: 'Native' },
      { label: 'French', level: 'Professional' },
      { label: 'English', level: 'Intermediate' },
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
    occupation: 'Backend Developer',
    location: 'Sfax, Tunisia',
    experienceYears: 5,
    score: 91,
    topSkills: ['Node.js', 'Express', 'MongoDB'],
    missing: ['Docker'],
    summary: 'Backend engineer specialized in APIs and performance.',
    status: 'Reviewed',
    email: 'sonia@email.com',
    offerTitle: 'Backend Engineer',
    company: 'DataSoft',
    rank: 1,

    jobExperiences: [
      {
        company: 'DataSoft',
        role: 'Backend Engineer',
        years: '2021 - Present',
        description: 'Designed REST APIs and microservices.',
      },
      {
        company: 'DevSolutions',
        role: 'Junior Backend Dev',
        years: '2019 - 2021',
        description: 'Worked on Node.js services.',
      },
    ],

    education: [
      {
        school: 'ENIS',
        degree: 'Software Engineering',
        years: '2016 - 2019',
      },
    ],

    languages: [
      { label: 'Arabic', level: 'Native' },
      { label: 'English', level: 'Advanced' },
    ],
  },

  {
    id: 'cand-003',
    name: 'Youssef Khlifi',
    initials: 'YK',
    occupation: 'Full Stack Developer',
    location: 'Sousse, Tunisia',
    experienceYears: 4,
    score: 76,
    topSkills: ['React', 'Node.js', 'PostgreSQL'],
    missing: ['AWS'],
    summary: 'Full stack developer with strong backend focus.',
    status: 'New',

    codingSkills: ['JavaScript', 'SQL'],

    offers: [
      {
        id: 'offer-001',
        title: 'Full Stack Engineer',
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
    location: 'Tunis, Tunisia',
    experienceYears: 2,
    score: 68,
    topSkills: ['Figma', 'User Research'],
    missing: ['Frontend Basics'],
    summary: 'UX designer focused on usability and research.',
    status: 'Rejected',

    education: [
      {
        school: 'ISAMM',
        degree: 'Multimedia Design',
        years: '2019 - 2022',
      },
    ],
  },
];
