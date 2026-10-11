// Minimal Node typing used by tests that load CommonJS packages directly.
declare module 'node:module' {
  export function createRequire(url: string): (id: string) => unknown
}
