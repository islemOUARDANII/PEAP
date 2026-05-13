"""Loaders du fichier RTMC.xlsx — lecture seule, pas d'effets de bord."""

import pandas as pd

from mapper_app.config import settings


def load_nodes(core_only: bool = True) -> pd.DataFrame:
    """
    Charge preview_nodes.
    core_only=True filtre include_in_core_load == True (12 941 → occupation + skill).
    Retourne les colonnes utiles au mapper.
    """
    df = pd.read_excel(
        settings.rtmc_xlsx_full_path,
        sheet_name="preview_nodes",
        usecols=[
            "include_in_core_load",
            "taxonomy_type",
            "code",
            "label",
            "parent_code",
            "depth",
            "is_leaf",
            "is_deprecated",
            "source_kind",
        ],
    )
    if core_only:
        df = df[df["include_in_core_load"] == True]  # noqa: E712
    return df.reset_index(drop=True)


def load_appellations(actif_only: bool = True) -> pd.DataFrame:
    """
    Charge preview_appellations (synonymes / intitulés alternatifs des métiers).
    actif_only=True garde seulement actif == 'O' (8 277 lignes).
    """
    df = pd.read_excel(
        settings.rtmc_xlsx_full_path,
        sheet_name="preview_appellations",
        usecols=[
            "code_appellation",
            "libelle_appellation",
            "code_metier",
            "actif",
        ],
    )
    if actif_only:
        df = df[df["actif"] == "O"]
    return df.reset_index(drop=True)


def load_relations(core_only: bool = True) -> pd.DataFrame:
    """
    Charge preview_relations.
    core_only=True filtre include_in_core_load == True (23 614 relations core).
    """
    df = pd.read_excel(
        settings.rtmc_xlsx_full_path,
        sheet_name="preview_relations",
        usecols=[
            "include_in_core_load",
            "src_taxonomy_type",
            "src_code",
            "relation_type",
            "dst_taxonomy_type",
            "dst_code",
            "score_forward",
            "score_backward",
        ],
    )
    if core_only:
        df = df[df["include_in_core_load"] == True]  # noqa: E712
    return df.reset_index(drop=True)
