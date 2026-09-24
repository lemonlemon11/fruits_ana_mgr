const M = window.ManagerApp
const ACTIVE_EVIDENCE_RULE = 'HANDOFF 明确未完成复选任务；Git 改动单列观察'
M.activeEvidenceRule = ACTIVE_EVIDENCE_RULE

M.api = (path, options = {}) => fetch(`/api${path}`, { credentials: 'same-origin', ...options })

M.showView = (view) => {
  const meta = M.viewMeta[view]
  if (!meta) return
  M.$$('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view))
  M.$$('[data-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === view))
  M.setText('#view-kicker', meta[0]); M.setText('#view-title', meta[1])
  window.scrollTo({ top: 0, behavior: 'smooth' }); M.$('#main-content')?.focus({ preventScroll: true })
}

M.showToast = (message) => {
  const toast = M.$('#toast'); if (!toast) return
  toast.textContent = message; toast.classList.add('is-visible'); window.clearTimeout(M.toastTimer); M.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000)
}

M.loadSnapshot = async (showFeedback = false) => {
  const response = await M.api('/snapshot')
  if (response.status === 401) throw new Error('登录已过期，请重新登录')
  if (!response.ok) throw new Error('观察快照读取失败')
  M.snapshot = await response.json(); M.clearDetails(); M.renderOverview(); M.renderActive(); M.renderBacklog(); M.renderCompleted(); M.renderDecisions(); M.renderQuality(); M.renderMeeting()
  if (showFeedback) M.showToast('观察快照已从两个源项目刷新')
}

M.setAuthenticated = (authenticated) => { M.$('#auth-gate').hidden = authenticated; M.$('#app-shell').hidden = !authenticated }

M.boot = async () => {
  try {
    const response = await M.api('/session'); const session = await response.json()
    if (!session.authenticated) return M.setAuthenticated(false)
    M.setAuthenticated(true); await M.loadSnapshot()
  } catch (error) { M.setAuthenticated(false); M.setText('#login-message', error.message) }
}

M.$('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const button = M.$('.auth-submit', event.currentTarget); button.disabled = true; M.setText('#login-message', '正在登录并读取源项目…')
  try {
    const response = await M.api('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
    if (!response.ok) throw new Error((await response.json()).detail || '登录失败')
    M.setAuthenticated(true); await M.loadSnapshot()
  } catch (error) { M.setAuthenticated(false); M.setText('#login-message', error.message) } finally { button.disabled = false }
})

M.$('#logout-button')?.addEventListener('click', async () => { await M.api('/logout', { method: 'POST' }); M.setAuthenticated(false); M.showToast('已退出项目观察台') })

M.$('#refresh-button')?.addEventListener('click', async () => {
  const button = M.$('#refresh-button'); button.disabled = true; button.classList.add('is-loading'); button.querySelector('span').textContent = '观察中…'
  try { await M.loadSnapshot(true) } catch (error) { M.showToast(error.message) } finally { button.disabled = false; button.classList.remove('is-loading'); button.querySelector('span').textContent = '重新观察' }
})

document.addEventListener('click', (event) => {
  const documentTrigger = event.target.closest('[data-detail-document]')
  if (documentTrigger) return M.openDocument(documentTrigger.dataset.project, documentTrigger.dataset.document)
  const trigger = event.target.closest('[data-detail-id]')
  if (trigger && !event.target.closest('button, a, input, select, textarea')) M.openDetail(trigger.dataset.detailId)
})

document.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key) || event.target.closest('button, a, input, select, textarea')) return
  const trigger = event.target.closest('[data-detail-id]'); if (!trigger) return; event.preventDefault(); M.openDetail(trigger.dataset.detailId)
})

M.$('#close-document')?.addEventListener('click', () => M.$('#document-dialog')?.close())
M.$('#close-detail')?.addEventListener('click', () => M.$('#detail-dialog')?.close())
M.$$('[data-view]').forEach((item) => item.addEventListener('click', () => M.showView(item.dataset.view)))
M.$$('[data-go-view]').forEach((button) => button.addEventListener('click', () => M.showView(button.dataset.goView)))
M.bindDecisionFilters(); M.boot()
