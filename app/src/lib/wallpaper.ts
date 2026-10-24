// ロック画面の壁紙：ランク・今日のクエスト・4マスのタスクを1枚の画像に描く

import type { Game } from '../store/game'
import { alpha } from './color'
import { daysBetween } from './date'
import { TASK_BOXES } from './defaults'
import type { TaskBox } from './types'

export interface WallpaperQuest {
  title: string
  state: 'done' | 'started' | 'open'
  challenge: boolean
}

export interface WallpaperData {
  date: string
  round: number
  rest: boolean
  rank: { name: string; color: string; progress: number; nextName: string | null; xpToNext: number | null; promotion: boolean }
  streak: number
  quests: WallpaperQuest[]
  board: Record<TaskBox, { title: string; done: boolean }[]>
}

export function wallpaperData(g: Game): WallpaperData {
  const r = g.rank
  const board = { now: [], key: [], next: [], someday: [] } as WallpaperData['board']
  for (const { box } of TASK_BOXES) board[box] = g.taskBoard[box].map((t) => ({ title: t.title, done: t.done }))
  return {
    date: g.today,
    round: daysBetween(g.startDate, g.today) + 1,
    rest: g.isRestDay,
    rank: {
      name: r.fullName,
      color: r.rank.color,
      progress: r.progress,
      nextName: r.next?.name ?? null,
      xpToNext: r.next && !r.promotion ? r.next.xpNeeded : null,
      promotion: !!r.promotion,
    },
    streak: g.streak,
    quests: g.todayQuests.map((q) => ({
      title: q.title,
      state: q.done ? 'done' : q.started ? 'started' : 'open',
      challenge: q.kind === 'challenge',
    })),
    board,
  }
}

// ---------- 描画 ----------

const JA = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif'
const HUD = `"Barlow Condensed",${JA}`
const C = {
  bg: '#07090d', panel: 'rgba(14,18,24,.78)', line: 'rgba(255,255,255,.16)',
  text: '#e9edf2', sub: '#8b95a5', mute: '#5d6676', atk: '#ff8c1a', danger: '#ff4655', streak: '#ffb067',
}
const BOX_COLOR: Record<TaskBox, string> = { now: '#ff4655', key: '#ff8c1a', next: '#8fb3da', someday: '#8b95a5' }

type Ctx = CanvasRenderingContext2D

function setFont(ctx: Ctx, weight: number, size: number, family = JA) {
  ctx.font = `${weight} ${size}px ${family}`
}

/** 字間をあけて書く（canvas の letterSpacing は端末によって効かないので手で並べる） */
function spaced(ctx: Ctx, text: string, x: number, y: number, gap: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + gap
  }
  return cx - gap
}

/** 1行に収まらなければ「…」で切る */
function fit(ctx: Ctx, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1)
  return `${s}…`
}

/** 1文字ずつ折り返す（日本語向け）。maxLines を超えたら最後の行を「…」で切る */
function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number) {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur)
      cur = ch
    } else cur += ch
  }
  if (cur) lines.push(cur)
  if (lines.length <= maxLines) return lines
  const head = lines.slice(0, maxLines)
  head[maxLines - 1] = fit(ctx, head[maxLines - 1] + lines.slice(maxLines).join(''), maxW)
  return head
}

