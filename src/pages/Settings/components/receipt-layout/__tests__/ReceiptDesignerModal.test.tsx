import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReceiptDesignerModal } from '@/pages/Settings/components/receipt-layout/ReceiptDesignerModal'
import { receiptLayoutService, type ReceiptBlock } from '@/services/receiptLayout.service'

vi.mock('@/services/receiptLayout.service', async importActual => {
  const real = await importActual<typeof import('@/services/receiptLayout.service')>()
  return { ...real, receiptLayoutService: { preview: vi.fn(), save: vi.fn(), reset: vi.fn(), get: vi.fn(), templates: vi.fn() } }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k) }),
}))

const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const preview = vi.mocked(receiptLayoutService.preview)
const save = vi.mocked(receiptLayoutService.save)
const get = vi.mocked(receiptLayoutService.get)

const bloques: ReceiptBlock[] = [
  { type: 'logo', size: 'M', align: 'center' },
  { type: 'fiscal', align: 'center' },
  { type: 'orderInfo', showOrderType: true },
  { type: 'items', showModifiers: true, showNotes: true },
  { type: 'totals', showSubtotal: true, showTax: true, showDiscount: true, showTip: true },
  { type: 'payment', showChange: true, showCardLastFour: true },
  { type: 'areaDelivery' },
  { type: 'qr', caption: 'Escanea' },
  { type: 'signature' },
]

const sano = { readiness: { fiscalEmisor: true, logo: true }, devices: { supporting: 3, notSupporting: [] } }

function abrir(over: Partial<Parameters<typeof ReceiptDesignerModal>[0]> = {}) {
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const arbol = (o: Partial<Parameters<typeof ReceiptDesignerModal>[0]>) => (
    <QueryClientProvider client={client}>
      <ReceiptDesignerModal
        open
        onClose={onClose}
        venueId="v1"
        venueName="Testarudo Cafe"
        blocks={bloques}
        revision={7}
        readiness={sano.readiness}
        devices={sano.devices}
        canManage
        {...o}
      />
    </QueryClientProvider>
  )
  const r = render(arbol(over))
  // Lo que pasa en la app real tras un 409: la página relee y le vuelve a pasar props NUEVAS.
  const releerDesdeLaCache = (o: Partial<Parameters<typeof ReceiptDesignerModal>[0]>) => r.rerender(arbol({ ...over, ...o }))
  return { onClose, releerDesdeLaCache }
}

