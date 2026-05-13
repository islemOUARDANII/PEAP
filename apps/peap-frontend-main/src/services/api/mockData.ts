import type { AuditLog, Candidate, Job, PlatformUser, Role, RoleOption, TaxonomyNode, TaxonomyType, Training } from "@/models";

// Mock data shared across the API adapter. Components consume it only through service methods.

export const roles: RoleOption[] = [
  { id: "candidate", label: "Candidate", description: "Find roles matched to your profile and skills." },
  { id: "provider", label: "Job Provider", description: "Post offers and discover qualified candidates." },
  { id: "advisor", label: "Advisor / Backoffice", description: "Govern taxonomy, monitor pipelines and audits." },
];

export const skills = [
  "Python", "TypeScript", "React", "Node.js", "PostgreSQL", "Kubernetes",
  "Docker", "AWS", "GCP", "Machine Learning", "NLP", "Data Engineering",
  "ETL", "Airflow", "dbt", "Snowflake", "FastAPI", "GraphQL", "REST APIs",
  "CI/CD", "Terraform", "Linux", "Agile", "Scrum",
];

export const occupations = [
  "Senior Backend Engineer", "Data Engineer", "ML Engineer", "Frontend Engineer",
  "DevOps Engineer", "Solution Architect", "Product Manager", "Data Scientist",
  "Cloud Engineer", "QA Engineer", "SRE", "Engineering Manager",
];

export const companies = [
  "Northbridge Labs", "Helios Systems", "Atlas Analytics", "Vertex Cloud",
  "Meridian Health", "Quanta Robotics", "Orbit Logistics", "Solstice Bank",
  "Aurelia Insurance", "Pivot Energy",
];

export const locations = [
  "Paris, FR", "Lyon, FR", "Berlin, DE", "Amsterdam, NL", "Madrid, ES",
  "Lisbon, PT", "London, UK", "Remote (EU)",
];

export const contractTypes = ["Full-time", "Contract", "Part-time", "Internship"];
export const experienceLevels = ["Junior", "Mid", "Senior", "Lead"];

const pick = <T,>(arr: T[], n: number): T[] => {
  const a = [...arr].sort(() => 0.5 - Math.random());
  return a.slice(0, n);
};

export const jobs: Job[] = Array.from({ length: 24 }).map((_, i) => {
  const required = pick(skills, 5);
  const matchedSkills = required.slice(0, 3 + (i % 3));
  return {
    id: `JOB-${(2400 + i).toString()}`,
    title: occupations[i % occupations.length],
    company: companies[i % companies.length],
    location: locations[i % locations.length],
    contract: contractTypes[i % contractTypes.length],
    level: experienceLevels[i % experienceLevels.length],
    postedDays: (i * 3) % 30,
    applicants: 12 + ((i * 7) % 80),
    matched: 4 + ((i * 5) % 28),
    status: (["Active", "Active", "Active", "Draft", "Paused", "Archived"] as const)[i % 6],
    required,
    preferred: pick(skills, 3),
    score: 62 + ((i * 11) % 36),
    matchedSkills,
    missingSkills: pick(skills.filter((s) => !matchedSkills.includes(s)), 2),
  };
});

const firstNames = ["Amélie", "Lucas", "Noor", "Mateo", "Ines", "Hugo", "Sofia", "Karim", "Liu", "Elena", "Jonas", "Yara"];
const lastNames = ["Laurent", "Fischer", "García", "Da Silva", "Rossi", "Janssen", "Novak", "Andersson", "Nakamura", "Bauer", "Moretti", "Weber"];

export const candidates: Candidate[] = Array.from({ length: 28 }).map((_, i) => {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const top = pick(skills, 4);
  return {
    id: `CAN-${(10250 + i).toString()}`,
    name: `${fn} ${ln}`,
    initials: `${fn[0]}${ln[0]}`,
    occupation: occupations[i % occupations.length],
    location: locations[i % locations.length],
    experienceYears: 2 + (i % 12),
    score: 58 + ((i * 13) % 40),
    topSkills: top,
    missing: pick(skills.filter((s) => !top.includes(s)), 2),
    summary: `${2 + (i % 12)} years of experience in ${occupations[i % occupations.length].toLowerCase()} with strong background in distributed systems and team leadership.`,
    status: (["New", "Reviewed", "Shortlisted", "Reviewed", "New"] as const)[i % 5],
  };
});

export const matchingActivity = Array.from({ length: 14 }).map((_, i) => ({
  day: `D-${13 - i}`,
  matches: 30 + Math.round(Math.sin(i / 2) * 15) + (i * 4),
  applications: 18 + Math.round(Math.cos(i / 3) * 10) + (i * 3),
}));

export const scoreDistribution = [
  { bucket: "0–40", count: 18 },
  { bucket: "40–60", count: 56 },
  { bucket: "60–75", count: 142 },
  { bucket: "75–90", count: 98 },
  { bucket: "90+", count: 34 },
];

export const taxonomyDistribution = [
  { name: "Skill", value: 4820 },
  { name: "Occupation", value: 1240 },
  { name: "Technology", value: 980 },
  { name: "Tool", value: 612 },
  { name: "Knowledge", value: 540 },
  { name: "Ability", value: 318 },
];

export const pipelineStatuses = [
  { name: "Ingested", value: 1284 },
  { name: "Parsed", value: 1248 },
  { name: "Enriched", value: 1192 },
  { name: "Indexed", value: 1156 },
  { name: "Failed", value: 28 },
];

