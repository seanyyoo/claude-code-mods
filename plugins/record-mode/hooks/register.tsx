// record-mode: /record on|off. While on, the transcript draws personal details as ▇▇▇ masks:
// emails, phone numbers, dollar amounts, your extra terms and (optionally) Korean text.
// Display only: Claude still reads the real text. Adds a red "● REC" label to the prompt footer.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const isOn = atom({ plugin: 'record-mode', key: 'isOn' } as const, false)

type Rule = [RegExp, (m: string) => string]
const BASE: Rule[] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => '▇▇▇@▇▇▇'],
  [/(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, () => '▇▇▇-▇▇▇-▇▇▇▇'],
  [/\$\s?\d[\d,]*(\.\d+)?(?:\s?[kKM]\b)?/g, () => '$▇▇'],
]
const KOREAN: Rule = [/[가-힣ㄱ-ㆎ]+(?:\s+[가-힣ㄱ-ㆎ]+)*/g, m => '▇'.repeat(Math.min(8, Math.max(2, Math.ceil(m.length / 2))))]
let rules: Rule[] = BASE
let what = 'Emails, phone numbers and money'

export const mask = (text: string) => {
  let n = 0
  let out = text
  for (const [re, f] of rules) out = out.replace(re, m => (n++, f(m)))
  return { out, n }
}

export const register: Register = (on, options) => {
  const terms = String(options.extra_terms ?? '').split(',').map(t => t.trim()).filter(Boolean)
  const korean = options.mask_korean === 'on'
  rules = [
    ...BASE,
    ...terms.map((t): Rule => [new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => '▇'.repeat(Math.min(8, Math.max(3, m.length)))]),
    ...(korean ? [KOREAN] : []),
  ]
  const extras = [terms.length ? 'your extra terms' : '', korean ? 'Korean text' : ''].filter(Boolean)
  what = extras.length ? `Emails, phone numbers, money, ${extras.join(' and ')}` : 'Emails, phone numbers and money'

  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'toggle', description: 'Turn recording mode on or off', inputSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] } })
    await $.command.register({ name: 'record', description: 'Recording mode: /record on | off (masks personal info on screen)' })
    const saved = (await $.store.get('isOn')) === true
    await update($, isOn, () => saved)
    return next(e)
  })

  on('command.run', { command: 'record' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const want = arg === 'off' ? false : arg === 'on' ? true : !(await read($, isOn))
    await update($, isOn, () => want)
    await $.store.set('isOn', want)
    $.ui.invalidate('ui.render')
    $.ui.toast(want ? '● REC on: personal info is masked on screen' : '■ REC off: everything is visible again')
    return { text: want ? `Recording mode ON. ${what} are masked on screen.` : 'Recording mode OFF.' }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { out, n } = mask(e.props.text)
    return n ? next({ ...e, props: { ...e.props, text: out } }) : next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { out, n } = mask(e.props.text)
    return n ? next({ ...e, props: { ...e.props, text: out } }) : next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    return next({ ...e, props: { ...e.props, modes: ['● REC', ...e.props.modes] } })
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    return next({ ...e, props: { ...e.props, tail: '● recording: personal info masked' } })
  })

  on('tool.call', { tool: 'mcp__record-mode__toggle' }, async ($, e) => {
    const want = (e as any).on === true
    await update($, isOn, () => want)
    await $.store.set('isOn', want)
    $.ui.invalidate('ui.render')
    $.ui.toast(want ? '● REC on: personal info is masked on screen' : '■ REC off: everything is visible again')
    return { result: (want ? 'Recording mode on.' : 'Recording mode off.') }
  })
}
