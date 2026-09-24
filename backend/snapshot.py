from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from backend.config import DOCUMENT_CANDIDATES, REPOSITORIES
from backend.document_reader import read_document
from backend.git_reader import parse_git
from backend.source_parsers import parse_decisions, parse_handoff, parse_todo


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def coverage(documents: list[dict[str, Any]], git: dict[str, Any]) -> dict[str, Any]:
    available = [item["path"] for item in documents if item["readable"]]
    missing = [item["path"] for item in documents if item["required"] and not item["exists"]]
    unreadable = [item["path"] for item in documents if item["error"]]
    complete = not missing and not unreadable
    return {"completeness": "unavailable" if not git["exists"] else "complete" if complete else "partial", "expected_count": len(DOCUMENT_CANDIDATES), "available_count": len(available), "required_missing_count": len(missing), "unreadable_count": len(unreadable), "available": available, "missing": missing, "unreadable": unreadable}


def scan_repository(key: str, path: Path) -> dict[str, Any]:
    documents = [read_document(path, name) for name in DOCUMENT_CANDIDATES]
    git = parse_git(path)
    handoff = parse_handoff(path)
    todo = parse_todo(path)
    decisions = parse_decisions(path)
    errors = [f"{item['path']}: {item['error']}" for item in documents if item["error"]]
    if git["error"]:
        errors.append(f"git: {git['error']}")
    for name, source in (("HANDOFF", handoff), ("TODO", todo), ("DECISIONS", decisions)):
        if source["error"] and source.get("exists") is False:
            errors.append(f"{name}: {source['error']}")
    return {"key": key, "name": key, "path": str(path), "read_only": True, "git": git, "documents": documents, "coverage": coverage(documents, git), "handoff": handoff, "todo": todo, "decisions": decisions, "errors": errors}


def build_snapshot(repositories: dict[str, Path] | None = None) -> dict[str, Any]:
    projects = [scan_repository(key, path) for key, path in (repositories or REPOSITORIES).items()]
    documents = [item for project in projects for item in project["documents"]]
    status = {"project_count": len(projects), "projects_available": sum(project["git"]["exists"] and not project["git"]["error"] for project in projects), "open_todos": sum(project["todo"]["open"] for project in projects), "completed_todos": sum(project["todo"]["done"] for project in projects), "decision_count": sum(project["decisions"]["count"] for project in projects), "dirty_files": sum(project["git"]["status"]["total"] for project in projects), "untracked_files": sum(project["git"]["status"]["untracked"] for project in projects), "source_documents_available": sum(item["readable"] for item in documents), "source_documents_expected": len(documents), "missing_required_sources": sum(project["coverage"]["required_missing_count"] for project in projects), "error_count": sum(len(project["errors"]) for project in projects)}
    return {"generated_at": now(), "read_only": True, "status": status, "projects": projects}
