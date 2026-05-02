import re
import unicodedata


def normalize_text(text: str) -> str:
    """Normalise un texte pour BM25 et le mapping."""
    if not text:
        return ""
    text = text.lower().strip()
    # Supprime les accents
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    # Supprime les espaces multiples
    text = re.sub(r"\s+", " ", text)
    return text


def tokenize_text(text: str) -> list[str]:
    """Tokenise un texte normalisé pour BM25."""
    normalized = normalize_text(text)
    return [tok for tok in normalized.split() if len(tok) >= 2]
