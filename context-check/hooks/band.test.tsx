import { expect, test } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100 } } as const

test('band draws the meter and toggles details', async ($, on) => {
  on('session.usage', () => ({ value: {
    startedAt: 0,
    rateLimits: [],
    context: {
      tokens: 84000, window: 200000, percent: 42,
      breakdown: {
        categories: [
          { name: 'Messages', tokens: 50000, color: 'x', isDeferred: false },
          { name: 'System tools', tokens: 27000, color: 'x', isDeferred: false },
          { name: 'Free space', tokens: 100000, color: 'x', isDeferred: false },
        ],
        totalTokens: 84000, maxTokens: 200000, rawMaxTokens: 200000, autocompactSource: 'model-default',
        percentage: 42, gridRows: [], model: 'm', memoryFiles: [], mcpTools: [], agents: [],
        isAutoCompactEnabled: true, autoCompactThreshold: 167000, apiUsage: null,
      },
    },
  } }) as any)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-check', surface, ...BAND } as any)
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /84k \/ 200k/ })).toBeDefined()
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /Messages/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /auto-compact at 167k/ })).toBeDefined()
    await ui.press({ key: 'toggle' })
    await ui.unmount()
  }
})
