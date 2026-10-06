import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Sim } from '../types'

const PANE = 'usage-slider'
// Guess until real data teaches us: one full 5h window ≈ 10% of the week.
const DEFAULT_RATIO = 0.1
const sim = atom({ plugin: 'usage-slider', key: 'sim' } as const, {
  five: null, week: null, fiveResetsAt: null, weekResetsAt: null,
  ratio: DEFAULT_RATIO, samples: 0, target: 50,
} as Sim)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round1 = (n: number) => Math.round(n * 10) / 10

function project(s: Sim) {
  const five = s.five ?? 0
  const week = s.week ?? 0
  const target = Math.max(s.target, five)
  const weekAt = week + (target - five) * s.ratio
  const fullWindowsLeft = s.ratio > 0 ? (100 - week) / (100 * s.ratio) : Infinity
  // 5h percent at which the weekly limit would hit 100 (if reachable in this window)
  const exhaustAtFive = s.ratio > 0 ? five + (100 - week) / s.ratio : Infinity
  return { five, week, target, weekAt: round1(weekAt), fullWindowsLeft, exhaustAtFive: round1(exhaustAtFive) }
}

const level = (p: number) => (p >= 100 ? 'out' : p >= 85 ? 'red' : p >= 60 ? 'yellow' : 'green')
const HEX = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', out: '#a21caf' }
const EMOJI = { green: '🟩', yellow: '🟨', red: '🟥', out: '🟪' }

function emojiBar(p: number) {
  const n = clamp(Math.round(p / 10), 0, 10)
  return EMOJI[level(p)].repeat(n) + '⬜'.repeat(10 - n)
}

