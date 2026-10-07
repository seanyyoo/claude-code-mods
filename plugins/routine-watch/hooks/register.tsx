// routine-watch: /routine-watch reads the Notion database your scheduled routines write to and shows
// today's haul by source, a 7-day chart, sources that came back empty (likely broken) and when
// each routine runs next.
import type { Register } from 'claude-code'

const PANE = 'routines'
const SETUP = 'Set your Notion view URL in /plugin → buildalone-mods → routine-watch'
const COLORS = ['#d97757', '#c98a3a', '#788c5d', '#6a9bcc', '#a3a199']
type Row = Record<string, string | undefined>
let servers: string[] = []
let viewUrl = ''
let dateKey = 'date:Date Collected:start'
let sourceKey = 'Source'
let sources: [string, string][] = []
let runs: [string, number, number][] = []
let rows: Row[] = []
let at = 0
let err = ''
let pulling = false

const list = (s: unknown) => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const dateOf = (r: Row) => r[dateKey] ?? ''

async function pull($: any) {
  if (pulling || !viewUrl) return false
  pulling = true
  try { return await pullOnce($) } finally { pulling = false }
}
async function query($: any, args: Record<string, unknown>) {
  let first: unknown
  for (const server of servers) {
    try { return await $.mcp.call(server, 'notion-query-data-sources', args) } catch (x) { first ??= x }
  }
  throw first ?? new Error('no Notion server')
}
// View mode: Notion caps "query data source" calls on non-Business plans (a quota your routines
// share), but saved-view queries have no quota. Reads the view newest pages first, and stops once
// it reaches rows older than a week.
async function pullOnce($: any) {
  const now = new Date(await $.clock.now())
  const since = new Date(now); since.setDate(since.getDate() - 7)
  const cut = day(since)
  const got: Row[] = []
  let cursor: string | undefined
  try {
    for (let page = 0; page < 15; page++) {
      const res = await query($, { data: { mode: 'view', view_url: viewUrl, page_size: 20, ...(cursor ? { start_cursor: cursor } : {}) } })
      const txt = (res.content ?? []).map((c: any) => c.text ?? '').join('')
      if (res.isError || !txt.trim().startsWith('{')) throw new Error(txt.slice(0, 160))
      const j = JSON.parse(txt)
      const rs: Row[] = j.results ?? []
      got.push(...rs)
      // newest first: stop once this page reaches rows older than the window
      if (rs.some(r => (r[dateKey] ?? '9') < cut)) break
      if (!j.has_more || !j.next_cursor) break
      cursor = j.next_cursor
    }
  } catch (x: any) {
    err = String(x?.message ?? x).slice(0, 170)
    $.ui.invalidate('ui.render')
    return false
  }
  rows = got.filter(r => dateOf(r) >= cut)
  err = ''
  at = +now
  $.ui.invalidate('ui.render')
  return true
}
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function nextRun(h: number, m: number, now: Date) {
  const t = new Date(now); t.setHours(h, m, 0, 0)
  if (t <= now) t.setDate(t.getDate() + 1)
  const ms = +t - +now, hh = Math.floor(ms / 3.6e6), mm = Math.floor((ms % 3.6e6) / 6e4)
  return `${hh}h ${mm}m`
}

