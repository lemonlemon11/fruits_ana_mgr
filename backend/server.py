from __future__ import annotations

import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles

from backend.project_data import (
    DOCUMENT_CANDIDATES,
    REPOSITORIES,
    _parse_handoff,
    _parse_todo,
    build_snapshot as _build_snapshot,
    read_document_text,
)

SESSION_COOKIE = "fruits_mgr_session"
SESSION_TTL = timedelta(hours=12)
DEFAULT_USERNAME = os.getenv("FRUITS_MGR_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("FRUITS_MGR_PASSWORD", "12345678")
_sessions: dict[str, datetime] = {}
_failed_logins: dict[str, tuple[int, datetime]] = {}
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_FAILURE_LIMIT = 5

app = FastAPI(title="Fruits ANA Manager", docs_url=None, redoc_url=None)
FRONTEND_ROOT = Path(__file__).resolve().parent.parent / "frontend"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


def _login_allowed(client_key: str) -> bool:
    failures, started = _failed_logins.get(client_key, (0, datetime.now(timezone.utc)))
    if datetime.now(timezone.utc) - started >= LOGIN_WINDOW:
        _failed_logins.pop(client_key, None)
        return True
    return failures < LOGIN_FAILURE_LIMIT


def _record_failed_login(client_key: str) -> None:
    failures, started = _failed_logins.get(client_key, (0, datetime.now(timezone.utc)))
    if datetime.now(timezone.utc) - started >= LOGIN_WINDOW:
        failures, started = 0, datetime.now(timezone.utc)
    _failed_logins[client_key] = (failures + 1, started)


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _session_is_valid(token: str | None) -> bool:
    if not token:
        return False
    expires_at = _sessions.get(token)
    if not expires_at:
        return False
    if expires_at <= datetime.now(timezone.utc):
        _sessions.pop(token, None)
        return False
    return True


def _require_session(token: str | None) -> None:
    if not _session_is_valid(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录项目观察台")


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
def login(payload: LoginRequest, response: Response, client_key: str = "local") -> dict[str, Any]:
    if not _login_allowed(client_key):
        raise HTTPException(status_code=429, detail="登录失败次数过多，请 15 分钟后重试")
    if not (
        hmac.compare_digest(payload.username, DEFAULT_USERNAME)
        and hmac.compare_digest(payload.password, DEFAULT_PASSWORD)
    ):
        _record_failed_login(client_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    _failed_logins.pop(client_key, None)
    token = secrets.token_urlsafe(32)
    _sessions[token] = datetime.now(timezone.utc) + SESSION_TTL
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"username": DEFAULT_USERNAME, "read_only": True, "expires_in": int(SESSION_TTL.total_seconds())}


@app.post("/api/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, fruits_mgr_session: str | None = Cookie(default=None)) -> Response:
    if fruits_mgr_session:
        _sessions.pop(fruits_mgr_session, None)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@app.get("/api/snapshot")
def snapshot(fruits_mgr_session: str | None = Cookie(default=None)) -> JSONResponse:
    _require_session(fruits_mgr_session)
    return JSONResponse(content=build_snapshot(), headers={"Cache-Control": "no-store"})


@app.get("/api/documents/{project_key}/{relative_path:path}")
def document(
    project_key: str,
    relative_path: str,
    fruits_mgr_session: str | None = Cookie(default=None),
) -> dict[str, Any]:
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
app.mount(
    "/fruits-ana-mgr",
    StaticFiles(directory=FRONTEND_ROOT, html=True),
    name="manager-frontend",
)
