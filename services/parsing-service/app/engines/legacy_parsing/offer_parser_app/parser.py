import re, json, uuid, time, os, warnings, logging, hashlib, unicodedata
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

try:
    import requests as _req
except ImportError:
    _req = None
from dotenv import load_dotenv

from app.engines.legacy_parsing.offer_parser_app.config import settings

load_dotenv()
warnings.filterwarnings("ignore")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("JobParser")

# ── Configuration ─────────────────────────────────────────────────────────────
_SETTINGS = settings
LLM_ON          = _SETTINGS.llm_on
GROQ_MODEL      = _SETTINGS.groq_model
MAX_RETRIES     = _SETTINGS.max_retries
FUZZY_THRESHOLD = _SETTINGS.fuzzy_threshold
PARSER_VERSION  = "v23"
_MIN_INTERVAL   = _SETTINGS.groq_min_interval
_TAXONOMY_PATH  = str(_SETTINGS.taxonomy_path)

# ── spaCy ─────────────────────────────────────────────────────────────────────
try:
    import spacy
except ImportError:
    spacy = None
    nlp = None
    log.warning("spaCy package not installed - sentencizer disabled")
else:
    try:
        nlp = spacy.load("fr_core_news_sm")
        log.info("spaCy: fr_core_news_sm loaded (fallback)")
    except OSError:
        try:
            nlp = spacy.load("en_core_web_sm")
            log.info("spaCy: en_core_web_sm loaded")
        except OSError:
            log.warning("No spaCy model found - sentencizer disabled")
            nlp = None

# ── Data Structures ───────────────────────────────────────────────────────────
@dataclass
class ParsedSkill:
    raw_label:             str
    normalized_label:      str
    category:              str      # technical | tool | methodology | certification | domain | language
    is_mandatory:          bool
    confidence:            float
    extraction_method:     str      # regex | llm
    classification_method: str
    mapping_status:        str      # mapped | fuzzy | unmapped
    taxonomy_code:         Optional[str] = None
    reasoning:             str = ""
    matched_label:         Optional[str] = None
    taxonomy_source:       Optional[str] = None
    domain_keys:           List[str] = field(default_factory=list)
    taxonomy_mapping:      Dict[str, Optional[str]] = field(default_factory=dict)
    taxonomy_match_type:   str = "none"
    taxonomy_confidence:   Optional[float] = None

@dataclass
class ParsedOffer:
    title:                Optional[str]   = None
    company_name:         Optional[str]   = None
    description:          Optional[str]   = None
    employment_type:      Optional[str]   = None
    contract_type:        Optional[str]   = None
    location:             Optional[str]   = None
    remote_policy:        Optional[str]   = None
    work_mode:            Optional[str]   = None
    governorate:          Optional[str]   = None
    delegation:           Optional[str]   = None
    number_of_positions:  int             = 1
    seniority_level:      Optional[str]   = None
    experience_years_min: Optional[int]   = None
    experience_years_max: Optional[int]   = None
    education_level:      Optional[str]   = None
    salary_min:           Optional[float] = None
    salary_max:           Optional[float] = None
    salary_currency:      str             = "USD"
    languages:            List[Dict]      = field(default_factory=list)
    offer_lang:           str             = "en"
    skills:               List[ParsedSkill] = field(default_factory=list)
    llm_calls:            int             = 0

# ── Groq API ──────────────────────────────────────────────────────────────────
GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions"
_groq_cache : Dict[str, str] = {}
_call_times : List[float]    = []


def _get_key() -> str:
    # Job offer parsing uses GROQ_API_KEY_OFFER (separate from CV parsing key).
    key = os.environ.get("GROQ_API_KEY_OFFER", "")
    if not key:
        # Fallback to shared key so existing setups without separation still work.
        key = os.environ.get("GROQ_API_KEY", "")
    return key


def _call_groq(system_prompt: str, user_content: str, max_tokens: int = 1500) -> Optional[str]:
    if _req is None:
        raise EnvironmentError(
            "Le package 'requests' est requis pour appeler Groq, "
            "mais il n'est pas installe dans cet environnement."
        )

    key = _get_key()
    if not key:
        raise EnvironmentError(
            "Clé API Groq manquante pour le parseur d'offres. "
            "Définissez GROQ_API_KEY_OFFER dans votre fichier .env."
        )

    # Proactive throttle
    now = time.time()
    _call_times[:] = [t for t in _call_times if now - t < 60]
    if _call_times:
        gap = _MIN_INTERVAL - (now - _call_times[-1])
        if gap > 0:
            time.sleep(gap)

    # Truncate input to avoid TPM limits (offer texts rarely exceed 4000 chars of useful content).
    user_content = user_content[:6000]

    cache_key = hashlib.md5(f"{system_prompt}|{user_content}|{max_tokens}".encode()).hexdigest()
    if cache_key in _groq_cache:
        return _groq_cache[cache_key]

    for attempt in range(MAX_RETRIES):
        try:
            r = _req.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_content},
                    ],
                    "temperature": 0.0,
                    "max_tokens":  max_tokens,
                },
                timeout=60,
            )
            r.raise_for_status()
            result = r.json()["choices"][0]["message"]["content"].strip()
            _groq_cache[cache_key] = result
            _call_times.append(time.time())
            return result
        except _req.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                wait = 2 ** attempt
                log.warning(f"Rate limit — retry {attempt+1}/{MAX_RETRIES} in {wait}s")
                time.sleep(wait)
                continue
            log.error(f"Groq HTTP {e.response.status_code}: {e}")
            return None
        except _req.exceptions.Timeout:
            log.warning(f"Timeout — retry {attempt+1}/{MAX_RETRIES}")
            continue
        except Exception as e:
            log.error(f"Groq error: {e}")
            return None
    log.error(f"Groq: failed after {MAX_RETRIES} attempts")
    return None


def _parse_json_block(raw: str, expect: str = "object") -> Optional[Any]:
    if not raw:
        return None
    raw = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    bracket = ("{", "}") if expect == "object" else ("[", "]")
    m = re.search(re.escape(bracket[0]) + ".*" + re.escape(bracket[1]), raw, re.DOTALL)
    if not m:
        return None
    candidate = m.group(0)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
        try:
            return json.loads(candidate)
        except Exception:
            log.warning("JSON parse failed")
            return None


def check_groq() -> bool:
    resp = _call_groq("Reply with exactly: OK", "OK", max_tokens=5)
    if resp and "OK" in resp:
        log.info(f"Groq OK — model: {GROQ_MODEL}")
        return True
    log.warning("Groq unavailable — regex-only fallback active")
    return False


def clear_groq_cache():
    _groq_cache.clear()
    log.info("Groq cache cleared")


# ── Regex Anchors (Step 1) ────────────────────────────────────────────────────
_LEGACY_CONTRACT_PATTERNS = [
    (r"(?i)\bCDI\b",            "full_time"),
    (r"(?i)\bCDD\b",            "contract"),
    (r"(?i)\bfull[\s-]time\b",  "full_time"),
    (r"(?i)\bpart[\s-]time\b",  "part_time"),
    (r"(?i)\bfreelance\b",      "contract"),
    (r"(?i)\bcontract\b",       "contract"),
    (r"(?i)\bpermanent\b",      "full_time"),
    (r"(?i)\binternship\b",     "internship"),
    (r"(?i)\bstage\b",          "internship"),
    (r"(?i)\balternance\b",     "internship"),
    (r"(?i)\bapprentissage\b",  "internship"),
]

