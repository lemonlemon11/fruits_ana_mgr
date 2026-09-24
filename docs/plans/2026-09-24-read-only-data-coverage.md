# 只读项目数据覆盖与观察台实施计划

> **For agentic workers:** 本计划由当前会话 inline 执行，按任务逐项验证。

**Goal:** 在不写入两个源仓库的前提下，提供受保护、可核验的项目进度快照，并明确展示数据覆盖缺口。

**Architecture:** FastAPI 在 `53011` 同时提供管理台静态页面和 API；认证后读取固定白名单仓库的 Git 与项目文档。静态页面登录后请求同源快照，动态呈现项目状态、待办、提交、决策、测试证据与数据源完整性；原文接口只开放白名单文件。

**Tech Stack:** Python 3.11、FastAPI、pytest、原生 HTML/CSS/JavaScript、Nginx。

---

### Task 1: 锁定读取契约与认证边界

**Files:** `tests/test_server.py`, `server.py`, `project_data.py`, `git_reader.py`

- [ ] 测试章节保留换行、任务与测试记录完整解析、Git 改动文件明细、文档覆盖状态。
- [ ] 测试未登录不能读取快照/原文；admin 默认凭据可登录；路径白名单拒绝任意文件。
- [ ] 测试扫描快照前后源仓库状态不变。

### Task 2: 接入真实只读数据与登录 API

**Files:** `server.py`, `project_data.py`, `git_reader.py`

- [ ] 只读解析并明确缺失/不可读来源，不把未知内容伪装成零或已完成。
- [ ] 增加签名 HttpOnly 会话 Cookie、登录/会话/退出接口、鉴权快照与白名单原文接口。
- [ ] 运行定向测试，修复解析和认证边界。

### Task 3: 替换静态示例为动态观察台

**Files:** `index.html`, `app.js`, `styles.css`

- [ ] 增加登录、退出、加载与错误状态。
- [ ] 动态显示概览、进行中、待办、提交、ADR、测试证据、数据覆盖与原文查看。
- [ ] 确认没有任务新增/编辑/删除控件，桌面与手机布局正常。

### Task 4: 部署与端到端核验

**Files:** `README.md`, `/www/server/panel/vhost/nginx/fruits_demo_enterprise_53001.conf`

- [ ] 文档说明数据范围、缺失来源、默认凭据覆盖方式、HTTP 风险与启动方式。
- [ ] API 与静态页面由同一 FastAPI `53011` origin 提供；不配置管理台 Nginx 反向代理，不占用现有 `53001` `/api/`。
- [ ] 实测未认证拒绝、认证后真实数据、原文读取、缺失文档展示、桌面/移动端，以及源仓库状态未变化。