const taxonomyLabels: Record<TaxonomyType, string[]> = {
  Occupation: ["Software Engineer", "Data Engineer", "ML Engineer", "DevOps Engineer", "Cloud Architect", "Product Manager"],
  Skill: ["Distributed Systems", "Statistical Modeling", "Code Review", "System Design", "Data Modeling", "Stakeholder Communication"],
  Technology: ["Kubernetes", "PostgreSQL", "Apache Kafka", "TensorFlow", "React", "Snowflake"],
  Tool: ["Git", "Jira", "Datadog", "Grafana", "Figma", "VS Code"],
  Knowledge: ["GDPR Compliance", "Linear Algebra", "Microservices", "Agile Methodology", "Information Security", "REST Principles"],
  Ability: ["Critical Thinking", "Team Leadership", "Active Listening", "Problem Solving", "Adaptability", "Negotiation"],
  "Work Activity": ["Designing Systems", "Reviewing Code", "Mentoring Engineers", "Running Standups", "Estimating Effort", "Investigating Incidents"],
  Task: ["Write API endpoint", "Deploy service", "Tune SQL query", "Resolve incident", "Onboard new hire", "Run retro"],
};

export const taxonomyNodes: TaxonomyNode[] = (Object.keys(taxonomyLabels) as TaxonomyType[]).flatMap((type) =>
  taxonomyLabels[type].map((label, i) => ({
    id: `${type.slice(0, 3).toUpperCase()}-${1000 + i}`,
    code: `${type.slice(0, 3).toUpperCase()}-${1000 + i}`,
    label,
    type,
    aliases: pick(["alt-name", "synonym", "abbrev", "fr/" + label.split(" ")[0].toLowerCase()], 2 + (i % 2)),
    source: (["ESCO", "O*NET", "Internal"] as const)[i % 3],
    related: pick([...skills, ...occupations], 4),
    description: `${label} is a ${type.toLowerCase()} entity referenced across job offers and candidate profiles.`,
    updated: `2025-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i * 3) % 27) + 1).padStart(2, "0")}`,
  }))
);

const actions = ["taxonomy.update", "match.compute", "cv.parse", "user.login", "offer.publish", "pipeline.run", "user.role.change"];
const actors = ["system@matcher", "alice.martin@advisor", "p.bouchard@provider", "scheduler", "admin"];

export const auditLogs: AuditLog[] = Array.from({ length: 32 }).map((_, i) => ({
  id: `LOG-${(98230 + i).toString()}`,
  actorUserId: `USR-${7400 + (i % 10)}`,
  actorEmail: actors[i % actors.length],
  trace: `tr_${Math.random().toString(36).slice(2, 14)}`,
  traceId: `tr_${Math.random().toString(36).slice(2, 14)}`,
  timestamp: `2025-04-${String(((i % 23) + 1)).padStart(2, "0")} ${String((i * 3) % 24).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
  occurredAt: `2025-04-${String(((i % 23) + 1)).padStart(2, "0")} ${String((i * 3) % 24).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
  actor: actors[i % actors.length],
  action: actions[i % actions.length],
  entity: ["TaxonomyNode", "Match", "Candidate", "Offer", "User", "Pipeline"][i % 6],
  entityType: ["TaxonomyNode", "Match", "Candidate", "Offer", "User", "Pipeline"][i % 6],
  entityId: `ENT-${10000 + i * 7}`,
  resultCode: [200, 200, 200, 302, 200, 500][i % 6],
  status: (["success", "success", "success", "warning", "success", "error"] as const)[i % 6],
  payload: {
    duration_ms: 30 + ((i * 17) % 800),
    affected_records: 1 + (i % 12),
    source_ip: `10.0.${i % 255}.${(i * 3) % 255}`,
    request: {
      method: ["GET", "POST", "PATCH", "DELETE"][i % 4],
      path: `/api/v1/${["taxonomy", "matches", "candidates", "offers"][i % 4]}/${i}`,
    },
  },
}));

// Users
export const users: PlatformUser[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `USR-${(7400 + i).toString()}`,
  name: `${firstNames[i % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`,
  email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[(i * 5) % lastNames.length].toLowerCase().replace(/[^a-z]/g, "")}@matchcore.io`,
  role: (["Candidate", "Provider", "Advisor", "Candidate", "Provider"] as const)[i % 5],
  account: (["SSO", "Email", "SSO", "API", "Email"] as const)[i % 5],
  status: (["Active", "Active", "Pending", "Active", "Suspended"] as const)[i % 5],
  created: `2024-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i * 2) % 27) + 1).padStart(2, "0")}`,
  createdAt: `2024-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i * 2) % 27) + 1).padStart(2, "0")}`,
}));

// Recommended trainings
export const trainings: Training[] = [
  { id: "T1", title: "Advanced Kubernetes Operators", provider: "CloudNative Academy", duration: "24h", level: "Advanced", relevance: 92 },
  { id: "T2", title: "PostgreSQL Performance Tuning", provider: "DBLearn", duration: "12h", level: "Intermediate", relevance: 87 },
  { id: "T3", title: "Production-Grade FastAPI", provider: "PySchool", duration: "8h", level: "Intermediate", relevance: 81 },
  { id: "T4", title: "Distributed Systems Patterns", provider: "ArchClass", duration: "32h", level: "Advanced", relevance: 78 },
];

export const activityTimeline = [
  { id: 1, time: "2h ago", text: "New match: Senior Backend Engineer at Northbridge Labs (92% score)" },
  { id: 2, time: "Yesterday", text: "CV parsing complete — 18 skills extracted" },
  { id: 3, time: "2 days ago", text: "Profile updated: added 2 certifications" },
  { id: 4, time: "5 days ago", text: "Application sent to Helios Systems — Data Engineer" },
  { id: 5, time: "1 week ago", text: "Recommendation: complete 'Advanced Kubernetes Operators' training" },
];
