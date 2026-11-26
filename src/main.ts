import './style.css'
import {
  accountEntries, getPhoto, hideNews, koreanDay, missions, newsHidden, newsItems, pendingEntries,
  publishNews, review, submit, validatePhoto, type Person,
} from './store'
import {
  adminView, composeDialog, header, loginView, newsDialog, participantView, reviewDialog, uploadDialog,
} from './views'

const main = document.querySelector<HTMLElement>('#main')!
const bar = document.querySelector<HTMLElement>('#header')!
const modal = document.querySelector<HTMLDialogElement>('#modal')!
const notice = document.querySelector<HTMLElement>('#notice')!
const sessionKey = 'sun-2026-participant'

function loadPerson(): Person | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    return typeof value?.employee === 'string' && typeof value?.name === 'string' ? value : null
  } catch { return null }
}

let person = loadPerson()
let generation = 0
let imageUrl: string | undefined
let noticeTimer: number
const updates = typeof BroadcastChannel === 'function' ? new BroadcastChannel('sun-2026-updates') : null
updates?.addEventListener('message', () => { if (person) void render() })

function feedback(message: string) {
  notice.textContent = message
  clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.textContent = '' }, 5000)
}
function errorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return '이 기기의 저장 공간이 부족해요. 더 작은 사진으로 다시 시도해 주세요.'
    return '브라우저 저장소를 사용할 수 없어요. 저장소 설정을 확인하고 다시 시도해 주세요.'
  }
  return error instanceof Error ? error.message : '다시 시도해 주세요.'
}
async function render() {
  const ticket = ++generation
  const admin = Boolean(person && location.hash === '#admin')
  bar.innerHTML = header(person, admin)
  if (!person) {
    main.innerHTML = loginView()
    return
  }
  try {
    const html = admin
      ? adminView(...await Promise.all([pendingEntries(), newsItems()]))
      : participantView(person, await accountEntries(person.employee))
    if (ticket === generation) main.innerHTML = html
  } catch (error) {
    if (ticket !== generation) return
    main.innerHTML = '<div class="frame page"><h1>기록을 불러올 수 없어요</h1><p role="alert"></p><button class="button dark" data-action="retry">다시 시도</button></div>'
    main.querySelector('p')!.textContent = errorMessage(error)
  }
}
function releaseImage() {
  if (imageUrl) URL.revokeObjectURL(imageUrl)
  imageUrl = undefined
}
function showModal(html: string) {
  modal.innerHTML = html
  if (!modal.open) modal.showModal()
  modal.scrollTop = 0
}
function goHome() {
  history.replaceState(null, '', location.pathname + location.search + '#home')
}
function finish(message: string) {
  modal.close()
  updates?.postMessage('changed')
  feedback(message)
  void render()
}
async function showNews() { showModal(newsDialog(await newsItems(), Boolean(person))) }

window.addEventListener('hashchange', () => {
  if (modal.open) modal.close()
  if (!person) goHome()
  void render()
  window.scrollTo(0, 0)
})
modal.addEventListener('close', () => {
  if (!modal.open) { releaseImage(); modal.replaceChildren() }
})
modal.addEventListener('click', e => {
  if (e.target !== modal) return
  const rect = modal.getBoundingClientRect()
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) modal.close()
})

document.addEventListener('click', async e => {
  const button = (e.target as Element).closest<HTMLButtonElement>('button')
  if (!button || button.disabled) return
  try {
    switch (button.dataset.action) {
      case 'retry': await render(); return
      case 'close': modal.close(); return
      case 'news': await showNews(); return
      case 'hide-news':
        if (person) await hideNews(person.employee)
        modal.close()
        return
      case 'logout':
        sessionStorage.removeItem(sessionKey)
        person = null
        goHome()
        await render()
        window.scrollTo(0, 0)
        return
      case 'compose': if (person) showModal(composeDialog()); return
    }
    if (!person) return
    const mission = missions.find(m => m.id === button.dataset.mission)
    if (mission) showModal(uploadDialog(mission.id))
    if (button.dataset.review) {
      const id = button.dataset.review
      const [queue, photo] = await Promise.all([pendingEntries(), getPhoto(id)])
      const row = queue.find(item => item.id === id)
      if (!row || !photo) { await render(); feedback('검토 목록을 새로고침했어요.'); return }
      releaseImage()
      imageUrl = URL.createObjectURL(photo)
      showModal(reviewDialog(row, imageUrl))
    }
  } catch (error) { feedback(errorMessage(error)) }
})