describe('ReceiptDesignerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preview.mockResolvedValue({ lines: [{ kind: 'text', text: 'TOTAL: $120.00', align: 'left', bold: true, double: false }], problems: [], dropped: 0 })
    save.mockResolvedValue({ blocks: bloques, schemaVersion: 1, revision: 8, source: 'custom', updatedAt: null })
  })

  it('🔴 guardar manda la revisión que se LEYÓ, no una inventada', async () => {
    abrir()
    // Un cambio real para habilitar el botón: sin cambios, guardar está apagado a propósito.
    await userEvent.click(await screen.findByTestId('block-row-logo'))
    await userEvent.click(await screen.findByTestId('block-size-logo-L'))
    await userEvent.click(screen.getByTestId('receipt-layout-save'))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][2]).toBe(7)
  })

  it('sin cambios, guardar está apagado: no hay nada que mandar', async () => {
    abrir()
    expect(await screen.findByTestId('receipt-layout-save')).toBeDisabled()
  })

  it('🔴 un 409 AVISA diciendo quién guardó, y no se reintenta en silencio', async () => {
    save.mockRejectedValue({
      response: { status: 409, data: { code: 'RECEIPT_LAYOUT_STALE', details: { currentRevision: 9, updatedByName: 'Ana Ríos' } } },
    })
    const { onClose } = abrir()
    await userEvent.click(await screen.findByTestId('block-row-logo'))
    await userEvent.click(await screen.findByTestId('block-size-logo-L'))
    await userEvent.click(screen.getByTestId('receipt-layout-save'))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0].description).toContain('staleByName')
    expect(save).toHaveBeenCalledTimes(1)
    // El modal NO se cierra: cerrarlo tras el conflicto escondería lo que el dueño escribió.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('🔴 cerrar con cambios pendientes PREGUNTA antes de perderlos', async () => {
    const { onClose } = abrir()
    await userEvent.click(await screen.findByTestId('block-row-logo'))
    await userEvent.click(await screen.findByTestId('block-size-logo-L'))
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(await screen.findByTestId('receipt-layout-discard')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTestId('receipt-layout-discard'))
    expect(onClose).toHaveBeenCalled()
  })

  it('cerrar SIN cambios no molesta con un diálogo', async () => {
    const { onClose } = abrir()
    await screen.findByTestId('receipt-layout-save')
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByTestId('receipt-layout-discard')).toBeNull()
  })

  it('🔴 los problemas de la vista previa se ven SOBRE el papel', async () => {
    preview.mockResolvedValue({
      lines: [],
      problems: [{ code: 'RECEIPT_LAYOUT_MISSING_BLOCK', message: 'Falta el bloque «fiscal»', blockType: 'fiscal' }],
      dropped: 0,
    })
    abrir()
    expect(await screen.findByTestId('receipt-layout-problems')).toHaveTextContent('Falta el bloque «fiscal»')
  })

  it('🔴 sin permiso de gestionar no hay botón de guardar, y se dice a quién pedirlo', async () => {
    abrir({ canManage: false })
    expect(await screen.findByTestId('receipt-layout-no-permission')).toBeInTheDocument()
    expect(screen.queryByTestId('receipt-layout-save')).toBeNull()
    expect(screen.queryByTestId('receipt-layout-add-block')).toBeNull()
  })

  it('🔴 quitar el QR avisa de lo que el cliente pierde, ANTES de quitarlo', async () => {
    abrir()
    await userEvent.click(await screen.findByTestId('block-remove-qr'))
    expect(await screen.findByTestId('receipt-layout-remove-qr-confirm')).toBeInTheDocument()
    // Todavía está: el aviso no es informativo, es una puerta.
    expect(screen.getByTestId('block-row-qr')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('receipt-layout-remove-qr-confirm'))
    await waitFor(() => expect(screen.queryByTestId('block-row-qr')).toBeNull())
  })

  it('el selector de 58 mm cambia el ancho del papel a 32 columnas', async () => {
    abrir()
    await userEvent.click(await screen.findByTestId('receipt-layout-width-58'))
    await waitFor(() => expect(preview).toHaveBeenCalledWith('v1', expect.anything(), 58, 'retail'))
  })

  it('la venta de ejemplo se le pide al SERVIDOR, no se arma aquí', async () => {
    abrir()
    await userEvent.click(await screen.findByTestId('receipt-layout-sample-restaurant'))
    await waitFor(() => expect(preview).toHaveBeenCalledWith('v1', expect.anything(), 80, 'restaurant'))
  })

  it('🔴 un bloque nuevo entra ANTES de la firma, nunca después', async () => {
    abrir()
    await userEvent.click(await screen.findByTestId('receipt-layout-add-block'))
    await userEvent.click(await screen.findByTestId('receipt-layout-add-staff'))
    const filas = [...document.querySelectorAll('[data-testid^="block-row-"]')].map(el => el.getAttribute('data-testid'))
    expect(filas[filas.length - 1]).toBe('block-row-signature')
    expect(filas).toContain('block-row-staff')
  })

  it('un tipo que ya alcanzó su tope no se ofrece (el servidor lo rechazaría)', async () => {
    abrir()
    await userEvent.click(await screen.findByTestId('receipt-layout-add-block'))
    // `logo` admite 1 y ya está puesto.
    expect(screen.queryByTestId('receipt-layout-add-logo')).toBeNull()
    expect(screen.getByTestId('receipt-layout-add-separator')).toBeInTheDocument()
  })

  it('🔴 los dos avisos honestos se ven arriba, no escondidos', async () => {
    abrir({
      readiness: { fiscalEmisor: false, logo: false },
      devices: { supporting: 0, notSupporting: [{ name: 'Sunmi D3', platform: 'POS_ANDROID', appVersion: null }] },
    })
    expect(await screen.findByTestId('receipt-layout-banners')).toBeInTheDocument()
    expect(screen.getByText('readiness.noEmisorTitle')).toBeInTheDocument()
    expect(screen.getByTestId('receipt-layout-devices')).toHaveTextContent('Sunmi D3')
  })

  it('un venue sin pendientes no ve ningún banner: no se inventa ruido', async () => {
    abrir()
    await screen.findByTestId('receipt-layout-save')
    expect(screen.queryByTestId('receipt-layout-banners')).toBeNull()
  })

  it('🔴 un error de la vista previa se DICE: nunca un papel en blanco mudo', async () => {
    preview.mockRejectedValue(new Error('boom'))
    abrir()
    expect(await screen.findByText('preview.errorTitle')).toBeInTheDocument()
  })
  /**
   * 🔴 El defecto que encontró /full-testing el 12-sep contra el servidor real, y que ninguna de las
   * pruebas de arriba veía: tras un 409 la página relee y le pasa al modal la revisión NUEVA, el modal
   * conservaba los bloques VIEJOS del usuario, y un segundo «Guardar» pisaba en silencio el trabajo
   * del otro (medido: rev 5 del admin con dirección → rev 6 del dueño sin ella). El CAS del servidor
   * funcionaba; la pantalla le pasaba por encima.
   */
  describe('🔴 conflicto: nunca pisar el trabajo de otro', () => {
    const conflicto = {
      response: { status: 409, data: { code: 'RECEIPT_LAYOUT_STALE', details: { currentRevision: 9, updatedByName: 'Ana Ríos' } } },
    }
    const delServidor: ReceiptBlock[] = [...bloques.slice(0, 7), { type: 'text', lines: ['Lo que puso Ana'], align: 'center', emphasis: 'normal' }, ...bloques.slice(7)]

    it('🔴 tras un 409, un segundo Guardar NO manda la revisión recién releída con los bloques viejos', async () => {
      save.mockRejectedValueOnce(conflicto)
      const { releerDesdeLaCache } = abrir()
      await userEvent.click(await screen.findByTestId('block-row-logo'))
      await userEvent.click(await screen.findByTestId('block-size-logo-L'))
      await userEvent.click(screen.getByTestId('receipt-layout-save'))
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1))

      // La página invalida y relee: el modal recibe la revisión y los bloques del OTRO.
      releerDesdeLaCache({ revision: 9, blocks: delServidor })

      const boton = await screen.findByTestId('receipt-layout-save')
      await waitFor(() => expect(boton).toBeDisabled())
      await userEvent.click(boton)
      expect(save).toHaveBeenCalledTimes(1)
    })

    it('🔴 el conflicto se DICE dentro del modal, con quién guardó, y ofrece recargar', async () => {
      save.mockRejectedValueOnce(conflicto)
      abrir()
      await userEvent.click(await screen.findByTestId('block-row-logo'))
      await userEvent.click(await screen.findByTestId('block-size-logo-L'))
      await userEvent.click(screen.getByTestId('receipt-layout-save'))
      const aviso = await screen.findByTestId('receipt-layout-conflict')
      expect(aviso).toHaveTextContent('designer.conflictByName')
      expect(screen.getByTestId('receipt-layout-reload')).toBeInTheDocument()
    })

    it('«Recargar lo guardado» reemplaza bloques Y revisión con lo del servidor, y el siguiente guardado usa ESA revisión', async () => {
      save.mockRejectedValueOnce(conflicto)
      get.mockResolvedValue({ blocks: delServidor, schemaVersion: 1, revision: 9, source: 'custom', updatedAt: null, ...sano })
      abrir()
      await userEvent.click(await screen.findByTestId('block-row-logo'))
      await userEvent.click(await screen.findByTestId('block-size-logo-L'))
      await userEvent.click(screen.getByTestId('receipt-layout-save'))
      await userEvent.click(await screen.findByTestId('receipt-layout-reload'))

      // Se ve lo que guardó el otro (su bloque de texto, que el dueño no tenía), y el aviso desaparece.
      expect(await screen.findByTestId('block-row-text')).toBeInTheDocument()
      expect(screen.queryByTestId('receipt-layout-conflict')).toBeNull()

      // Un cambio nuevo y guardar: ahora sí con la revisión recargada.
      save.mockResolvedValueOnce({ blocks: delServidor, schemaVersion: 1, revision: 10, source: 'custom', updatedAt: null })
      await userEvent.click(screen.getByTestId('block-remove-qr'))
      await userEvent.click(await screen.findByTestId('receipt-layout-remove-qr-confirm'))
      await userEvent.click(screen.getByTestId('receipt-layout-save'))
      await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
      expect(save.mock.calls[1][2]).toBe(9)
    })

    it('🔴 la revisión se FIJA al abrir: si la caché cambia por debajo, guardar manda la de apertura y el servidor decide', async () => {
      const { releerDesdeLaCache } = abrir()
      await userEvent.click(await screen.findByTestId('block-row-logo'))
      await userEvent.click(await screen.findByTestId('block-size-logo-L'))
      releerDesdeLaCache({ revision: 12 })
      await userEvent.click(screen.getByTestId('receipt-layout-save'))
      await waitFor(() => expect(save).toHaveBeenCalled())
      expect(save.mock.calls[0][2]).toBe(7)
    })
  })
})
