(() => {
  const M = window.ManagerApp
  let sequence = 0
  M.detailRegistry = new Map()
  M.clearDetails = () => { M.detailRegistry.clear(); sequence = 0 }
  M.detailAttrs = (detail, label) => {
    const id = `detail-${sequence++}`
    M.detailRegistry.set(id, detail)
    return `data-detail-id="${id}" role="button" tabindex="0" aria-label="${M.escapeHtml(label)}"`
  }
  M.registerDetail = (detail) => {
    const id = `detail-${sequence++}`
    M.detailRegistry.set(id, detail)
    return id
  }
  M.detailField = (label, value) => `<div class="detail-field"><span>${M.escapeHtml(label)}</span><strong>${M.escapeHtml(value || '未记录')}</strong></div>`
  M.sourceMarkup = (detail) => {
    if (!detail.sourcePath) return '<div class="detail-source"><p><span class="detail-source-label">Source</span>Git 只读记录，无可打开的文档原文。</p></div>'
    const project = M.snapshot.projects.find((item) => item.key === detail.projectKey)
    const document = project?.documents.find((item) => item.path === detail.sourcePath)
    const readable = Boolean(document?.readable)
    return `<div class="detail-source"><p><span class="detail-source-label">Source</span>${M.escapeHtml(detail.projectKey)} · ${M.escapeHtml(detail.sourcePath)}</p><button type="button" data-detail-document="true" data-project="${M.escapeHtml(detail.projectKey)}" data-document="${M.escapeHtml(detail.sourcePath)}" ${readable ? '' : 'disabled'}>${readable ? '查看原文' : '来源缺失'}</button></div>`
  }
  M.openDetail = (id) => {
    const detail = M.detailRegistry.get(id); const dialog = M.$('#detail-dialog'); const content = M.$('#detail-content')
    if (!detail || !dialog || !content) return
    let title = '数据详情'; let lead = ''; let fields = ''; let source = ''
    if (detail.type === 'project') {
      const project = detail.project
      title = `${M.projectLabel(project)} · ${project.key}`
      lead = project.errors.length ? project.errors.join('；') : '该项目的 Git 与项目管理来源已完成本次只读扫描。'
      fields = M.detailField('分支', project.git.branch || '无分支') + M.detailField('工作区', project.git.dirty ? `${project.git.status.total} 个改动` : '干净') + M.detailField('来源状态', project.coverage.completeness) + M.detailField('Git 来源', `${project.coverage.available_count}/${project.coverage.expected_count} 可读`)
      source = `<div><span class="detail-source-label">SOURCE INVENTORY</span><ul class="detail-list">${project.documents.map((item) => `<li><span>${item.readable ? '可读取' : item.error ? '不可读取' : '缺失'}</span><strong>${M.escapeHtml(item.path)}</strong></li>`).join('')}</ul></div>`
    } else if (detail.type === 'work') { title = detail.title; lead = detail.body; fields = M.detailField('项目', M.projectLabel({ key: detail.projectKey })) + M.detailField('状态', '进行中 / 当前证据'); source = M.sourceMarkup(detail)
    } else if (detail.type === 'todo') { title = detail.title; lead = detail.done ? '该条目已在 TODO.md 中标记完成。' : '该条目仍是源项目中的可读未完成待办。'; fields = M.detailField('项目', M.projectLabel({ key: detail.projectKey })) + M.detailField('优先级', detail.priority) + M.detailField('状态', detail.done ? '已完成' : '未完成'); source = M.sourceMarkup(detail)
    } else if (detail.type === 'commit') { title = detail.subject; lead = '提交信息来自源项目 Git 日志，观察台不会修改提交或工作区。'; fields = M.detailField('项目', M.projectLabel({ key: detail.projectKey })) + M.detailField('短哈希', detail.hash) + M.detailField('时间', M.formatTime(detail.date)); source = M.sourceMarkup(detail)
    } else if (detail.type === 'decision') { title = `${detail.id} · ${detail.title}`; lead = '决策详情来自源项目 DECISIONS.md 的索引，不代表观察台创建或修改了决策。'; fields = M.detailField('项目', M.projectLabel({ key: detail.projectKey })) + M.detailField('状态', detail.status) + M.detailField('日期', detail.date); source = M.sourceMarkup(detail)
    } else if (detail.type === 'test') { title = detail.title; lead = detail.summary || 'HANDOFF 中没有附加测试摘要。'; fields = M.detailField('项目', M.projectLabel({ key: detail.projectKey })) + M.detailField('证据类型', 'HANDOFF / Test Status'); source = M.sourceMarkup(detail) }
    M.setText('#detail-title', title); content.innerHTML = `<p class="detail-lead">${M.escapeHtml(lead)}</p><div class="detail-grid">${fields}</div>${source}`; dialog.showModal()
  }
  M.openDocument = async (project, path) => {
    const dialog = M.$('#document-dialog')
    try { const response = await M.api(`/documents/${encodeURIComponent(project)}/${path}`); if (!response.ok) throw new Error('文档无法读取'); const data = await response.json(); M.setText('#document-title', `${project} / ${path}`); M.$('#document-content').textContent = data.content; dialog?.showModal() } catch (error) { M.showToast(error.message) }
  }
})()