_LEGACY_REMOTE_PATTERNS = [
    (r"(?i)(?:fully?\s+remote|100\s*%\s*remote|remote[\s-]first|work\s+from\s+anywhere|t[eé]l[eé]travail\s*(?:total|complet|100))", "full_remote"),
    (r"(?i)(?:hybrid|hybride|t[eé]l[eé]travail\s*partiel|flexible\s*remote|partial\s*remote)", "hybrid"),
    (r"(?i)(?:on[\s-]?site|onsite|sur\s*site|pr[eé]sentiel|in[\s-]?office)", "onsite"),
]

EXP_PATTERNS = [
    (r"(\d+)\s*(?:[àa]|-|to)\s*(\d+)\s*(?:ans?|ann[eé]es?|years?)",          True),
    (r"(?:minimum|at\s*least|min\.?)\s*(\d+)\s*(?:ans?|years?)",              False),
    (r"(\d+)\+\s*(?:ans?|years?)\s*(?:of\s*)?(?:exp[eé]rience|experience)?",  False),
    (r"(\d+)\s*(?:ans?|years?)\s*(?:of\s*)?(?:exp[eé]rience|experience)",     False),
]
WORD_TO_NUM = {
    "one":1,"two":2,"three":3,"trois":3,"four":4,"cinq":5,"five":5,
    "six":6,"sept":7,"seven":7,"huit":8,"eight":8,"nine":9,"ten":10,
}

SALARY_PATTERNS = [
    r"(?:[£$€])(\d[\d,.]*)[\s]*[-–à][\s]*(?:[£$€])(\d[\d,.]*)",
    r"(\d[\d,.]*)[\s]*[-–à][\s]*(\d[\d,.]*)\s*(?:K|k)?\s*(?:EUR|USD|TND|GBP|CAD|DT|€|\$|£)",
    r"(?:salary|salaire|r[eé]mun[eé]ration|compensation|pay)\s*[:\s]+(\d[\d,.]*)[\s]*[-–àto]+(\d[\d,.]*)",
]

LANG_MAP = {
    "english":"en","anglais":"en","french":"fr","français":"fr","francais":"fr",
    "arabic":"ar","arabe":"ar","spanish":"es","espagnol":"es",
    "german":"de","allemand":"de","italian":"it","italien":"it",
    "portuguese":"pt","portugais":"pt","dutch":"nl",
}
CEFR_MAP = {
    "native":"native","natif":"native","bilingue":"C2","bilingual":"C2",
    "fluent":"C1","courant":"C1","advanced":"C1","avancé":"C1",
    "professional":"B2","professionnel":"B2","business":"B2","working":"B2",
    "intermediate":"B1","intermédiaire":"B1",
    "basic":"A2","notions":"A2","elementary":"A1",
}


# v23 enrichments kept parser-side only. The final RTMC mapping still happens
# later through mapper_app.service.MapperService.
CONTRACT_PATTERNS = [
    (r"(?i)\bCDI\b",                                          "full_time",  "CDI"),
    (r"(?i)\bCDD\b",                                          "contract",   "CDD"),
    (r"(?i)\bSIVP\b",                                         "internship", "SIVP"),
    (r"(?i)\bKARAMA\b",                                       "internship", "KARAMA"),
    (r"(?i)\bfull[\s-]time\b",                                "full_time",  "CDI"),
    (r"(?i)\bpart[\s-]time\b",                                "part_time",  "PART_TIME"),
    (r"(?i)\b(?:freelance|ind[eÃ©]pendant|contractor)\b",      "contract",   "FREELANCE"),
    (r"(?i)\bcontract\b",                                     "contract",   "CDD"),
    (r"(?i)\bpermanent\b",                                    "full_time",  "CDI"),
    (r"(?i)\b(?:internship|stage)\b",                         "internship", "STAGE"),
    (r"(?i)\b(?:alternance|apprentissage|apprenticeship)\b",  "internship", "APPRENTICESHIP"),
    (r"(?i)\b(?:seasonal|saisonnier)\b",                      "contract",   "SEASONAL"),
]

WORK_MODE_PATTERNS = [
    (r"(?i)(?:fully?\s+remote|100\s*%\s*remote|remote[\s-]first|work\s+from\s+anywhere|t[eÃ©]l[eÃ©]travail\s*(?:total|complet|100))", "full_remote", "REMOTE"),
    (r"(?i)(?:hybrid|hybride|t[eÃ©]l[eÃ©]travail\s*partiel|flexible\s*remote|partial\s*remote)", "hybrid", "HYBRID"),
    (r"(?i)(?:on[\s-]?site|onsite|sur\s*site|pr[eÃ©]sentiel|in[\s-]?office)", "onsite", "ONSITE"),
    (r"(?i)(?:mobile|itin[eÃ©]rant|terrain|d[eÃ©]placement)", "mobile", "MOBILE"),
]

GOVERNORATES = [
    "Tunis", "Ariana", "Ben Arous", "Manouba",
    "Nabeul", "Zaghouan", "Bizerte", "Beja",
    "Jendouba", "Le Kef", "Siliana", "Sousse",
    "Monastir", "Mahdia", "Sfax", "Kairouan",
    "Kasserine", "Sidi Bouzid", "Gabes", "Medenine",
    "Tataouine", "Gafsa", "Tozeur", "Kebili",
]
_GOV_RE = re.compile(
    r"\b(" + "|".join(re.escape(g) for g in GOVERNORATES) + r")\b",
    re.I,
)

POSITIONS_PATTERNS = [
    r"(\d+)\s*(?:postes?|positions?|places?|profils?)",
    r"(?:nombre\s+de\s+postes?|positions?\s+available|vacanc(?:y|ies))\s*[:\s]*(\d+)",
]


def clean_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    for src, dst in [
        ("\u2018","'"),("\u2019","'"),("\u201c",'"'),("\u201d",'"'),
        ("\u2013","-"),("\u2014","-"),("\u00a0"," "),
        ("\u2022","*"),("\u25aa","*"),("\u25cf","*"),
    ]:
        text = text.replace(src, dst)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return "\n".join(l.strip() for l in text.split("\n")).strip()


def extract_regex_anchors(text: str) -> Dict:
    fields: Dict = {}

    for pat, emp_type, contract_type in CONTRACT_PATTERNS:
        if re.search(pat, text):
            fields["employment_type"] = emp_type
            fields["contract_type"] = contract_type
            break

    for pat, policy, work_mode in WORK_MODE_PATTERNS:
        if re.search(pat, text):
            fields["remote_policy"] = policy
            fields["work_mode"] = work_mode
            break

    for pattern in POSITIONS_PATTERNS:
        match = re.search(pattern, text, re.I)
        if not match:
            continue
        try:
            positions = int(match.group(1))
        except (TypeError, ValueError, IndexError):
            positions = None
        if positions and 1 < positions <= 500:
            fields["number_of_positions"] = positions
        break

    for pat, is_range in EXP_PATTERNS:
        m = re.search(pat, text, re.I)
        if m:
            word = m.group(0).split()[0].lower()
            if word in WORD_TO_NUM:
                fields["experience_years_min"] = WORD_TO_NUM[word]
            else:
                try:
                    fields["experience_years_min"] = int(m.group(1))
                    if is_range and len(m.groups()) > 1 and m.group(2):
                        fields["experience_years_max"] = int(m.group(2))
                except (ValueError, IndexError):
                    pass
            break

    if re.search(r"[€]|\bEUR\b", text):         fields["salary_currency"] = "EUR"
    elif re.search(r"\bTND\b|\bDT\b", text):    fields["salary_currency"] = "TND"
    elif re.search(r"\bGBP\b|£", text):         fields["salary_currency"] = "GBP"
    elif re.search(r"\bCAD\b", text):            fields["salary_currency"] = "CAD"
    elif re.search(r"\$|\bUSD\b", text):        fields["salary_currency"] = "USD"

    for sp in SALARY_PATTERNS:
        m = re.search(sp, text, re.I)
        if m:
            try:
                raw_min = re.sub(r"[,\s]", "", m.group(1))
                raw_max = re.sub(r"[,\s]", "", m.group(2)) if m.lastindex >= 2 else None
                smin = float(raw_min)
                smax = float(raw_max) if raw_max else None
                if re.search(r"\b[Kk]\b", m.group(0)):
                    smin *= 1000
                    if smax: smax *= 1000
                fields["salary_min"] = smin
                if smax: fields["salary_max"] = smax
            except (ValueError, AttributeError, IndexError):
                pass
            break

    gov_match = _GOV_RE.search(text)
    if gov_match:
        fields["governorate"] = gov_match.group(1).title()

    languages, seen = [], set()
    lang_re = r"\b(" + "|".join(re.escape(k) for k in LANG_MAP) + r")\b"
    for lm in re.finditer(lang_re, text, re.I):
        code = LANG_MAP.get(lm.group(1).lower())
        if not code or code in seen: continue
        seen.add(code)
        ctx = text[max(0, lm.start()-5):lm.end()+60].lower()
        level = "B2"
        for kw, cefr in CEFR_MAP.items():
            if kw in ctx:
                level = cefr; break
        languages.append({"code": code, "label": lm.group(1).capitalize(), "min_level": level})
    if languages:
        fields["languages"] = languages

    return fields

