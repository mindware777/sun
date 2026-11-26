import { openDB, type DBSchema } from 'idb'

export const missions = [
  { id: 'mask', title: '마스크 착용', detail: '코와 입을 가린 모습을 기록해요.' },
  { id: 'meal', title: '균형 있는 한 끼', detail: '탄수화물·단백질·지방이 담긴 식사를 기록해요.' },
  { id: 'window', title: '실내 환기', detail: '창문을 열어 환기하는 모습을 기록해요.' },
  { id: 'wash', title: '손 씻기', detail: '물과 비누로 손을 씻는 모습을 기록해요.' },
] as const

export type MissionId = typeof missions[number]['id']
export type Status = 'approved' | 'pending' | 'rejected'
export interface Person { employee: string; name: string }
export interface Submission extends Person {
  id: string
  mission: MissionId
  day: string
  created: number
  status: Status
  hash: string
  reason?: string
}
export interface News { id: string; title: string; body: string; created: number }

interface CampaignDB extends DBSchema {
  entries: {
    key: string
    value: Submission
    indexes: { employee: string; status: Status; hash: string; slot: [string, string, MissionId] }
  }
  photos: { key: string; value: Blob }
  news: { key: string; value: News }
  hiddenNews: { key: string; value: string }
}

const dayFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
})
export const koreanDay = (date = new Date()) => dayFormat.format(date)

function openCampaign() {
  return openDB<CampaignDB>('sun-winter-2026', 1, {
    upgrade(db) {
      const entries = db.createObjectStore('entries', { keyPath: 'id' })
      entries.createIndex('employee', 'employee')
      entries.createIndex('status', 'status')
      entries.createIndex('hash', 'hash', { unique: true })
      entries.createIndex('slot', ['employee', 'day', 'mission'])
      db.createObjectStore('photos')
      db.createObjectStore('hiddenNews')
      db.createObjectStore('news', { keyPath: 'id' }).add({
        id: 'welcome', created: 0, title: '겨울 생활예방 챌린지 참여 안내',
        body: '평택캠퍼스 구성원이라면 매일 네 가지 미션에 참여할 수 있어요. 오늘 실천한 활동을 사진으로 남기고, 승인된 미션마다 1점을 모아 보세요.',
      })
    },
  })
}

let connection: ReturnType<typeof openCampaign> | undefined
const db = () => connection ??= openCampaign().catch(error => { connection = undefined; throw error })
const newest = <T extends { created: number }>(rows: T[]) => rows.sort((a, b) => b.created - a.created)

export async function accountEntries(employee: string) {
  return newest(await (await db()).getAllFromIndex('entries', 'employee', employee))
}
export async function pendingEntries() {
  return newest(await (await db()).getAllFromIndex('entries', 'status', 'pending'))
}
export async function getPhoto(id: string) { return (await db()).get('photos', id) }

export function validatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.')
  if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error('빈 파일은 사용할 수 없어요. 10MB 이하의 사진을 선택해 주세요.')
}

export async function submit(person: Person, mission: MissionId, file: File, status: 'approved' | 'pending') {
  validatePhoto(file)
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const created = Date.now()
  const day = koreanDay(new Date(created))
  // Serialize the eligibility checks with both writes, including submissions from other tabs.
  const tx = (await db()).transaction(['entries', 'photos'], 'readwrite')
  const entries = tx.objectStore('entries')
  const slot = await entries.index('slot').getAll([person.employee, day, mission])
  if (slot.some(row => row.status !== 'rejected')) throw new Error('오늘 이미 제출한 미션이에요. 참여 기록을 확인해 주세요.')
  if (await entries.index('hash').getKey(hash)) throw new Error('이미 제출된 사진이에요. 새 사진으로 참여해 주세요.')
  const id = crypto.randomUUID()
  await Promise.all([
    entries.add({ ...person, id, mission, day, hash, status, created }),
    tx.objectStore('photos').add(file, id),
    tx.done,
  ])
}

export async function review(id: string, decision: 'approved' | 'rejected', reason: string) {
  if (decision === 'rejected' && !reason.trim()) throw new Error('참여자에게 전달할 반려 사유를 입력해 주세요.')
  const tx = (await db()).transaction('entries', 'readwrite')
  const row = await tx.store.get(id)
  if (!row || row.status !== 'pending') throw new Error('이미 처리된 제출 건이에요. 목록을 다시 확인해 주세요.')
  await Promise.all([tx.store.put({ ...row, status: decision, reason: decision === 'rejected' ? reason.trim() : undefined }), tx.done])
}

export async function newsItems() { return newest(await (await db()).getAll('news')) }
export async function publishNews(title: string, body: string) {
  if (!title.trim() || !body.trim()) throw new Error('제목과 내용을 모두 입력해 주세요.')
  await (await db()).add('news', { id: crypto.randomUUID(), created: Date.now(), title: title.trim(), body: body.trim() })
}
export async function newsHidden(employee: string) {
  return (await (await db()).get('hiddenNews', employee)) === koreanDay()
}
export async function hideNews(employee: string) { await (await db()).put('hiddenNews', koreanDay(), employee) }
