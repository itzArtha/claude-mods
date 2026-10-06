export type Sim = {
  /** Live 5-hour window, percent used (null until the first API response). */
  five: number | null
  /** Live weekly window, percent used. */
  week: number | null
  fiveResetsAt: string | null
  weekResetsAt: string | null
  /** Weekly percent consumed per 1% of the 5-hour window. */
  ratio: number
  /** How many real movements the ratio was learned from (0 = default guess). */
  samples: number
  /** The 5-hour percent the slider is set to. */
  target: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-slider': { sim: Sim }
  }
}
