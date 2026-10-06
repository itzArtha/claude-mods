export type Fill = { tokens?: number; window: number; percent?: number }
export type Row = { name: string; tokens: number }
export type Detail = { rows: Row[]; total: number; max: number; autoCompactAt?: number }

declare module 'claude-code' {
  interface PluginState {
    'context-check': {
      fill: Fill | null
      detail: Detail | null
      isOpen: boolean
      isHidden: boolean
    }
  }
}