# ── LLM Structured Fields (Step 2) ───────────────────────────────────────────
FIELDS_SYSTEM_PROMPT = """You are a job offer parser. Extract structured metadata from the job offer.

Return ONLY a valid JSON object with these exact keys:
{
  "title": "the job title, exactly as written",
  "company_name": "the name of the hiring company/employer. If not found, return null",
  "location": "the city or place of work. If fully remote return 'Remote'. If not found, return null",
  "seniority_level": one of ["junior", "mid", "senior", "lead"] or null — ONLY if explicit word in title/first 3 lines,
  "education_min": one of ["high_school", "associate", "bachelor", "master", "phd"] or null,
  "offer_lang": "fr" or "en",
  "languages": [{"code": "fr", "label": "French", "min_level": "C1"}]
}

LANGUAGE LEVEL — always return CEFR code:
  native/natif/bilingue → "C2"
  fluent/courant/avancé/advanced → "C1"
  professional/professionnel/business → "B2"
  intermediate/intermédiaire → "B1"
  basic/notions → "A2"
  If no level stated → "B2"

RULES:
- company_name: ONLY the employer name, never a tool or methodology.
- seniority_level: ONLY from explicit words (senior/junior/lead) in the job title. Never infer from years.
- education_min: only if explicitly stated.
- languages: ONLY languages explicitly required. Empty array [] if none mentioned.

Return ONLY the JSON object. No markdown."""


FIELDS_SYSTEM_PROMPT = """You are a job offer parser. Extract structured metadata from the job offer.

Return ONLY a valid JSON object with these exact keys:
{
  "title": "the job title, exactly as written",
  "company_name": "the hiring company/employer. If not found, return null",
  "description": "2-3 sentence summary of the role, or null",
  "location": "the city or place of work. If fully remote return 'Remote'. If not found, return null",
  "governorate": "Tunisian governorate if mentioned, otherwise the most relevant city/region, or null",
  "delegation": "delegation/city within the governorate, or null",
  "number_of_positions": "integer number of open positions, default 1",
  "contract_type": one of ["CDI", "CDD", "SIVP", "KARAMA", "STAGE", "APPRENTICESHIP", "FREELANCE", "PART_TIME", "SEASONAL", "OTHER"] or null,
  "employment_type": one of ["full_time", "part_time", "contract", "internship"] or null,
  "work_mode": one of ["ONSITE", "REMOTE", "HYBRID", "MOBILE", "UNKNOWN"] or null,
  "seniority_level": one of ["junior", "mid", "senior", "lead"] or null - ONLY if explicit word in title/first 3 lines,
  "education_min": one of ["high_school", "associate", "bachelor", "master", "phd"] or null,
  "offer_lang": "fr" or "en",
  "languages": [{"code": "fr", "label": "French", "min_level": "C1"}]
}

CONTRACT TYPE MAPPING:
  full-time/permanent/CDI -> "CDI"
  fixed-term/contract/CDD -> "CDD"
  internship/stage -> "STAGE"
  apprenticeship/alternance -> "APPRENTICESHIP"
  freelance/independent -> "FREELANCE"
  part-time -> "PART_TIME"
  SIVP -> "SIVP"
  KARAMA -> "KARAMA"

LANGUAGE LEVEL - always return CEFR code:
  native/natif/bilingue -> "C2"
  fluent/courant/advanced -> "C1"
  professional/business -> "B2"
  intermediate -> "B1"
  basic/notions -> "A2"
  If no level stated -> "B2"

RULES:
- company_name: ONLY the employer name, never a tool or methodology.
- seniority_level: ONLY from explicit words (senior/junior/lead) in the job title. Never infer from years.
- education_min: only if explicitly stated.
- languages: ONLY languages explicitly required. Empty array [] if none mentioned.
- If no explicit location exists but a governorate is present, fill governorate and keep location null.

Return ONLY the JSON object. No markdown."""


def extract_structured_fields_llm(text: str) -> Dict:
    if not GROQ_OK or not LLM_ON:
        return {}
    raw = _call_groq(FIELDS_SYSTEM_PROMPT, text[:6000], max_tokens=1000)
    result = _parse_json_block(raw, expect="object")
    if not result:
        log.warning("LLM structured fields: parse failed")
        return {}
    return {k: v for k, v in result.items() if v is not None and v != "null" and v != ""}


def extract_structured_fields_regex_fallback(text: str) -> Dict:
    fields = {}
    TITLE_SKIP = re.compile(
        r"^(at\s+|we\s+(are|believe)|our\s+(mission|vision|company)|about\s+us|welcome|join\s+us)",
        re.I,
    )
    for line in text.split("\n")[:10]:
        line = line.strip()
        if line and 4 <= len(line) <= 130 and not TITLE_SKIP.match(line):
            if not re.match(r"^(location|localisation|lieu|compensation|rémunération)\s*:", line, re.I):
                fields["title"] = line
                break

    title = fields.get("title", "")
    city_in_title = re.search(r"-\s*([A-Z][a-zA-Zé]+)\s*$", title)
    if city_in_title:
        candidate = city_in_title.group(1)
        if candidate.lower() not in {"cdi","cdd","full","time","remote","senior","junior"}:
            fields["location"] = candidate
    if not fields.get("location"):
        loc_m = re.search(r"(?:location|lieu|localisation|ville|city|based\s+in)\s*[:\-]\s*([^\n,;|]{3,40})", text, re.I)
        if loc_m:
            cand = loc_m.group(1).strip().split(",")[0].strip()
            if len(cand) <= 40:
                fields["location"] = cand
    if re.search(r"(?i)(?:fully?\s+remote|remote[\s-]first|100\s*%\s*remote)", text):
        fields["location"] = "Remote"

    body = "\n".join(text.split("\n")[1:])
    for pat, lvl in [
        (r"(?i)\b(?:phd|doctorat)\b", "phd"),
        (r"(?i)\b(?:master|msc|bac\s*\+\s*5|mba)\b", "master"),
        (r"(?i)\b(?:bachelor|bsc|licence|bac\s*\+\s*3)\b", "bachelor"),
        (r"(?i)\b(?:bts|dut|bac\s*\+\s*2)\b", "associate"),
        (r"(?i)\b(?:ing[eé]nieur|b\.?eng)\b", "master"),
    ]:
        if re.search(pat, body):
            fields["education_min"] = lvl; break

    fr_c = len(re.findall(r"\b(vous|nous|votre|notre|poste|diplôme|compétences|expérience|profil)\b", text, re.I))
    en_c = len(re.findall(r"\b(you|we|your|our|required|skills|position|role|join|must)\b", text, re.I))
    fields["offer_lang"] = "fr" if fr_c >= en_c else "en"
    return fields

