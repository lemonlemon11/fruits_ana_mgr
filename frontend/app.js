const viewMeta = {
  overview: ['PROJECT PULSE / OVERVIEW', '今天，先看这三件事'],
  active: ['LIVE WORK / ACTIVE', '正在进行的工作'],
  backlog: ['ROADMAP / BACKLOG', '后面还有什么要做'],
  completed: ['DELIVERY / COMPLETED', '已经完成了什么'],
  decisions: ['CONTEXT / DECISIONS', '为什么要这样做'],
  quality: ['EVIDENCE / QUALITY', '完成必须有验证证据'],
  meeting: ['FACILITATOR / REVIEW', '主持一场只谈证据的会'],
}

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const api = (path, options = {}) => fetch(`/api${path}`, { credentials: 'same-origin', ...options })
let snapshot = null
let toastTimer

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]))
}

function setText(selector, value) {
  const element = $(selector)
  if (element) element.textContent = value
}

function showView(view) {
  const meta = viewMeta[view]
  if (!meta) return
  $$('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view))
  $$('[data-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view))
  setText('#view-kicker', meta[0])
  setText('#view-title', meta[1])
  window.scrollTo({ top: 0, behavior: 'smooth' })
  $('#main-content')?.focus({ preventScroll: true })
}

function formatTime(value) {
  if (!value) return '未记录'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function projectLabel(project) {
  return project.key === 'fruits_ana' ? '用户端' : '管理端'
}

function stateLabel(project) {
  if (project.errors.length) return ['数据缺口', 'is-risk']
  if (project.git.dirty) return ['工作区有改动', 'is-risk']
  return ['主干干净', 'is-stable']
}

function projectTasks(project) {
  const tasks = project.handoff.in_progress_items.slice(0, 4)
  if (!tasks.length && project.git.changed_files.length) {
    return project.git.changed_files.slice(0, 4).map((item) => `工作区文件：${item.path}`)
  }
  if (!tasks.length && project.git.recent_commits.length) return [`最近提交：${project.git.recent_commits[0].subject}`]
  return tasks
}

function renderProject(project, prefix) {
  const [state, stateClass] = stateLabel(project)
  setText(`#${prefix}-project-branch`, `${project.git.branch || '无分支'} · ${project.git.dirty ? `${project.git.status.total} 个工作区改动` : '工作区干净'}`)
  const stateElement = $(`#${prefix}-project-state`)
  if (stateElement) {
    stateElement.textContent = state
    stateElement.className = `project-state ${stateClass}`
  }
  const focus = project.handoff.sections?.current_goal || project.git.recent_commits[0]?.subject || '源项目未提供当前目标记录'
  setText(`#${prefix}-project-focus`, focus)
  setText(`#${prefix}-project-files`, `${project.git.status.total} 个 Git 改动 · ${project.coverage.available_count}/${project.coverage.expected_count} 个来源可读`)
  setText(`#${prefix}-project-commit`, project.git.recent_commits[0] ? `${project.git.recent_commits[0].short_hash} · ${formatTime(project.git.recent_commits[0].date)}` : '暂无提交记录')
  const list = $(`.project-${prefix === 'user' ? 'user' : 'admin'} .task-lines`)
  if (list) list.innerHTML = projectTasks(project).map((task, index) => `<li><span class="task-status ${index === 0 ? 'is-working' : 'is-review'}"></span><p><strong>${escapeHtml(task)}</strong><small>${escapeHtml(project.key)} · 只读来源</small></p><b>${index === 0 ? '进行中' : '观察项'}</b></li>`).join('') || '<li class="empty-row">没有当前进行中记录</li>'
}

function renderOverview() {
  const { status, projects } = snapshot
  const user = projects.find((project) => project.key === 'fruits_ana')
  const admin = projects.find((project) => project.key === 'fruits_ana_admin')
  setText('#last-scan', formatTime(snapshot.generated_at))
  setText('#source-status-label', status.error_count ? '只读观察 · 有缺口' : '只读观察 · 已连接')
  setText('#source-status-detail', `${status.projects_available}/${status.project_count} 个仓库可读取 · ${status.source_documents_available}/${status.source_documents_expected} 个来源可读`)
  setText('#source-user-detail', user ? `${user.git.branch || '无分支'} · ${user.coverage.completeness === 'complete' ? '来源完整' : '来源不完整'}` : '未找到')
  setText('#source-admin-detail', admin ? `${admin.git.branch || '无分支'} · ${admin.coverage.completeness === 'complete' ? '来源完整' : '来源不完整'}` : '未找到')
  setText('#summary-active', projects.reduce((total, project) => total + project.handoff.in_progress_items.length, 0))
  setText('#summary-active-detail', 'HANDOFF 当前进行中条目')
  setText('#summary-backlog', status.open_todos)
  setText('#summary-backlog-detail', 'TODO 未完成；缺失文档不计为 0')
  setText('#summary-questions', status.missing_required_sources + status.error_count)
  setText('#summary-questions-detail', '来源缺口或扫描错误')
  setText('#summary-quality', projects.reduce((total, project) => total + project.handoff.test_entries.length, 0))
  setText('#summary-quality-detail', 'HANDOFF 测试记录条目')
  setText('#nav-active-count', projects.reduce((total, project) => total + project.handoff.in_progress_items.length, 0))
  setText('#nav-backlog-count', status.open_todos)
  setText('#nav-decisions-count', status.decision_count)
  setText('#signal-work-title', `${status.dirty_files} 个工作区改动等待收口`)
  setText('#signal-work-detail', `${status.untracked_files} 个未跟踪文件；状态来自 Git 只读扫描。`)
  setText('#signal-source-title', `${status.source_documents_available}/${status.source_documents_expected} 个来源已读`)
  setText('#signal-source-detail', status.missing_required_sources ? '缺失来源已显式列出，管理端没有进度文档记录。' : '两个仓库的必需观察来源均可读取。')
  setText('#signal-next-title', `${status.open_todos} 项待办来自源项目`)
  setText('#signal-next-detail', '待办只读展示，新增/修改/删除回到源项目完成。')
  if (user) renderProject(user, 'user')
  if (admin) renderProject(admin, 'admin')
  const coverage = $('#coverage-grid')
  if (coverage) coverage.innerHTML = projects.map((project) => `<article class="coverage-card"><header><div><span class="project-code">${project.key === 'fruits_ana' ? 'U' : 'A'}</span><strong>${project.key}</strong></div><b class="${project.coverage.completeness === 'complete' ? 'coverage-ok' : 'coverage-warn'}">${project.coverage.completeness === 'complete' ? '来源完整' : '部分可读'}</b></header><p>${project.coverage.available_count}/${project.coverage.expected_count} 个观察来源可读，${project.coverage.required_missing_count} 个必需来源缺失。</p><div class="coverage-files">${project.documents.map((document) => `<button type="button" class="document-link ${document.readable ? '' : 'is-missing'}" data-project="${project.key}" data-document="${document.path}" ${document.readable ? '' : 'disabled'}>${document.readable ? '查看' : '缺失'} · ${document.path}</button>`).join('')}</div></article>`).join('')
  $$('.document-link').forEach((button) => button.addEventListener('click', () => openDocument(button.dataset.project, button.dataset.document)))
  setText('#coverage-total', `${status.source_documents_available}/${status.source_documents_expected} 可读`)
  setText('#evidence-todo', `TODO · ${status.open_todos} 未完成 / ${status.completed_todos} 已完成`)
  setText('#evidence-handoff', `HANDOFF · ${projects.reduce((sum, project) => sum + project.handoff.in_progress_items.length, 0)} 项进行中`)
  setText('#evidence-git', `Git · ${status.dirty_files} 个改动`)
  setText('#evidence-tests', `Tests · ${projects.reduce((sum, project) => sum + project.handoff.test_entries.length, 0)} 条记录`)
  setText('#evidence-decisions', `ADR · ${status.decision_count} 条索引`)
}

function renderActive() {
  const container = $('[data-panel="active"] .work-columns')
  if (!container) return
  setText('#active-total', `${snapshot.status.open_todos} 项待办 · ${snapshot.status.dirty_files} 个工作区改动`)
  container.innerHTML = snapshot.projects.map((project) => {
    const tasks = projectTasks(project)
    return `<section class="work-column"><header><div><span class="project-code">${project.key === 'fruits_ana' ? 'U' : 'A'}</span><p><strong>${projectLabel(project)}</strong><small>${tasks.length} 条当前证据</small></p></div><b class="project-state ${stateLabel(project)[1]}">${stateLabel(project)[0]}</b></header>${tasks.map((task, index) => `<article class="work-item ${index === 0 ? 'is-priority' : ''}"><p class="eyebrow">${project.key.toUpperCase()} · ${project.handoff.exists ? 'HANDOFF' : 'GIT'}</p><h3>${escapeHtml(task)}</h3><p>来源：${project.handoff.exists ? 'docs/HANDOFF.md' : 'Git 工作区 / 最近提交'}。观察台不写回源项目。</p><footer><span>${project.git.changed_files.length} 个改动文件</span><b>${index === 0 ? '当前证据' : '观察项'}</b></footer></article>`).join('') || '<div class="quiet-state"><span>无当前记录</span><h3>源项目没有提供进行中条目</h3><p>这不是“已完成”，而是没有可读的当前状态证据。</p></div>'}</section>`
  }).join('')
}

function renderBacklog() {
  const container = $('[data-panel="backlog"] .kanban-grid')
  if (!container) return
  const items = snapshot.projects.flatMap((project) => project.todo.items.filter((item) => !item.done).map((item) => ({ ...item, project: project.key })))
  setText('#backlog-total', `${items.length} 项可读未完成待办`)
  const priorities = ['P0', 'P1', 'P2', 'BLOCKED', '未分组']
  container.innerHTML = priorities.map((priority) => {
    const group = items.filter((item) => item.priority === priority)
    if (!group.length) return ''
    return `<section class="kanban-column"><header><p><span class="dot ${priority === 'P0' ? 'critical' : priority === 'P1' ? 'active' : 'future'}"></span>${priority}</p><b>${group.length}</b></header>${group.map((item) => `<article><small>${escapeHtml(item.project)}</small><h3>${escapeHtml(item.title)}</h3><p>来自 TODO.md，只读展示。</p></article>`).join('')}</section>`
  }).join('') || '<div class="quiet-state"><span>没有可读未完成待办</span><h3>注意：缺失 TODO.md 不等于没有待办</h3><p>请在对应源项目补充项目管理文档后再观察。</p></div>'
}

function renderCompleted() {
  const todoContainer = $('#completed-todos')
  const commitContainer = $('#commit-timeline')
  const completed = snapshot.projects.flatMap((project) => project.todo.items.filter((item) => item.done).map((item) => ({ ...item, project: project.key })))
  const commits = snapshot.projects.flatMap((project) => project.git.recent_commits.map((commit) => ({ ...commit, project: project.key }))).sort((a, b) => new Date(b.date) - new Date(a.date))
  setText('#completed-total', `${completed.length} 个已完成待办 · ${commits.length} 条最近提交`)
  if (todoContainer) todoContainer.innerHTML = completed.slice(0, 80).map((item) => `<article class="completed-row"><span class="quality-mark pass">DONE</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.project)} · TODO.md · ${item.priority}</small></div></article>`).join('') || '<p class="empty-row">暂无可读已完成待办。</p>'
  if (commitContainer) commitContainer.innerHTML = commits.map((commit) => `<article><time>${escapeHtml(formatTime(commit.date))}</time><span></span><div><p class="eyebrow">${escapeHtml(commit.project)} · COMMIT</p><h3>${escapeHtml(commit.subject)}</h3><p>提交 <code>${escapeHtml(commit.short_hash)}</code> · Git 只读记录。</p></div></article>`).join('') || '<p class="empty-row">暂无提交记录。</p>'
}

function renderDecisions() {
  const container = $('#decision-list') || $('[data-panel="decisions"] .decision-list')
  if (!container) return
  container.innerHTML = snapshot.projects.flatMap((project) => project.decisions.items.map((decision) => ({ ...decision, project: project.key }))).sort((a, b) => String(b.id).localeCompare(String(a.id), undefined, { numeric: true })).map((decision) => `<article data-decision="${decision.status.toLowerCase().startsWith('accepted') ? 'active' : 'impact'}"><span>${escapeHtml(decision.id)}</span><div><p class="eyebrow">${escapeHtml(decision.status)} · ${escapeHtml(decision.project)}</p><h3>${escapeHtml(decision.title)}</h3><p>日期：${escapeHtml(decision.date || '未记录')} · 原文来自 DECISIONS.md。</p></div><b>${escapeHtml(decision.date || '—')}</b></article>`).join('') || '<p class="empty-row">暂无可读 DECISIONS.md。缺失不代表没有架构决策。</p>'
  bindDecisionFilters()
}

function renderQuality() {
  const entries = snapshot.projects.flatMap((project) => project.handoff.test_entries.map((entry) => ({ ...entry, project: project.key })))
  setText('#quality-title', entries.length ? `${entries.length} 条测试证据已从 HANDOFF 读取` : '没有可读测试记录')
  setText('#quality-count', entries.length ? `${entries.length}` : '—')
  setText('#quality-summary', entries.length ? '这是历史交接记录；当前工作区若有改动，仍需重新验证。' : '两个项目没有提供可读的 HANDOFF 测试章节，观察台不会推断质量状态。')
  const grid = $('[data-panel="quality"] .quality-grid')
  if (grid) grid.innerHTML = entries.slice(0, 12).map((entry) => `<article><span class="quality-mark pass">RECORDED</span><h3>${escapeHtml(entry.title)}</h3><strong>${escapeHtml(entry.project)}</strong><p>${escapeHtml(entry.summary.slice(0, 160))}</p></article>`).join('') || '<article><span class="quality-mark stale">MISSING</span><h3>测试记录来源缺失</h3><strong>不作质量推断</strong><p>请查看数据源覆盖卡。</p></article>'
}

function renderMeeting() {
  const topics = []
  snapshot.projects.filter((project) => project.coverage.required_missing_count).forEach((project) => topics.push({ title: `${projectLabel(project)} 缺少项目管理文档`, detail: `缺少：${project.coverage.missing.join('、')}。` }))
  if (snapshot.status.dirty_files) topics.push({ title: `确认 ${snapshot.status.dirty_files} 个工作区改动的收口边界`, detail: `${snapshot.status.untracked_files} 个文件未跟踪，先区分交付文件与本地产物。` })
  if (snapshot.status.open_todos) topics.push({ title: `排定 ${snapshot.status.open_todos} 项待办的下一检查点`, detail: '只记录负责人和时间，不在观察台修改源项目待办。' })
  const list = $('#meeting-topics')
  if (list) list.innerHTML = topics.slice(0, 3).map((topic, index) => `<li><span>${index + 1}</span><div><strong>${escapeHtml(topic.title)}</strong><p>${escapeHtml(topic.detail)}</p></div></li>`).join('') || '<li><span>1</span><div><strong>当前没有可生成的观察议题</strong><p>请先补充源项目文档或提交记录。</p></div></li>'
  const agenda = $('#meeting-agenda')
  if (agenda) agenda.innerHTML = topics.slice(0, 3).map((topic, index) => `<li><time>${String(index + 1).padStart(2, '0')}'</time><div><small>OBSERVE</small><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.detail)}</p></div></li>`).join('')
  const materials = $('#meeting-materials')
  if (materials) materials.innerHTML = snapshot.projects.flatMap((project) => project.documents.filter((document) => document.readable).map((document) => `<li>${escapeHtml(project.key)} · ${escapeHtml(document.path)}</li>`)).join('')
}

function bindDecisionFilters() {
  const decisions = $$('.decision-list [data-decision]')
  $$('[data-decision-filter]').forEach((button) => button.onclick = () => {
    $$('[data-decision-filter]').forEach((item) => item.classList.toggle('is-active', item === button))
    decisions.forEach((decision) => decision.classList.toggle('is-hidden', button.dataset.decisionFilter !== 'all' && decision.dataset.decision !== button.dataset.decisionFilter))
  })
}

async function openDocument(project, path) {
  const dialog = $('#document-dialog')
  try {
    const response = await api(`/documents/${encodeURIComponent(project)}/${path}`)
    if (!response.ok) throw new Error('文档无法读取')
    const data = await response.json()
    setText('#document-title', `${project} / ${path}`)
    $('#document-content').textContent = data.content
    dialog?.showModal()
  } catch (error) {
    showToast(error.message)
  }
}

function showToast(message) {
  const toast = $('#toast')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000)
}

async function loadSnapshot(showFeedback = false) {
  const response = await api('/snapshot')
  if (response.status === 401) throw new Error('登录已过期，请重新登录')
  if (!response.ok) throw new Error('观察快照读取失败')
  snapshot = await response.json()
  renderOverview(); renderActive(); renderBacklog(); renderCompleted(); renderDecisions(); renderQuality(); renderMeeting()
  if (showFeedback) showToast('观察快照已从两个源项目刷新')
}

function setAuthenticated(authenticated) {
  $('#auth-gate').hidden = authenticated
  $('#app-shell').hidden = !authenticated
}

async function boot() {
  try {
    const sessionResponse = await api('/session')
    const session = await sessionResponse.json()
    if (!session.authenticated) return setAuthenticated(false)
    setAuthenticated(true)
    await loadSnapshot()
  } catch (error) {
    setAuthenticated(false)
    setText('#login-message', error.message)
  }
}

$('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  const button = $('.auth-submit', event.currentTarget)
  button.disabled = true
  setText('#login-message', '正在登录并读取源项目…')
  try {
    const response = await api('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
    if (!response.ok) throw new Error((await response.json()).detail || '登录失败')
    setAuthenticated(true)
    await loadSnapshot()
  } catch (error) {
    setText('#login-message', error.message)
  } finally {
    button.disabled = false
  }
})

$('#logout-button')?.addEventListener('click', async () => {
  await api('/logout', { method: 'POST' })
  setAuthenticated(false)
  showToast('已退出项目观察台')
})

$('#refresh-button')?.addEventListener('click', async () => {
  const button = $('#refresh-button')
  button.disabled = true
  button.classList.add('is-loading')
  button.querySelector('span').textContent = '观察中…'
  try { await loadSnapshot(true) } catch (error) { showToast(error.message) } finally {
    button.disabled = false
    button.classList.remove('is-loading')
    button.querySelector('span').textContent = '重新观察'
  }
})

$('#close-document')?.addEventListener('click', () => $('#document-dialog')?.close())
$$('[data-view]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)))
$$('[data-go-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.goView)))
bindDecisionFilters()
boot()
