/**
 * D1 · casilla «Vender en: ☑ Rappi ☐ Uber Eats» del producto: qué canales salen, cómo arranca cada casilla y qué manda `aplicar`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink } from '@/types/delivery'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const acceso = vi.hoisted(() => ({ puede: true }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => acceso.puede && p === 'delivery-channels:manage' }) }))
const svc = vi.hoisted(() => ({ getChannels: vi.fn(), ponerProductoEnCanales: vi.fn() }))
vi.mock('@/services/delivery.service', () => svc)

import { useVenderEnCanales, VenderEnCanales } from './VenderEnCanales'

const canal = (over: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink => ({
  id: 'l1',
  venueId: 'v1',
  provider: 'RAPPI',
  status: 'ACTIVE',
  orderAcceptanceMode: 'AUTO',
  autoSyncMenu: true,
  lastMenuSyncAt: null,
  externalLocationId: 'ext',
  config: { productoIds: ['otro'] },
  ...over,
})

let estado: ReturnType<typeof useVenderEnCanales>
function Prueba({ producto }: { producto: { id?: string; sku?: string } }) {
  estado = useVenderEnCanales('v1', producto)
  return <VenderEnCanales estado={estado} />
}
function montar(producto: { id?: string; sku?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Prueba producto={producto} />
    </QueryClientProvider>,
  )
}
const casilla = (nombre = 'Rappi') => screen.findByRole('checkbox', { name: nombre })

beforeEach(() => {
  acceso.puede = true
  svc.getChannels.mockResolvedValue([canal()])
  svc.ponerProductoEnCanales.mockResolvedValue([])
})

describe('casilla «Vender en»: qué se ve', () => {
  it('sin permiso no consulta los canales ni aparece', async () => {
    acceso.puede = false
    montar()
    await act(async () => {})
    expect(svc.getChannels).not.toHaveBeenCalled()
    expect(screen.queryByText('venderEn.titulo')).not.toBeInTheDocument()
  })

  it('si la lista de canales falla (403 sin plan), no aparece y no hay aviso', async () => {
    svc.getChannels.mockRejectedValue({ response: { status: 403 } })
    montar()
    await waitFor(() => expect(svc.getChannels).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByText('venderEn.titulo')).not.toBeInTheDocument()
    expect(estado.visible).toBe(false)
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('un canal PENDING no aparece; uno PAUSED sí', async () => {
    svc.getChannels.mockResolvedValue([canal({ id: 'l2', provider: 'UBER_EATS', status: 'PENDING' }), canal({ status: 'PAUSED' })])
    montar()
    expect(await casilla('Rappi')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Uber Eats' })).not.toBeInTheDocument()
  })

  it('en un alta, un canal con lista arranca sin marcar', async () => {
    montar()
    expect(await casilla()).not.toBeChecked()
  })

  it('al editar, el producto que está en la lista por id sale marcado', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productoIds: ['p1'] } })])
    montar({ id: 'p1', sku: 'CAFE' })
    expect(await casilla()).toBeChecked()
  })

  it('con la lista vieja por código, sale marcado si su código está', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productos: ['CAFE'] } })])
    montar({ id: 'p1', sku: 'CAFE' })
    expect(await casilla()).toBeChecked()
  })

  it('un canal con todo el catálogo sale marcado y, al desmarcarlo, avisa qué pasa', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: null })])
    montar()
    const rappi = await casilla()
    expect(rappi).toBeChecked()
    expect(screen.queryByText('venderEn.avisoTodoElCatalogo')).not.toBeInTheDocument()
    await userEvent.click(rappi)
    expect(rappi).not.toBeChecked()
    expect(screen.getByText('venderEn.avisoTodoElCatalogo')).toBeInTheDocument()
    expect(estado.cambio).toBe(true)
  })
})

describe('casilla «Vender en»: qué manda aplicar', () => {
  it('editar sin cambios no llama a la ruta', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productoIds: ['p1'] } })])
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true }, alta: false }))
    expect(svc.ponerProductoEnCanales).not.toHaveBeenCalled()
  })

  it('con un cambio manda sólo ese canal', async () => {
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true }, alta: false }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true })
  })

  it('en un alta, un canal con lista que quedó sin marcar se manda en false (cuenta como revisado)', async () => {
    svc.getChannels.mockResolvedValue([canal(), canal({ id: 'l2', provider: 'UBER_EATS', config: null })])
    montar()
    await casilla()
    await act(() => estado.aplicar('nuevo', { marcados: { l1: false, l2: true }, alta: true }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'nuevo', { l1: false })
  })

  it('si la ruta falla: aviso con el texto de «agregar» y la promesa se resuelve', async () => {
    svc.ponerProductoEnCanales.mockRejectedValue(new Error('500'))
    montar()
    await casilla()
    await act(async () => {
      await expect(estado.aplicar('nuevo', { marcados: { l1: true }, alta: true })).resolves.toBe(false) // no lanza: dice «no quedó»
    })
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'venderEn.falloAgregar' }))
  })
})
