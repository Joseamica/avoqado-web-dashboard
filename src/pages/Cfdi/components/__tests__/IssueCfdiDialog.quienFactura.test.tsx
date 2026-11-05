/**
 * D11 (videos de Facturación, 5-nov): una venta cobrada con un comercio sin la facturación configurada dejaba capturar todo y fallaba al
 * final con un texto que hablaba de efectivo. Ahora el diálogo pregunta al abrir quién factura la venta (la regla del servidor) y, si
 * nadie, dice qué falta en vez del formulario.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import es from '@/locales/es/cfdi.json'

const traducir = (key: string) => {
  const raw = key.split('.').reduce<any>((o, p) => o?.[p], es as any)
  return typeof raw === 'string' ? raw : key
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

const svc = vi.hoisted(() => ({ issueCfdiForOrder: vi.fn(), confirmPriceContract: vi.fn(), quienFactura: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({ default: svc, cfdiService: svc }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/demo' }) }))
const permisos = vi.hoisted(() => ({ actuales: new Set<string>() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => permisos.actuales.has(p) }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d }) }))
vi.mock('../receptor-fields', () => ({ ReceptorFields: () => <input aria-label="rfc" /> }))

import { IssueCfdiDialog } from '../IssueCfdiDialog'

const TEXTO =
  'El comercio «Terminal mostrador» con el que se cobró esta venta no tiene la facturación configurada. En Facturación › Configuración, elige con qué RFC factura ese comercio y enciende su facturación.'

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <IssueCfdiDialog open onOpenChange={() => {}} orderId="order-1" />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}
const emitir = () => screen.getByRole('button', { name: es.issueDialog.submit })

beforeEach(() => {
  permisos.actuales = new Set(['cfdi:issue', 'cfdi:configure'])
})

describe('IssueCfdiDialog · quién factura (D11)', () => {
  it('nadie factura la venta ⇒ el aviso del servidor en vez del formulario, «Emitir» apagado y el atajo a Configuración', async () => {
    svc.quienFactura.mockResolvedValue({ listo: false, motivo: 'COMERCIO_SIN_CONFIGURAR', error: TEXTO })
    renderDialog()
    expect(await screen.findByText(TEXTO)).toBeInTheDocument()
    expect(screen.getByText(es.issueDialog.notReady.title)).toBeInTheDocument()
    expect(screen.queryByLabelText('rfc')).toBeNull()
    expect(emitir()).toBeDisabled()
    expect(screen.getByRole('link', { name: es.issueDialog.notReady.goToSettings })).toHaveAttribute(
      'href',
      '/venues/demo/cfdi/configuracion',
    )
    expect(svc.quienFactura).toHaveBeenCalledWith('venue-1', 'order-1')
    expect(screen.queryByText(/efectivo/i)).toBeNull()
  })

  it('sin permiso de configurar ⇒ «pídeselo al dueño», sin atajo', async () => {
    permisos.actuales = new Set(['cfdi:issue'])
    svc.quienFactura.mockResolvedValue({ listo: false, motivo: 'FACTURACION_APAGADA', error: 'APAGADA' })
    renderDialog()
    expect(await screen.findByText(es.issueDialog.notReady.askOwner)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('un motivo que no se arregla en Configuración ⇒ sin atajo', async () => {
    svc.quienFactura.mockResolvedValue({ listo: false, motivo: 'VARIOS_RFC', error: 'VARIOS' })
    renderDialog()
    expect(await screen.findByText('VARIOS')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(es.issueDialog.notReady.askOwner)).toBeNull()
  })

  it('venta facturable ⇒ el formulario de siempre', async () => {
    svc.quienFactura.mockResolvedValue({ listo: true })
    renderDialog()
    await waitFor(() => expect(svc.quienFactura).toHaveBeenCalled())
    expect(screen.getByLabelText('rfc')).toBeInTheDocument()
    expect(emitir()).not.toBeDisabled()
  })

  it('Codex r1 #4: un «no» viejo no manda si la pregunta de ahora falla (cerrar, arreglar, reabrir sin red)', async () => {
    svc.quienFactura.mockResolvedValueOnce({ listo: false, motivo: 'FACTURACION_APAGADA', error: 'APAGADA' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const ui = (open: boolean) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <IssueCfdiDialog open={open} onOpenChange={() => {}} orderId="order-1" />
        </QueryClientProvider>
      </MemoryRouter>
    )
    const r = render(ui(true))
    expect(await screen.findByText('APAGADA')).toBeInTheDocument()
    svc.quienFactura.mockRejectedValueOnce(new Error('red'))
    r.rerender(ui(false))
    r.rerender(ui(true))
    await waitFor(() => expect(svc.quienFactura).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('APAGADA')).toBeNull())
    expect(screen.getByLabelText('rfc')).toBeInTheDocument()
  })

  it('Codex r3 #2: mientras llega la pregunta nueva, el «no» viejo no bloquea (cerrar, arreglar, reabrir)', async () => {
    svc.quienFactura.mockResolvedValueOnce({ listo: false, motivo: 'FACTURACION_APAGADA', error: 'APAGADA' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const ui = (open: boolean) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <IssueCfdiDialog open={open} onOpenChange={() => {}} orderId="order-1" />
        </QueryClientProvider>
      </MemoryRouter>
    )
    const r = render(ui(true))
    expect(await screen.findByText('APAGADA')).toBeInTheDocument()
    svc.quienFactura.mockReturnValueOnce(new Promise(() => {})) // la nueva nunca llega en esta prueba
    r.rerender(ui(false))
    r.rerender(ui(true))
    await waitFor(() => expect(svc.quienFactura).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('APAGADA')).toBeNull()
    expect(screen.getByLabelText('rfc')).toBeInTheDocument()
  })

  it('si la pregunta falla ⇒ el formulario de siempre (el candado de verdad es el servidor)', async () => {
    svc.quienFactura.mockRejectedValue(new Error('red'))
    renderDialog()
    await waitFor(() => expect(svc.quienFactura).toHaveBeenCalled())
    expect(screen.getByLabelText('rfc')).toBeInTheDocument()
    expect(emitir()).not.toBeDisabled()
  })
})
