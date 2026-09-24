"""Compatibility exports for the read-only project data pipeline.

The implementation is split by responsibility; this module keeps the original
imports stable for the API layer and existing tests.
"""

from backend.config import DOCUMENT_CANDIDATES, HANDOFF_SECTIONS, REQUIRED_DOCUMENTS, REPOSITORIES
from backend.document_reader import read_document, read_document_text, safe_repo_file
from backend.snapshot import build_snapshot as _build_snapshot, coverage, now, scan_repository
from backend.source_parsers import (
    clean_text,
    count_todos,
    decision_items,
    empty_decisions,
    empty_handoff,
    empty_todo,
    parse_decisions,
    parse_handoff,
    parse_test_entries,
    parse_todo,
    section,
    todo_items,
)

# Keep private parser names available to callers that used the original module.
_clean_text = clean_text
_count_todos = count_todos
_decision_items = decision_items
_empty_decisions = empty_decisions
_empty_handoff = empty_handoff
_empty_todo = empty_todo
_parse_decisions = parse_decisions
_parse_handoff = parse_handoff
_parse_test_entries = parse_test_entries
_parse_todo = parse_todo
_section = section
_todo_items = todo_items
_coverage = coverage
_scan_repository = scan_repository
_safe_repo_file = safe_repo_file
_now = now


def build_snapshot(repositories=None):
    """Preserve the original module-level repository override seam."""
    return _build_snapshot(repositories or REPOSITORIES)

__all__ = [
    "DOCUMENT_CANDIDATES", "HANDOFF_SECTIONS", "REQUIRED_DOCUMENTS", "REPOSITORIES",
    "build_snapshot", "read_document", "read_document_text",
    "_parse_decisions", "_parse_handoff", "_parse_todo",
]
