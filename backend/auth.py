from __future__ import annotations

import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from pydantic import BaseModel, Field

SESSION_COOKIE = "fruits_mgr_session"
SESSION_TTL = timedelta(hours=12)
DEFAULT_USERNAME = os.getenv("FRUITS_MGR_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("FRUITS_MGR_PASSWORD", "12345678")
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_FAILURE_LIMIT = 5
_sessions: dict[str, datetime] = {}
_failed_logins: dict[str, tuple[int, datetime]] = {}


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


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


def session_is_valid(token: str | None) -> bool:
    if not token:
        return False
    expires_at = _sessions.get(token)
    if not expires_at:
        return False
    if expires_at <= datetime.now(timezone.utc):
        _sessions.pop(token, None)
        return False
    return True


def require_session(token: str | None) -> None:
    if not session_is_valid(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录项目观察台")


def login_user(payload: LoginRequest, response: Response, client_key: str = "local") -> dict[str, int | str | bool]:
    if not _login_allowed(client_key):
        raise HTTPException(status_code=429, detail="登录失败次数过多，请 15 分钟后重试")
    if not (hmac.compare_digest(payload.username, DEFAULT_USERNAME) and hmac.compare_digest(payload.password, DEFAULT_PASSWORD)):
        _record_failed_login(client_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    _failed_logins.pop(client_key, None)
    token = secrets.token_urlsafe(32)
    _sessions[token] = datetime.now(timezone.utc) + SESSION_TTL
    response.set_cookie(SESSION_COOKIE, token, max_age=int(SESSION_TTL.total_seconds()), httponly=True, samesite="lax", secure=False, path="/")
    return {"username": DEFAULT_USERNAME, "read_only": True, "expires_in": int(SESSION_TTL.total_seconds())}


def logout_user(response: Response, token: str | None) -> Response:
    if token:
        _sessions.pop(token, None)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
