from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.git_reader import parse_git


REPOSITORIES = {
    "fruits_ana": Path(os.getenv("FRUITS_ANA_ROOT", "/home/python/workspace/fruits_ana")),
    "fruits_ana_admin": Path(
        os.getenv("FRUITS_ANA_ADMIN_ROOT", "/home/python/workspace/fruits_ana_admin")
    ),
}
DOCUMENT_CANDIDATES = (
    "AGENTS.md",
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/HANDOFF.md",
    "docs/TODO.md",
    "docs/DECISIONS.md",
)
REQUIRED_DOCUMENTS = {"README.md", "docs/ARCHITECTURE.md", "docs/HANDOFF.md", "docs/TODO.md", "docs/DECISIONS.md"}
HANDOFF_SECTIONS = (
    ("current_goal", ("Current Goal", "当前目标")),
    ("current_status", ("Current Status", "当前状态")),
    ("in_progress", ("In Progress", "进行中")),
    ("next_steps", ("Next Steps", "下一步")),
    ("known_issues", ("Known Issues", "已知问题")),
    ("test_status", ("Test Status", "测试状态")),
)


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _clean_text(value: str, limit: int = 900) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    return compact if len(compact) <= limit else f"{compact[: limit - 1]}…"


def _safe_repo_file(repo: Path, relative_path: str) -> Path:
    root = repo.resolve()
    candidate = (root / relative_path).resolve()
    candidate.relative_to(root)
    return candidate


def read_document(repo: Path, relative_path: str) -> dict[str, Any]:
    item: dict[str, Any] = {
        "path": relative_path,
        "required": relative_path in REQUIRED_DOCUMENTS,
        "exists": False,
        "readable": False,
        "line_count": 0,
        "size_bytes": 0,
        "modified_at": None,
        "error": None,
    }
    try:
        path = _safe_repo_file(repo, relative_path)
        if not path.is_file():
            return item
        stat = path.stat()
        text = path.read_text(encoding="utf-8")
        item.update(
            exists=True,
            readable=True,
            line_count=len(text.splitlines()),
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(
                timespec="seconds"
            ),
        )
    except (OSError, UnicodeError, ValueError) as exc:
        item["error"] = str(exc)
    return item


def read_document_text(repo: Path, relative_path: str, max_bytes: int = 1_000_000) -> str:
    path = _safe_repo_file(repo, relative_path)
    if not path.is_file():
        raise FileNotFoundError(relative_path)
    if path.stat().st_size > max_bytes:
        raise OverflowError(relative_path)
    return path.read_text(encoding="utf-8")


def _section(text: str, names: tuple[str, ...]) -> str:
    lines = text.splitlines()
    start = None
    section_level = 2
    for index, line in enumerate(lines):
        heading = re.match(r"^(#{1,3})\s+", line)
        if heading and any(name.casefold() in line.casefold() for name in names):
            start = index + 1
            section_level = len(heading.group(1))
            break
    if start is None:
        return ""
    end = len(lines)
    for index in range(start, len(lines)):
        heading = re.match(r"^(#{1,3})\s+", lines[index])
        if heading and len(heading.group(1)) <= section_level:
            end = index
            break
    return "\n".join(lines[start:end]).strip()


def _parse_handoff(repo: Path) -> dict[str, Any]:
    path = repo / "docs/HANDOFF.md"
    if not path.is_file():
        return _empty_handoff("docs/HANDOFF.md 不存在")
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return _empty_handoff(str(exc), exists=True)
    sections = {key: _section(text, names) for key, names in HANDOFF_SECTIONS}
    in_progress_items = []
    for line in sections["in_progress"].splitlines():
        match = re.match(r"^\s*[-*]\s+(.+)$", line)
        if match:
            in_progress_items.append(_clean_text(match.group(1), 260))
    test_entries = _parse_test_entries(sections["test_status"])
    return {
        "exists": True,
        "sections": sections,
        "in_progress_items": in_progress_items,
        "test_entries": test_entries,
        "error": None,
    }


def _empty_handoff(error: str, exists: bool = False) -> dict[str, Any]:
    return {
        "exists": exists,
        "sections": {},
        "in_progress_items": [],
        "test_entries": [],
        "error": error,
    }


def _parse_test_entries(section: str) -> list[dict[str, str]]:
    entries = []
    matches = list(re.finditer(r"^###\s+([^\n]+)\n", section, flags=re.M))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        body = section[match.end():end].strip()
        entries.append({"title": _clean_text(match.group(1), 160), "summary": body})
    return entries


def _parse_todo(repo: Path) -> dict[str, Any]:
    path = repo / "docs/TODO.md"
    if not path.is_file():
        return _empty_todo("docs/TODO.md 不存在")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        return _empty_todo(str(exc), exists=True)
    items = _todo_items(lines)
    by_priority = _count_todos(items)
    return {
        "exists": True,
        "total": len(items),
        "open": sum(not item["done"] for item in items),
        "done": sum(item["done"] for item in items),
        "by_priority": by_priority,
        "items": items,
        "error": None,
    }


def _empty_todo(error: str, exists: bool = False) -> dict[str, Any]:
    return {"exists": exists, "total": 0, "open": 0, "done": 0, "by_priority": {}, "items": [], "error": error}


