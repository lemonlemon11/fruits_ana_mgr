# Same-Origin FastAPI Hosting Implementation Plan

> **For agentic workers:** 本计划由当前会话 inline 执行，按任务逐项验证。

**Goal:** 让项目管理台由同一个 FastAPI 进程提供静态 HTML/CSS/JavaScript 和只读 API，不再依赖 Nginx 反向代理，并将管理端代码上传到指定 Git 仓库。

**Architecture:** FastAPI 在 `53011` 提供 `/fruits-ana-mgr/` 静态入口和 `/api/*` 同源接口；前端使用绝对同源 `/api` 请求并继续使用 HttpOnly Cookie。Nginx 删除管理台专用静态与 API 代理位置；两个源项目仍只读扫描。

**Tech Stack:** Python 3.11、FastAPI、Starlette `StaticFiles`、pytest、原生 HTML/CSS/JavaScript、Git。

**Spec:** `docs/plans/2026-09-24-read-only-data-coverage.md` 中的只读数据覆盖与认证边界，以及本计划对部署拓扑的修订。

## Global Constraints

- 不向 `/home/python/workspace/fruits_ana` 或 `/home/python/workspace/fruits_ana_admin` 写入任何任务、状态或配置。
- 未登录不能读取快照和文档原文；文档读取仅限固定白名单。
- 页面和 API 必须由同一 `53011` origin 提供，不配置 CORS、不依赖代理。
- 默认账号仍为 `admin / 12345678`，支持环境变量覆盖。
- 不提交 `.env`、缓存、截图等运行产物。

## Review Focus

- 直接打开 `/fruits-ana-mgr/` 时 `./styles.css`、`./app.js` 和 `/api/*` 均解析到同一端口。
- 未登录访问 `/api/snapshot` 与 `/api/documents/*` 仍返回 401。
- 静态挂载不会吞掉 `/api` 路由，且未知路径不会读取任意本地文件。
- 删除 Nginx 管理台代理后，现有用户端 `53001` 的 `/api/` 代理行为保持不变。
- 扫描、登录和文档查看前后，两个源仓库的 `git status --short` 不发生变化。

### Task 1: FastAPI 同源静态宿主

**Files:**
- Modify: `backend/server.py`
- Test: `tests/test_server.py`

- [x] 增加 `/fruits-ana-mgr/` 的 `StaticFiles(html=True)` 挂载与根路径跳转。
- [x] 增加静态入口、CSS、JavaScript 的测试，并保留现有认证/API测试。
- [x] 运行 `python -m pytest -q tests/test_server.py`，10 项通过。

### Task 2: 前端同源 API 与动态容器收口

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`

- [x] 将 API 基址固定为当前 origin 的 `/api`，避免相对路径在子路径和直接访问场景下产生歧义。
- [x] 补齐动态渲染和文档弹窗依赖的 DOM 容器，确保登录后各观察页可以挂载真实快照。
- [x] 用静态检查确认所有脚本选择器都有对应元素，保留只读交互。

### Task 3: 部署配置与运行文档

**Files:**
- Modify: `/www/server/panel/vhost/nginx/fruits_demo_enterprise_53001.conf`
- Modify: `README.md`
- Modify: `docs/plans/2026-09-24-read-only-data-coverage.md`

- [x] 删除管理台专用 Nginx 静态位置和 `53011` 反代位置，不改现有用户端 `/api/` 代理。
- [x] 记录启动命令、访问地址、默认账号、数据覆盖范围和 HTTP/HTTPS 注意事项。
- [x] 更新旧计划中的部署拓扑，避免交接文档继续描述反向代理。

### Task 4: Git 交付与端到端验证

**Files:**
- Create: `.gitignore`
- Create/modify: Git metadata for `https://github.com/lemonlemon11/fruits_ana_mgr.git`

- [x] 忽略 Python 缓存、pytest 缓存、运行日志和本地截图。
- [x] 初始化管理端仓库，配置 `origin` 为用户提供的 Git 地址。
- [x] 运行后端测试、启动 Uvicorn，并验证静态页、未登录拦截、登录快照、文档白名单和源仓库状态。
- [x] 创建符合项目规则的 checkpoint 提交；使用机器已有的 GitHub SSH 身份推送，保留 HTTPS 拉取地址。
