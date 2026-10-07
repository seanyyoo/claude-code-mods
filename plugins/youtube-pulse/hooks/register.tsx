// youtube-pulse: /pulse opens a card with the channel's latest videos, their views as bars and
// the gain since the last check (kept across sessions). Refreshes every 10 minutes.
import type { Register } from 'claude-code'

const PANE = 'pulse'
const SETUP = 'Set your channel ID in /plugin → buildalone-mods → youtube-pulse'
type Video = { id: string; title: string; published: string; views: number }
let channel = ''
let count = 6
let videos: Video[] = []
let prev: Record<string, number> = {}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n))

async function pull($: any) {
  if (!channel) return
  const r = await $.http.fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel)}`)
  if (!r.ok) return
  const list: Video[] = []
  for (const m of r.text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const x = m[1]
    list.push({
      id: x.match(/<yt:videoId>(.*?)</)?.[1] ?? '',
      title: decode(x.match(/<title>(.*?)</)?.[1] ?? ''),
      published: (x.match(/<published>(.*?)</)?.[1] ?? '').slice(0, 10),
      views: parseInt(x.match(/views="(\d+)"/)?.[1] ?? '0', 10),
    })
  }
  videos = list.slice(0, count)
  $.ui.invalidate('ui.render')
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
  <text x="24" y="34" font-size="13" class="mu">▶ YouTube</text>
  <text x="24" y="66" font-size="13" class="fg">${esc(SETUP)}</text></svg>`
}
function card() {
  const max = Math.max(1, ...videos.map(v => v.views))
  const total = videos.reduce((a, v) => a + v.views, 0)
  const H = 76 + videos.length * 44
  const rows = videos.map((v, i) => {
    const y = 70 + i * 44, w = Math.max(3, (300 * v.views) / max)
    const was = prev[v.id], gain = was !== undefined ? v.views - was : 0
    const t = v.title.length > 46 ? v.title.slice(0, 45) + '…' : v.title
    return `<text x="24" y="${y}" font-size="13" class="fg">${esc(t)}</text>
    <rect x="24" y="${y + 9}" width="300" height="6" rx="3" class="tr"/>
    <rect x="24" y="${y + 9}" width="${w}" height="6" rx="3" class="ac"><animate attributeName="width" from="0" to="${w}" dur="${0.5 + i * 0.1}s" fill="freeze"/></rect>
    <text x="340" y="${y + 16}" font-size="13" font-weight="600" class="fg">${fmt(v.views)}</text>
    <text x="436" y="${y + 16}" text-anchor="end" font-size="12" class="${gain > 0 ? 'ok' : 'mu'}">${gain > 0 ? '+' + gain : '—'}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="${H}" viewBox="0 0 460 ${H}">${STYLE}
  <rect x="0.5" y="0.5" width="459" height="${H - 1}" rx="14" class="card"/>
  <text x="24" y="34" font-size="13" class="mu">▶ YouTube · latest ${videos.length}</text>
  <text x="436" y="34" text-anchor="end" font-size="13" class="mu"><tspan class="fg" font-weight="600">${fmt(total)}</tspan> views</text>
  ${rows}</svg>`
}

export const register: Register = (on, options) => {
  channel = String(options.channel_id ?? '').trim()
  count = Math.min(15, Math.max(1, Math.round(Number(options.count) || 6)))

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'show', description: 'Open the ▶ Pulse pane in Claude Code for the person' })
    await $.command.register({ name: 'pulse', description: 'Show your latest YouTube videos and their views' })
    prev = ((await $.store.get('seen')) as Record<string, number>) ?? {}
    if (channel) $.clock.every(600000, () => { void pull($) })
    return next(e)
  })

  on('command.run', { command: 'pulse' }, async $ => {
    await $.ui.open({ id: PANE, title: '▶ Pulse' })
    if (!channel) return { text: SETUP }
    await pull($)
    const latest = videos[0]
    // remember what was seen now, so next time the gain shows what changed since this look
    const seen: Record<string, number> = {}
    for (const v of videos) seen[v.id] = v.views
    await $.store.set('seen', seen)
    return { text: latest ? `Latest: "${latest.title}" · ${latest.views} views` : 'Pulse opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (!channel) {
      if (e.surface === 'terminal') {
        const { Text } = $.ui.resolve(e)
        return <Text>{SETUP}</Text>
      }
      const { Svg } = $.ui.resolve(e)
      return <Svg source={setupCard()} alt={SETUP} width={460} isInteractive />
    }
    if (!videos.length) await pull($)
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return <Box flexDirection="column">{videos.map(v => <Text>{fmt(v.views)}  {v.title}</Text>)}</Box>
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={card()} alt="Latest YouTube videos and view counts" width={460} isInteractive />
  })

  on('tool.call', { tool: 'mcp__youtube-pulse__show' }, async $ => {
    try { await $.ui.close({ id: PANE }) } catch {}
    await $.ui.open({ id: PANE, title: '▶ Pulse' })
    return { result: channel ? '▶ Pulse pane opened.' : `▶ Pulse pane opened. ${SETUP}.` }
  })
}
