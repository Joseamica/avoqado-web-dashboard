import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReceiptLayoutPage from '@/pages/Settings/ReceiptLayout'
import { receiptLayoutService, type ReceiptLayoutResponse } from '@/services/receiptLayout.service'

vi.mock('@/services/receiptLayout.service', async importActual => {
  const real = await importActual<typeof import('@/services/receiptLayout.service')>()
  return { ...real, receiptLayoutService: { get: vi.fn(), save: vi.fn(), reset: vi.fn(), preview: vi.fn(), templates: vi.fn() } }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.count !== undefined ? `${k}:${o.count}` : o?.date !== undefined ? `${k}:${o.date}` : k,
    i18n: { language: 'es' },
  }),
}))
// La zona del NEGOCIO, lejos de la del proceso de pruebas: sólo así una fecha pintada con la
// zona del navegador se distingue de una pintada con la del negocio.
const zonaDelNegocio = { timezone: 'Asia/Tokyo' }
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: zonaDelNegocio }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Testarudo Cafe' }, fullBasePath: '/venues/testarudo' }),
}))
const can = vi.fn()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const get = vi.mocked(receiptLayoutService.get)
const reset = vi.mocked(receiptLayoutService.reset)
const preview = vi.mocked(receiptLayoutService.preview)
const templates = vi.mocked(receiptLayoutService.templates)

const guardado: ReceiptLayoutResponse = {
  blocks: [
    { type: 'fiscal', align: 'center' },
    { type: 'orderInfo', showOrderType: true },
    { type: 'items', showModifiers: true, showNotes: true },
    { type: 'totals', showSubtotal: true, showTax: true, showDiscount: true, showTip: true },
    { type: 'payment', showChange: true, showCardLastFour: true },
    { type: 'areaDelivery' },
    { type: 'signature' },
  ],
  schemaVersion: 1,
  revision: 4,
  source: 'custom',
  updatedAt: '2026-09-11T12:00:00.000Z',
  readiness: { fiscalEmisor: true, logo: true },
  devices: { supporting: 2, notSupporting: [] },
}

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReceiptLayoutPage />
    </QueryClientProvider>,
  )
}

