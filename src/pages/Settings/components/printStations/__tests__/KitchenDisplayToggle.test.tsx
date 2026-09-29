import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { PrintStation } from '@/services/printStations.service'
import { KitchenDisplayToggle } from '../KitchenDisplayToggle'

const h = vi.hoisted(() => ({
  setMock: vi.fn(),
  toastMock: vi.fn(),
  can: vi.fn(),
  role: 'OWNER' as string,
  hasAccess: true,
}))

vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  setPrintStationKitchenDisplay: (...a: unknown[]) => h.setMock(...a),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: h.can, role: h.role }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: h.hasAccess, requiredTier: 'PRO', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/alpha' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toastMock }) }))

// Radix pide pointer capture; funciones simples (mockReset borraría un vi.fn).
beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  h.setMock.mockReset()
  h.toastMock.mockReset()
  h.can.mockImplementation((p: string) => p === 'printers:manage' || p === 'billing:read')
  h.role = 'OWNER'
  h.hasAccess = true
})

const estacion = (over: Partial<PrintStation> = {}): PrintStation => ({
  id: 's1',
  venueId: 'v1',
  name: 'Barra',
  printerId: 'p1',
  copies: 1,
  isDefault: false,
  isPacking: false,
  hasKitchenDisplay: false,
  active: true,
  displayOrder: 0,
  printer: { id: 'p1', name: 'Epson Barra', active: true, lastStatus: null },
  ...over,
})

