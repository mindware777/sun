import activity from 'lucide-static/icons/activity.svg?raw'
import bell from 'lucide-static/icons/bell.svg?raw'
import calendar from 'lucide-static/icons/calendar-days.svg?raw'
import info from 'lucide-static/icons/info.svg?raw'
import lock from 'lucide-static/icons/lock-keyhole.svg?raw'
import logout from 'lucide-static/icons/log-out.svg?raw'
import snow from 'lucide-static/icons/snowflake.svg?raw'
import upload from 'lucide-static/icons/upload.svg?raw'
import x from 'lucide-static/icons/x.svg?raw'
import { koreanDay, missions, type MissionId, type News, type Person, type Status, type Submission } from './store'

const icons = { activity, bell, calendar, info, lock, logout, snow, upload, x }
function icon(name: keyof typeof icons) { return `<span class="icon" aria-hidden="true">${icons[name]}</span>` }
const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (value: string) => value.replace(/[&<>"']/g, c => escapes[c])
export const missionFor = (id: MissionId) => missions.find(item => item.id === id)!
const stateLabel: Record<Status, string> = { approved: '승인 완료', pending: '검토 중', rejected: '반려' }
const badge = (status: Status) => `<span class="status ${status}">${stateLabel[status]}</span>`
const dateLabel = (created: number) => koreanDay(new Date(created)).replaceAll('-', '.')
const cover = `<img class="cover" src="${import.meta.env.BASE_URL}media/winter-campus.webp" alt="" fetchpriority="high">`

function emoji(id: MissionId) {
  return `<img src="${import.meta.env.BASE_URL}media/emoji/${id}.png" alt="" width="32" height="32">`
}

export function header(person: Person | null, admin: boolean) {
  return `<div class="frame header-inner">
    <a href="#home" class="brand" aria-label="캠퍼스케어 홈"><span class="brand-mark" aria-hidden="true"></span>캠퍼스케어</a>
    <span class="brand-campus">평택캠퍼스</span>
    ${person ? `<nav aria-label="화면 선택"><a href="#home" ${admin ? '' : 'aria-current="page"'}>참여 홈</a><a href="#admin" ${admin ? 'aria-current="page"' : ''}>운영 관리</a></nav>` : ''}
    <div class="header-right"><button type="button" class="utility" data-action="news">${icon('bell')}<span>캠페인 소식</span></button>
    ${person ? `<button type="button" class="utility logout" data-action="logout" aria-label="로그아웃">${icon('logout')}</button>` : ''}</div>
  </div>`
}

function hero() {
  return `<section class="hero">${cover}<div class="hero-content">
    <span class="season">${icon('snow')} 겨울철 감염병 예방 캠페인</span>
    <h1>건강한 겨울,<br>매일의 실천.</h1>
    <p>네 가지 생활예방 미션으로<br>건강한 캠퍼스를 함께 만들어요.</p>
    <span class="hero-date">${icon('calendar')} 2026.12.01 – 12.31</span>
  </div></section>`
}

function missionCards(entries?: Submission[]) {
  const today = koreanDay()
  return `<section class="mission-section" aria-labelledby="missions-title">
    <div class="section-heading"><h2 id="missions-title">${entries ? '오늘의 미션' : '네 가지 생활예방 미션'}</h2><span>미션별 1점 · 하루 최대 4점</span></div>
    <div class="mission-grid">${missions.map(m => {
      const row = entries?.find(r => r.day === today && r.mission === m.id)
      const available = !row || row.status === 'rejected'
      return `<article class="mission-card"><div class="card-top"><span class="emoji" aria-hidden="true">${emoji(m.id)}</span>${row ? badge(row.status) : '<span class="points">+1점</span>'}</div>
        <h3>${m.title}</h3><p>${m.detail}</p>
        ${entries ? `<button type="button" class="button ${available ? 'secondary' : 'inactive'}" data-mission="${m.id}" ${available ? '' : 'disabled'}>${row ? ({ approved: '오늘 참여 완료', pending: '운영자 검토 중', rejected: '새 사진으로 재제출' })[row.status] : '사진으로 참여'}</button>` : ''}</article>`
    }).join('')}</div></section>`
}

export function loginView() {
  return `<div class="frame page"><div class="intro-grid">${hero()}
    <section class="login-panel" aria-labelledby="login-title">
      <span class="feature-icon">${icon('lock')}</span>
      <h2 id="login-title">캠페인 로그인</h2>
      <p class="lead">사번과 이름을 입력하고 참여해 주세요.</p>
      <form id="login-form"><label>사번<input name="employee" placeholder="사번 입력" required></label>
        <label>이름<input name="name" placeholder="이름 입력" required></label>
        <p class="error" role="alert"></p><button class="button dark full">로그인하고 참여하기</button>
      </form>
      <p class="hint">${icon('info')}<span>데모에서는 임의의 사번과 이름을 사용할 수 있어요.</span></p>
    </section></div>${missionCards()}</div>`
}

export function participantView(person: Person, entries: Submission[]) {
  const approved = entries.filter(row => row.status === 'approved')
  const today = approved.filter(row => row.day === koreanDay()).length
  return `<div class="frame page"><div class="intro-grid signed-in">${hero()}
    <section class="score-panel"><span class="feature-icon">${icon('activity')}</span><h2>${esc(person.name)}님의 참여 현황</h2>
    <p class="lead">이번 캠페인에서 모은 점수</p><strong class="score">${approved.length}<small>점</small></strong>
    <div class="progress-label"><span>오늘 완료한 미션</span><strong>${today} / 4</strong></div>
    <div class="progress" aria-hidden="true">${missions.map((_, i) => `<i class="${i < today ? 'done' : ''}"></i>`).join('')}</div></section></div>
    ${missionCards(entries)}
    <section class="section"><div class="section-heading"><h2>참여 기록</h2><span>총 ${entries.length}건</span></div>
    ${entries.length ? `<ul class="records">${entries.map(row => `<li><span class="record-emoji" aria-hidden="true">${emoji(row.mission)}</span><div><strong>${missionFor(row.mission).title}</strong><small>${esc(row.day)}${row.reason ? ' · ' + esc(row.reason) : ''}</small></div>${badge(row.status)}${row.status === 'approved' ? '<b class="earned">+1점</b>' : ''}</li>`).join('')}</ul>` : '<p class="empty">첫 미션을 제출하면 참여 기록이 여기에 표시돼요.</p>'}</section></div>`
}

export function adminView(queue: Submission[], news: News[]) {
  return `<div class="frame page admin"><div class="page-title"><h1>캠페인 운영 관리</h1><p>이 브라우저에 제출된 사진을 검토하고 참여자에게 소식을 전하세요.</p></div>
    <section class="section"><div class="section-heading"><h2>검토 대기 사진</h2><span>${queue.length}건</span></div>
    ${queue.length ? `<ul class="records">${queue.map(row => `<li><span class="record-emoji" aria-hidden="true">${emoji(row.mission)}</span>
      <div><strong>${missionFor(row.mission).title}</strong><small>${esc(row.name)} · ${esc(row.employee)} · ${row.day}</small></div>
      <button type="button" class="button secondary compact" data-review="${row.id}">사진 검토</button></li>`).join('')}</ul>` : '<p class="empty">현재 검토를 기다리는 사진이 없어요.</p>'}</section>
    <section class="section"><div class="section-heading"><h2>캠페인 소식</h2><button type="button" class="button dark compact" data-action="compose">소식 작성</button></div>
    ${newsList(news)}</section></div>`
}

export function newsList(items: News[]) {
  return `<div class="news-list">${items.map(item => `<article><small>${item.created ? dateLabel(item.created) : '캠페인 안내'}</small><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join('')}</div>`
}

export function dialogTitle(title: string) {
  return `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" type="button" data-action="close" aria-label="닫기">${icon('x')}</button></div>`
}
export function newsDialog(items: News[], signedIn: boolean) {
  return `${dialogTitle('캠페인 소식')}${newsList(items)}<div class="actions">
    ${signedIn ? '<button type="button" class="button secondary" data-action="hide-news">오늘 하루 보지 않기</button>' : ''}
    <button type="button" class="button dark" data-action="close">확인</button></div>`
}
export function composeDialog() {
  return `${dialogTitle('캠페인 소식 작성')}<form id="compose-form">
    <label>제목<input name="title" required maxlength="120"></label><label>내용<textarea name="body" rows="5" required maxlength="5000"></textarea></label>
    <p class="error" role="alert"></p><button class="button blue full">게시하기</button></form>`
}
export function uploadDialog(id: MissionId) {
  const m = missionFor(id)
  return `${dialogTitle(m.title)}<p class="lead">${m.detail}</p><form id="upload-form" data-id="${id}">
    <label class="consent"><input type="checkbox" name="consent" required><span>사진을 이 기기의 브라우저에 저장하고 데모 운영 화면에서 확인하는 데 동의해요.</span></label>
    <div class="picker">${icon('upload')}<label for="photo">참여 사진 선택</label><small>JPG, PNG, WebP · 최대 10MB</small><input name="photo" id="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled required></div>
    <img class="photo-preview" id="photo-preview" alt="선택한 사진 미리보기" hidden>
    <fieldset><legend>데모 판정 방식</legend><label><input type="radio" name="mode" value="approved" checked> 자동 승인 예시</label>
    <label><input type="radio" name="mode" value="pending"> 운영자 검토 예시</label></fieldset>
    <p class="error" role="alert"></p><button class="button blue full" disabled>사진 제출</button></form>`
}
export function reviewDialog(row: Submission, url: string) {
  return `${dialogTitle(missionFor(row.mission).title + ' 검토')}<p class="lead">${esc(row.name)} · ${esc(row.employee)} · ${row.day}</p>
    <img class="photo-preview" src="${url}" alt="참여자가 제출한 사진">
    <form id="review-form" data-id="${row.id}"><label>반려 사유 <small>반려 시 필수</small><textarea name="reason" rows="2"></textarea></label>
    <p class="error" role="alert"></p><div class="actions"><button class="button secondary" value="rejected">반려</button><button class="button blue" value="approved">승인 · 1점 부여</button></div></form>`
}
