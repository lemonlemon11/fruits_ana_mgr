(() => {
  const M = window.ManagerApp

  M.renderProject = (project, prefix) => {
    const [state, stateClass] = M.stateLabel(project)
    const card = M.$(`.project-${prefix === 'user' ? 'user' : 'admin'}`)
    if (card) {
      card.setAttribute('data-detail-id', M.registerDetail({ type: 'project', project }))
      card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.setAttribute('aria-label', `查看${M.projectLabel(project)}项目详情`)
    }
    M.setText(`#${prefix}-project-branch`, `${project.git.branch || '无分支'} · ${project.git.dirty ? `${project.git.status.total} 个工作区改动` : '工作区干净'}`)
    const stateElement = M.$(`#${prefix}-project-state`)
    if (stateElement) { stateElement.textContent = state; stateElement.className = `project-state ${stateClass}` }
    M.setText(`#${prefix}-project-focus`, project.handoff.sections?.current_goal || project.git.recent_commits[0]?.subject || '源项目未提供当前目标记录')
    M.setText(`#${prefix}-project-files`, `${project.git.status.total} 个 Git 改动 · ${project.coverage.available_count}/${project.coverage.expected_count} 个来源可读`)
    M.setText(`#${prefix}-project-commit`, project.git.recent_commits[0] ? `${project.git.recent_commits[0].short_hash} · ${M.formatTime(project.git.recent_commits[0].date)}` : '暂无提交记录')
    const list = M.$(`.project-${prefix === 'user' ? 'user' : 'admin'} .task-lines`)
    if (!list) return
    const emptyState = project.handoff.exists ? '没有明确进行中任务' : 'HANDOFF 来源缺失，无法判断'
    list.innerHTML = M.projectTasks(project).map((task) => `<li ${M.detailAttrs({ type: 'work', projectKey: project.key, title: task, body: '来自当前项目的进行中证据。', sourcePath: 'docs/HANDOFF.md' }, `查看${M.projectLabel(project)}：${task}`)}><span class="task-status is-working"></span><p><strong>${M.escapeHtml(task)}</strong><small>${M.escapeHtml(project.key)} · HANDOFF 明确任务</small></p><b>进行中</b></li>`).join('') || `<li class="empty-row">${emptyState}</li>`
  }

  M.renderOverview = () => {
    const { status, projects } = M.snapshot
    const user = projects.find((project) => project.key === 'fruits_ana')
    const admin = projects.find((project) => project.key === 'fruits_ana_admin')
    M.setText('#last-scan', M.formatTime(M.snapshot.generated_at)); M.setText('#source-status-label', status.error_count ? '只读观察 · 有缺口' : '只读观察 · 已连接'); M.setText('#source-status-detail', `${status.projects_available}/${status.project_count} 个仓库可读取 · ${status.source_documents_available}/${status.source_documents_expected} 个来源可读`)
    M.setText('#source-user-detail', user ? `${user.git.branch || '无分支'} · ${user.coverage.completeness === 'complete' ? '来源完整' : '来源不完整'}` : '未找到'); M.setText('#source-admin-detail', admin ? `${admin.git.branch || '无分支'} · ${admin.coverage.completeness === 'complete' ? '来源完整' : '来源不完整'}` : '未找到')
    const active = projects.reduce((total, project) => total + project.handoff.in_progress_items.length, 0); const tests = projects.reduce((total, project) => total + project.handoff.test_entries.length, 0)
    M.setText('#summary-active', active); M.setText('#summary-active-detail', 'HANDOFF 当前进行中条目'); M.setText('#summary-backlog', status.open_todos); M.setText('#summary-backlog-detail', 'TODO 未完成；缺失文档不计为 0'); M.setText('#summary-questions', status.missing_required_sources + status.error_count); M.setText('#summary-questions-detail', '来源缺口或扫描错误'); M.setText('#summary-quality', tests); M.setText('#summary-quality-detail', 'HANDOFF 测试记录条目')
    M.setText('#nav-active-count', active); M.setText('#nav-backlog-count', status.open_todos); M.setText('#nav-decisions-count', status.decision_count); M.setText('#signal-work-title', `${status.dirty_files} 个工作区改动等待收口`); M.setText('#signal-work-detail', `${status.untracked_files} 个未跟踪文件；状态来自 Git 只读扫描。`); M.setText('#signal-source-title', `${status.source_documents_available}/${status.source_documents_expected} 个来源已读`); M.setText('#signal-source-detail', status.missing_required_sources ? '缺失来源已显式列出，管理端没有进度文档记录。' : '两个仓库的必需观察来源均可读取。'); M.setText('#signal-next-title', `${status.open_todos} 项待办来自源项目`); M.setText('#signal-next-detail', '待办只读展示，新增/修改/删除回到源项目完成。')
    if (user) M.renderProject(user, 'user'); if (admin) M.renderProject(admin, 'admin')
    const coverage = M.$('#coverage-grid')
    if (coverage) coverage.innerHTML = projects.map((project) => {
      const projectDetail = M.registerDetail({ type: 'project', project }); const statusText = project.coverage.completeness === 'complete' ? '来源完整' : project.coverage.completeness === 'unavailable' ? '仓库不可用' : '部分可读'
      return `<article class="coverage-card" data-detail-id="${projectDetail}" role="button" tabindex="0" aria-label="查看${M.projectLabel(project)}来源详情"><header><div><span class="project-code">${project.key === 'fruits_ana' ? 'U' : 'A'}</span><p><strong>${project.key}</strong><small>${project.git.branch || '无分支'} · ${project.coverage.available_count}/${project.coverage.expected_count} 可读</small></p></div><b class="${statusText === '来源完整' ? 'coverage-ok' : 'coverage-warn'}">${statusText}</b></header><p>${project.coverage.available_count}/${project.coverage.expected_count} 个观察来源可读，${project.coverage.required_missing_count} 个必需来源缺失。</p><div class="coverage-files">${project.documents.map((document) => `<button type="button" class="document-link ${document.readable ? '' : 'is-missing'}" data-project="${project.key}" data-document="${document.path}" ${document.readable ? '' : 'disabled'}>${document.readable ? '查看' : '缺失'} · ${document.path}</button>`).join('')}</div></article>`
    }).join('')
    M.$$('.document-link').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); M.openDocument(button.dataset.project, button.dataset.document) }))
    M.setText('#coverage-total', `${status.source_documents_available}/${status.source_documents_expected} 可读`); M.setText('#evidence-todo', `TODO · ${status.open_todos} 未完成 / ${status.completed_todos} 已完成`); M.setText('#evidence-handoff', `HANDOFF · ${active} 项进行中`); M.setText('#evidence-git', `Git · ${status.dirty_files} 个改动`); M.setText('#evidence-tests', `Tests · ${tests} 条记录`); M.setText('#evidence-decisions', `ADR · ${status.decision_count} 条索引`)
  }

  M.renderActive = () => {
    const container = M.$('[data-panel="active"] .work-columns'); if (!container) return
    const active = M.snapshot.projects.reduce((total, project) => total + project.handoff.in_progress_items.length, 0)
    M.setText('#active-total', `${active} 项明确进行中 · ${M.snapshot.status.open_todos} 项待办 · ${M.snapshot.status.dirty_files} 个 Git 观察项`)
    container.innerHTML = M.snapshot.projects.map((project) => {
      const tasks = M.projectTasks(project)
      const items = tasks.map((task, index) => `<article class="work-item ${index === 0 ? 'is-priority' : ''}" ${M.detailAttrs({ type: 'work', projectKey: project.key, title: task, body: '来自当前项目的进行中证据。', sourcePath: 'docs/HANDOFF.md' }, `查看${M.projectLabel(project)}：${task}`)}><p class="eyebrow">${project.key.toUpperCase()} · HANDOFF</p><h3>${M.escapeHtml(task)}</h3><p>来源：docs/HANDOFF.md 中的未完成复选任务。观察台不写回源项目。</p><footer><span>${project.git.changed_files.length} 个 Git 观察项</span><b>明确任务</b></footer></article>`).join('')
      const emptyState = project.handoff.exists
        ? '<div class="quiet-state"><span>0 项明确进行中</span><h3>HANDOFF 没有未完成复选任务</h3><p>这不代表项目已完成；TODO 待办和 Git 观察项在各自区域单列。</p></div>'
        : '<div class="quiet-state"><span>来源缺失</span><h3>HANDOFF 来源缺失，无法判断</h3><p>请在源项目补齐交接文档；观察台不会把 Git 改动推断为任务。</p></div>'
      return `<section class="work-column"><header><div><span class="project-code">${project.key === 'fruits_ana' ? 'U' : 'A'}</span><p><strong>${M.projectLabel(project)}</strong><small>${tasks.length} 项明确进行中</small></p></div><b class="project-state ${M.stateLabel(project)[1]}">${M.stateLabel(project)[0]}</b></header>${items || emptyState}</section>`
    }).join('')
  }

  M.renderBacklog = () => {
    const container = M.$('[data-panel="backlog"] .kanban-grid'); if (!container) return
    const items = M.snapshot.projects.flatMap((project) => project.todo.items.filter((item) => !item.done).map((item) => ({ ...item, project: project.key })))
    M.setText('#backlog-total', `${items.length} 项可读未完成待办`)
    const priorities = ['P0', 'P1', 'P2', 'BLOCKED', '未分组']
    container.innerHTML = priorities.map((priority) => { const group = items.filter((item) => item.priority === priority); if (!group.length) return ''; return `<section class="kanban-column"><header><p><span class="dot ${priority === 'P0' ? 'critical' : priority === 'P1' ? 'active' : 'future'}"></span>${priority}</p><b>${group.length}</b></header>${group.map((item) => `<article ${M.detailAttrs({ type: 'todo', projectKey: item.project, title: item.title, priority: item.priority, done: item.done, sourcePath: 'docs/TODO.md' }, `查看待办：${item.title}`)}><small>${M.escapeHtml(item.project)}</small><h3>${M.escapeHtml(item.title)}</h3><p>来自 TODO.md，只读展示。</p></article>`).join('')}</section>` }).join('') || '<div class="quiet-state"><span>没有可读未完成待办</span><h3>注意：缺失 TODO.md 不等于没有待办</h3><p>请在对应源项目补充项目管理文档后再观察。</p></div>'
  }

  M.renderCompleted = () => {
    const todoContainer = M.$('#completed-todos'); const commitContainer = M.$('#commit-timeline')
    const completed = M.snapshot.projects.flatMap((project) => project.todo.items.filter((item) => item.done).map((item) => ({ ...item, project: project.key }))); const commits = M.snapshot.projects.flatMap((project) => project.git.recent_commits.map((commit) => ({ ...commit, project: project.key }))).sort((a, b) => new Date(b.date) - new Date(a.date))
    M.setText('#completed-total', `${completed.length} 个已完成待办 · ${commits.length} 条最近提交`)
    if (todoContainer) todoContainer.innerHTML = completed.slice(0, 80).map((item) => `<article class="completed-row" ${M.detailAttrs({ type: 'todo', projectKey: item.project, title: item.title, priority: item.priority, done: true, sourcePath: 'docs/TODO.md' }, `查看已完成待办：${item.title}`)}><span class="quality-mark pass">DONE</span><div><strong>${M.escapeHtml(item.title)}</strong><small>${M.escapeHtml(item.project)} · TODO.md · ${item.priority}</small></div></article>`).join('') || '<p class="empty-row">暂无可读已完成待办。</p>'
    if (commitContainer) commitContainer.innerHTML = commits.map((commit) => `<article ${M.detailAttrs({ type: 'commit', projectKey: commit.project, subject: commit.subject, hash: commit.short_hash, date: commit.date, sourcePath: null }, `查看提交：${commit.subject}`)}><time>${M.escapeHtml(M.formatTime(commit.date))}</time><span></span><div><p class="eyebrow">${M.escapeHtml(commit.project)} · COMMIT</p><h3>${M.escapeHtml(commit.subject)}</h3><p>提交 <code>${M.escapeHtml(commit.short_hash)}</code> · Git 只读记录。</p></div></article>`).join('') || '<p class="empty-row">暂无提交记录。</p>'
  }

  M.renderDecisions = () => {
    const container = M.$('#decision-list') || M.$('[data-panel="decisions"] .decision-list'); if (!container) return
    container.innerHTML = M.snapshot.projects.flatMap((project) => project.decisions.items.map((decision) => ({ ...decision, project: project.key }))).sort((a, b) => String(b.id).localeCompare(String(a.id), undefined, { numeric: true })).map((decision) => `<article ${M.detailAttrs({ type: 'decision', projectKey: decision.project, id: decision.id, title: decision.title, status: decision.status, date: decision.date, sourcePath: 'docs/DECISIONS.md' }, `查看决策：${decision.id}`)} data-decision="${decision.status.toLowerCase().startsWith('accepted') ? 'active' : 'impact'}"><span>${M.escapeHtml(decision.id)}</span><div><p class="eyebrow">${M.escapeHtml(decision.status)} · ${M.escapeHtml(decision.project)}</p><h3>${M.escapeHtml(decision.title)}</h3><p>日期：${M.escapeHtml(decision.date || '未记录')} · 原文来自 DECISIONS.md。</p></div><b>${M.escapeHtml(decision.date || '—')}</b></article>`).join('') || '<p class="empty-row">暂无可读 DECISIONS.md。缺失不代表没有架构决策。</p>'
    M.bindDecisionFilters()
  }

  M.renderQuality = () => {
    const entries = M.snapshot.projects.flatMap((project) => project.handoff.test_entries.map((entry) => ({ ...entry, project: project.key })))
    M.setText('#quality-title', entries.length ? `${entries.length} 条测试证据已从 HANDOFF 读取` : '没有可读测试记录'); M.setText('#quality-count', entries.length ? `${entries.length}` : '—'); M.setText('#quality-summary', entries.length ? '这是历史交接记录；当前工作区若有改动，仍需重新验证。' : '两个项目没有提供可读的 HANDOFF 测试章节，观察台不会推断质量状态。')
    const grid = M.$('[data-panel="quality"] .quality-grid')
    if (grid) grid.innerHTML = entries.slice(0, 12).map((entry) => `<article ${M.detailAttrs({ type: 'test', projectKey: entry.project, title: entry.title, summary: entry.summary, sourcePath: 'docs/HANDOFF.md' }, `查看测试证据：${entry.title}`)}><span class="quality-mark pass">RECORDED</span><h3>${M.escapeHtml(entry.title)}</h3><strong>${M.escapeHtml(entry.project)}</strong><p>${M.escapeHtml(entry.summary.slice(0, 160))}</p></article>`).join('') || '<article><span class="quality-mark stale">MISSING</span><h3>测试记录来源缺失</h3><strong>不作质量推断</strong><p>请查看数据源覆盖卡。</p></article>'
  }

  M.renderMeeting = () => {
    const topics = []
    M.snapshot.projects.filter((project) => project.coverage.required_missing_count).forEach((project) => topics.push({ title: `${M.projectLabel(project)} 缺少项目管理文档`, detail: `缺少：${project.coverage.missing.join('、')}。` }))
    if (M.snapshot.status.dirty_files) topics.push({ title: `确认 ${M.snapshot.status.dirty_files} 个工作区改动的收口边界`, detail: `${M.snapshot.status.untracked_files} 个文件未跟踪，先区分交付文件与本地产物。` })
    if (M.snapshot.status.open_todos) topics.push({ title: `排定 ${M.snapshot.status.open_todos} 项待办的下一检查点`, detail: '只记录负责人和时间，不在观察台修改源项目待办。' })
    const list = M.$('#meeting-topics'); if (list) list.innerHTML = topics.slice(0, 3).map((topic, index) => `<li><span>${index + 1}</span><div><strong>${M.escapeHtml(topic.title)}</strong><p>${M.escapeHtml(topic.detail)}</p></div></li>`).join('') || '<li><span>1</span><div><strong>当前没有可生成的观察议题</strong><p>请先补充源项目文档或提交记录。</p></div></li>'
    const agenda = M.$('#meeting-agenda'); if (agenda) agenda.innerHTML = topics.slice(0, 3).map((topic, index) => `<li><time>${String(index + 1).padStart(2, '0')}'</time><div><small>OBSERVE</small><h3>${M.escapeHtml(topic.title)}</h3><p>${M.escapeHtml(topic.detail)}</p></div></li>`).join('')
    const materials = M.$('#meeting-materials'); if (materials) materials.innerHTML = M.snapshot.projects.flatMap((project) => project.documents.filter((document) => document.readable).map((document) => `<li>${M.escapeHtml(project.key)} · ${M.escapeHtml(document.path)}</li>`)).join('')
  }

  M.bindDecisionFilters = () => {
    const decisions = M.$$('.decision-list [data-decision]')
    M.$$('[data-decision-filter]').forEach((button) => button.onclick = () => { M.$$('[data-decision-filter]').forEach((item) => item.classList.toggle('is-active', item === button)); decisions.forEach((decision) => decision.classList.toggle('is-hidden', button.dataset.decisionFilter !== 'all' && decision.dataset.decision !== button.dataset.decisionFilter)) })
  }
})()
