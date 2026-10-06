import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

import type { Detail, Fill } from '../types'

const fill = atom({ plugin: 'context-check', key: 'fill' } as const, null)
const detail = atom({ plugin: 'context-check', key: 'detail' } as const, null)
const isOpen = atom({ plugin: 'context-check', key: 'isOpen' } as const, false)
const isHidden = atom({ plugin: 'context-check', key: 'isHidden' } as const, false)

const WARN_AT = [70, 85, 95]

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

const colorFor = (pct: number) => (pct >= 85 ? 'red' : pct >= 60 ? 'yellow' : 'green')

const bar = (pct: number, width: number) => {
  const on = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return ['█'.repeat(on), '░'.repeat(width - on)]
}

const toFill = (c: SessionContextUsage): Fill => ({ tokens: c.tokens, window: c.window, percent: c.percent })

async function loadDetail($: EngineInterface) {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (!b) return
  const d: Detail = {
    rows: b.categories
      .filter(c => c.tokens > 0 && c.name !== 'Free space')
      .map(c => ({
        name: c.isDeferred && !/deferred/i.test(c.name) ? `${c.name} (deferred)` : c.name,
        tokens: c.tokens,
      }))
      .sort((a, z) => z.tokens - a.tokens),
    total: b.totalTokens,
    max: b.rawMaxTokens,
    autoCompactAt: b.isAutoCompactEnabled ? b.autoCompactThreshold : undefined,
  }
  await update($, detail, () => d)
}

export const register: Register = on => {
  let warned = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context } = await $.session.usage()
    await update($, fill, () => toFill(context))
    $.command.register({ name: 'ctx', description: 'Show or toggle the context meter above the prompt' })
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await update($, fill, () => toFill(e.context))
      if (await read($, isOpen)) await loadDetail($)

      const pct = e.context.percent ?? 0
      if (pct < WARN_AT[0]) warned = 0
      const level = WARN_AT.filter(t => pct >= t).pop()
      if (level !== undefined && level > warned) {
        warned = level
        $.ui.toast(`Context ${pct}% full — consider /compact or /clear`)
      }
    }
    return next(e)
  })

  on('command.run', { command: 'ctx' }, async $ => {
    await update($, isHidden, () => false)
    await update($, isOpen, () => true)
    await loadDetail($)
    const f = (await read($, fill)) ?? toFill((await $.session.usage()).context)
    const d = await read($, detail)

    const lines: string[] = []
    if (f.percent === undefined) {
      lines.push(`Context  ${'░'.repeat(30)}  —  ${k(f.window)} window · waiting for first reply`)
    } else {
      const [lit, unlit] = bar(f.percent, 30)
      const mark = f.percent >= 85 ? '🔴' : f.percent >= 60 ? '🟡' : '🟢'
      lines.push(`${mark} Context  ${lit}${unlit}  ${f.percent}%  ·  ${k(f.tokens ?? 0)} / ${k(f.window)}`)
    }
    if (d) {
      lines.push('')
      const top = d.rows[0]?.tokens || 1
      for (const r of d.rows) {
        const [lit, unlit] = bar((r.tokens / top) * 100, 20)
        lines.push(`   ${r.name.padEnd(26).slice(0, 26)} ${lit}${unlit} ${k(r.tokens).padStart(5)}`)
      }
      lines.push('')
      lines.push(`   estimated ${k(d.total)} of ${k(d.max)}${d.autoCompactAt !== undefined ? ` · auto-compact at ${k(d.autoCompactAt)}` : ''}`)
    }
    return { text: lines.join('\n') }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const f = (await read($, fill)) ?? toFill((await $.session.usage()).context)

    const { Box, Text, Button } = $.ui.resolve(e)
    const open = await read($, isOpen)
    const d = open ? await read($, detail) : null

    const pct = f.percent
    const known = pct !== undefined
    const color = known ? colorFor(pct) : 'gray'
    const cols = e.props.bodyColumns
    const barWidth = Math.max(10, Math.min(40, cols - 60))
    const [full, empty] = bar(pct ?? 0, barWidth)

    const nameWidth = 26
    const rowBar = Math.max(8, Math.min(30, cols - nameWidth - 16))

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>Context</Text>
          <Text color={color}>{full}</Text>
          <Text dimColor>{empty}</Text>
          <Text bold color={color}>{known ? `${pct}%` : '—'}</Text>
          <Text dimColor>
            {known ? `${k(f.tokens ?? 0)} / ${k(f.window)}` : `${k(f.window)} window · waiting for first reply`}
          </Text>
          <Box flexGrow={1} />
          <Button
            key="toggle"
            plain
            label={open ? '▾ less' : '▸ details'}
            onPress={async () => {
              const willOpen = !(await read($, isOpen))
              await update($, isOpen, () => willOpen)
              if (willOpen) await loadDetail($)
            }}
          />
          <Button key="hide" plain role="dismiss" label="✕" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {d && (
          <Box flexDirection="column" marginTop={1}>
            {d.rows.map(r => {
              const share = d.max ? (r.tokens / d.max) * 100 : 0
              const [lit, unlit] = bar(share, rowBar)
              return (
                <Box key={`row-${r.name}`} flexDirection="row" gap={1}>
                  <Text wrap="truncate">{r.name.padEnd(nameWidth).slice(0, nameWidth)}</Text>
                  <Text color="cyan">{lit}</Text>
                  <Text dimColor>{unlit}</Text>
                  <Text>{k(r.tokens).padStart(5)}</Text>
                </Box>
              )
            })}
            <Text dimColor>
              {`estimated ${k(d.total)} of ${k(d.max)}`}
              {d.autoCompactAt !== undefined ? ` · auto-compact at ${k(d.autoCompactAt)}` : ''}
              {' · /ctx to reopen after hiding'}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