# ── LLM Skill Extraction (Step 3) ────────────────────────────────────────────
def _fallback_description(text: str, title: Optional[str]) -> Optional[str]:
    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if not block:
            continue
        if title and block == title:
            continue
        if len(block) < 40:
            continue
        if re.match(r"^(must[\s-]have|required|mandatory|obligatoire|nice[\s-]to[\s-]have|optional|preferred)\b", block, re.I):
            continue
        compact = re.sub(r"\s+", " ", block).strip()
        if len(compact) <= 420:
            return compact
        return compact[:420].rsplit(" ", 1)[0].strip() + "..."
    return None


def extract_structured_fields_regex_fallback(text: str) -> Dict:
    fields = {}
    title_skip = re.compile(
        r"^(at\s+|we\s+(are|believe)|our\s+(mission|vision|company)|about\s+us|welcome|join\s+us)",
        re.I,
    )
    header_skip = re.compile(
        r"^(location|localisation|lieu|compensation|r[eÃ©]mun[eÃ©]ration|nombre\s+de\s+postes?)\s*:",
        re.I,
    )

    for line in text.split("\n")[:10]:
        line = line.strip()
        if line and 4 <= len(line) <= 130 and not title_skip.match(line) and not header_skip.match(line):
            fields["title"] = line
            break

    title = fields.get("title", "")
    city_in_title = re.search(r"-\s*([A-Z][a-zA-ZÃ©]+)\s*$", title)
    if city_in_title:
        candidate = city_in_title.group(1)
        if candidate.lower() not in {"cdi", "cdd", "full", "time", "remote", "senior", "junior"}:
            fields["location"] = candidate
            gov_match = _GOV_RE.search(candidate)
            if gov_match:
                fields["governorate"] = gov_match.group(1).title()

    if not fields.get("location"):
        loc_match = re.search(r"(?:location|lieu|localisation|ville|city|based\s+in)\s*[:\-]\s*([^\n;|]{3,60})", text, re.I)
        if loc_match:
            candidate = loc_match.group(1).strip()
            if len(candidate) <= 60:
                fields["location"] = candidate
                parts = [part.strip() for part in re.split(r"[,/|-]", candidate) if part.strip()]
                for part in parts:
                    gov_match = _GOV_RE.search(part)
                    if not gov_match:
                        continue
                    fields["governorate"] = gov_match.group(1).title()
                    if parts and parts[0].casefold() != fields["governorate"].casefold():
                        fields["delegation"] = parts[0]
                    break

    company_match = re.search(
        r"(?:entreprise|company|employeur|employer|soci[eé]t[eé]|recruteur|organisation|organization)\s*[:\-]\s*([^\n]{2,80})",
        text, re.I
    )
    if company_match:
        candidate = company_match.group(1).strip()
        if candidate.lower() not in ("non spécifié", "non specifié", "n/a", "na", "unknown", ""):
            fields["company_name"] = candidate

    for pattern, _, work_mode in WORK_MODE_PATTERNS:
        if re.search(pattern, text):
            fields["work_mode"] = work_mode
            break
    if fields.get("work_mode") == "REMOTE" or re.search(r"(?i)(?:fully?\s+remote|remote[\s-]first|100\s*%\s*remote)", text):
        fields["location"] = "Remote"

    if "governorate" not in fields:
        gov_match = _GOV_RE.search(text)
        if gov_match:
            fields["governorate"] = gov_match.group(1).title()

    for pattern in POSITIONS_PATTERNS:
        match = re.search(pattern, text, re.I)
        if not match:
            continue
        try:
            positions = int(match.group(1))
        except (TypeError, ValueError, IndexError):
            positions = None
        if positions and 1 < positions <= 500:
            fields["number_of_positions"] = positions
        break

    body = "\n".join(text.split("\n")[1:])
    for pat, lvl in [
        (r"(?i)\b(?:phd|doctorat)\b", "phd"),
        (r"(?i)\b(?:master|msc|bac\s*\+\s*5|mba)\b", "master"),
        (r"(?i)\b(?:bachelor|bsc|licence|bac\s*\+\s*3)\b", "bachelor"),
        (r"(?i)\b(?:bts|dut|bac\s*\+\s*2)\b", "associate"),
        (r"(?i)\b(?:ing[eÃ©]nieur|b\.?eng)\b", "master"),
    ]:
        if re.search(pat, body):
            fields["education_min"] = lvl
            break

    fr_count = len(re.findall(r"\b(vous|nous|votre|notre|poste|diplÃ´me|compÃ©tences|expÃ©rience|profil)\b", text, re.I))
    en_count = len(re.findall(r"\b(you|we|your|our|required|skills|position|role|join|must)\b", text, re.I))
    fields["offer_lang"] = "fr" if fr_count >= en_count else "en"
    fields["description"] = _fallback_description(text, fields.get("title"))
    return fields


SKILLS_SYSTEM_PROMPT = """You are a skill extraction specialist. Extract every skill, tool, technology, methodology, certification, and domain knowledge from this job offer.

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown, no text before or after.
Each item: {"skill": "NAME ONLY", "is_mandatory": true/false, "confidence": 0.70-0.98, "category": "technical"|"tool"|"methodology"|"certification"|"domain"|"language"}

SKILL NAME RULE: The skill field must contain ONLY the skill name. Nothing else.
CORRECT: "CI/CD"   WRONG: "CI/CD pipelines is non-negotiable"
CORRECT: "FastAPI"  WRONG: "FastAPI for automation"
Split "X or Y" into TWO separate items.

MANDATORY (is_mandatory: true): required, must have, mandatory, obligatoire, non-negotiable, essential,
  "our team uses X" / "l'équipe utilise X" → X is mandatory, core job duties.
OPTIONAL (is_mandatory: false): nice to have, bonus, plus, preferred, appreciated, souhaité, apprécié, familiarity with.

WHAT TO EXTRACT (any domain):
- For internship/junior offers with soft language ("basic knowledge of X", "willingness to learn X"):
  extract X as a skill with is_mandatory=false and confidence=0.76
  "Basic knowledge of LinkedIn" → skill: "LinkedIn", is_mandatory=false
  "email marketing experience" → skill: "Email Marketing", is_mandatory=true
- IT: Python, SQL, React, AWS, Docker, Power BI...
- Finance: SAP FI, Sage 100, IFRS, Excel, ERP...
- Healthcare: Mediboard, EMR/EHR, HIPAA, clinical protocols...
- HR: Workday, SAP HR, SIRH...
- Engineering: AutoCAD, ISO 9001, API 510, NDE...
- Any named software, tool, standard, methodology, certification.
- Implicit: "the team uses Sage 100 daily" → extract "Sage 100" mandatory.

WHAT NOT TO EXTRACT:
- Generic soft skills (communication, teamwork, leadership)
- Job titles, company names, locations, salary
- Physical requirements, benefits
- Sentence fragments: "working on X", "creating reports"
- "X years of [role] experience" sentences → skip entirely

NORMALIZATION: "reactjs"→"React", "k8s"→"Kubernetes", preserve casing: "GitHub", "PostgreSQL"
No duplicates. Return [] if nothing found."""


