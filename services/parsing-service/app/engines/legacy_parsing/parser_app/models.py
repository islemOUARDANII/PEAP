from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple

from pydantic import BaseModel, Field, field_validator, model_validator


# =========================
# OpenCV structures
# =========================

@dataclass
class ProgressBar:
    x: int
    y: int
    width: int
    height: int
    fill_percent: float
    level: str
    level_score: int
    color: str
    shape_type: str = "bar"


@dataclass
class CVStructure:
    layout: str = "single_column"
    has_dark_sidebar: bool = False
    progress_bars: List[ProgressBar] = field(default_factory=list)
    sections: List[Dict] = field(default_factory=list)
    detected_software_icons: List[Dict] = field(default_factory=list)
    image_width: int = 0
    image_height: int = 0
    dark_bg_regions: List[Dict] = field(default_factory=list)
    has_level_indicators: bool = False


# =========================
# Pydantic validation
# =========================

class PersonalInfo(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None
    nationality: Optional[str] = None
    birth_date: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v and "@" not in v:
            return None
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, v):
        if v is None:
            return None

        if isinstance(v, str):
            v = v.strip()
            return v if v else None

        if isinstance(v, (list, tuple, set)):
            parts = []
            seen = set()

            for item in v:
                if item is None:
                    continue
                s = str(item).strip()
                if not s:
                    continue
                key = s.casefold()
                if key not in seen:
                    seen.add(key)
                    parts.append(s)

            return " | ".join(parts) if parts else None

        s = str(v).strip()
        return s if s else None

    @field_validator(
        "full_name", "location", "linkedin", "github",
        "website", "nationality", "birth_date"
    )
    @classmethod
    def clean_string(cls, v):
        return v.strip() if isinstance(v, str) else v


class Education(BaseModel):
    degree: Optional[str] = None
    field: Optional[str] = None
    institution: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None
    honors: Optional[str] = None
    code: Optional[str] = None
    confidence: Optional[float] = None

    @field_validator("degree", "field", "institution", "location", "gpa", "honors")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v


