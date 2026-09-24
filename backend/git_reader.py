from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def run_git(repo: Path, *args: str) -> tuple[bool, str, str]:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, "", str(exc)
    return result.returncode == 0, result.stdout, result.stderr.strip()


def _empty_git_result(exists: bool) -> dict[str, Any]:
    return {
        "exists": exists,
        "branch": None,
        "upstream": None,
        "ahead": None,
        "behind": None,
        "dirty": False,
        "status": {
            "modified": 0,
            "staged": 0,
            "untracked": 0,
            "deleted": 0,
            "renamed": 0,
            "total": 0,
        },
        "changed_files": [],
        "recent_commits": [],
        "error": None,
    }


def _record_change(result: dict[str, Any], line: str) -> None:
    code = line[:2]
    if not code:
        return
    status = result["status"]
    status["total"] += 1
    if code == "??":
        status["untracked"] += 1
    else:
        status["staged"] += code[0] != " "
        status["modified"] += code[1] != " "
        status["deleted"] += "D" in code
        status["renamed"] += "R" in code
    result["changed_files"].append({"code": code, "path": line[3:]})


def _read_changes(repo: Path, result: dict[str, Any]) -> None:
    ok, status_text, error = run_git(repo, "status", "--short", "--untracked-files=normal")
    if not ok:
        result["error"] = error or "无法读取 Git 状态"
        return
    for line in status_text.splitlines():
        _record_change(result, line)
    result["dirty"] = result["status"]["total"] > 0


def _read_commits(repo: Path, result: dict[str, Any]) -> None:
    ok, log_text, error = run_git(
        repo, "log", "-8", "--date=iso", "--format=%H%x1f%h%x1f%ad%x1f%s"
    )
    if not ok:
        result["error"] = result["error"] or error or "无法读取 Git 提交"
        return
    for line in log_text.splitlines():
        parts = line.split("\x1f", 3)
        if len(parts) == 4:
            result["recent_commits"].append(
                {
                    "hash": parts[0],
                    "short_hash": parts[1],
                    "date": parts[2],
                    "subject": parts[3],
                }
            )


def parse_git(repo: Path) -> dict[str, Any]:
    result = _empty_git_result(repo.is_dir())
    if not result["exists"]:
        result["error"] = "仓库目录不存在"
        return result
    ok, _, error = run_git(repo, "rev-parse", "--is-inside-work-tree")
    if not ok:
        result["error"] = error or "不是 Git 仓库"
        return result
    ok, branch, _ = run_git(repo, "branch", "--show-current")
    result["branch"] = branch.strip() if ok else None
    ok, upstream, _ = run_git(
        repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"
    )
    result["upstream"] = upstream.strip() if ok else None
    if result["upstream"]:
        ok, counts, _ = run_git(repo, "rev-list", "--left-right", "--count", "HEAD...@{u}")
        if ok and len(counts.split()) == 2:
            result["ahead"], result["behind"] = map(int, counts.split())
    _read_changes(repo, result)
    _read_commits(repo, result)
    return result