def extract_skills_llm(text: str) -> Tuple[List[Dict], bool]:
    if not GROQ_OK or not LLM_ON:
        return [], False
    raw = _call_groq(SKILLS_SYSTEM_PROMPT, text[:12000], max_tokens=3500)
    items = _parse_json_block(raw, expect="array")
    if not items:
        log.warning("LLM skills: parse failed")
        return [], True
    results = []
    for item in items:
        if not isinstance(item, dict): continue
        skill = str(item.get("skill", "")).strip()
        if not skill or len(skill) < 2: continue
        skill = re.sub(
            r"\s+(?:is\s+|are\s+|serait\s+|would\s+be\s+a?\s*)?"
            r"(?:non[- ]negotiable|mandatory|required|obligatoire|a\s+bonus|"
            r"a\s+plus|preferred|appreciated|souhait[eé][e]?|apprécié[e]?|"
            r"un\s+atout|un\s+plus|not\s+required|but\s+not\s+required).*$",
            "", skill, flags=re.I | re.DOTALL,
        ).strip(". ,;:-")
        skill = re.sub(
            r"^(?:strong\s+|deep\s+|solid\s+|good\s+|"
            r"proficiency\s+in\s+|experience\s+(?:with|in)\s+|"
            r"knowledge\s+of\s+|familiarity\s+with\s+)", "", skill, flags=re.I,
        ).strip()
        if not skill or len(skill) < 2: continue
        or_parts = re.split(r"\s+or\s+", skill, flags=re.I)
        skills_to_add = [p.strip() for p in or_parts if len(p.strip()) >= 2] if len(or_parts) > 1 else [skill]
        for sk in skills_to_add:
            results.append({
                "raw":       sk,
                "is_must":   bool(item.get("is_mandatory", True)),
                "confidence": float(item.get("confidence", 0.80)),
                "method":    "llm",
                "category":  str(item.get("category", "technical")),
                "reasoning": "",
            })
    return results, True


def extract_skills_regex_fallback(text: str) -> List[Dict]:
    results, seen = [], set()
    MUST_RE = re.compile(r"\b(obligatoire|indispensable|requis[e]?|mandatory|must[\s-]have|required|non[\s-]negotiable|essential)\b", re.I)
    NICE_RE = re.compile(r"\b(souhait[eé][e]?|apprécié[e]?|appreciated|bonus|preferred|plus|nice[\s-]to[\s-]have|un\s+atout)\b", re.I)
    ARTICLE_RE = re.compile(r"^(?:du\s+|de\s+|d[eu]\s+|des\s+|le\s+|la\s+|les\s+|l['\u2019]\s*|the\s+|a\s+|an\s+)", re.I)
    MUST_SECTION_RE = re.compile(r"^(?:must[\s-]have|required|mandatory|obligatoire)\s*:?\s*$", re.I)
    NICE_SECTION_RE = re.compile(r"^(?:nice[\s-]to[\s-]have|optional|preferred|bonus|a\s+plus|un\s+atout)\s*:?\s*$", re.I)
    PATTERNS = [
        r"(?i)(?:experience|proficiency|expertise)\s+(?:with|in|of)\s+([\w][\w\s/&.+\-#]{0,60}?)(?=[;.(\n]|$)",
        r"(?i)(?:ma[îi]trise|connaissance)\s+(?:de\s+|d[u\u2019])?([\w][\w\s/&.+\-#]{0,60}?)(?=[;.(\n]|$)",
        r"(?i)(?:utilise[sz]?|utilisons|travaille[zn]?\s+sur)\s+(?:le\s+logiciel\s+)?([\w][\w\s/&.+\-#]{0,40}?)(?=[,;.(\n]|$)",
        r"(?i)(?:knowledge|familiarity)\s+(?:with|of)\s+([\w][\w\s/&.+\-#]{0,40}?)(?=[,;.(\n]|$)",
        r"(?i)(?:maîtrise|maitrise)\s+du\s+(droit\s+[\w\s/&.-]{2,40}?)(?=[;.(\n—]|$)",
        r"(?i)(?:connaissance|expérience|experience)\s+(?:du|en|de\s+la?)\s+(droit\s+[\w\s/&.-]{2,40}?)(?=[;.(\n—]|$)",
        r"(?i)\busing\s+([\w][\w\s/&.+\-#,]{0,80}?)(?=[;.\n]|$)",
    ]
    STOPWORDS = {"experience","connaissance","the","and","or","with","in","of","notre","votre","our","your","good","strong","years","ans"}

    def _split_clean(raw):
        parts = re.split(r"\s+(?:and|et)\s+|\s*,\s*", raw)
        for p in parts:
            p = p.strip()
            p = re.sub(r"\s+(?:is\s+)?(?:required|mandatory|obligatoire|preferred|recommended|appreciated).*$", "", p, flags=re.I).strip(". ,;:-")
            p = ARTICLE_RE.sub("", p).strip()
            if len(p) >= 2 and len(p) <= 50 and p.lower() not in STOPWORDS:
                yield p

    section_mode = None
    for line in text.splitlines():
        stripped = line.strip()
        if MUST_SECTION_RE.match(stripped):
            section_mode = True
            continue
        if NICE_SECTION_RE.match(stripped):
            section_mode = False
            continue
        if not stripped:
            section_mode = None
            continue
        if section_mode is None:
            continue

        bullet = re.match(r"^[-*•]\s+(.+)$", stripped)
        if not bullet:
            continue

        for term in _split_clean(bullet.group(1)):
            key = re.sub(r"[^a-z0-9]", "", term.lower())
            if key in seen:
                continue
            seen.add(key)
            results.append(
                {
                    "raw": term,
                    "is_must": section_mode,
                    "confidence": 0.86 if section_mode else 0.82,
                    "method": "regex",
                    "category": "technical",
                    "reasoning": "",
                }
            )

    for pat in PATTERNS:
        for m in re.finditer(pat, text):
            raw_match = m.group(1).strip()
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            if line_end == -1:
                line_end = len(text)
            sent = text[line_start:line_end]
            if NICE_RE.search(sent):
                is_must = False
            elif MUST_RE.search(sent):
                is_must = True
            else:
                is_must = True
            for term in _split_clean(raw_match):
                key = re.sub(r"[^a-z0-9]", "", term.lower())
                if key in seen: continue
                seen.add(key)
                results.append({"raw": term, "is_must": is_must, "confidence": 0.72, "method": "regex", "category": "technical", "reasoning": ""})
    return results

# ── Normalization (Step 4) ────────────────────────────────────────────────────
# ── Normalization légère seulement ────────────────────────────────────────────
# Le parser nettoie les labels, mais ne produit aucun code RTMC.
# Le vrai mapping RTMC sera fait par mapper_app.service.MapperService.

_LABEL_TRAIL = re.compile(
    r"\s+(?:serait\s+un\s+(?:plus|atout)|would\s+be\s+\w+|"
    r"is\s+(?:a\s+bonus|non.negotiable|preferred|mandatory)|"
    r"apprécié[e]?|souhait[eé][e]?|obligatoire|requis[e]?|"
    r"appreciated|un\s+atout|un\s+plus|not\s+required).*$",
    re.I,
)


def simple_normalize_label(raw: str) -> str:
    """
    Normalisation légère uniquement.
    Ne fait PAS de mapping RTMC.
    """
    if raw is None:
        return ""

    text = str(raw).strip()
    text = _LABEL_TRAIL.sub("", text).strip(". ,;:-")

    replacements = {
        "python3": "Python",
        "python 3": "Python",
        "js": "JavaScript",
        "javascript": "JavaScript",
        "reactjs": "React",
        "react.js": "React",
        "nodejs": "Node.js",
        "node.js": "Node.js",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "powerbi": "Power BI",
        "power bi": "Power BI",
        "fast api": "FastAPI",
        "fastapi": "FastAPI",
        "rest api": "REST API",
        "api rest": "API REST",
        "cicd": "CI/CD",
        "ci cd": "CI/CD",
        "ci/cd": "CI/CD",
        "k8s": "Kubernetes",
    }

    key = text.lower().strip()
    if key in replacements:
        return replacements[key]

    if text == text.lower() and len(text) > 1:
        return text.title()

    return text


