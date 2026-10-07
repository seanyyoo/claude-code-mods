// publish-guard: before Claude types into the browser (YouTube Studio, forms) or writes a file
// under a guarded path, it checks the text for your blocked terms (and, if turned on, Korean
// text). The matched term is never echoed back. /pubguard shows the block log.
import type { Register } from 'claude-code'

const PANE = 'guard'
const HANGUL = /[가-힣ㄱ-ㆎ]/
type Hit = { at: number; what: string; where: string }
let log: Hit[] = []
let blocked: string[] = []
let allowed: string[] = []
let paths: string[] = []
let korean = false

const list = (s: unknown) => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean)
const reOf = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')

function problem(text: string): string | undefined {
  let t = text
  for (const a of allowed) t = t.replace(reOf(a), ' ')
  const low = t.toLowerCase()
  if (blocked.some(b => low.includes(b.toLowerCase()))) return 'a blocked term'
  if (korean && HANGUL.test(t)) return 'Korean text'
  return undefined
}
function textsOf(e: any): { text: string; where: string }[] {
  const t = String(e.tool)
  if (/^mcp__.*__computer$/.test(t) && e.action === 'type') return [{ text: String(e.text ?? ''), where: 'browser typing' }]
  if (/^mcp__.*__form_input$/.test(t)) return [{ text: String(e.value ?? ''), where: 'browser form' }]
  if (/^mcp__.*__browser_batch$/.test(t)) return (e.actions ?? []).flatMap((a: any) => textsOf({ tool: 'mcp__browser__' + a.name, ...(a.input ?? {}) }))
  const file = String(e.file_path ?? '')
  if ((t === 'Write' || t === 'Edit') && paths.some(p => file.includes(p))) {
    return [{ text: String(e.content ?? e.new_string ?? ''), where: file.split('/').slice(-2).join('/') }]
  }
  return []
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const STYLE = `<style>
  svg{--bg:#ffffff;--fg:#141413;--mu:#73726c;--ln:#e8e6dc;--tr:#f0eee6;--ac:#d97757;--ok:#788c5d;--wa:#c98a3a;--bad:#bf4d43}
  @media (prefers-color-scheme: dark){svg{--bg:#262624;--fg:#faf9f5;--mu:#a3a199;--ln:#3d3d3a;--tr:#30302e}}
  .card{fill:var(--bg);stroke:var(--ln);stroke-width:1}
  .fg{fill:var(--fg)} .mu{fill:var(--mu)} .tr{fill:var(--tr)} .trs{stroke:var(--tr)} .ln{stroke:var(--ln)}
  .ac{fill:var(--ac)} .acs{stroke:var(--ac)} .ok{fill:var(--ok)} .oks{stroke:var(--ok)} .wa{fill:var(--wa)} .was{stroke:var(--wa)} .bad{fill:var(--bad)} .bads{stroke:var(--bad)}
  .t{font-family:ui-serif,"Tiempos Text",Georgia,serif}
  text{font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif}
</style>`
function card() {
  const idle = !blocked.length && !korean
  const n = Math.max(1, Math.min(5, log.length)), H = 120 + n * 28
  const rows = log.slice(-5).reverse().map((h, i) => `<circle cx="30" cy="${103 + i * 28}" r="3" class="bad"/><text x="42" y="${107 + i * 28}" font-size="13" class="fg">Blocked ${h.what} <tspan class="mu">→ ${esc(h.where)}</tspan></text>`).join('')
  const empty = idle ? 'Add blocked terms in /plugin → buildalone-mods → publish-guard' : 'Nothing blocked yet.'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="${H}" viewBox="0 0 460 ${H}">${STYLE}
  <rect x="0.5" y="0.5" width="459" height="${H - 1}" rx="14" class="card"/>
  <path d="M36 22 l13 5 v9 c0 8 -6 13 -13 16 c-7 -3 -13 -8 -13 -16 v-9 z" class="${log.length ? 'ac' : idle ? 'tr' : 'ok'}"/>
  <text x="60" y="36" font-size="15" class="fg t">Publish guard</text>
  <text x="60" y="54" font-size="12" class="mu">Checks browser typing, forms and files in guarded paths</text>
  <text x="436" y="40" text-anchor="end" font-size="26" font-weight="600" class="fg">${log.length}</text>
  <text x="436" y="56" text-anchor="end" font-size="11" class="mu">blocked</text>
  <line x1="24" y1="76" x2="436" y2="76" class="ln"/>
  ${log.length ? rows : `<text x="24" y="107" font-size="13" class="mu">${esc(empty)}</text>`}</svg>`
}

export const register: Register = (on, options) => {
  blocked = list(options.blocked_terms)
  allowed = list(options.allowed_terms)
  paths = list(options.guarded_paths)
  korean = options.block_non_latin === 'korean'

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'show', description: 'Open the ⛨ Guard pane in Claude Code for the person' })
    await $.command.register({ name: 'pubguard', description: 'Show what the publish guard has blocked' })
    log = ((await $.store.get('log')) as Hit[]) ?? []
    return next(e)
  })

  on('command.run', { command: 'pubguard' }, async $ => {
    await $.ui.open({ id: PANE, title: '⛨ Guard' })
    return { text: `Publish guard: ${log.length} blocked so far.` }
  })

  on('tool.call', async ($, e, next) => {
    for (const { text, where } of textsOf(e)) {
      const why = problem(text)
      if (why) {
        log = [...log, { at: await $.clock.now(), what: why, where }].slice(-50)
        await $.store.set('log', log)
        $.ui.toast(`⛨ Publish guard blocked ${why} going into ${where}`)
        $.ui.invalidate('ui.render')
        return { deny: `publish-guard: this would put ${why} into ${where}. Remove it and try again.` }
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>Publish guard: {log.length} blocked</Text>
    }
    const { Svg } = $.ui.resolve(e)
    return <Svg source={card()} alt="Publish guard block log" width={460} isInteractive />
  })

  on('tool.call', { tool: 'mcp__publish-guard__show' }, async $ => {
    try { await $.ui.close({ id: PANE }) } catch {}
    await $.ui.open({ id: PANE, title: '⛨ Guard' })
    return { result: '⛨ Guard pane opened.' }
  })
}
