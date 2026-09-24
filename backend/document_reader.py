from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from backend.config import REQUIRED_DOCUMENTS


def safe_repo_file(repo: Path, relative_path: str) -> Path:
    root = repo.resolve()
    candidate = (root / relative_path).resolve()
    candidate.relative_to(root)
    return candidate


def read_document(repo: Path, relative_path: str) -> dict[str, Any]:
    item: dict[str, Any] = {"path": relative_path, "required": relative_path in REQUIRED_DOCUMENTS, "exists": False, "readable": False, "line_count": 0, "size_bytes": 0, "modified_at": None, "error": None}
    try:
        path = safe_repo_file(repo, relative_path)
        if not path.is_file():
            return item
        stat = path.stat()
        text = path.read_text(encoding="utf-8")
        item.update(exists=True, readable=True, line_count=len(text.splitlines()), size_bytes=stat.st_size, modified_at=datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"))
    except (OSError, UnicodeError, ValueError) as exc:
        item["error"] = str(exc)
    return item


def read_document_text(repo: Path, relative_path: str, max_bytes: int = 1_000_000) -> str:
    path = safe_repo_file(repo, relative_path)
    if not path.is_file():
        raise FileNotFoundError(relative_path)
    if path.stat().st_size > max_bytes:
        raise OverflowError(relative_path)
    return path.read_text(encoding="utf-8")