def map_skill(raw: str) -> Dict[str, Any]:
    """
    Ne fait PAS de mapping RTMC.
    Retourne seulement un label nettoyé.
    Le vrai mapping sera fait après par mapper_app.pipeline.map_offer
    via MapperService.
    """
    normalized = simple_normalize_label(raw)

    return {
        "raw_label": raw,
        "normalized_label": normalized,
        "taxonomy_code": None,
        "mapping_status": "pending_rtmc_mapping",
        "taxonomy_match_type": "none",
        "matched_label": None,
        "source": None,
        "domain_keys": [],
        "mapping": {},
        "confidence": 0.0,
    }


def normalize(raw: str) -> Tuple[str, str, Optional[str]]:
    mapped = map_skill(raw)
    return mapped["normalized_label"], mapped["mapping_status"], mapped["taxonomy_code"]

# ── Schema Export (Step 5) — strict JSON schema v1.0 compliance ───────────────
EDU_LEVEL_MAP = {
    "high_school": {"code": "EDU_HS",       "label": "High School / Bac"},
    "associate":   {"code": "EDU_ASSOCIATE", "label": "Associate / BTS / DUT"},
    "bachelor":    {"code": "EDU_BACHELOR",  "label": "Bachelor / Licence"},
    "master":      {"code": "EDU_MASTER",    "label": "Master / Ingénieur / MBA"},
    "phd":         {"code": "EDU_PHD",       "label": "PhD / Doctorat"},
}

INDUSTRY_SIGNALS = [
    (r"(?i)(devops|sre|platform\s+engineer|cloud\s+engineer|infra)",    "IND_CLOUD_INFRA"),
    (r"(?i)(data\s+engineer|data\s+scientist|ml\s+engineer|mlops)",    "IND_DATA_AI"),
    (r"(?i)(machine\s+learning|deep\s+learning|ai\s+engineer)",        "IND_DATA_AI"),
    (r"(?i)(full.?stack|backend|frontend|mobile\s+dev|software\s+eng)","IND_IT_SERVICES"),
    (r"(?i)(security\s+eng|cybersec|penetration|soc\s+analyst)",       "IND_CYBERSECURITY"),
    (r"(?i)(comptable|accountant|finance|audit|fiscal|cfo|controller)", "IND_FINANCE"),
    (r"(?i)(infirmier|nurse|médecin|physician|pharmacist|soins)",       "IND_HEALTHCARE"),
    (r"(?i)(\brh\b|ressources\s+humaines|\bhr\b|talent\s+acq)",        "IND_HR"),
    (r"(?i)(marketing|seo|sem|growth|content\s+strat|brand)",          "IND_MARKETING"),
    (r"(?i)(mechanical|civil|electrical|structural|facility|integrity)","IND_ENGINEERING"),
    (r"(?i)(legal|lawyer|attorney|solicitor|paralegal|juriste)",        "IND_LEGAL"),
    (r"(?i)(supply\s+chain|logistics|procurement|warehouse)",           "IND_SUPPLY_CHAIN"),
    (r"(?i)(data\s+anal|business\s+anal|reporting\s+anal)",            "IND_DATA_AI"),
    (r"(?i)(business\s+dev|sales\s+dev|lead\s+gen)",                   "IND_MARKETING"),
]

OCCUPATION_SIGNALS = [
    (r"(?i)devops",                              "OCC_DEVOPS_ENGINEER",     "DevOps Engineer"),
    (r"(?i)data\s*engineer",                    "OCC_DATA_ENGINEER",       "Data Engineer"),
    (r"(?i)data\s*scientist",                   "OCC_DATA_SCIENTIST",      "Data Scientist"),
    (r"(?i)data\s*anal",                        "OCC_DATA_ANALYST",        "Data Analyst"),
    (r"(?i)machine\s*learning|ml\s*engineer",  "OCC_ML_ENGINEER",         "ML Engineer"),
    (r"(?i)full.?stack",                         "OCC_FULLSTACK_DEVELOPER", "Full Stack Developer"),
    (r"(?i)\bbackend\b",                        "OCC_BACKEND_DEVELOPER",   "Backend Developer"),
    (r"(?i)\bfrontend\b",                       "OCC_FRONTEND_DEVELOPER",  "Frontend Developer"),
    (r"(?i)platform|sre\b|site\s+reliab",      "OCC_SRE",                 "SRE / Platform Engineer"),
    (r"(?i)security|cybersec|pentest",           "OCC_SECURITY_ENGINEER",   "Security Engineer"),
    (r"(?i)software\s+engineer|développeur|developer", "OCC_SOFTWARE_ENGINEER", "Software Engineer"),
    (r"(?i)comptable|accountant",               "OCC_ACCOUNTANT",          "Accountant"),
    (r"(?i)\bhr\b|talent\s+acq|responsable\s+rh", "OCC_HR_MANAGER",       "HR Manager"),
    (r"(?i)legal|lawyer|attorney|juriste|paralegal", "OCC_LEGAL",          "Legal / Juriste"),
    (r"(?i)project\s+manager|chef\s+de\s+projet",    "OCC_PROJECT_MANAGER","Project Manager"),
    (r"(?i)infirmier|nurse",                    "OCC_NURSE",               "Nurse"),
    (r"(?i)médecin|physician|doctor",           "OCC_PHYSICIAN",           "Physician"),
    (r"(?i)integrity\s+engineer|facility\s+engineer", "OCC_INTEGRITY_ENGINEER", "Integrity Engineer"),
    (r"(?i)business\s*dev|bdr\b|sales\s*dev",  "OCC_BUSINESS_DEV",        "Business Developer"),
    (r"(?i)\bsales\b|\baccount\s+exec",         "OCC_SALES",               "Sales Representative"),
    (r"(?i)marketing\s+manager|growth\s+hack",  "OCC_MARKETING_MANAGER",   "Marketing Manager"),
    (r"(?i)supply\s+chain|logistic|procurement","OCC_SUPPLY_CHAIN",        "Supply Chain"),
    (r"(?i)intern|stagiaire",                   "OCC_INTERN",              "Intern / Stagiaire"),
]


def _infer_industry(title: str, skills: List[ParsedSkill]) -> Optional[str]:
    combined = f"{title or ''} {' '.join(s.normalized_label for s in skills)}"
    for pat, code in INDUSTRY_SIGNALS:
        if re.search(pat, combined): return code
    return None


def _infer_occupations(title: str, skills: List[ParsedSkill]) -> List[Dict]:
    combined = f"{title or ''} {' '.join(s.normalized_label for s in skills)}"
    found = []
    for pat, occ_code, occ_label in OCCUPATION_SIGNALS:
        if re.search(pat, combined):
            found.append({"code": occ_code, "label": occ_label, "weight": 0.90})
    if not found:
        found.append({"code": "OCC_UNKNOWN", "label": title or "Unknown", "weight": 0.50})
    return found[:3]


# FIX L1 : level inferred from text context, not confidence
_BEGINNER_RE = re.compile(
    r"\b(basic|beginner|notions?|débutant|entry[- ]level|elementary|"
    r"introductory|awareness|willingness\s+to\s+learn|familiarity\s+with)\b", re.I,
)
_ADVANCED_RE = re.compile(
    r"\b(advanced|expert|senior|confirmed|approfondi[e]?|deep|"
    r"strong\s+proficien|non[- ]negotiable|mandatory|indispensable|"
    r"mastery|proficient|specialist)\b", re.I,
)

