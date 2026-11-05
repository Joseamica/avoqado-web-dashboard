import { vi } from 'vitest'

/** El setup global deja `localStorage` como mocks vacíos: aquí se le da memoria real. */
export function almacenLocalConMemoria() {
  const memoria = new Map<string, string>()
  const ls = window.localStorage as unknown as Record<string, ReturnType<typeof vi.fn>>
  ls.getItem.mockImplementation((k: string) => memoria.get(k) ?? null)
  ls.setItem.mockImplementation((k: string, v: string) => void memoria.set(k, String(v)))
  ls.removeItem.mockImplementation((k: string) => void memoria.delete(k))
  ls.clear.mockImplementation(() => memoria.clear())
}