function pintar(station: PrintStation = estacion(), abiertaAClientes = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <KitchenDisplayToggle venueId="v1" station={station} abiertaAClientes={abiertaAClientes} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const casilla = () => screen.getByRole('switch', { name: 'Pantalla de cocina de Barra' })

describe('KitchenDisplayToggle', () => {
  it('antes del lanzamiento el dueño no la ve', () => {
    pintar(estacion(), false)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('antes del lanzamiento, una que Avoqado prendió se puede apagar', async () => {
    h.setMock.mockResolvedValue(estacion())
    pintar(estacion({ hasKitchenDisplay: true }), false)
    expect(screen.getByText(/Avoqado la prendió como prueba/)).toBeInTheDocument()
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Apagar pantalla' }))
    await waitFor(() => expect(h.setMock).toHaveBeenCalledWith('v1', 's1', false))
  })

  it('superadmin la ve antes del lanzamiento, marcada «sólo Avoqado»', () => {
    h.role = 'SUPERADMIN'
    pintar(estacion(), false)
    expect(casilla()).toBeEnabled()
    expect(screen.getByText(/Sólo Avoqado la ve/)).toBeInTheDocument()
  })

  it('prender pide confirmación y sólo al confirmar llama al servidor', async () => {
    h.setMock.mockResolvedValue(estacion({ hasKitchenDisplay: true }))
    pintar()
    await userEvent.click(casilla())
    expect(screen.getByText('¿Prender la pantalla de Barra?')).toBeInTheDocument()
    expect(screen.getByText('También siguen saliendo en la impresora Epson Barra.')).toBeInTheDocument()
    expect(h.setMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    await waitFor(() => expect(h.setMock).toHaveBeenCalledWith('v1', 's1', true))
  })

  it('cancelar no cambia nada', async () => {
    pintar()
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(h.setMock).not.toHaveBeenCalled()
  })

  it('doble clic en «Prender pantalla» con la petición en camino ⇒ una sola petición', async () => {
    let resolver: (v: unknown) => void = () => {}
    h.setMock.mockImplementation(() => new Promise(r => (resolver = r)))
    pintar()
    await userEvent.click(casilla())
    const boton = screen.getByRole('button', { name: 'Prender pantalla' })
    await userEvent.click(boton)
    await userEvent.click(boton)
    expect(h.setMock).toHaveBeenCalledTimes(1)
    resolver(estacion({ hasKitchenDisplay: true }))
  })

  it('apagar una estación sin impresora avisa que vuelve a la impresora de cocina de la caja', async () => {
    h.setMock.mockResolvedValue(estacion({ printerId: null, printer: null }))
    pintar(estacion({ hasKitchenDisplay: true, printerId: null, printer: null }))
    await userEvent.click(casilla())
    expect(screen.getByText(/vuelven a salir en la impresora de cocina de la caja/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Apagar pantalla' }))
    await waitFor(() => expect(h.setMock).toHaveBeenCalledWith('v1', 's1', false))
  })

  it('sin Pro no prende: enseña el plan Pro y no llama al servidor', async () => {
    h.hasAccess = false
    pintar()
    await userEvent.click(casilla())
    expect(screen.getByText('La pantalla de cocina es del plan Pro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver planes/ })).toBeInTheDocument()
    expect(h.setMock).not.toHaveBeenCalled()
  })

  it('sin permiso de facturación, en vez de «Ver planes» dice a quién pedírselo', async () => {
    h.hasAccess = false
    h.can.mockImplementation((p: string) => p === 'printers:manage')
    pintar()
    await userEvent.click(casilla())
    expect(screen.queryByRole('button', { name: /Ver planes/ })).not.toBeInTheDocument()
    expect(screen.getByText('Pídele al dueño que mejore el plan.')).toBeInTheDocument()
  })

  it('sin printers:manage sólo se mira', () => {
    h.can.mockReturnValue(false)
    pintar()
    expect(casilla()).toBeDisabled()
    expect(screen.getByText('Sólo quien configura impresoras puede cambiarla.')).toBeInTheDocument()
  })

  it('bajó de plan con la pantalla prendida: lo explica y se puede apagar', async () => {
    h.hasAccess = false
    h.setMock.mockResolvedValue(estacion())
    pintar(estacion({ hasKitchenDisplay: true }))
    expect(screen.getByText(/Tu plan ya no incluye la pantalla/)).toBeInTheDocument()
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Apagar pantalla' }))
    await waitFor(() => expect(h.setMock).toHaveBeenCalledWith('v1', 's1', false))
  })

  it('si el servidor responde que requiere Pro, enseña el plan en vez de un error', async () => {
    h.setMock.mockRejectedValue({ response: { status: 403, data: { message: 'x', code: 'KITCHEN_DISPLAY_REQUIRES_PRO' } } })
    pintar()
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    expect(await screen.findByText('La pantalla de cocina es del plan Pro.')).toBeInTheDocument()
    expect(h.toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })

  it('si el servidor dice que todavía no está lanzada, lo explica', async () => {
    h.setMock.mockRejectedValue({ response: { status: 403, data: { message: 'x', code: 'KITCHEN_DISPLAY_NOT_RELEASED' } } })
    pintar()
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    await waitFor(() =>
      expect(h.toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: expect.stringMatching(/todavía no está disponible/) }),
      ),
    )
  })

  // I-2: tras un 403 REQUIRES_PRO, el dashboard debe dejar de creer que el negocio tiene Pro. Como `useTierFeatureAccess`
  // está mockeado como un valor estático (no reactivo a TanStack Query), la aserción que el setup soporta es que se
  // invalida la clave del plan-tier (`['venueFeatures', venueId]`, prefijo que cubre `planTierQueryKey` — ver el
  // comentario Codex R4-8 en `use-tier-feature-access.ts`): eso es lo que hace que un remount / refetch real deje de
  // ofrecer «Prender».
  it('I-2: tras el 403 REQUIRES_PRO invalida la consulta de plan-tier del venue', async () => {
    h.setMock.mockRejectedValue({ response: { status: 403, data: { message: 'x', code: 'KITCHEN_DISPLAY_REQUIRES_PRO' } } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <KitchenDisplayToggle venueId="v1" station={estacion()} abiertaAClientes />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['venueFeatures', 'v1'] }))
  })

  // M-5: la tarjeta ámbar «pídele al dueño / ver planes» no debe quedarse pegada — si el estado deja de ser
  // REQUIERE_PRO (el plan se resolvió a Pro), `pideMejorar` se apaga solo.
  it('M-5: pideMejorar se apaga cuando el estado deja de pedir Pro', async () => {
    h.hasAccess = false
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    // Un `rerender(ui)` con el MISMO objeto de elemento hace que React se salte la re-renderización (bailout por
    // igualdad referencial) y nunca vuelva a invocar el hook mockeado — hay que construir el árbol de nuevo cada vez.
    const pintarLocal = () => (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <KitchenDisplayToggle venueId="v1" station={estacion()} abiertaAClientes />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const { rerender } = render(pintarLocal())
    await userEvent.click(casilla())
    expect(screen.getByText('La pantalla de cocina es del plan Pro.')).toBeInTheDocument()

    h.hasAccess = true
    rerender(pintarLocal())
    expect(screen.queryByText('La pantalla de cocina es del plan Pro.')).not.toBeInTheDocument()
  })

  // M-4: el resultado de la mutación (la estación devuelta por el servidor) se escribe en la caché de configuración
  // ANTES del refetch. Se prueba leyendo la caché directamente: en este QueryClient aislado no hay ningún `useQuery`
  // montado para esa clave, así que `invalidateQueries` no dispara ningún fetch real — si la caché ya trae el cambio,
  // es porque vino de `setQueryData`, no de un refetch que "no resolvió".
  it('M-4: onSuccess escribe la estación devuelta en la caché de configuración antes de que el refetch resuelva', async () => {
    const actualizada = estacion({ hasKitchenDisplay: true })
    h.setMock.mockResolvedValue(actualizada)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const configKey = ['printStations', 'v1', 'config']
    qc.setQueryData(configKey, { stations: [estacion()], kitchenDisplayOpenToClients: true })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <KitchenDisplayToggle venueId="v1" station={estacion()} abiertaAClientes />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(casilla())
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    await waitFor(() => {
      const cache = qc.getQueryData<{ stations: PrintStation[] }>(configKey)
      expect(cache?.stations.find(s => s.id === 's1')?.hasKitchenDisplay).toBe(true)
    })
  })
})