def _level(skill_label: str, source_text: str) -> str:
    ctx = (source_text + " " + skill_label).lower()
    if _BEGINNER_RE.search(ctx): return "beginner"
    if _ADVANCED_RE.search(ctx): return "advanced"
    return "intermediate"


CERT_KW = ["certification","certified","certificate","license","pmp","aws sa",
           "oscp","ceh","cissp","cpa","cfa","acca","cima","iso auditor"]


def to_schema_json(offer: ParsedOffer, filename: str = "offer.txt",
                   mime_type: str = "text/plain") -> Dict:
    """
    Returns a JSON object strictly compliant with offer-parsed-output.schema.json v1.0.
    Fields: contract_version, offer_id, source, parsing_metadata,
            offer, occupations_target, requirements.
    """
    oid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    relevant = [s for s in offer.skills if s.category in ("technical","tool","methodology","domain","certification")]
    confs = [s.confidence for s in relevant]
    confidence_overall = round(sum(confs) / len(confs), 3) if confs else 0.70

    emp_type = _normalize_employment_type(offer.employment_type, offer.contract_type)
    if emp_type not in {"internship", "full_time", "part_time", "contract"}:
        emp_type = "full_time"

    # offer object — only schema-allowed fields
    offer_obj: Dict = {
        "title":           offer.title or "Non spécifié",
        "company_name":    offer.company_name or "Non spécifié",
        "location":        offer.location or "Non spécifié",
        "employment_type": emp_type,
    }
    if offer.seniority_level in {"junior", "mid", "senior", "lead"}:
        offer_obj["seniority_level"] = offer.seniority_level
    ind = _infer_industry(offer.title, offer.skills)
    if ind:
        offer_obj["industry_code"] = ind

    # skills split
    mandatory_skills, optional_skills, certifications = [], [], []
    for s in offer.skills:
        if s.category not in ("technical", "tool", "methodology", "domain", "certification"):
            continue
        item = {
            "raw_label": s.raw_label,
            "normalized_label": s.normalized_label,
            "category": s.category,
            "is_mandatory": bool(s.is_mandatory),
            "confidence": round(float(s.confidence), 3),
            "extraction_method": s.extraction_method,
            "classification_method": s.classification_method,
            "mapping_status": "pending_rtmc_mapping",
            "taxonomy_code": None,
        }
        if s.category == "certification" or any(kw in s.normalized_label.lower() for kw in CERT_KW):
            certifications.append(item)
            continue
        if s.is_mandatory:
            item["min_level"] = _level(s.normalized_label, s.reasoning + " " + s.raw_label)
            mandatory_skills.append(item)
        else:
            optional_skills.append(item)

    requirements: Dict = {
        "mandatory_skills": mandatory_skills,
        "optional_skills":  optional_skills,
    }
    if offer.experience_years_min is not None:
        requirements["min_years_experience"] = offer.experience_years_min
    if offer.education_level and offer.education_level in EDU_LEVEL_MAP:
        requirements["education_min"] = EDU_LEVEL_MAP[offer.education_level]
    if certifications:
        requirements["certifications_preferred"] = certifications
    if offer.languages:
        requirements["languages"] = offer.languages

    return {
        "contract_version":   "1.0",
        "offer_id":           oid,
        "source":             {"filename": filename, "mime_type": mime_type},
        "parsing_metadata":   {
            "parser_version":   PARSER_VERSION,
            "parsed_at":        now,
            "lang":             offer.offer_lang,
            "confidence_overall": confidence_overall,   # exact schema field name
        },
        "offer":              offer_obj,
        "occupations_target": _infer_occupations(offer.title, offer.skills),
        "requirements":       requirements,
    }

# ── Main Pipeline ─────────────────────────────────────────────────────────────
_GARBAGE_PAT = re.compile(
    r"^(engineering|operations|management|closely|related|field|following|"
    r"including|various|additional|seven|more|other|above|below|similar|"
    r"automation|data|services|activities|tasks|duties|processes|experience|"
    r"knowledge|skills|ability|background|understanding|proficiency|"
    r"devops|sre|accounting|finance|marketing|sales|legal|development|"
    r"university|college|students|candidates|applicants|individuals|"
    r"persons|anyone|someone|those|people|team\s+player|self.motivated)$",
    re.I,
)
_CEFR_NORM = {
    "native":"C2","natif":"C2","bilingue":"C2","bilingual":"C2",
    "fluent":"C1","courant":"C1","avancé":"C1","advanced":"C1","courante":"C1",
    "professional":"B2","professionnel":"B2","business":"B2","working":"B2",
    "appreciated":"B2","appréciée":"B2","apprécié":"B2",
    "intermediate":"B1","intermédiaire":"B1",
    "basic":"A2","notions":"A2","elementary":"A1",
}


def _normalize_employment_type(
    employment_type: Optional[str],
    contract_type: Optional[str] = None,
) -> Optional[str]:
    mapping = {
        "full_time": "full_time",
        "full-time": "full_time",
        "cdi": "full_time",
        "permanent": "full_time",
        "part_time": "part_time",
        "part-time": "part_time",
        "part time": "part_time",
        "contract": "contract",
        "cdd": "contract",
        "freelance": "contract",
        "seasonal": "contract",
        "internship": "internship",
        "stage": "internship",
        "apprenticeship": "internship",
        "alternance": "internship",
        "sivp": "internship",
        "karama": "internship",
    }
    for value in (employment_type, contract_type):
        if not value:
            continue
        normalized = mapping.get(str(value).strip().lower())
        if normalized:
            return normalized
    return None


def _normalize_remote_policy(
    remote_policy: Optional[str],
    work_mode: Optional[str] = None,
) -> Optional[str]:
    mapping = {
        "full_remote": "full_remote",
        "remote": "full_remote",
        "hybrid": "hybrid",
        "onsite": "onsite",
        "on_site": "onsite",
        "mobile": "mobile",
    }
    for value in (remote_policy, work_mode):
        if not value:
            continue
        normalized = mapping.get(str(value).strip().lower())
        if normalized:
            return normalized
    return None