modal.addEventListener('change', async e => {
  const field = e.target as HTMLInputElement
  const form = field.form
  if (form?.id !== 'upload-form') return
  const photo = form.elements.namedItem('photo') as HTMLInputElement
  const consent = form.elements.namedItem('consent') as HTMLInputElement
  const preview = form.querySelector<HTMLImageElement>('#photo-preview')!
  const send = form.querySelector<HTMLButtonElement>('button')!
  if (field !== consent && field !== photo) return
  const error = form.querySelector<HTMLElement>('.error')!
  error.textContent = ''
  photo.disabled = !consent.checked
  if (!consent.checked) photo.value = ''
  send.disabled = true
  releaseImage()
  preview.hidden = true
  preview.removeAttribute('src')
  const file = photo.files?.[0]
  if (!file) return
  try {
    validatePhoto(file)
    imageUrl = URL.createObjectURL(file)
    preview.src = imageUrl
    await preview.decode()
    if (photo.files?.[0] !== file || !form.isConnected) return
    preview.hidden = false
    send.disabled = false
  } catch (err) {
    if (photo.files?.[0] !== file || !form.isConnected) return
    releaseImage()
    photo.value = ''
    error.textContent = err instanceof DOMException ? '사진을 열 수 없어요. 다른 사진을 선택해 주세요.' : errorMessage(err)
  }
})

document.addEventListener('submit', async e => {
  e.preventDefault()
  const form = e.target as HTMLFormElement
  if (form.dataset.busy) return
  const fields = new FormData(form)
  const value = (key: string) => String(fields.get(key) ?? '').trim()
  const trigger = (e as SubmitEvent).submitter as HTMLButtonElement | null
  const error = form.querySelector<HTMLElement>('.error')!
  error.textContent = ''
  form.dataset.busy = 'true'
  if (trigger) trigger.disabled = true
  try {
    switch (form.id) {
      case 'login-form': {
        const user = { employee: value('employee'), name: value('name') }
        if (!user.name || !user.employee) throw new Error('사번과 이름을 입력해 주세요.')
        const hide = await newsHidden(user.employee)
        sessionStorage.setItem(sessionKey, JSON.stringify(user))
        person = user
        goHome()
        await render()
        window.scrollTo(0, 0)
        if (!hide) await showNews()
        break
      }
      case 'upload-form': {
        const file = fields.get('photo')
        const mission = missions.find(m => m.id === form.dataset.id)
        if (!person || !mission || !fields.has('consent') || !(file instanceof File) || !file.size) throw new Error('안내에 동의한 뒤 사진을 선택해 주세요.')
        const status = value('mode') === 'pending' ? 'pending' : 'approved'
        await submit(person, mission.id, file, status)
        finish(status === 'pending' ? '검토를 요청했어요. 참여 기록에서 결과를 확인하세요.' : '미션을 완료했어요. 1점이 적립됐어요.')
        break
      }
      case 'review-form': {
        if (!person || !form.dataset.id) return
        const decision = trigger?.value === 'approved' ? 'approved' : 'rejected'
        await review(form.dataset.id, decision, value('reason'))
        finish(decision === 'approved' ? '승인했어요. 참여자의 점수에 반영했어요.' : '반려 사유를 참여 기록에 남겼어요.')
        break
      }
      case 'compose-form':
        if (!person) return
        await publishNews(value('title'), value('body'))
        finish('캠페인 소식을 게시했어요.')
        break
    }
  } catch (err) {
    if (form.isConnected) error.textContent = errorMessage(err)
    else feedback(errorMessage(err))
  } finally {
    delete form.dataset.busy
    if (trigger) trigger.disabled = false
  }
})

let lastDay = koreanDay()
function refreshDay() {
  const now = koreanDay()
  if (lastDay !== now && person) void render()
  lastDay = now
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay() })
window.setInterval(refreshDay, 30_000)
void render()