describe('ReceiptLayout (sección de Ajustes)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    can.mockReturnValue(true)
    get.mockResolvedValue(guardado)
    preview.mockResolvedValue({
      lines: [{ kind: 'text', text: 'TOTAL: $120.00', align: 'left', bold: true, double: false }],
      problems: [],
      dropped: 0,
    })
    templates.mockResolvedValue([
      { id: 'minimal', name: 'Mínimo', description: 'Lo que exige la ley', blocks: [{ type: 'fiscal' }], hash: 'abc' },
    ])
    reset.mockResolvedValue({ blocks: guardado.blocks, schemaVersion: 1, revision: 0, source: 'default', updatedAt: null })
  })

  it('🔴 un error del servidor se DICE y ofrece reintentar: nunca «no hay nada»', async () => {
    get.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByRole('alert')).toHaveTextContent('page.loadErrorTitle')
    expect(screen.getByRole('button', { name: 'page.retry' })).toBeInTheDocument()
    // El vacío y el error no se pueden confundir: son dos cosas distintas.
    expect(screen.queryByText('page.thisIsWhatPrints')).toBeNull()
  })

  it('el ticket que sale HOY se enseña, con su etiqueta: el vacío enseña en vez de estar en blanco', async () => {
    pintar()
    expect(await screen.findByText('page.thisIsWhatPrints')).toBeInTheDocument()
    expect(await screen.findByText('TOTAL: $120.00')).toBeInTheDocument()
  })

  it('un diseño propio y uno de fábrica se distinguen con TEXTO, no con un tono', async () => {
    pintar()
    expect(await screen.findByText('page.sourceCustom')).toBeInTheDocument()
  })

  it('un diseño de fábrica no ofrece «Restablecer»: no hay nada que restablecer', async () => {
    get.mockResolvedValue({ ...guardado, source: 'default', revision: 0, updatedAt: null })
    pintar()
    await screen.findByText('page.sourceDefault')
    expect(screen.getByTestId('receipt-layout-reset')).toBeDisabled()
  })

  it('🔴 restablecer manda la revisión LEÍDA, para que un 409 lo pare si alguien guardó', async () => {
    pintar()
    await userEvent.click(await screen.findByTestId('receipt-layout-reset'))
    await userEvent.click(await screen.findByTestId('receipt-layout-reset-confirm'))
    await waitFor(() => expect(reset).toHaveBeenCalledWith('v1', 4))
  })

  it('🔴 sin permiso de gestionar: se ve todo, no hay escritura, y se dice a quién pedirlo', async () => {
    can.mockImplementation((p: string) => p !== 'receipt-layout:manage')
    pintar()
    expect(await screen.findByTestId('receipt-layout-read-only')).toBeInTheDocument()
    expect(screen.queryByTestId('receipt-layout-reset')).toBeNull()
    expect(screen.queryByTestId('receipt-layout-templates')).toBeNull()
    // Ver SÍ se puede: el botón cambia de «Diseñar» a «Ver».
    expect(screen.getByTestId('receipt-layout-design')).toHaveTextContent('page.view')
  })

  it('🔴 elegir una plantilla NO la guarda: abre el diseñador CON ella puesta', async () => {
    pintar()
    await userEvent.click(await screen.findByTestId('receipt-layout-templates'))
    await userEvent.click(await screen.findByTestId('receipt-layout-template-minimal'))
    // La plantilla mínima trae UN bloque: si el diseñador abriera con el ticket guardado,
    // se verían los siete.
    await waitFor(() => expect(screen.getByTestId('block-row-fiscal')).toBeInTheDocument())
    expect(screen.queryByTestId('block-row-signature')).toBeNull()
    expect(receiptLayoutService.save).not.toHaveBeenCalled()
  })

  it('«Diseñar» abre con lo GUARDADO, aunque antes se hubiera mirado una plantilla', async () => {
    pintar()
    await userEvent.click(await screen.findByTestId('receipt-layout-templates'))
    await userEvent.click(await screen.findByTestId('receipt-layout-template-minimal'))
    await waitFor(() => expect(screen.getByTestId('block-row-fiscal')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    await userEvent.click(await screen.findByTestId('receipt-layout-design'))
    await waitFor(() => expect(screen.getByTestId('block-row-signature')).toBeInTheDocument())
  })

  // 🔴 WARN del full-testing del 12-sep: `toLocaleDateString()` usaba la zona del NAVEGADOR.
  // Guardado a las 03:30 UTC del 12-sep: en Tokio (el negocio) es el 12; en México, todavía el 11.
  it('🔴 «Editado el» sale en la zona del NEGOCIO, no en la del navegador', async () => {
    get.mockResolvedValue({ ...guardado, updatedAt: '2026-09-12T03:30:00.000Z' })
    pintar()
    const editado = await screen.findByText(/^page\.editedOn:/)
    expect(editado.textContent).toMatch(/\b12\b/)
    expect(editado.textContent).not.toMatch(/\b11\b/)
  })

  // 🔴 WARN: los avisos honestos sólo vivían DENTRO del diseñador. Quien entra a mirar su ticket
  // no se enteraba de que su RFC no sale ni de que sus aparatos siguen con el ticket anterior.
  it('🔴 los avisos honestos se ven en la sección, sin abrir el diseñador, con la MARCA del aparato', async () => {
    get.mockResolvedValue({
      ...guardado,
      readiness: { fiscalEmisor: false, logo: true },
      devices: { supporting: 0, notSupporting: [{ name: 'Terminal 2', platform: 'TPV_ANDROID', brand: 'NEXGO', appVersion: '2.9.2' }] },
    })
    pintar()
    const avisos = await screen.findByTestId('receipt-layout-banners')
    expect(avisos).toHaveTextContent('readiness.noEmisorTitle')
    // «TPV_ANDROID» a secas no dice cuál de las dos terminales falta actualizar.
    expect(avisos).toHaveTextContent('Terminal 2')
    expect(avisos).toHaveTextContent('devices.platform.TPV_ANDROID')
    expect(avisos).toHaveTextContent('NEXGO')
    expect(screen.queryByText('TPV_ANDROID')).toBeNull()
  })

  // 🔴 WARN: la vista previa se encendía con los bloques VIVOS pero mandaba los del debounce, que al
  // cargar todavía eran []. Resultado: un POST con blocks:[] y un 400 en el log en cada entrada.
  it('🔴 la vista previa NUNCA se pide con una lista vacía', async () => {
    pintar()
    await waitFor(() => expect(preview).toHaveBeenCalled(), { timeout: 2000 })
    for (const [, blocks] of preview.mock.calls) expect(blocks).not.toEqual([])
  })

  // 🔴 WARN: el mismo `data-tour` en el papel de la sección y en el del diseñador. El tour
  // iluminaba el primero que encontraba, que no siempre era el que se estaba viendo.
  it('🔴 el papel de la sección NO lleva el data-tour del diseñador: sólo hay uno', async () => {
    pintar()
    await screen.findByText('TOTAL: $120.00')
    expect(document.querySelectorAll('[data-tour="receipt-layout-paper"]')).toHaveLength(0)
    await userEvent.click(screen.getByTestId('receipt-layout-design'))
    await waitFor(() => expect(document.querySelectorAll('[data-tour="receipt-layout-paper"]')).toHaveLength(1))
  })

  it('un fallo al traer las plantillas se DICE dentro del diálogo', async () => {
    templates.mockRejectedValue(new Error('boom'))
    pintar()
    await userEvent.click(await screen.findByTestId('receipt-layout-templates'))
    expect(await screen.findByText('templates.error')).toBeInTheDocument()
  })
})
