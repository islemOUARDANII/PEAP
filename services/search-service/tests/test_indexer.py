"""
Tests unitaires du pipeline de sync (indexer.py).

Vérifie :
  - Le checkpoint est lu/écrit correctement
  - bulk_sync_offers appelle pg_reader + embed_batch + bulk_index
  - incremental_sync passe le bon `since` à chaque sync
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

from tests.conftest import FAKE_OFFER, FAKE_VECTOR


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_SINCE = datetime(2024, 1, 1, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def tmp_state_file(tmp_path, monkeypatch):
    """Redirige STATE_FILE vers un fichier temporaire pour chaque test."""
    state_path = tmp_path / "sync_state.json"
    monkeypatch.setattr("app.sync.indexer.STATE_FILE", state_path)
    return state_path


# ---------------------------------------------------------------------------
# Checkpoint
# ---------------------------------------------------------------------------

class TestCheckpoint:

    def test_no_state_file_returns_none(self):
        from app.sync.indexer import _get_last_sync
        assert _get_last_sync("offers") is None

    def test_saved_timestamp_is_restored(self, tmp_state_file):
        from app.sync.indexer import _get_last_sync, _set_last_sync
        _set_last_sync("offers")
        result = _get_last_sync("offers")
        assert isinstance(result, datetime)
        assert result.tzinfo is not None

    def test_multiple_keys_independent(self, tmp_state_file):
        from app.sync.indexer import _get_last_sync, _set_last_sync
        _set_last_sync("offers")
        assert _get_last_sync("candidates") is None
        _set_last_sync("candidates")
        assert _get_last_sync("offers") is not None
        assert _get_last_sync("candidates") is not None


# ---------------------------------------------------------------------------
# bulk_sync_offers
# ---------------------------------------------------------------------------

class TestBulkSyncOffers:

    def test_calls_embed_batch_and_bulk_index(self):
        fake_doc = {**FAKE_OFFER}
        fake_batch = [fake_doc]

        with (
            patch("app.sync.indexer.fetch_offers", return_value=iter([fake_batch])),
            patch("app.sync.indexer.embed_batch", return_value=[FAKE_VECTOR]) as mock_embed,
            patch("app.sync.indexer.bulk_index", return_value=(1, [])) as mock_bulk,
        ):
            from app.sync.indexer import bulk_sync_offers
            total = bulk_sync_offers(since=None)

        assert total == 1
        mock_embed.assert_called_once()
        mock_bulk.assert_called_once()

    def test_embedding_attached_to_doc(self):
        """Chaque doc doit avoir un champ `embedding` après enrichissement."""
        fake_doc = {**FAKE_OFFER}

        with (
            patch("app.sync.indexer.fetch_offers", return_value=iter([[fake_doc]])),
            patch("app.sync.indexer.embed_batch", return_value=[FAKE_VECTOR]),
            patch("app.sync.indexer.bulk_index", return_value=(1, [])) as mock_bulk,
        ):
            from app.sync.indexer import bulk_sync_offers
            bulk_sync_offers()

        indexed_docs = mock_bulk.call_args[0][1]
        assert "embedding" in indexed_docs[0]
        assert indexed_docs[0]["embedding"] == FAKE_VECTOR

    def test_since_passed_to_pg_reader(self):
        with (
            patch("app.sync.indexer.fetch_offers", return_value=iter([])) as mock_fetch,
            patch("app.sync.indexer.embed_batch", return_value=[]),
            patch("app.sync.indexer.bulk_index", return_value=(0, [])),
        ):
            from app.sync.indexer import bulk_sync_offers
            bulk_sync_offers(since=FAKE_SINCE)

        mock_fetch.assert_called_once_with(since=FAKE_SINCE, batch_size=500)

    def test_multiple_batches_total_count(self):
        batch1 = [{**FAKE_OFFER, "_id": "a", "offer_id": "a"}]
        batch2 = [{**FAKE_OFFER, "_id": "b", "offer_id": "b"}]

        with (
            patch("app.sync.indexer.fetch_offers", return_value=iter([batch1, batch2])),
            patch("app.sync.indexer.embed_batch", return_value=[FAKE_VECTOR]),
            patch("app.sync.indexer.bulk_index", return_value=(1, [])),
        ):
            from app.sync.indexer import bulk_sync_offers
            total = bulk_sync_offers()

        assert total == 2


# ---------------------------------------------------------------------------
# incremental_sync
# ---------------------------------------------------------------------------

class TestIncrementalSync:

    def test_uses_checkpoint_as_since(self, tmp_state_file):
        """incremental_sync doit lire le checkpoint et le passer à bulk_sync_*."""
        state = {
            "offers": FAKE_SINCE.isoformat(),
            "candidates": FAKE_SINCE.isoformat(),
        }
        tmp_state_file.write_text(json.dumps(state))

        with (
            patch("app.sync.indexer.bulk_sync_offers", return_value=0) as mock_offers,
            patch("app.sync.indexer.bulk_sync_candidates", return_value=0) as mock_candidates,
        ):
            from app.sync.indexer import incremental_sync
            incremental_sync()

        mock_offers.assert_called_once_with(since=FAKE_SINCE)
        mock_candidates.assert_called_once_with(since=FAKE_SINCE)

    def test_checkpoint_updated_after_sync(self, tmp_state_file):
        with (
            patch("app.sync.indexer.bulk_sync_offers", return_value=5),
            patch("app.sync.indexer.bulk_sync_candidates", return_value=3),
        ):
            from app.sync.indexer import incremental_sync, _get_last_sync
            incremental_sync()

        assert _get_last_sync("offers") is not None
        assert _get_last_sync("candidates") is not None