class EmbeddedProject(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

    @field_validator("name", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v


class CareerEntry(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    duration_months: Optional[int] = None
    duration_years: Optional[float] = None
    description: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[EmbeddedProject] = Field(default_factory=list)
    source_section: Optional[str] = None
    entry_type: Optional[str] = None
    confidence: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_job_title(cls, values):
        if not isinstance(values, dict):
            return values
        if not values.get("title") and values.get("job_title"):
            values = dict(values)
            values["title"] = values["job_title"]
        return values

    @field_validator("projects", mode="before")
    @classmethod
    def parse_projects(cls, v):
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                name = item.get("name") or item.get("title")
                desc = item.get("description") or item.get("details")
                if isinstance(desc, list):
                    desc = " ".join(str(d).strip() for d in desc if d)
                if name or desc:
                    result.append({"name": name, "description": desc})
            elif isinstance(item, str) and item.strip():
                result.append({"name": item.strip(), "description": None})
        return result

    @field_validator("responsibilities", "technologies", mode="before")
    @classmethod
    def parse_str_list(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return [v.strip()]
        return [str(r).strip() for r in v if r]

    @field_validator("title", "company", "location", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v

    @field_validator("duration_months", mode="before")
    @classmethod
    def parse_duration_months(cls, v):
        if v in (None, "", "null", "none"):
            return None
        try:
            return int(v)
        except Exception:
            return None

    @field_validator("duration_years", mode="before")
    @classmethod
    def parse_duration_years(cls, v):
        if v in (None, "", "null", "none"):
            return None
        try:
            return round(float(v), 1)
        except Exception:
            return None


class Experience(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    description: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    projects: List[EmbeddedProject] = Field(default_factory=list)
    code: Optional[str] = None
    confidence: Optional[float] = None

    @field_validator("projects", mode="before")
    @classmethod
    def parse_projects(cls, v):
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                name = item.get("name") or item.get("title")
                desc = item.get("description") or item.get("details")
                if isinstance(desc, list):
                    desc = " ".join(str(d).strip() for d in desc if d)
                if name or desc:
                    result.append({"name": name, "description": desc})
            elif isinstance(item, str) and item.strip():
                result.append({"name": item.strip(), "description": None})
        return result

    @field_validator("responsibilities", "technologies", mode="before")
    @classmethod
    def parse_str_list(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return [v.strip()]
        return [str(r).strip() for r in v if r]

    @field_validator("job_title", "company", "location", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v


class SkillItem(BaseModel):
    """
    level_score est exclu du modèle car non pertinent dans le JSON final.
    Seuls name, level, source, code, confidence sont conservés.
    """
    name: Optional[str] = None
    level: Optional[str] = None
    source: Optional[str] = None
    code: Optional[str] = None
    confidence: Optional[float] = None

    @field_validator("name", "level", "source")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v


class SkillGroup(BaseModel):
    category: Optional[str] = None
    items: List[SkillItem] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def clean_category(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("items", mode="before")
    @classmethod
    def parse_items(cls, v):
        if not v:
            return []
        out = []
        for item in v:
            if isinstance(item, str):
                s = item.strip()
                if s:
                    out.append({
                        "name": s,
                        "level": None,
                        "source": None,
                        "code": None,
                        "confidence": None,
                    })
            elif isinstance(item, dict):
                item.pop("level_score", None)
                out.append(item)
        return out


class TechnicalSkills(BaseModel):
    programming_languages: List[str] = Field(default_factory=list)
    frameworks_libraries: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    devops_tools: List[str] = Field(default_factory=list)
    data_ai_tools: List[str] = Field(default_factory=list)
    web_technologies: List[str] = Field(default_factory=list)
    api_backend: List[str] = Field(default_factory=list)
    other_technical_tools: List[str] = Field(default_factory=list)

    @field_validator(
        "programming_languages",
        "frameworks_libraries",
        "databases",
        "devops_tools",
        "data_ai_tools",
        "web_technologies",
        "api_backend",
        "other_technical_tools",
        mode="before",
    )
    @classmethod
    def parse_str_list(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            s = v.strip()
            return [s] if s else []
        if isinstance(v, list):
            out = []
            seen = set()
            for item in v:
                if item is None:
                    continue
                s = str(item).strip()
                if not s:
                    continue
                key = s.casefold()
                if key not in seen:
                    seen.add(key)
                    out.append(s)
            return out
        return []

    def has_items(self) -> bool:
        return any(
            getattr(self, field_name)
            for field_name in (
                "programming_languages",
                "frameworks_libraries",
                "databases",
                "devops_tools",
                "data_ai_tools",
                "web_technologies",
                "api_backend",
                "other_technical_tools",
            )
        )


class Language(BaseModel):
    """
    level_score est exclu du modèle car non pertinent dans le JSON final.
    Seuls name, level, source, code, confidence sont conservés.
    """
    name: Optional[str] = None
    level: Optional[str] = None
    source: Optional[str] = None
    code: Optional[str] = None
    confidence: Optional[float] = None

    @field_validator("name", "level", "source")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v


class Certification(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    code: Optional[str] = None
    confidence: Optional[float] = None

    @field_validator("name", "issuer", "date")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is not None:
            return max(0.0, min(1.0, float(v)))
        return v


class Project(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    url: Optional[str] = None

    @field_validator("technologies", mode="before")
    @classmethod
    def parse_techs(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return [v.strip()]
        return [str(x).strip() for x in v if x]

    @field_validator("name", "description", "url")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v


class VolunteerEntry(BaseModel):
    role: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

    @field_validator("role", "organization", "location", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v


class AssociationEntry(BaseModel):
    role: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

    @field_validator("role", "organization", "location", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v


class AdditionalInfoEntry(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)

    @field_validator("title", "organization", "location", "description")
    @classmethod
    def clean_str(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("bullets", mode="before")
    @classmethod
    def parse_bullets(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return [v.strip()]
        return [str(x).strip() for x in v if x]


class CVData(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: Optional[str] = None
    education: List[Education] = Field(default_factory=list)
    experience: List[CareerEntry] = Field(default_factory=list)
    stages: List[CareerEntry] = Field(default_factory=list)
    skills: List[SkillGroup] = Field(default_factory=list)
    technical_skills: TechnicalSkills = Field(default_factory=TechnicalSkills)
    languages: List[Language] = Field(default_factory=list)
    certifications: List[Certification] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    volunteer: List[VolunteerEntry] = Field(default_factory=list)
    associations: List[AssociationEntry] = Field(default_factory=list)
    additional_info: List[AdditionalInfoEntry] = Field(default_factory=list)
    awards: List[str] = Field(default_factory=list)

    experience_years: Optional[float] = None
    stage_months: Optional[int] = None
    stage_years: Optional[float] = None
    total_career_months: Optional[int] = None
    total_career_years: Optional[float] = None
    experience_warnings: List[str] = Field(default_factory=list)

    @field_validator("summary")
    @classmethod
    def clean_summary(cls, v):
        return v.strip() if isinstance(v, str) else v
    
    @field_validator("experience_years", "stage_years", "total_career_years", mode="before")
    @classmethod
    def parse_experience_years(cls, v):
        if v in (None, "", "null", "none"):
            return None
        try:
            return round(float(v), 1)
        except Exception:
            return None

    @field_validator("stage_months", "total_career_months", mode="before")
    @classmethod
    def parse_career_months(cls, v):
        if v in (None, "", "null", "none"):
            return None
        try:
            return int(v)
        except Exception:
            return None

    @field_validator("experience_warnings", mode="before")
    @classmethod
    def parse_experience_warnings(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            s = v.strip()
            return [s] if s else []
        if isinstance(v, list):
            return [str(x).strip() for x in v if x and str(x).strip()]
        return []

    @field_validator("skills", mode="before")
    @classmethod
    def parse_skills(cls, v):
        if not v:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            return [
                {"category": k, "items": i if isinstance(i, list) else []}
                for k, i in v.items()
            ]
        return []

    @field_validator("awards", mode="before")
    @classmethod
    def parse_awards(cls, v):
        if not v:
            return []
        result, seen = [], set()
        for item in v:
            if isinstance(item, str) and item.strip():
                s = item.strip()
                key = s.casefold()
                if key not in seen:
                    seen.add(key)
                    result.append(s)
            elif isinstance(item, dict):
                name = item.get("name") or item.get("title") or item.get("award")
                if name:
                    s = str(name).strip()
                    key = s.casefold()
                    if key not in seen:
                        seen.add(key)
                        result.append(s)
        return result

    @field_validator("volunteer", mode="before")
    @classmethod
    def parse_volunteer(cls, v):
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                entry = {
                    "role": item.get("role") or item.get("title"),
                    "organization": item.get("organization") or item.get("company"),
                    "location": item.get("location"),
                    "start_date": item.get("start_date"),
                    "end_date": item.get("end_date"),
                    "description": item.get("description"),
                }
                if any(val for val in entry.values() if val):
                    result.append(entry)
            elif isinstance(item, str) and item.strip():
                result.append({"role": item.strip()})
        return result

    @field_validator("associations", mode="before")
    @classmethod
    def parse_associations(cls, v):
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                entry = {
                    "role": item.get("role") or item.get("title"),
                    "organization": item.get("organization") or item.get("club"),
                    "location": item.get("location"),
                    "start_date": item.get("start_date"),
                    "end_date": item.get("end_date"),
                    "description": item.get("description"),
                }
                if any(val for val in entry.values() if val):
                    result.append(entry)
            elif isinstance(item, str) and item.strip():
                result.append({"role": item.strip()})
        return result

    @field_validator("additional_info", mode="before")
    @classmethod
    def parse_additional_info(cls, v):
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                bullets = item.get("bullets") or item.get("responsibilities") or []
                if isinstance(bullets, str):
                    bullets = [bullets]
                entry = {
                    "title": item.get("title") or item.get("role") or item.get("name"),
                    "organization": item.get("organization") or item.get("club") or item.get("team"),
                    "location": item.get("location"),
                    "start_date": item.get("start_date"),
                    "end_date": item.get("end_date"),
                    "description": item.get("description"),
                    "bullets": [str(b).strip() for b in bullets if b],
                }
                if any(val for val in entry.values() if val):
                    result.append(entry)
            elif isinstance(item, str) and item.strip():
                result.append({"title": item.strip()})
        return result

    @field_validator("interests", mode="before")
    @classmethod
    def parse_interests(cls, v):
        if not v:
            return []
        result, seen = [], set()
        for item in v:
            if isinstance(item, str) and item.strip():
                s = item.strip()
                key = s.casefold()
                if key not in seen:
                    seen.add(key)
                    result.append(s)
            elif isinstance(item, dict):
                name = item.get("name") or item.get("interest")
                if name:
                    s = str(name).strip()
                    key = s.casefold()
                    if key not in seen:
                        seen.add(key)
                        result.append(s)
        return result


def validate_cv_data(raw_data: Dict) -> Tuple["CVData", List[str]]:
    warnings_list = []
    try:
        cv = CVData(**raw_data)

        if not cv.personal_info.full_name:
            warnings_list.append("Nom non extrait")
        if not cv.personal_info.email:
            warnings_list.append("Email non extrait")
        if not cv.personal_info.phone:
            warnings_list.append("Téléphone non extrait")
        if not cv.education:
            warnings_list.append("Formation non extraite")
        if not cv.experience and not cv.stages:
            warnings_list.append("Aucune expérience ou stage extrait")
        if not cv.skills and not cv.technical_skills.has_items():
            warnings_list.append("Compétences non extraites")

        # ✅ on remonte aussi les warnings calculés sur l’expérience
        if cv.experience_warnings:
            warnings_list.extend(cv.experience_warnings)

        return cv, warnings_list

    except Exception as e:
        warnings_list.append(f"Erreur validation : {e}")
        return CVData(), warnings_list