def _todo_items(lines: list[str]) -> list[dict[str, Any]]:
    priority = "未分组"
    items = []
    for line in lines:
        heading = re.match(r"^##\s+(P[0-2]|Blocked|已阻塞)", line, re.I)
        if heading:
            priority = heading.group(1).upper()
        match = re.match(r"^[-*]\s+\[([ xX])\]\s+(.+)$", line)
        if match:
            items.append({
                "title": _clean_text(re.sub(r"[*`]", "", match.group(2)).strip(), 260),
                "done": match.group(1).lower() == "x",
                "priority": priority,
            })
    return items


def _count_todos(items: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    buckets: dict[str, dict[str, int]] = {}
    for item in items:
        bucket = buckets.setdefault(item["priority"], {"total": 0, "open": 0, "done": 0})
        bucket["total"] += 1
        bucket["done" if item["done"] else "open"] += 1
    return buckets


def _parse_decisions(repo: Path) -> dict[str, Any]:
    path = repo / "docs/DECISIONS.md"
    if not path.is_file():
        return _empty_decisions("docs/DECISIONS.md 不存在")
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return _empty_decisions(str(exc), exists=True)
    items = _decision_items(text)
    statuses = [item["status"].lower() for item in items]
    return {
        "exists": True,
        "count": len(items),
        "accepted": sum(value.startswith("accepted") for value in statuses),
        "proposed": sum(value.startswith("proposed") for value in statuses),
        "superseded": sum(value.startswith("superseded") for value in statuses),
        "items": items,
        "error": None,
    }


def _empty_decisions(error: str, exists: bool = False) -> dict[str, Any]:
    return {"exists": exists, "count": 0, "accepted": 0, "proposed": 0, "superseded": 0, "items": [], "error": error}


def _decision_items(text: str) -> list[dict[str, Any]]:
    chunks = re.split(r"(?=^##\s+ADR-\d+)", text, flags=re.M)
    items = []
    for chunk in chunks:
        heading = re.search(r"^##\s+(ADR-\d+)\s+[—–-]\s+(.+)$", chunk, flags=re.M)
        if not heading:
            continue
        date = re.search(r"^- Date[：:]\s*(.+)$", chunk, flags=re.M)
        status = re.search(r"^- Status[：:]\s*(.+)$", chunk, flags=re.M)
        items.append({
            "id": heading.group(1),
            "title": _clean_text(heading.group(2), 220),
            "date": date.group(1).strip() if date else None,
            "status": status.group(1).strip() if status else "Unknown",
        })
    return items


def _coverage(documents: list[dict[str, Any]], git: dict[str, Any]) -> dict[str, Any]:
    available = [item["path"] for item in documents if item["readable"]]
    missing = [item["path"] for item in documents if item["required"] and not item["exists"]]
    unreadable = [item["path"] for item in documents if item["error"]]
    return {
        "completeness": "unavailable" if not git["exists"] else "complete" if not missing and not unreadable else "partial",
        "expected_count": len(DOCUMENT_CANDIDATES),
        "available_count": len(available),
        "required_missing_count": len(missing),
        "unreadable_count": len(unreadable),
        "available": available,
        "missing": missing,
        "unreadable": unreadable,
    }


def _scan_repository(key: str, path: Path) -> dict[str, Any]:
    documents = [read_document(path, name) for name in DOCUMENT_CANDIDATES]
    git = parse_git(path)
    handoff = _parse_handoff(path)
    todo = _parse_todo(path)
    decisions = _parse_decisions(path)
    errors = [f"{item['path']}: {item['error']}" for item in documents if item["error"]]
    if git["error"]:
        errors.append(f"git: {git['error']}")
    for name, source in (("HANDOFF", handoff), ("TODO", todo), ("DECISIONS", decisions)):
        if source["error"] and source.get("exists") is False:
            errors.append(f"{name}: {source['error']}")
    return {
        "key": key,
        "name": key,
        "path": str(path),
        "read_only": True,
        "git": git,
        "documents": documents,
        "coverage": _coverage(documents, git),
        "handoff": handoff,
        "todo": todo,
        "decisions": decisions,
        "errors": errors,
    }


def build_snapshot(repositories: dict[str, Path] | None = None) -> dict[str, Any]:
    projects = [_scan_repository(key, path) for key, path in (repositories or REPOSITORIES).items()]
    documents = [item for project in projects for item in project["documents"]]
    status = {
        "project_count": len(projects),
        "projects_available": sum(project["git"]["exists"] and not project["git"]["error"] for project in projects),
        "open_todos": sum(project["todo"]["open"] for project in projects),
        "completed_todos": sum(project["todo"]["done"] for project in projects),
        "decision_count": sum(project["decisions"]["count"] for project in projects),
        "dirty_files": sum(project["git"]["status"]["total"] for project in projects),
        "untracked_files": sum(project["git"]["status"]["untracked"] for project in projects),
        "source_documents_available": sum(item["readable"] for item in documents),
        "source_documents_expected": len(documents),
        "missing_required_sources": sum(project["coverage"]["required_missing_count"] for project in projects),
        "error_count": sum(len(project["errors"]) for project in projects),
    }
    return {"generated_at": _now(), "read_only": True, "status": status, "projects": projects}
