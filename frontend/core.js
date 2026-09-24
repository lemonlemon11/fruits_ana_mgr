window.ManagerApp = window.ManagerApp || {}

(() => {
  const M = window.ManagerApp
  M.viewMeta = {
    overview: ['PROJECT PULSE / OVERVIEW', '今天，先看这三件事'],
    active: ['LIVE WORK / ACTIVE', '正在进行的工作'],
    backlog: ['ROADMAP / BACKLOG', '后面还有什么要做'],
    completed: ['DELIVERY / COMPLETED', '已经完成了什么'],
    decisions: ['CONTEXT / DECISIONS', '为什么要这样做'],
    quality: ['EVIDENCE / QUALITY', '完成必须有验证证据'],
    meeting: ['FACILITATOR / REVIEW', '主持一场只谈证据的会'],
  }
  M.$ = (selector, root = document) => root.querySelector(selector)
  M.$$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  M.snapshot = null
  M.toastTimer = null

  M.escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]))
  M.setText = (selector, value) => {
    const element = M.$(selector)
    if (element) element.textContent = value
  }
  M.formatTime = (value) => {
    if (!value) return '未记录'
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  }
  M.projectLabel = (project) => project.key === 'fruits_ana' ? '用户端' : '管理端'
  M.stateLabel = (project) => {
    if (project.errors.length) return ['数据缺口', 'is-risk']
    if (project.git.dirty) return ['工作区有改动', 'is-risk']
    return ['主干干净', 'is-stable']
  }
  M.projectTasks = (project) => {
    return project.handoff.in_progress_items.slice(0, 4)
  }
})()
