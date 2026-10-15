import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  listCustomerDisplayDevices,
  previewCustomerDisplay,
  type CustomerDisplayDraft,
  type CustomerDisplayFicha,
  type CustomerDisplayPreview,
} from '@/services/customerDisplay.service'
import { tpvSettingsService } from '@/services/tpv-settings.service'
import { useCopyTargets, useFichaPreview, usePasosDelCobro } from '../queries'

vi.mock('@/services/customerDisplay.service', () => ({
  getCustomerDisplay: vi.fn(),
  previewCustomerDisplay: vi.fn(),
  listCustomerDisplayDevices: vi.fn(),
}))
vi.mock('@/services/tpv-settings.service', () => ({ tpvSettingsService: { getSettings: vi.fn() } }))

const ficha = (fingerprint: string): CustomerDisplayFicha => ({
  schemaVersion: 1,
  fingerprint,
  theme: 'LIGHT',
  accent: { custom: false },
  logo: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  promotionCards: { enabled: false },
  poweredBy: true,
})
const cuerpo = (welcomeText: string): CustomerDisplayDraft => ({
  theme: 'LIGHT',
  accentColor: null,
  logoAssetId: null,
  welcomeText,
  thanksText: '',
})
function envoltura() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
/** Cada solicitud queda retenida hasta que la prueba decide resolverla o rechazarla. */
function retenerPreviews() {
  const pendientes = new Map<number, { ok: (f: CustomerDisplayFicha) => void; falla: (e: unknown) => void }>()
  vi.mocked(previewCustomerDisplay).mockImplementation(
    (_v, _t, _d, previewSeq) =>
      new Promise<CustomerDisplayPreview>((resolve, reject) =>
        pendientes.set(previewSeq, { ok: f => resolve({ ficha: f, assetRejected: [], previewSeq }), falla: reject }),
      ),
  )
  return pendientes
}
function montar() {
  return renderHook(
    ({ c }) => useFichaPreview({ venueId: 'v1', terminalId: 't1', cuerpo: c, fichaInicial: ficha('inicial'), assetRejectedInicial: [] }),
    {
      initialProps: { c: cuerpo('A') },
      wrapper: envoltura(),
    },
  )
}

describe('useFichaPreview (Review Focus 4)', () => {
  it('🔴 una respuesta VIEJA que llega después de la nueva no pisa la vista previa', async () => {
    const pendientes = retenerPreviews()
    const { result, rerender } = montar()
    await waitFor(() => expect(pendientes.has(1)).toBe(true))
    rerender({ c: cuerpo('B') })
    await waitFor(() => expect(pendientes.has(2)).toBe(true))
    await act(async () => pendientes.get(2)!.ok(ficha('fp-B')))
    await waitFor(() => expect(result.current.ficha.fingerprint).toBe('fp-B'))
    await act(async () => pendientes.get(1)!.ok(ficha('fp-A')))
    expect(result.current.ficha.fingerprint).toBe('fp-B')
  })

  it('🔴 si la vigente FALLA antes de que la vieja tenga éxito, el error se queda y la vieja no se pinta (Codex #10)', async () => {
    const pendientes = retenerPreviews()
    const { result, rerender } = montar()
    await waitFor(() => expect(pendientes.has(1)).toBe(true))
    rerender({ c: cuerpo('B') })
    await waitFor(() => expect(pendientes.has(2)).toBe(true))
    await act(async () =>
      pendientes.get(2)!.falla({ response: { status: 400, data: { message: 'El texto no puede pasar de 40 caracteres' } } }),
    )
    await waitFor(() => expect(result.current.error).toBe('El texto no puede pasar de 40 caracteres'))
    await act(async () => pendientes.get(1)!.ok(ficha('fp-A')))
    expect(result.current.error).toBe('El texto no puede pasar de 40 caracteres')
    expect(result.current.ficha.fingerprint).toBe('inicial')
    expect(result.current.cargando).toBe(false)
  })

  it('🔴 el ERROR de una solicitud vieja que llega después de que la vigente tuvo éxito no se pinta (B2 r2)', async () => {
    const pendientes = retenerPreviews()
    const { result, rerender } = montar()
    await waitFor(() => expect(pendientes.has(1)).toBe(true))
    rerender({ c: cuerpo('B') })
    await waitFor(() => expect(pendientes.has(2)).toBe(true))
    await act(async () => pendientes.get(2)!.ok(ficha('fp-B')))
    await waitFor(() => expect(result.current.ficha.fingerprint).toBe('fp-B'))
    await act(async () =>
      pendientes.get(1)!.falla({ response: { status: 400, data: { message: 'El texto no puede pasar de 40 caracteres' } } }),
    )
    expect(result.current.error).toBeNull()
    expect(result.current.ficha.fingerprint).toBe('fp-B')
    expect(result.current.cargando).toBe(false)
  })

  it('🔴 la vigencia se decide con el número que MANDAMOS: si el server no lo devuelve, la vigente igual se pinta y deja de cargar (B2 r2)', async () => {
    vi.mocked(previewCustomerDisplay).mockImplementation(
      async () => ({ ficha: ficha('fp-sin-eco'), assetRejected: [] }) as unknown as CustomerDisplayPreview,
    )
    const { result } = montar()
    await waitFor(() => expect(result.current.ficha.fingerprint).toBe('fp-sin-eco'))
    expect(result.current.cargando).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('useCopyTargets (datos acotados)', () => {
  it('pide páginas de 50 y la siguiente con el cursor que dio el server', async () => {
    vi.mocked(listCustomerDisplayDevices)
      .mockResolvedValueOnce({ total: 3, nextCursor: 'c2', devices: [] })
      .mockResolvedValueOnce({ total: 3, nextCursor: null, devices: [] })
    const { result } = renderHook(() => useCopyTargets('v1', true), { wrapper: envoltura() })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(vi.mocked(listCustomerDisplayDevices).mock.calls).toEqual([
      ['v1', { cursor: undefined, take: 50 }],
      ['v1', { cursor: 'c2', take: 50 }],
    ])
  })
  it('cerrado no consulta', () => {
    renderHook(() => useCopyTargets('v1', false), { wrapper: envoltura() })
    expect(listCustomerDisplayDevices).not.toHaveBeenCalled()
  })
})

describe('usePasosDelCobro', () => {
  it('🔴 con los defaults de la app (3 reintentos) igual reintenta UNA sola vez: «Sin confirmar» no dura ~7 s', async () => {
    vi.mocked(tpvSettingsService.getSettings).mockRejectedValue(new Error('Network Error'))
    const qc = new QueryClient() // los defaults de main.tsx, a propósito
    const envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => usePasosDelCobro('t1', true), { wrapper: envoltura })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 })
    expect(tpvSettingsService.getSettings).toHaveBeenCalledTimes(2)
    qc.clear()
  })
})
