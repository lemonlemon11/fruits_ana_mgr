from __future__ import annotations

import subprocess

from fastapi.testclient import TestClient

from backend import server


def _write_doc(repo, relative_path: str, content: str) -> None:
    path = repo / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_handoff_parser_only_counts_explicit_open_tasks(tmp_path):
    _write_doc(
        tmp_path,
        "docs/HANDOFF.md",
        "## In Progress\n"
        "- 实现说明，不是任务\n"
        "- [x] 已经完成\n"
        "- [ ] 第一项\n"
        "- [ ] 第二项\n"
        "## Test Status\n"
        + "".join(f"### Test {number}\n结果 {number}\n" for number in range(1, 12)),
    )

    result = server._parse_handoff(tmp_path)

    assert result["in_progress_items"] == ["第一项", "第二项"]
    assert len(result["test_entries"]) == 11
    assert result["test_entries"][-1]["title"] == "Test 11"


def test_todo_parser_returns_every_item_and_priority(tmp_path):
    rows = "\n".join(f"- [ ] 待办 {index}" for index in range(85))
    _write_doc(tmp_path, "docs/TODO.md", f"## P1 — 当前阶段\n{rows}\n")

    result = server._parse_todo(tmp_path)

    assert result["total"] == 85
    assert result["open"] == 85
    assert len(result["items"]) == 85
    assert result["items"][-1]["title"] == "待办 84"


def test_snapshot_reports_missing_management_sources_as_incomplete(tmp_path, monkeypatch):
    _write_doc(tmp_path, "README.md", "项目说明\n")
    (tmp_path / ".git").mkdir()
    monkeypatch.setattr(server, "REPOSITORIES", {"sample": tmp_path})

    snapshot = server.build_snapshot()
    source = snapshot["projects"][0]["coverage"]

    assert source["completeness"] == "partial"
    assert "docs/HANDOFF.md" in source["missing"]
    assert "README.md" in source["available"]


def test_snapshot_reads_git_without_changing_repository(tmp_path, monkeypatch):
    subprocess.run(["git", "init", str(tmp_path)], check=True, capture_output=True)
    _write_doc(tmp_path, "README.md", "read only\n")
    subprocess.run(["git", "-C", str(tmp_path), "add", "README.md"], check=True)
    subprocess.run(
        ["git", "-C", str(tmp_path), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        check=True,
        capture_output=True,
    )
    monkeypatch.setattr(server, "REPOSITORIES", {"sample": tmp_path})
    before = subprocess.run(["git", "-C", str(tmp_path), "status", "--short"], check=True, capture_output=True, text=True).stdout

    server.build_snapshot()

    after = subprocess.run(["git", "-C", str(tmp_path), "status", "--short"], check=True, capture_output=True, text=True).stdout
    assert after == before == ""


def test_snapshot_api_requires_authenticated_session():
    client = TestClient(server.app)

    assert client.get("/api/snapshot").status_code == 401
    assert client.get("/api/session").json() == {"authenticated": False}


def test_fastapi_serves_manager_ui_and_assets_from_same_origin():
    client = TestClient(server.app)

    root = client.get("/fruits-ana-mgr/")
    styles = client.get("/fruits-ana-mgr/styles.css")
    script = client.get("/fruits-ana-mgr/app.js")

    assert root.status_code == 200
    assert "项目观察台" in root.text
    assert styles.status_code == 200
    assert "--ink" in styles.text
    assert script.status_code == 200
    assert "fetch(`/api${path}`" in script.text


def test_manager_ui_keeps_git_evidence_separate_from_active_tasks():
    client = TestClient(server.app)

    page = client.get("/fruits-ana-mgr/")
    script = client.get("/fruits-ana-mgr/app.js")
    core = client.get("/fruits-ana-mgr/core.js")
    renderers = client.get("/fruits-ana-mgr/renderers.js")

    assert "Git 改动单列观察" in page.text
    assert "7 项在途" not in page.text
    assert "登录后首屏性能优化" not in page.text
    assert "changed_files.slice(0, 4).map" not in script.text
    assert "HANDOFF 明确未完成复选任务" in script.text
    assert "project.handoff.in_progress_items.slice(0, 4)" in core.text
    assert "项明确进行中" in renderers.text
    assert "个 Git 观察项" in renderers.text
    assert "HANDOFF 来源缺失，无法判断" in renderers.text
    assert "Git 工作区 / 最近提交" not in renderers.text


def test_root_redirects_to_manager_ui():
    response = TestClient(server.app).get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/fruits-ana-mgr/"


def test_default_manager_login_unlocks_snapshot_then_logout_revokes_it():
    client = TestClient(server.app)
    response = client.post("/api/login", json={"username": "admin", "password": "12345678"})

    assert response.status_code == 200
    assert response.json()["username"] == "admin"
    client.cookies.set("fruits_mgr_session", response.cookies["fruits_mgr_session"], path="/")
    assert client.get("/api/snapshot").status_code == 200
    assert client.post("/api/logout").status_code == 204
    assert client.get("/api/snapshot").status_code == 401


def test_login_rejects_wrong_password():
    client = TestClient(server.app)

    response = client.post("/api/login", json={"username": "admin", "password": "wrong"})

    assert response.status_code == 401


def test_document_endpoint_returns_full_allowlisted_source_and_rejects_unknown_path(tmp_path, monkeypatch):
    content = "## 交接\n" + "原文数据。" * 400
    _write_doc(tmp_path, "README.md", content)
    monkeypatch.setattr(server, "REPOSITORIES", {"sample": tmp_path})
    client = TestClient(server.app)
    login = client.post("/api/login", json={"username": "admin", "password": "12345678"})
    client.cookies.set("fruits_mgr_session", login.cookies["fruits_mgr_session"], path="/")

    document = client.get("/api/documents/sample/README.md")
    unknown = client.get("/api/documents/sample/.env")
    traversal = client.get("/api/documents/sample/../../etc/passwd")

    assert document.status_code == 200
    assert document.json()["content"] == content
    assert unknown.status_code == 404
    assert traversal.status_code == 404
