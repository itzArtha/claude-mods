export type Design = {
  size: number
  radius: number
  padding: number
  opacity: number
  hue: number
}

declare module 'claude-code' {
  interface PluginState {
    'design-panel': { design: Design }
  }
}
