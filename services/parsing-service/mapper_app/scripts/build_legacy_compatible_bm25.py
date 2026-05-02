from __future__ import annotations

import pickle
from pathlib import Path
from dotenv import load_dotenv

from mapper_app.scripts.build_bm25_indexes import get_engine, fetch_entities, build_index


def write_pickle(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        pickle.dump(data, f)


def main() -> None:
    load_dotenv()
    
    output_dir = Path("./data/rtmc/bm25_indexes")
    output_dir.mkdir(parents=True, exist_ok=True)

    engine = get_engine()
    records = fetch_entities(engine)

    # Ancien mapper:
    # bm25_nodes.pkl = entités canoniques: occupation, skill, activity
    node_records = [
        r for r in records
        if r["entity_type"] in {"occupation", "skill", "activity"}
    ]

    # Ancien mapper:
    # bm25_appellations.pkl = appellations reliées à un métier
    appellation_records = [
        r for r in records
        if r["entity_type"] == "appellation"
    ]

    node_index = build_index(node_records)
    appellation_index = build_index(appellation_records)

    node_meta = []
    for doc in node_index["documents"]:
        node_meta.append(
            {
                "id": None,
                "taxonomy_type": doc["entity_type"],
                "code": doc["code"],
                "label": doc["label"],
                "normalized_label": doc["normalized_label"],
                "source_kind": doc["source_table"],
            }
        )

    appellation_meta = []
    for doc in appellation_index["documents"]:
        appellation_meta.append(
            {
                "code_appellation": doc["code"],
                "libelle_appellation": doc["label"],
                "normalized_label": doc["normalized_label"],
                "code_metier": doc["occupation_code"],
            }
        )

    write_pickle(
        output_dir / "bm25_nodes.pkl",
        {
            "bm25": node_index["bm25"],
            "meta": node_meta,
            "generator": "legacy-compatible-from-postgres-v1",
        },
    )

    write_pickle(
        output_dir / "bm25_appellations.pkl",
        {
            "bm25": appellation_index["bm25"],
            "meta": appellation_meta,
            "generator": "legacy-compatible-from-postgres-v1",
        },
    )

    print("Legacy-compatible BM25 indexes generated")
    print("bm25_nodes.pkl:", len(node_meta))
    print("bm25_appellations.pkl:", len(appellation_meta))


if __name__ == "__main__":
    main()