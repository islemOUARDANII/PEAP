"""
Tests unitaires du module embeddings.py.

Le SentenceTransformer est mocké pour éviter de charger le modèle (80MB).
"""

from __future__ import annotations

import numpy as np
import pytest
from unittest.mock import MagicMock, patch


DIM = 384


@pytest.fixture(autouse=True)
def reset_model_singleton():
    """Réinitialise le singleton _model entre chaque test."""
    import app.embeddings as emb
    emb._model = None
    yield
    emb._model = None


def _make_mock_model(vector=None):
    vec = np.array(vector or [0.1] * DIM, dtype=np.float32)
    mock = MagicMock()
    mock.encode.return_value = vec
    return mock


# ---------------------------------------------------------------------------
# embed_text
# ---------------------------------------------------------------------------

class TestEmbedText:

    def test_returns_list_of_floats(self):
        with patch("app.embeddings._get_model", return_value=_make_mock_model()):
            from app.embeddings import embed_text
            result = embed_text("python backend engineer")

        assert isinstance(result, list)
        assert len(result) == DIM
        assert all(isinstance(v, float) for v in result)

    def test_empty_text_returns_zero_vector(self):
        from app.embeddings import embed_text
        result = embed_text("")
        assert result == [0.0] * DIM

    def test_whitespace_text_returns_zero_vector(self):
        from app.embeddings import embed_text
        result = embed_text("   ")
        assert result == [0.0] * DIM

    def test_model_encode_called_with_stripped_text(self):
        mock_model = _make_mock_model()
        with patch("app.embeddings._get_model", return_value=mock_model):
            from app.embeddings import embed_text
            embed_text("  python  ")

        call_args = mock_model.encode.call_args[0][0]
        assert call_args == "python"


# ---------------------------------------------------------------------------
# embed_batch
# ---------------------------------------------------------------------------

class TestEmbedBatch:

    def test_returns_list_of_vectors(self):
        vectors = np.array([[0.1] * DIM, [0.2] * DIM], dtype=np.float32)
        mock_model = MagicMock()
        mock_model.encode.return_value = vectors

        with patch("app.embeddings._get_model", return_value=mock_model):
            from app.embeddings import embed_batch
            result = embed_batch(["text1", "text2"])

        assert len(result) == 2
        assert len(result[0]) == DIM

    def test_empty_strings_are_stripped(self):
        vectors = np.array([[0.0] * DIM], dtype=np.float32)
        mock_model = MagicMock()
        mock_model.encode.return_value = vectors

        with patch("app.embeddings._get_model", return_value=mock_model):
            from app.embeddings import embed_batch
            embed_batch(["  hello  ", None])

        cleaned = mock_model.encode.call_args[0][0]
        assert cleaned[0] == "hello"
        assert cleaned[1] == ""


# ---------------------------------------------------------------------------
# build_offer_text
# ---------------------------------------------------------------------------

class TestBuildOfferText:

    def test_combines_title_skills_description(self):
        from app.embeddings import build_offer_text
        result = build_offer_text(
            title="Senior Python Engineer",
            description="Développement FastAPI.",
            skills=["python", "fastapi"],
        )
        assert "Senior Python Engineer" in result
        assert "python" in result
        assert "fastapi" in result
        assert "Développement FastAPI." in result

    def test_description_truncated_to_1000_chars(self):
        from app.embeddings import build_offer_text
        long_desc = "x" * 2000
        result = build_offer_text("titre", long_desc, [])
        # description tronquée
        assert len(result) < 1100

    def test_empty_fields_no_crash(self):
        from app.embeddings import build_offer_text
        result = build_offer_text("", "", [])
        assert isinstance(result, str)