function svgBar(label: string, now: number, then: number) {
  const w = 300, x0 = 0
  const a = clamp(now, 0, 100) * w / 100
  const b = clamp(then, 0, 100) * w / 100
  const c = HEX[level(then)]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34" viewBox="0 0 ${w} 34">
<text x="0" y="11" font-size="11" fill="#999" font-family="sans-serif">${label}</text>
<text x="${w}" y="11" font-size="11" fill="${c}" text-anchor="end" font-family="sans-serif" font-weight="bold">${round1(now)}% → ${round1(then)}%</text>
<rect x="${x0}" y="18" width="${w}" height="12" rx="6" fill="#8883"/>
<rect x="${x0}" y="18" width="${b}" height="12" rx="6" fill="${c}" fill-opacity="0.45"/>
<rect x="${x0}" y="18" width="${a}" height="12" rx="6" fill="${c}"/>
<line x1="${w * 0.85}" y1="16" x2="${w * 0.85}" y2="32" stroke="#ef4444" stroke-dasharray="2 2"/>
</svg>`
}

function report(s: Sim) {
  const p = project(s)
  const live = s.five === null ? '\n_No live usage yet — send one message first. Showing 0% as the start._' : ''
  const lines = [
    `**If your 5-hour usage goes to ${p.target}%:**`,
    `5h     ${emojiBar(p.target)} ${p.five}% → ${p.target}%`,
    `Weekly ${emojiBar(p.weekAt)} ${p.week}% → **${p.weekAt}%** ${p.weekAt >= 100 ? '⚠️ weekly exhausted' : ''}`,
    ``,
    p.exhaustAtFive <= 100
      ? `🟥 Weekly runs out when this 5h window reaches **${p.exhaustAtFive}%**.`
      : `🟩 Weekly survives this whole 5h window (${round1(p.week + (100 - p.five) * s.ratio)}% at 100% of 5h).`,
    `About **${round1(p.fullWindowsLeft)}** full 5h windows left this week.`,
    `_1% of 5h ≈ ${round1(s.ratio * 100) / 100}% weekly (${s.samples ? `learned from ${s.samples} real changes` : 'a guess until your usage moves'})._${live}`,
  ]
  return lines.join('\n')
}

async function drawPane($: any, e: any) {
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const Svg = 'Svg' in ui ? ui.Svg : null
  const s: Sim = await read($, sim)
  const p = project(s)
  const set = (t: number) => update($, sim, (c: Sim) => ({ ...c, target: clamp(t, Math.ceil(c.five ?? 0), 100) }))
  const color = (pct: number) => HEX[level(pct)]

  return (
    <Box flexDirection="column" gap={1}>
      {s.five === null && <Text dimColor>No live usage yet: send one message, then this fills in.</Text>}
      <Text>{`5-hour slider: ${p.target}%`}</Text>
      <Box flexDirection="row" gap={1}>
        <Button key="m10" label="−10" onPress={() => set(s.target - 10)} />
        <Button key="m1" label="−1" onPress={() => set(s.target - 1)} />
        <Button key="p1" label="+1" onPress={() => set(s.target + 1)} />
        <Button key="p10" label="+10" onPress={() => set(s.target + 10)} />
        <Button key="max" label="100%" variant="primary" onPress={() => set(100)} />
      </Box>
      {Svg ? (
        <Box flexDirection="column">
          <Svg source={svgBar('5-hour', p.five, p.target)} alt={`5-hour ${p.five}% to ${p.target}%`} width={300} height={34} />
          <Svg source={svgBar('Weekly', p.week, p.weekAt)} alt={`Weekly ${p.week}% to ${p.weekAt}%`} width={300} height={34} />
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={color(p.target)}>{`5h     ${'█'.repeat(Math.round(p.target / 5)).padEnd(20, '░')} ${p.five}% → ${p.target}%`}</Text>
          <Text color={color(p.weekAt)}>{`Weekly ${'█'.repeat(clamp(Math.round(p.weekAt / 5), 0, 20)).padEnd(20, '░')} ${p.week}% → ${p.weekAt}%`}</Text>
        </Box>
      )}
      <Text color={p.exhaustAtFive <= 100 ? HEX.red : HEX.green}>
        {p.exhaustAtFive <= 100
          ? `Weekly runs out at ${p.exhaustAtFive}% of this 5h window`
          : `Weekly survives this whole 5h window`}
      </Text>
      <Text dimColor>{`≈ ${round1(p.fullWindowsLeft)} full 5h windows left · 1% of 5h ≈ ${Math.round(s.ratio * 100) / 100}% weekly ${s.samples ? `(learned, ${s.samples})` : '(guess)'}`}</Text>
      <Box flexDirection="row" gap={1}>
        <Text dimColor>Ratio:</Text>
        <Button key="r-" label="−" onPress={() => update($, sim, (c: Sim) => ({ ...c, ratio: Math.max(0.01, round1(c.ratio * 100 - 1) / 100), samples: 0 }))} />
        <Button key="r+" label="+" onPress={() => update($, sim, (c: Sim) => ({ ...c, ratio: round1(c.ratio * 100 + 1) / 100, samples: 0 }))} />
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-sim', description: 'Simulate 5h usage vs weekly: /usage-sim 70' })
    try {
      const u = await $.session.usage()
      const five = u.rateLimits.find(r => r.kind === 'five_hour')
      const week = u.rateLimits.find(r => r.kind === 'seven_day')
      if (five || week) {
        await update($, sim, c => ({
          ...c,
          five: five?.percentUsed ?? c.five, week: week?.percentUsed ?? c.week,
          fiveResetsAt: five?.resetsAt ?? c.fiveResetsAt, weekResetsAt: week?.resetsAt ?? c.weekResetsAt,
        }))
      }
    } catch {}
    return next(e)
  })

  // Live readings; learn weekly-per-5h from real movements in the same windows.
  on('session.measure', async ($, e, next) => {
    const five = e.rateLimits.find(r => r.kind === 'five_hour')
    const week = e.rateLimits.find(r => r.kind === 'seven_day')
    if (five && week) {
      await update($, sim, c => {
        let { ratio, samples } = c
        const sameWindows = c.fiveResetsAt === (five.resetsAt ?? null) && c.weekResetsAt === (week.resetsAt ?? null)
        const d5 = c.five === null ? 0 : five.percentUsed - c.five
        const dw = c.week === null ? 0 : week.percentUsed - c.week
        if (sameWindows && d5 >= 1 && dw >= 0) {
          const r = dw / d5
          ratio = samples === 0 ? r : ratio * 0.7 + r * 0.3
          samples += 1
        }
        return {
          ...c, ratio: Math.max(0.001, ratio), samples,
          five: five.percentUsed, week: week.percentUsed,
          fiveResetsAt: five.resetsAt ?? null, weekResetsAt: week.resetsAt ?? null,
          target: Math.max(c.target, Math.ceil(five.percentUsed)),
        }
      })
    }
    return next(e)
  })

  on('command.run', { command: 'usage-sim' }, async ($, e) => {
    const n = parseFloat(e.args)
    if (!Number.isNaN(n)) await update($, sim, c => ({ ...c, target: clamp(Math.round(n), Math.ceil(c.five ?? 0), 100) }))
    void $.ui.open({ id: PANE, title: 'Usage slider' })
    return { text: report(await read($, sim)) }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const engine = await next(e)
    return (
      <Box flexDirection="row" gap={1}>
        <Button key="open-usage" label="📊 Usage" dimColor onPress={() => $.ui.open({ id: PANE, title: 'Usage slider' })} />
        {engine}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    try {
      return await drawPane($, e)
    } catch (err) {
      const { Text } = $.ui.resolve(e)
      return <Text color="red">usage-slider error: {String(err)}</Text>
    }
  })
}