def _coerce_positions(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 1
    return parsed if 1 <= parsed <= 500 else 1


def _compose_location(
    location: Optional[str],
    delegation: Optional[str],
    governorate: Optional[str],
    remote_policy: Optional[str],
) -> Optional[str]:
    if location and re.match(r"(?i)^remote[\s\-]first$|^fully?\s+remote$|^100\s*%\s*remote$", location.strip()):
        return "Remote"
    if remote_policy == "full_remote" and not location:
        return "Remote"
    if location:
        return location.strip()
    if delegation and governorate:
        if delegation.casefold() == governorate.casefold():
            return governorate
        return f"{delegation}, {governorate}"
    if governorate:
        return governorate
    if delegation:
        return delegation
    return None


def parse_offer(raw_text: str) -> ParsedOffer:
    offer = ParsedOffer()
    text  = clean_text(raw_text)

    # Step 1 — regex anchors
    anchors = extract_regex_anchors(text)
    offer.employment_type      = anchors.get("employment_type")
    offer.contract_type        = anchors.get("contract_type")
    offer.remote_policy        = anchors.get("remote_policy")
    offer.work_mode            = anchors.get("work_mode")
    offer.governorate          = anchors.get("governorate")
    offer.number_of_positions  = _coerce_positions(anchors.get("number_of_positions", 1))
    offer.experience_years_min = anchors.get("experience_years_min")
    offer.experience_years_max = anchors.get("experience_years_max")
    offer.salary_min           = anchors.get("salary_min")
    offer.salary_max           = anchors.get("salary_max")
    offer.salary_currency      = anchors.get("salary_currency", "USD")
    regex_languages            = anchors.get("languages", [])

    # Step 2 — LLM structured fields
    if GROQ_OK and LLM_ON:
        fields = extract_structured_fields_llm(text)
        offer.llm_calls += 1
        if not fields:
            fields = extract_structured_fields_regex_fallback(text)
    else:
        fields = extract_structured_fields_regex_fallback(text)

    offer.title        = fields.get("title")
    offer.company_name = fields.get("company_name") or fields.get("employer_name")
    offer.description  = fields.get("description") or fields.get("description_summary")
    offer.location     = fields.get("location")
    offer.delegation   = fields.get("delegation")

    if not offer.governorate:
        offer.governorate = fields.get("governorate")
    if not offer.contract_type and fields.get("contract_type"):
        offer.contract_type = fields.get("contract_type")
    if not offer.employment_type:
        offer.employment_type = _normalize_employment_type(
            fields.get("employment_type"),
            offer.contract_type,
        )
    if not offer.work_mode and fields.get("work_mode"):
        offer.work_mode = fields.get("work_mode")
    offer.remote_policy = _normalize_remote_policy(offer.remote_policy, offer.work_mode)
    offer.number_of_positions = _coerce_positions(
        fields.get("number_of_positions", offer.number_of_positions)
    )

    _raw_seniority = fields.get("seniority_level")
    if _raw_seniority:
        _title_area = (fields.get("title","") + " " + text[:200]).lower()
        _WORDS = {
            "senior": ["senior","sr.","sr "],
            "junior": ["junior","jr.","jr ","entry level","entry-level","débutant"],
            "lead":   ["lead","head of","principal","staff ","director"],
            "mid":    ["mid-level","mid level","confirmed","intermédiaire"],
        }
        _WORDS["senior"].extend(["sÃ©nior", "expÃ©rimentÃ©", "expÃ©rimentÃ©e"])
        _WORDS["junior"].extend(["dÃ©butant", "dÃ©butante"])
        _WORDS["lead"].extend(["responsable", "chef"])
        _WORDS["mid"].extend(["confirmÃ©", "confirmÃ©e"])
        offer.seniority_level = _raw_seniority if any(
            kw in _title_area for kw in _WORDS.get(_raw_seniority, [])
        ) else None
    else:
        offer.seniority_level = None

    offer.education_level = fields.get("education_min")
    offer.offer_lang      = fields.get("offer_lang", "en")
    llm_languages         = fields.get("languages", [])
    offer.languages       = llm_languages if llm_languages else regex_languages

    offer.location = _compose_location(
        offer.location,
        offer.delegation,
        offer.governorate,
        offer.remote_policy,
    )

    # Step 3 — LLM skill extraction
    if GROQ_OK and LLM_ON:
        skill_hits, called = extract_skills_llm(text)
        if called: offer.llm_calls += 1
        if not skill_hits:
            skill_hits = extract_skills_regex_fallback(text)
    else:
        skill_hits = extract_skills_regex_fallback(text)

    # OR-recovery
    _OR_PATTERN = re.compile(
        r"(?:familiarity\s+with|experience\s+with|knowledge\s+of|proficiency\s+in)?"
        r"\s*([\w][\w.+\-#/]{1,30})\s+or\s+([\w][\w.+\-#/]{1,30})"
        r"(?:\s+(?:is\s+)?(?:preferred|appreciated|bonus|optional|a\s+plus|not\s+required))?",
        re.I,
    )
    _found_raws  = {re.sub(r"[^a-z0-9]","",h["raw"].lower()) for h in skill_hits}
    _STOP_OR     = {"it","is","the","or","and","of","in","a","an","to","for","not","but","with"}
    for m in _OR_PATTERN.finditer(text):
        sa, sb = m.group(1).strip(), m.group(2).strip()
        if sa.lower() in _STOP_OR or sb.lower() in _STOP_OR: continue
        if len(sa) < 2 or len(sb) < 2: continue
        ka = re.sub(r"[^a-z0-9]","",sa.lower())
        kb = re.sub(r"[^a-z0-9]","",sb.lower())
        surrounding = text[max(0,m.start()-50):m.end()+80]
        _has_pref = bool(re.search(r"\b(?:familiarity|preferred|appreciated|bonus|a\s+plus|nice\s+to|not\s+required|required|mandatory)\b", surrounding, re.I))
        _is_exp   = bool(re.search(r"\d+\s+years?\s+of\b", surrounding, re.I))
        if not _has_pref or _is_exp: continue
        if ka not in _found_raws:
            skill_hits.append({"raw":sa,"is_must":False,"confidence":0.80,"method":"or_recovery","category":"technical","reasoning":""})
            _found_raws.add(ka)
        if kb not in _found_raws:
            skill_hits.append({"raw":sb,"is_must":False,"confidence":0.80,"method":"or_recovery","category":"technical","reasoning":""})
            _found_raws.add(kb)

    # Step 4 — normalize + dedup
    seen_norm: set = set()
    for hit in skill_hits:
        raw = hit["raw"]
        mapping = map_skill(raw)
        norm_label = mapping["normalized_label"]
        mapping_status = mapping["mapping_status"]
        tax_code = mapping["taxonomy_code"]
        dedup_key = re.sub(r"[^a-z0-9]", "", norm_label.lower())
        if dedup_key in seen_norm: continue
        seen_norm.add(dedup_key)
        conf = hit["confidence"]
        if mapping_status == "mapped": conf = min(conf + 0.02, 0.99)
        offer.skills.append(ParsedSkill(
            raw_label=raw, normalized_label=norm_label,
            category=hit.get("category","technical"),
            is_mandatory=hit["is_must"], confidence=round(conf,3),
            extraction_method=hit.get("method","llm"),
            classification_method="llm" if hit.get("method") == "llm" else "regex",
            mapping_status=mapping_status, taxonomy_code=tax_code,
            reasoning=hit.get("reasoning",""),
            matched_label=mapping["matched_label"],
            taxonomy_source=mapping["source"],
            domain_keys=mapping["domain_keys"],
            taxonomy_mapping=mapping["mapping"],
            taxonomy_match_type=mapping["taxonomy_match_type"],
            taxonomy_confidence=mapping["confidence"] if mapping["taxonomy_code"] else None,
        ))

    # Remove language skills already in offer.languages
    lang_words = {"english","french","arabic","spanish","german","italian","portuguese",
                  "anglais","français","arabe","espagnol","allemand","italien"}
    offer.skills = [s for s in offer.skills
                    if not (s.category == "language" and s.normalized_label.lower() in lang_words)]

    # Normalize CEFR codes
    for lang in offer.languages:
        raw_level = lang.get("min_level","")
        if raw_level and raw_level not in ("C1","C2","B1","B2","A1","A2","native"):
            lang["min_level"] = _CEFR_NORM.get(raw_level.lower(), "B2")

    # Garbage filter
    offer.skills = [s for s in offer.skills
                    if not _GARBAGE_PAT.match(s.normalized_label.strip())
                    and len(s.normalized_label.strip()) >= 3]

    return offer

# ── Init (called once at import) ──────────────────────────────────────────────
# Pas de taxonomy.json ici.
# Le mapping RTMC final est fait par mapper_app.service.MapperService.

ACTIVE_TAXONOMY = {}
ALIAS_INDEX = {}
ALL_CANONICAL = []
GROQ_OK = bool(_get_key()) and _req is not None if LLM_ON else False
