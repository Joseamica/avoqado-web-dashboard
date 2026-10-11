import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { get, post: vi.fn() } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { AutofacturaPanel } from '../AutofacturaPanel'

// B3a ronda final F3 (Codex final #3) y ajuste 4: el motivo que el servidor calcula para 2 × $1.04 con IVA aparte ($0.17 de IVA cada
// uno, cobro $2.42; `motivoNoCuadra(241, 242)` en avoqado-server). Está escrito para el COMERCIO; la tarjeta pública nunca lo enseña,
// ni aunque un servidor lo mandara.
const MOTIVO_2X104 =
  'Con el redondeo que usa el SAT, esta factura saldría por $2.41 y se cobraron $2.42, y no encontramos cómo cuadrarla moviendo centavos de descuento sin cambiar precios. No se timbró: factúrala con tu contador o repórtala a soporte.'

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={qc}>
      <AutofacturaPanel accessKey="key-abc" />
    </QueryClientProvider>,
  )
  // Mientras carga el panel también está vacío: las pruebas de «no enseña nada» esperan a que el GET haya contestado.
  const contestado = () => vi.waitFor(() => expect(qc.getQueryState(['public-cfdi-status', 'key-abc'])?.status).toBe('success'))
  return { ...view, contestado }
}

describe('AutofacturaPanel: autofactura habilitada pero esta venta no se puede timbrar exacta (F3)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('🔴 2 × $1.04 (bloqueo fiscal): enseña SÓLO el texto para el cliente (título + «pide tu factura al negocio»), sin el motivo interno ni el botón de facturar', async () => {
    get.mockResolvedValue({
      // `reasons` no lo manda el servidor (ajuste 4); va aquí para probar que, aunque llegara, la tarjeta no lo enseña.
      data: { cfdi: null, autofacturaAvailable: false, autofacturaUnavailable: { kind: 'FISCAL_BLOCK', reasons: [MOTIVO_2X104] } },
    })
    const { container } = mount()
    expect(await screen.findByText('autofactura.fiscalBlock.title')).toBeInTheDocument()
    expect(screen.getByText('autofactura.fiscalBlock.subtitle')).toBeInTheDocument()
    expect(screen.queryByText(MOTIVO_2X104)).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('$2.41')
    expect(screen.queryByText('autofactura.cta.button')).not.toBeInTheDocument()
  })

  it('control — el comercio la desactivó (DISABLED): no enseña nada', async () => {
    get.mockResolvedValue({ data: { cfdi: null, autofacturaAvailable: false, autofacturaUnavailable: { kind: 'DISABLED' } } })
    const { container, contestado } = mount()
    await contestado()
    expect(container).toBeEmptyDOMElement()
  })

  it('control — un servidor viejo sin el campo nuevo: igual que hoy, no enseña nada', async () => {
    get.mockResolvedValue({ data: { cfdi: null, autofacturaAvailable: false } })
    const { container, contestado } = mount()
    await contestado()
    expect(container).toBeEmptyDOMElement()
  })

  it('control — disponible: el botón de facturar, sin la explicación', async () => {
    get.mockResolvedValue({ data: { cfdi: null, autofacturaAvailable: true } })
    mount()
    expect(await screen.findByText('autofactura.cta.button')).toBeInTheDocument()
    expect(screen.queryByText('autofactura.fiscalBlock.title')).not.toBeInTheDocument()
  })
})

// C2-pulido · G1: la factura de la venta quedó EN DUDA (el PAC no contestó claro y pudo haberla timbrado). El servidor ya no ofrece el
// formulario y lo dice con `autofacturaUnavailable.kind: 'TIMBRE_EN_DUDA'` (nuevo y opcional): el recibo lo pinta como una ESPERA, en ámbar,
// con el mismo texto que ya da el 409 del POST («Tu factura se está procesando…»).
describe('AutofacturaPanel — C2-pulido · G1: la factura de la venta en duda', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('🔴 TIMBRE_EN_DUDA ⇒ tarjeta ámbar «se está procesando», sin el botón de facturar ni el texto del bloqueo fiscal', async () => {
    get.mockResolvedValue({
      data: {
        cfdi: { uuid: null, status: 'STAMP_FAILED' },
        autofacturaAvailable: false,
        autofacturaUnavailable: { kind: 'TIMBRE_EN_DUDA' },
      },
    })
    const { container, contestado } = mount()
    await contestado()
    await vi.waitFor(() => expect(screen.queryByText('autofactura.stampInDoubt.title')).toBeInTheDocument())
    expect(screen.getByText('autofactura.stampInDoubt.subtitle')).toBeInTheDocument()
    expect(container.querySelector('[data-tour="autofactura-stamp-in-doubt"] .text-amber-500')).not.toBeNull()
    expect(screen.queryByText('autofactura.cta.button')).not.toBeInTheDocument()
    expect(screen.queryByText('autofactura.fiscalBlock.title')).not.toBeInTheDocument()
  })

  it('control — un `kind` que este recibo no conoce (servidor más nuevo): igual que hoy, no enseña nada', async () => {
    get.mockResolvedValue({ data: { cfdi: null, autofacturaAvailable: false, autofacturaUnavailable: { kind: 'OTRO_MOTIVO_NUEVO' } } })
    const { container, contestado } = mount()
    await contestado()
    expect(container).toBeEmptyDOMElement()
  })

  it('control — ya timbrada (la duda se resolvió): manda la descarga, no la espera', async () => {
    get.mockResolvedValue({
      data: {
        cfdi: { uuid: 'u-1', status: 'STAMPED', pdfUrl: 'p' },
        autofacturaAvailable: false,
        autofacturaUnavailable: { kind: 'TIMBRE_EN_DUDA' },
      },
    })
    mount()
    expect(await screen.findByText('autofactura.alreadyInvoiced')).toBeInTheDocument()
    expect(screen.queryByText('autofactura.stampInDoubt.title')).not.toBeInTheDocument()
  })
})
