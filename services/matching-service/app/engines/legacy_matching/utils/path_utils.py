from __future__ import annotations

import re
from typing import Any


_PART_RE = re.compile(r"([^\[\]]+)|\[(\d+)\]")


def _split_path(path: str) -> list[str | int]:
    tokens: list[str | int] = []
    for part in path.split("."):
        for match in _PART_RE.finditer(part):
            key, index = match.groups()
            if key is not None:
                tokens.append(key)
            elif index is not None:
                tokens.append(int(index))
    return tokens


def get_by_path(data: dict[str, Any], path: str, default: Any = None) -> Any:
    if not path:
        return default

    current: Any = data
    for token in _split_path(path):
        if isinstance(token, int):
            if not isinstance(current, list) or token >= len(current):
                return default
            current = current[token]
            continue
        if not isinstance(current, dict):
            return default
        current = current.get(token, default)
        if current is default:
            return default
    return current
