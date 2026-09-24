from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from backend.config import HANDOFF_SECTIONS


def clean_text(value: str, limit: int = 900) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    return compact if len(compact) <= limit else f"{compact[: limit - 1]}…"


def section(text: str, names: tuple[str, ...]) -> str:
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


def empty_handoff(error: str, exists: bool = False) -> dict[str, Any]:
    return {"exists": exists, "sections": {}, "in_progress_items": [], "test_entries": [], "error": error}


def parse_handoff(repo: Path) -> dict[str, Any]:
    path = repo / "docs/HANDOFF.md"
    if not path.is_file():
        return empty_handoff("docs/HANDOFF.md 不存在")
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return empty_handoff(str(exc), exists=True)
    sections = {key: section(text, names) for key, names in HANDOFF_SECTIONS}
    tasks = []
    for line in sections["in_progress"].splitlines():
        match = re.match(r"^\s*[-*]\s+\[\s\]\s+(.+)$", line)
        if match:
            tasks.append(clean_text(match.group(1), 260))
    return {"exists": True, "sections": sections, "in_progress_items": tasks, "test_entries": parse_test_entries(sections["test_status"]), "error": None}


def parse_test_entries(section_text: str) -> list[dict[str, str]]:
    entries = []
    matches = list(re.finditer(r"^###\s+([^\n]+)\n", section_text, flags=re.M))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(section_text)
        entries.append({"title": clean_text(match.group(1), 160), "summary": section_text[match.end():end].strip()})
    return entries


def empty_todo(error: str, exists: bool = False) -> dict[str, Any]:
    return {"exists": exists, "total": 0, "open": 0, "done": 0, "by_priority": {}, "items": [], "error": error}


def parse_todo(repo: Path) -> dict[str, Any]:
    path = repo / "docs/TODO.md"
    if not path.is_file():
        return empty_todo("docs/TODO.md 不存在")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        return empty_todo(str(exc), exists=True)
    items = todo_items(lines)
    buckets = count_todos(items)
    return {"exists": True, "total": len(items), "open": sum(not item["done"] for item in items), "done": sum(item["done"] for item in items), "by_priority": buckets, "items": items, "error": None}


def todo_items(lines: list[str]) -> list[dict[str, Any]]:
    priority = "未分组"
    items = []
    for line in lines:
        heading = re.match(r"^##\s+(P[0-2]|Blocked|已阻塞)", line, re.I)
        if heading:
            priority = heading.group(1).upper()
        match = re.match(r"^[-*]\s+\[([ xX])\]\s+(.+)$", line)
        if match:
            items.append({"title": clean_text(re.sub(r"[*`]", "", match.group(2)).strip(), 260), "done": match.group(1).lower() == "x", "priority": priority})
    return items


def count_todos(items: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    buckets: dict[str, dict[str, int]] = {}
    for item in items:
        bucket = buckets.setdefault(item["priority"], {"total": 0, "open": 0, "done": 0})
        bucket["total"] += 1
        bucket["done" if item["done"] else "open"] += 1
    return buckets


def empty_decisions(error: str, exists: bool = False) -> dict[str, Any]:
    return {"exists": exists, "count": 0, "accepted": 0, "proposed": 0, "superseded": 0, "items": [], "error": error}


def parse_decisions(repo: Path) -> dict[str, Any]:
    path = repo / "docs/DECISIONS.md"
    if not path.is_file():
        return empty_decisions("docs/DECISIONS.md 不存在")
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return empty_decisions(str(exc), exists=True)
    items = decision_items(text)
    statuses = [item["status"].lower() for item in items]
    return {"exists": True, "count": len(items), "accepted": sum(value.startswith("accepted") for value in statuses), "proposed": sum(value.startswith("proposed") for value in statuses), "superseded": sum(value.startswith("superseded") for value in statuses), "items": items, "error": None}


def decision_items(text: str) -> list[dict[str, Any]]:
    chunks = re.split(r"(?=^##\s+ADR-\d+)", text, flags=re.M)
    items = []
    for chunk in chunks:
        heading = re.search(r"^##\s+(ADR-\d+)\s+[—–-]\s+(.+)$", chunk, flags=re.M)
        if not heading:
            continue
        date = re.search(r"^- Date[：:]\s*(.+)$", chunk, flags=re.M)
        status = re.search(r"^- Status[：:]\s*(.+)$", chunk, flags=re.M)
        items.append({"id": heading.group(1), "title": clean_text(heading.group(2), 220), "date": date.group(1).strip() if date else None, "status": status.group(1).strip() if status else "Unknown"})
    return items
