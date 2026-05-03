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
