from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.staticfiles import StaticFiles

from backend.auth import (
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    SESSION_COOKIE,
    SESSION_TTL,
    LOGIN_FAILURE_LIMIT,
    LOGIN_WINDOW,
    LoginRequest,
    _failed_logins,
    _login_allowed,
    _record_failed_login,
    _sessions,
    login_user,
    logout_user,
    now as _now,
    require_session as _require_session,
    session_is_valid as _session_is_valid,
)
from backend.project_data import (
    DOCUMENT_CANDIDATES,
    REPOSITORIES,
    _parse_handoff,
    _parse_todo,
    build_snapshot as _build_snapshot,
    read_document_text,
)

app = FastAPI(title="Fruits ANA Manager", docs_url=None, redoc_url=None)
FRONTEND_ROOT = Path(__file__).resolve().parent.parent / "frontend"


def build_snapshot() -> dict[str, Any]:
    return _build_snapshot(REPOSITORIES)


@app.get("/", include_in_schema=False)
def manager_root() -> RedirectResponse:
    return RedirectResponse(url="/fruits-ana-mgr/", status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "read_only": True, "service": "fruits-ana-manager", "generated_at": _now()}


@app.get("/api/session")
def session_status(fruits_mgr_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    authenticated = _session_is_valid(fruits_mgr_session)
    return {"authenticated": authenticated, **({"username": DEFAULT_USERNAME} if authenticated else {})}


@app.post("/api/login")
def login(payload: LoginRequest, response: Response, client_key: str = "local") -> dict[str, int | str | bool]:
    return login_user(payload, response, client_key)


@app.post("/api/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, fruits_mgr_session: str | None = Cookie(default=None)) -> Response:
    return logout_user(response, fruits_mgr_session)


@app.get("/api/snapshot")
def snapshot(fruits_mgr_session: str | None = Cookie(default=None)) -> JSONResponse:
    _require_session(fruits_mgr_session)
    return JSONResponse(content=build_snapshot(), headers={"Cache-Control": "no-store"})


@app.get("/api/documents/{project_key}/{relative_path:path}")
def document(project_key: str, relative_path: str, fruits_mgr_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    _require_session(fruits_mgr_session)
    repo = REPOSITORIES.get(project_key)
    if repo is None or relative_path not in DOCUMENT_CANDIDATES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档不在只读白名单中")
    try:
        content = read_document_text(repo, relative_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在") from None
    except (OSError, UnicodeError, OverflowError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="文档无法读取") from None
    return {"project": project_key, "path": relative_path, "content": content, "read_only": True}


# The UI and API share this FastAPI origin; no reverse proxy or CORS setup is required.
app.mount("/fruits-ana-mgr", StaticFiles(directory=FRONTEND_ROOT, html=True), name="manager-frontend")
