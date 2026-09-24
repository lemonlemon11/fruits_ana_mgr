# Fruits ANA Manager

Fruits ANA Manager 是一个只读的项目进度观察台，用于查看 `fruits_ana`（用户端）和
`fruits_ana_admin`（管理端）的 Git 状态、交接文档、待办、架构决策和测试记录。
它不会向两个源项目写入任务、修改文档或执行 Git 操作。

## 运行方式

管理台页面和 API 由同一个 FastAPI 进程提供，不需要 Nginx 反向代理，也不需要配置 CORS：

```bash
cd /home/python/workspace/fruits_ana_mgr
python -m pip install -r requirements.txt
python -m uvicorn backend.server:app --host 0.0.0.0 --port 53011
```

浏览器访问：

```text
http://<服务器地址>:53011/fruits-ana-mgr/
```

根路径 `/` 会跳转到管理台入口。前端使用同源 `/api/*` 请求，登录 Cookie 由 FastAPI 设置。

## 登录

默认项目经理账号：

```text
账号：admin
密码：12345678
```

部署时可通过环境变量覆盖：

```bash
FRUITS_MGR_USERNAME=admin FRUITS_MGR_PASSWORD='change-me' \
  python -m uvicorn backend.server:app --host 0.0.0.0 --port 53011
```

## 数据覆盖

- `FRUITS_ANA_ROOT`：用户端仓库路径，默认 `/home/python/workspace/fruits_ana`
- `FRUITS_ANA_ADMIN_ROOT`：管理端仓库路径，默认 `/home/python/workspace/fruits_ana_admin`
- 观察来源包括 `AGENTS.md`、`README.md`、`docs/ARCHITECTURE.md`、`docs/HANDOFF.md`、
  `docs/TODO.md` 和 `docs/DECISIONS.md`。
- 缺失或无法读取的文档会显示为“来源缺失/部分可读”，不会被当成 0 条待办或已完成。
- 文档原文接口只允许读取上述固定白名单，并且需要登录。

## 接口

- `GET /api/health`：服务健康状态
- `GET /api/session`：当前登录状态
- `POST /api/login`：登录
- `POST /api/logout`：退出
- `GET /api/snapshot`：认证后的双项目只读快照
- `GET /api/documents/{project_key}/{relative_path}`：认证后的白名单文档原文

## 验证

```bash
python -m pytest -q tests/test_server.py
```

生产或公网使用应在外层配置 HTTPS；当前 Uvicorn 示例使用 HTTP，账号和文档内容会以明文传输。
