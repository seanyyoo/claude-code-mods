// credit-meter: /credits opens a card with ElevenLabs characters left and Higgsfield credits.
// Before a tool call that spends credits (voice generation, image/video generation) it toasts
// what you have left, and after it toasts what the call cost.
import type { Register } from 'claude-code'

type Balances = { el?: { left: number; limit: number; resetsAt?: number }; hf?: number; at: number }
const PANE = 'credits'
let last: Balances = { at: 0 }
let configuredKey = ''
let servers: string[] = []

// Key order: the plugin setting, then $ELEVENLABS_API_KEY, then the ElevenLabs MCP server's env in ~/.claude.json.
async function elevenLabsKey($: any, configured: string): Promise<string | undefined> {
  if (configured) return configured
  const fromEnv = await $.env.get('ELEVENLABS_API_KEY')
  if (fromEnv) return fromEnv
  try {
    const home = await $.env.get('HOME')
    if (!home) return undefined
    const cfg = JSON.parse(await $.fs.read(`${home}/.claude.json`))
    return cfg?.mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY || undefined
  } catch { return undefined }
}
async function elevenLabs($: any, configured: string): Promise<Balances['el']> {
  try {
    const key = await elevenLabsKey($, configured)
    if (!key) return undefined
    const r = await $.http.fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
    if (!r.ok) return undefined
    const j = JSON.parse(r.text)
    return { left: j.character_limit - j.character_count, limit: j.character_limit, resetsAt: j.next_character_count_reset_unix }
  } catch { return undefined }
}
async function higgsfield($: any, servers: string[]): Promise<number | undefined> {
  for (const server of servers) {
    try {
      const res = await $.mcp.call(server, 'balance', {})
      const txt = (res.content ?? []).map((c: any) => c.text ?? '').join(' ')
      const m = txt.match(/"?credits"?\s*[:=]\s*([\d.]+)/i) ?? txt.match(/([\d][\d,.]*)\s*credits/i)
      if (m) return parseFloat(m[1].replace(/,/g, ''))
    } catch { /* try next name */ }
  }
  return undefined
}
async function refresh($: any) {
  const [el, hf] = await Promise.all([elevenLabs($, configuredKey), higgsfield($, servers)])
  last = { el, hf, at: await $.clock.now() }
  $.ui.invalidate('ui.render')
  return last
}
// Connectors from claude.ai carry an id rather than a name in their tool names, so Higgsfield's
// spending tools are matched by tool name on any MCP server.
const SPENDS = /(api\.elevenlabs\.io\/v1\/(text-to-speech|sound-generation))|(^mcp__.*__(generate_(image|video|audio|3d)(_batch)?|upscale_(image|video)|execute_preset|motion_control)$)|(^mcp__elevenlabs__(text_to_speech|text_to_sound|compose_music|voice_clone))/i