const STYLE = `<style>
  svg{--bg:#ffffff;--fg:#141413;--mu:#73726c;--ln:#e8e6dc;--tr:#f0eee6;--ac:#d97757;--ok:#788c5d;--wa:#c98a3a;--bad:#bf4d43}
  @media (prefers-color-scheme: dark){svg{--bg:#262624;--fg:#faf9f5;--mu:#a3a199;--ln:#3d3d3a;--tr:#30302e}}
  .card{fill:var(--bg);stroke:var(--ln);stroke-width:1}
  .fg{fill:var(--fg)} .mu{fill:var(--mu)} .tr{fill:var(--tr)} .trs{stroke:var(--tr)} .ln{stroke:var(--ln)}
  .ac{fill:var(--ac)} .acs{stroke:var(--ac)} .ok{fill:var(--ok)} .oks{stroke:var(--ok)} .wa{fill:var(--wa)} .was{stroke:var(--wa)} .bad{fill:var(--bad)} .bads{stroke:var(--bad)}
  .t{font-family:ui-serif,"Tiempos Text",Georgia,serif}
  text{font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif}
</style>`
function setupCard() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="96" viewBox="0 0 460 96">${STYLE}
  <rect x="0.5" y="0.5" width="459" height="95" rx="14" class="card"/>
  <text x="24" y="34" font-size="13" class="mu">⚙ Routines</text>
  <text x="24" y="66" font-size="13" class="fg">${esc(SETUP)}</text></svg>`
}
function card(now: Date) {
  const today = day(now)
  const todays = rows.filter(r => dateOf(r) === today)
  const by = (rs: Row[], s: string) => rs.filter(r => r[sourceKey] === s).length
  const days = [...Array(7)].map((_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return day(d) })
  const counts = days.map(d => rows.filter(r => dateOf(r) === d).length)
  const max = Math.max(1, ...counts)
  const cols = counts.map((c, i) => {
    const h = Math.max(2, (64 * c) / max), x = 262 + i * 25
    return `<rect x="${x}" y="${132 - h}" width="15" height="${h}" rx="3" class="${i === 6 ? 'ac' : 'tr'}"/>
    <text x="${x + 7.5}" y="148" text-anchor="middle" font-size="10" class="mu">${days[i]!.slice(8)}</text>`
  }).join('')
  let off = 0
  const segs = sources.map(([s, c]) => { const n = by(todays, s); const w = todays.length ? (210 * n) / todays.length : 0; const r = `<rect x="${24 + off}" y="104" width="${w}" height="6" fill="${c}"/>`; off += w; return r }).join('')
  const legend = sources.slice(0, 3).map(([s, c], i) => `<circle cx="${28 + i * 72}" cy="${128}" r="3.5" fill="${c}"/><text x="${36 + i * 72}" y="132" font-size="11" class="mu">${esc(s.slice(0, 7))} ${by(todays, s)}</text>`).join('')
  const dead = sources.map(([s]) => s).filter(s => rows.length && by(rows, s) === 0)
  const runRows = runs.length
    ? runs.map(([n, h, m], i) => `<text x="24" y="${196 + i * 24}" font-size="13" class="fg">${esc(n)}</text><text x="436" y="${196 + i * 24}" text-anchor="end" font-size="12" class="mu">next run in ${nextRun(h, m, now)}</text>`).join('')
    : `<text x="24" y="196" font-size="12" class="mu">Add your routines' run times in the plugin settings to see next runs.</text>`
  const lastY = 196 + (Math.max(1, runs.length) - 1) * 24
  const deadY = lastY + 32
  const H = dead.length ? deadY + 14 : lastY + 22
  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="${H}" viewBox="0 0 460 ${H}">${STYLE}
  <rect x="0.5" y="0.5" width="459" height="${H - 1}" rx="14" class="card"/>
  <text x="24" y="34" font-size="13" class="mu">⚙ Routines</text>
  <text x="436" y="34" text-anchor="end" font-size="11" class="${at ? 'mu' : 'wa'}">${at ? 'Notion · live' : err ? 'Notion unreachable' : 'loading…'}</text>
  <text x="24" y="86" font-size="44" font-weight="600" class="fg">${todays.length}</text>
  <text x="${todays.length >= 10 ? 80 : 56}" y="86" font-size="13" class="mu">collected today</text>
  <rect x="24" y="104" width="210" height="6" rx="3" class="tr"/>${segs}${legend}
  <text x="262" y="56" font-size="11" class="mu">Last 7 days</text>${cols}
  <line x1="24" y1="168" x2="436" y2="168" class="ln"/>
  ${runRows}
  ${dead.length ? `<text x="${24}" y="${deadY}" font-size="12" class="wa">No ${esc(dead.join(', '))} items this week: that source may be broken</text>` : ''}
</svg>`
}

export const register: Register = (on, options) => {
  servers = [...new Set([String(options.notion_server ?? '').trim(), 'notion'].filter(Boolean))]
  viewUrl = String(options.notion_view_url ?? '').trim()
  dateKey = `date:${String(options.date_property ?? '').trim() || 'Date Collected'}:start`
  sourceKey = String(options.source_property ?? '').trim() || 'Source'
  sources = list(options.sources).map((s, i): [string, string] => [s, COLORS[i % COLORS.length]!])
  // "Name@HH:MM" pairs; entries without a valid time are skipped
  runs = list(options.routines).flatMap((r): [string, number, number][] => {
    const m = r.match(/^(.+?)\s*@\s*(\d{1,2}):(\d{2})$/)
    return m && +m[2]! < 24 && +m[3]! < 60 ? [[m[1]!, +m[2]!, +m[3]!]] : []
  })

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'show', description: 'Open the ⚙ Routines pane in Claude Code for the person' })
    await $.command.register({ name: 'routine-watch', description: 'Show what your scheduled routines collected, and when they run next' })
    $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('command.run', { command: 'routine-watch' }, async $ => {
    await $.ui.open({ id: PANE, title: '⚙ Routines' })
    if (!viewUrl) return { text: SETUP }
    const ok = await pull($)
    return { text: ok ? `Routine watch: ${rows.length} items this week.` : 'Routine watch: could not reach Notion.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (!viewUrl) {
      if (e.surface === 'terminal') {
        const { Text } = $.ui.resolve(e)
        return <Text>{SETUP}</Text>
      }
      const { Svg } = $.ui.resolve(e)
      return <Svg source={setupCard()} alt={SETUP} width={460} isInteractive />
    }
    const now = new Date(await $.clock.now())
    if (!at && !err) void pull($)
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{rows.filter(r => dateOf(r) === day(now)).length} collected today</Text>
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={card(now)} alt="Scheduled routine summary" width={460} isInteractive />
  })

  on('tool.call', { tool: 'mcp__routine-watch__show' }, async $ => {
    try { await $.ui.close({ id: PANE }) } catch {}
    await $.ui.open({ id: PANE, title: '⚙ Routines' })
    if (!viewUrl) return { result: `⚙ Routines pane opened. ${SETUP}.` }
    const ok = (await $.clock.now()) - at < 10 * 60e3 ? true : await pull($)
    return { result: ok ? `⚙ Routines pane opened: ${rows.length} items this week.` : `⚙ Routines pane opened; Notion read failed: ${err}` }
  })
}
