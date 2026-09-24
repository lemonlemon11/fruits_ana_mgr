from __future__ import annotations

import os
from pathlib import Path

REPOSITORIES = {
    "fruits_ana": Path(os.getenv("FRUITS_ANA_ROOT", "/home/python/workspace/fruits_ana")),
    "fruits_ana_admin": Path(os.getenv("FRUITS_ANA_ADMIN_ROOT", "/home/python/workspace/fruits_ana_admin")),
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