/** 右に傾いた平行四辺形（R6 の HUD 風） */
function skewRect(ctx: Ctx, x: number, y: number, w: number, h: number, skew: number) {
  ctx.beginPath()
  ctx.moveTo(x + skew, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w - skew, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

function hexagon(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath()
}

function sectionHead(ctx: Ctx, u: number, x: number, y: number, en: string, ja: string) {
  ctx.fillStyle = C.atk
  skewRect(ctx, x, y - 7 * u, 5 * u, 14 * u, 2.5 * u)
  ctx.fill()
  ctx.fillStyle = C.text
  setFont(ctx, 800, 14 * u, HUD)
  const end = spaced(ctx, en, x + 11 * u, y, 1.2 * u)
  ctx.fillStyle = C.sub
  setFont(ctx, 500, 11 * u)
  ctx.fillText(ja, end + 8 * u, y)
}

export function drawWallpaper(ctx: Ctx, d: WallpaperData, w: number, h: number, stamp: string) {
  const u = w / 390
  const px = 22 * u
  const color = d.rank.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  // 背景：暗い地にランク色の光と細いグリッド
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(w / 2, h * 0.17, 0, w / 2, h * 0.17, w * 0.8)
  glow.addColorStop(0, alpha(color, 0.26))
  glow.addColorStop(1, alpha(color, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  // グリッドは画素の境目にそろえて描く（ぼけると画像が重くなる）
  ctx.fillStyle = 'rgba(255,255,255,.035)'
  const step = Math.round(26 * u)
  const lw = Math.max(1, Math.round(u * 0.5))
  for (let x = 0; x <= w; x += step) ctx.fillRect(x, 0, lw, h)
  for (let y = 0; y <= h; y += step) ctx.fillRect(0, y, w, lw)

  // 時計の下から描く
  let y = h * 0.3

  // ---- ランク ----
  ctx.strokeStyle = color
  ctx.lineWidth = 2.2 * u
  hexagon(ctx, px + 14 * u, y, 13 * u)
  ctx.stroke()
  ctx.fillStyle = alpha(color, 0.18)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px + 8 * u, y + 3 * u); ctx.lineTo(px + 14 * u, y - 3 * u); ctx.lineTo(px + 20 * u, y + 3 * u)
  ctx.stroke()
  ctx.fillStyle = color
  setFont(ctx, 800, 27 * u, HUD)
  spaced(ctx, d.rank.name, px + 36 * u, y + 1 * u, 1 * u)

  // 右端に連続日数
  ctx.textAlign = 'right'
  ctx.fillStyle = C.streak
  setFont(ctx, 700, 10 * u)
  ctx.fillText('日', w - px, y + 5 * u)
  setFont(ctx, 800, 26 * u, HUD)
  const num = String(d.streak)
  ctx.fillText(num, w - px - 13 * u, y + 1 * u)
  const numW = ctx.measureText(num).width
  setFont(ctx, 700, 9 * u, HUD)
  ctx.fillText('STREAK', w - px - 19 * u - numW, y + 3 * u)
  ctx.textAlign = 'left'

  y += 26 * u
  const barW = w - px * 2
  ctx.fillStyle = '#141a23'
  skewRect(ctx, px, y, barW, 7 * u, 3 * u)
  ctx.fill()
  ctx.fillStyle = color
  skewRect(ctx, px, y, Math.max(6 * u, barW * Math.min(1, d.rank.progress)), 7 * u, 3 * u)
  ctx.fill()
  y += 20 * u
  ctx.fillStyle = C.sub
  setFont(ctx, 500, 11 * u)
  ctx.fillText(
    d.rank.promotion ? '昇格戦：条件をクリアしよう'
      : d.rank.nextName ? `${d.rank.nextName} まであと ${(d.rank.xpToNext ?? 0).toLocaleString()} XP` : '最高ランク',
    px, y,
  )

  // ---- 今日のクエスト ----
  y += 34 * u
  sectionHead(ctx, u, px, y, 'OBJECTIVES', '今日のクエスト')
  y += 22 * u
  if (d.rest) {
    ctx.fillStyle = '#8fb3da'
    setFont(ctx, 700, 14 * u)
    ctx.fillText('REST DAY ・ 今日は休息日', px, y + 4 * u)
    y += 30 * u
  } else if (d.quests.length === 0) {
    ctx.fillStyle = C.danger
    setFont(ctx, 700, 14 * u)
    ctx.fillText('まだ決めていない ・ アプリで1つ決めよう', px, y + 4 * u)
    y += 30 * u
  } else {
    d.quests.forEach((q, i) => {
      const cy = y + 13 * u
      const tile = 24 * u
      skewRect(ctx, px, cy - tile / 2, tile, tile, 4 * u)
      if (q.state === 'done') {
        ctx.fillStyle = color
        ctx.fill()
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.55)'
        ctx.fill()
        ctx.strokeStyle = q.state === 'started' ? C.atk : C.line
        ctx.lineWidth = 1.6 * u
        ctx.stroke()
      }
      ctx.textAlign = 'center'
      ctx.fillStyle = q.state === 'done' ? C.bg : q.state === 'started' ? C.atk : C.text
      setFont(ctx, 800, 15 * u, HUD)
      ctx.fillText('ABC'[i] ?? String(i + 1), px + tile / 2, cy + 1 * u)
      ctx.textAlign = 'left'

      const tx = px + tile + 12 * u
      let maxW = w - px - tx
      const tag = q.state === 'started' ? '着手' : q.challenge ? '挑戦' : ''
      setFont(ctx, 700, 10 * u)
      const tagW = tag ? ctx.measureText(tag).width + 10 * u : 0
      if (tag) maxW -= tagW + 8 * u
      setFont(ctx, 700, 15 * u)
      const title = fit(ctx, q.title, maxW)
      ctx.fillStyle = q.state === 'done' ? C.mute : C.text
      ctx.fillText(title, tx, cy)
      const tw = ctx.measureText(title).width
      if (q.state === 'done') {
        ctx.strokeStyle = C.mute
        ctx.lineWidth = 1.4 * u
        ctx.beginPath(); ctx.moveTo(tx, cy); ctx.lineTo(tx + tw, cy); ctx.stroke()
      }
      if (tag) {
        const gx = tx + tw + 8 * u
        ctx.fillStyle = q.state === 'started' ? 'rgba(255,140,26,.18)' : C.atk
        ctx.fillRect(gx, cy - 8 * u, tagW, 16 * u)
        ctx.fillStyle = q.state === 'started' ? C.atk : C.bg
        setFont(ctx, 700, 10 * u)
        ctx.fillText(tag, gx + 5 * u, cy + 0.5 * u)
      }
      y += 32 * u
    })
  }

  // ---- 4マス ----
  y += 14 * u
  sectionHead(ctx, u, px, y, 'TASK BOARD', 'タスク')
  y += 16 * u
  const bottom = h * 0.85
  const cellW = (w - px * 2) / 2
  const cellH = Math.max(60 * u, Math.min(176 * u, (bottom - y) / 2))
  ctx.fillStyle = C.panel
  ctx.fillRect(px, y, cellW * 2, cellH * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.22)'
  ctx.lineWidth = 1.2 * u
  ctx.setLineDash([2.5 * u, 4 * u])
  ctx.beginPath()
  ctx.moveTo(px + cellW, y + 6 * u); ctx.lineTo(px + cellW, y + cellH * 2 - 6 * u)
  ctx.moveTo(px + 6 * u, y + cellH); ctx.lineTo(px + cellW * 2 - 6 * u, y + cellH)
  ctx.stroke()
  ctx.setLineDash([])

  TASK_BOXES.forEach(({ box, en, ja }, i) => {
    const cx = px + (i % 2) * cellW
    const cy = y + Math.floor(i / 2) * cellH
    const bc = BOX_COLOR[box]
    const list = d.board[box]
    const open = list.filter((t) => !t.done).length
    ctx.fillStyle = bc
    setFont(ctx, 900, 14 * u)
    ctx.fillText(ja, cx + 12 * u, cy + 18 * u)
    const jw = ctx.measureText(ja).width
    ctx.fillStyle = C.mute
    setFont(ctx, 700, 8.5 * u, HUD)
    spaced(ctx, en, cx + 18 * u + jw, cy + 19 * u, 1.4 * u)
    if (open) {
      ctx.textAlign = 'right'
      ctx.fillStyle = C.text
      setFont(ctx, 800, 15 * u, HUD)
      ctx.fillText(String(open), cx + cellW - 12 * u, cy + 18 * u)
      ctx.textAlign = 'left'
    }

    const textX = cx + 32 * u
    const textW = cellW - 44 * u
    const lineH = 18 * u
    const limit = cy + cellH - 10 * u
    let iy = cy + 40 * u
    for (let k = 0; k < list.length; k++) {
      const t = list[k]
      setFont(ctx, t.done ? 500 : 700, 13 * u)
      const lines = wrap(ctx, t.title, textW, 2)
      const need = lines.length * lineH
      const rest = list.length - k
      // 文字の下端が枠を超えるなら「ほか○件」にする（最後の1件以外は、その行の分をあけておく）
      if (iy - lineH / 2 + need > limit - (rest > 1 ? 14 * u : 0)) {
        ctx.fillStyle = C.sub
        setFont(ctx, 500, 11 * u)
        ctx.fillText(`ほか${rest}件`, textX, iy)
        break
      }
      // 丸（完了なら塗りとチェック）
      ctx.beginPath()
      ctx.arc(cx + 19 * u, iy, 6.5 * u, 0, Math.PI * 2)
      if (t.done) {
        ctx.fillStyle = bc
        ctx.fill()
        ctx.strokeStyle = C.bg
        ctx.lineWidth = 1.8 * u
        ctx.beginPath()
        ctx.moveTo(cx + 15.5 * u, iy); ctx.lineTo(cx + 18 * u, iy + 2.6 * u); ctx.lineTo(cx + 22.5 * u, iy - 2.6 * u)
        ctx.stroke()
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'
        ctx.lineWidth = 1.5 * u
        ctx.stroke()
      }
      ctx.fillStyle = t.done ? C.mute : C.text
      lines.forEach((line, li) => {
        const ly = iy + li * lineH
        ctx.fillText(line, textX, ly)
        if (t.done) {
          ctx.strokeStyle = C.mute
          ctx.lineWidth = 1.2 * u
          ctx.beginPath(); ctx.moveTo(textX, ly); ctx.lineTo(textX + ctx.measureText(line).width, ly); ctx.stroke()
        }
      })
      iy += need + 7 * u
    }
    if (list.length === 0) {
      ctx.fillStyle = C.mute
      setFont(ctx, 500, 11 * u)
      ctx.fillText('なし', cx + 12 * u, cy + 40 * u)
    }
  })

  // ---- いつの状態か ----
  ctx.textAlign = 'center'
  ctx.fillStyle = C.mute
  setFont(ctx, 600, 10 * u, HUD)
  ctx.fillText(`LIFE RANKED ・ ROUND ${d.round} ・ ${stamp}`, w / 2, y + cellH * 2 + 16 * u)
  ctx.textAlign = 'left'
}

let fontsReady: Promise<unknown> | null = null

function loadFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all(
      [600, 700, 800].map((wgt) => document.fonts.load(`${wgt} 20px "Barlow Condensed"`).catch(() => null)),
    )
  }
  return fontsReady
}

/** 壁紙を JPEG にする（背景のグラデーションがあると PNG は重いため）。stamp は「いつの状態か」の表示 */
export async function renderWallpaper(d: WallpaperData, w: number, h: number, stamp: string) {
  await loadFonts()
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を作れませんでした')
  drawWallpaper(ctx, d, w, h, stamp)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/jpeg', 0.92)
  })
}

/** この端末の画面サイズ（縦向き・実ピクセル） */
export function screenSize() {
  const dpr = window.devicePixelRatio || 1
  const a = Math.round(window.screen.width * dpr)
  const b = Math.round(window.screen.height * dpr)
  return { width: Math.min(a, b), height: Math.max(a, b) }
}
