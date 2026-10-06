import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Design } from '../types'

const PANE = 'design-panel'
const DEFAULTS: Design = { size: 120, radius: 16, padding: 12, opacity: 100, hue: 210 }
const design = atom({ plugin: 'design-panel', key: 'design' } as const, DEFAULTS)

type Knob = { key: keyof Design; label: string; min: number; max: number; step: number; unit: string }

const KNOBS: Knob[] = [
  { key: 'size', label: 'Size', min: 40, max: 200, step: 10, unit: 'px' },
  { key: 'radius', label: 'Corner radius', min: 0, max: 100, step: 4, unit: 'px' },
  { key: 'padding', label: 'Padding', min: 0, max: 40, step: 2, unit: 'px' },
  { key: 'opacity', label: 'Opacity', min: 10, max: 100, step: 10, unit: '%' },
  { key: 'hue', label: 'Hue', min: 0, max: 360, step: 15, unit: '°' },
]

const clamp = (n: number, k: Knob) => Math.min(k.max, Math.max(k.min, n))

// A slider track: filled part plus a thumb, drawn as SVG.
const track = (k: Knob, value: number, hue: number) => {
  const w = 220
  const x = 8 + ((value - k.min) / (k.max - k.min)) * (w - 16)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" viewBox="0 0 ${w} 20">
<rect x="8" y="8" width="${w - 16}" height="4" rx="2" fill="#8884"/>
<rect x="8" y="8" width="${x - 8}" height="4" rx="2" fill="hsl(${hue},70%,55%)"/>
<circle cx="${x}" cy="10" r="7" fill="#fff" stroke="hsl(${hue},70%,45%)" stroke-width="2"/>
</svg>`
}

const preview = (d: Design) => {
  const box = d.size + d.padding * 2
  const w = 240
  const h = Math.max(box + 20, 120)
  const r = Math.min(d.radius, d.size / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect x="${(w - box) / 2}" y="${(h - box) / 2}" width="${box}" height="${box}" rx="${r + d.padding / 2}" fill="none" stroke="#8886" stroke-dasharray="4 3"/>
<rect x="${(w - d.size) / 2}" y="${(h - d.size) / 2}" width="${d.size}" height="${d.size}" rx="${r}" fill="hsl(${d.hue},70%,55%)" fill-opacity="${d.opacity / 100}"/>
</svg>`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'design', description: 'Open the design sliders panel' })
    return next(e)
  })

  on('command.run', { command: 'design' }, async $ => {
    const r = await $.ui.open({ id: PANE, title: 'Design' })
    return { text: r.isPlaced ? 'Design panel opened.' : `Design panel not shown: ${r.reason}` }
  })

  // The button in the hint line under the prompt.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const engine = await next(e)
    return (
      <Box flexDirection="row" gap={1}>
        <Button key="open-design" label="🎨 Design" dimColor onPress={() => $.ui.open({ id: PANE, title: 'Design' })} />
        {engine}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const d = await read($, design)
    const nudge = (k: Knob, dir: number) =>
      update($, design, cur => ({ ...cur, [k.key]: clamp(cur[k.key] + dir * k.step, k) }))
    const hasSvg = e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode'
    const Svg = hasSvg ? ($.ui.resolve(e) as { Svg: any }).Svg : null

    return (
      <Box flexDirection="column" gap={1}>
        {Svg ? (
          <Svg source={preview(d)} alt={`Preview: ${d.size}px square, radius ${d.radius}`} />
        ) : (
          <Text dimColor>Preview shows in the desktop app.</Text>
        )}
        {KNOBS.map(k => (
          <Box flexDirection="column">
            <Text>
              {k.label}: <Text bold>{d[k.key]}{k.unit}</Text>
            </Text>
            <Box flexDirection="row" gap={1}>
              <Button key={`${k.key}-min`} label="⏮" plain onPress={() => update($, design, c => ({ ...c, [k.key]: k.min }))} />
              <Button key={`${k.key}-dec`} label="−" onPress={() => nudge(k, -1)} />
              {Svg ? (
                <Svg source={track(k, d[k.key], d.hue)} alt={`${k.label} ${d[k.key]} of ${k.max}`} width={220} height={20} />
              ) : (
                <Text>{'█'.repeat(Math.round(((d[k.key] - k.min) / (k.max - k.min)) * 20)).padEnd(20, '░')}</Text>
              )}
              <Button key={`${k.key}-inc`} label="+" onPress={() => nudge(k, 1)} />
              <Button key={`${k.key}-max`} label="⏭" plain onPress={() => update($, design, c => ({ ...c, [k.key]: k.max }))} />
            </Box>
          </Box>
        ))}
        <Box flexDirection="row" gap={1}>
          <Button key="reset" label="Reset" onPress={() => update($, design, () => DEFAULTS)} />
          <Button key="copy" label="Show CSS" variant="primary" onPress={() =>
            $.ui.toast(`width:${d.size}px;height:${d.size}px;padding:${d.padding}px;border-radius:${d.radius}px;opacity:${d.opacity / 100};background:hsl(${d.hue} 70% 55%)`)} />
        </Box>
      </Box>
    )
  })
}
