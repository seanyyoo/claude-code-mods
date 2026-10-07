export type RecordMode = { isOn: boolean }

declare module 'claude-code' {
  interface PluginState {
    'record-mode': { isOn: boolean }
  }
}