const STYLE = `<style>
  svg{--bg:#ffffff;--fg:#141413;--mu:#73726c;--ln:#e8e6dc;--tr:#f0eee6;--ac:#d97757;--ok:#788c5d;--wa:#c98a3a;--bad:#bf4d43}
  @media (prefers-color-scheme: dark){svg{--bg:#262624;--fg:#faf9f5;--mu:#a3a199;--ln:#3d3d3a;--tr:#30302e}}
  .card{fill:var(--bg);stroke:var(--ln);stroke-width:1}
  .fg{fill:var(--fg)} .mu{fill:var(--mu)} .tr{fill:var(--tr)} .trs{stroke:var(--tr)} .ln{stroke:var(--ln)}
  .ac{fill:var(--ac)} .acs{stroke:var(--ac)} .ok{fill:var(--ok)} .oks{stroke:var(--ok)} .wa{fill:var(--wa)} .was{stroke:var(--wa)} .bad{fill:var(--bad)} .bads{stroke:var(--bad)}
  .t{font-family:ui-serif,"Tiempos Text",Georgia,serif}
  text{font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif}
</style>`
function card(b: Balances) {
  const el = b.el, pct = el ? Math.round((el.left / el.limit) * 100) : 0
  const cls = pct < 15 ? 'bad' : pct < 35 ? 'wa' : 'ok'
  const c = 2 * Math.PI * 54, dash = (c * pct) / 100
  const reset = el?.resetsAt ? new Date(el.resetsAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const hfCls = b.hf === undefined ? 'mu' : b.hf < 60 ? 'wa' : 'fg'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="250" viewBox="0 0 460 250">${STYLE}
  <rect x="0.5" y="0.5" width="459" height="249" rx="14" class="card"/>
  <text x="24" y="34" font-size="13" class="mu">◆ Credits</text>
  <circle cx="110" cy="122" r="54" fill="none" class="trs" stroke-width="10"/>
  <circle cx="110" cy="122" r="54" fill="none" class="${cls}s" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 110 122)">
    <animate attributeName="stroke-dasharray" from="0 ${c}" to="${dash} ${c}" dur="1s" fill="freeze"/></circle>
  <text x="110" y="122" text-anchor="middle" font-size="22" font-weight="600" class="fg">${el ? (el.left / 1000).toFixed(1) + 'k' : '—'}</text>
  <text x="110" y="141" text-anchor="middle" font-size="11" class="mu">characters left</text>
  <text x="110" y="208" text-anchor="middle" font-size="15" class="fg t">ElevenLabs</text>
  <text x="110" y="228" text-anchor="middle" font-size="12" class="mu">${el ? `${pct}% left · resets ${reset}` : 'not connected'}</text>
  <line x1="222" y1="64" x2="222" y2="226" class="ln"/>
  <text x="340" y="112" text-anchor="middle" font-size="40" font-weight="600" class="${hfCls}">${b.hf !== undefined ? b.hf.toFixed(0) : '—'}</text>
  <text x="340" y="134" text-anchor="middle" font-size="11" class="mu">credits left</text>
  <text x="340" y="208" text-anchor="middle" font-size="15" class="fg t">Higgsfield</text>
  <text x="340" y="228" text-anchor="middle" font-size="12" class="mu">${b.hf === undefined ? 'not connected' : b.hf < 60 ? 'running low' : 'plenty'}</text>
</svg>`
}

export const register: Register = (on, options) => {
  configuredKey = String(options.elevenlabs_api_key ?? '').trim()
  servers = [...new Set([String(options.higgsfield_server ?? '').trim(), 'higgsfield'].filter(Boolean))]

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'show', description: 'Open the ◆ Credits pane in Claude Code for the person' })
    await $.command.register({ name: 'credits', description: 'Show ElevenLabs characters and Higgsfield credits left' })
    return next(e)
  })

  on('command.run', { command: 'credits' }, async $ => {
    await $.ui.open({ id: PANE, title: '◆ Credits' })
    const b = await refresh($)
    return { text: `Credits: ElevenLabs ${b.el ? b.el.left.toLocaleString() + ' chars' : 'not connected'} · Higgsfield ${b.hf ?? 'not connected'}` }
  })

  on('tool.call', async ($, e, next) => {
    const probe = e.tool === 'Bash' ? String((e as any).command ?? '') : e.tool
    if (!SPENDS.test(probe)) return next(e)
    const before = await refresh($)
    $.ui.toast(`◆ This spends credits. Left now: ElevenLabs ${before.el ? before.el.left.toLocaleString() : '?'} chars · Higgsfield ${before.hf ?? '?'}`)
    const ran = await next(e)
    const after = await refresh($)
    const elSpent = before.el && after.el ? before.el.left - after.el.left : 0
    const hfSpent = before.hf !== undefined && after.hf !== undefined ? before.hf - after.hf : 0
    if (elSpent > 0 || hfSpent > 0) $.ui.toast(`◆ Spent ${elSpent > 0 ? elSpent.toLocaleString() + ' ElevenLabs chars ' : ''}${hfSpent > 0 ? hfSpent + ' Higgsfield credits' : ''}`)
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (!last.at) await refresh($)
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>ElevenLabs {last.el ? last.el.left + ' chars' : 'not connected'} · Higgsfield {last.hf ?? 'not connected'}</Text>
    }
    const { Box, Svg, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Svg source={card(last)} alt="ElevenLabs and Higgsfield credit balances" width={460} isInteractive />
        <Button key="refresh" label="Refresh" onPress={() => { void refresh($) }} />
      </Box>
    )
  })

  on('tool.call', { tool: 'mcp__credit-meter__show' }, async $ => {
    try { await $.ui.close({ id: PANE }) } catch {}
    await $.ui.open({ id: PANE, title: '◆ Credits' })
    return { result: '◆ Credits pane opened.' }
  })
}
