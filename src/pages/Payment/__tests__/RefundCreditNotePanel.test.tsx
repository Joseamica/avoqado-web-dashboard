/**
 * C2 · Tarea 9 (P10; Codex C2-16) — «acreditar por importe». Cuando la devolución por artículos se detuvo por falta de evidencia de lo
 * facturado, el servidor manda `preview.alternativa` (el reparto por tasa y su huella). El panel dice el motivo, ofrece el botón, enseña
 * el total, el reparto y el redondeo, y al confirmar manda `{ modalidad: 'POR_IMPORTE', huella }`. Un 409 («El reparto cambió…») se dice
 * y recarga la vista previa. Nunca se elige solo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import { Currency } from '@/utils/currency'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return (opts?.defaultValue as string) ?? key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

const m = vi.hoisted(() => ({
  data: null as any,
  permisos: ['cfdi:issue'] as string[],
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  post: vi.fn(),
  agotada: false,
  volverAConsultar: vi.fn(),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permisos.includes(p) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useRefundCreditNote: () => ({
    data: m.data,
    isLoading: false,
    error: null,
    refetch: m.refetch,
    esperaDelXmlAgotada: m.agotada,
    volverAConsultar: m.volverAConsultar,
  }),
  useEmitRefundCreditNote: () => ({ mutateAsync: m.mutateAsync, isPending: false }),
}))
vi.mock('@/api', () => ({ default: { post: m.post, get: vi.fn() } }))

import { RefundCreditNotePanel } from '../RefundCreditNotePanel'
import { DURACION_AVISO_LARGO_MS } from '@/pages/Cfdi/components/issueCfdiErrors'
import cfdiService, { MOTIVOS_DE_BLOQUEO_DE_NOTA } from '@/services/cfdi.service'
import en from '@/locales/en/cfdi.json'

const HUELLA = 'a'.repeat(64)
const MOTIVO =
  'Esta factura no registró cuánto se facturó de cada artículo, así que la nota no se puede emitir por artículos. Puedes acreditar lo devuelto por importe (repartido por tasa en proporción a lo que queda) o hacerla con tu contador.'
const sinEvidencia = (over: Record<string, unknown> = {}) => ({
  creditNote: null,
  eligibility: { eligible: false, reason: 'SIN_MONTO_POR_ARTICULO', message: MOTIVO },
  preview: {
    facturaOriginal: { folio: 'F12', uuid: 'UUID-1', totalCents: 25800 },
    receptor: { rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER' },
    amountToCreditCents: 5800,
    tipRefundCents: 0,
    alternativa: {
      modalidad: 'POR_IMPORTE',
      desglose: [
        { tratamiento: 'IVA_0', cents: 4496, baseCents: 4496, ivaCents: 0 },
        { tratamiento: 'IVA_16', cents: 1304, baseCents: 1124, ivaCents: 180 },
      ],
      redondeo: [{ tratamiento: 'IVA_16', componente: 'BASE', cents: 1, ambito: 'FACTURA' }],
      huella: HUELLA,
      ...over,
    },
  },
})

beforeEach(() => {
  m.data = sinEvidencia()
  m.agotada = false
  m.volverAConsultar.mockReset()
  m.permisos = ['cfdi:issue']
  m.mutateAsync.mockReset()
  m.refetch.mockReset()
  m.toast.mockReset()
  m.post.mockReset()
})

describe('RefundCreditNotePanel — C2 · T9 · acreditar por importe', () => {
  it('🔴 con `preview.alternativa`: el motivo y el botón; el diálogo enseña el total, el reparto por tasa, el redondeo y el aviso', () => {
    m.data = sinEvidencia({ aviso: '«Galleta» no aparece en la factura (por ejemplo, una cortesía que no se cobró).' })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(MOTIVO)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText(es.creditNote.byAmount.title)).toBeInTheDocument()
    expect(within(dialogo).getByText(es.creditNote.byAmount.explain)).toBeInTheDocument()
    const reparto = within(dialogo).getByTestId('reparto-por-importe')
    expect(within(reparto).getByText(Currency(58))).toBeInTheDocument()
    expect(within(reparto).getByText('F12')).toBeInTheDocument()
    expect(within(reparto).getByText('IVA 0 %')).toBeInTheDocument()
    expect(within(reparto).getByText(`${Currency(44.96)} (base ${Currency(44.96)} + IVA ${Currency(0)})`)).toBeInTheDocument()
    expect(within(reparto).getByText('IVA 16 %')).toBeInTheDocument()
    expect(within(reparto).getByText(`${Currency(13.04)} (base ${Currency(11.24)} + IVA ${Currency(1.8)})`)).toBeInTheDocument()
    // T9 ronda 1 (M-5), cambio A PROPÓSITO: el redondeo dice su ámbito. T10, cambio A PROPÓSITO: el texto es el del plan (el mismo en
    // los dos diálogos): «Incluye 1 ¢ de redondeo del SAT en la base.», con su tasa delante.
    expect(within(dialogo).getByText('IVA 16 %: Incluye 1 ¢ de redondeo del SAT en la base.')).toBeInTheDocument()
    expect(within(dialogo).getByText(/«Galleta» no aparece en la factura/)).toBeInTheDocument()
    expect(m.mutateAsync).not.toHaveBeenCalled() // abrir el diálogo no emite nada
  })
  it('🔴 «Confirmar y emitir» manda la elección con la huella del reparto que se vio', async () => {
    m.mutateAsync.mockResolvedValue({ creditNote: { id: 'n1' } })
    render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.confirm }))
    await waitFor(() =>
      expect(m.mutateAsync).toHaveBeenCalledWith({ refundId: 'r1', eleccion: { modalidad: 'POR_IMPORTE', huella: HUELLA } }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
  it('🔴 un 409 («El reparto cambió…») enseña su texto, cierra el diálogo y recarga la vista previa', async () => {
    m.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { error: 'El reparto cambió desde la vista previa; vuelve a revisarlo.' } },
    })
    render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.confirm }))
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'El reparto cambió desde la vista previa; vuelve a revisarlo.' }),
      ),
    )
    expect(m.refetch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
  it('🔴 sin permiso de facturar: el motivo y a quién pedírselo, sin el botón', () => {
    m.permisos = []
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(MOTIVO)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.byAmount.button })).not.toBeInTheDocument()
    expect(screen.getByText(es.creditNote.noPermission)).toBeInTheDocument()
  })
  it('control — otro bloqueo (sin alternativa): sólo el motivo, sin botón', () => {
    m.data = { ...sinEvidencia(), eligibility: { eligible: false, reason: 'EXCEEDS_REMAINING', message: 'Ya no queda nada.' } }
    m.data.preview = { ...m.data.preview, alternativa: undefined }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText('Ya no queda nada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.byAmount.button })).not.toBeInTheDocument()
  })
})

describe('RefundCreditNotePanel — C2 · T9 ronda 1 (M-3, M-4, M-5)', () => {
  const abrir = () => {
    render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    return screen.getByRole('alertdialog')
  }
  it('🔴 M-4: el diálogo «por importe» también enseña el receptor, el RFC, el UUID relacionado y la propina que no entra', () => {
    m.data = sinEvidencia()
    m.data.preview = { ...m.data.preview, tipRefundCents: 1000 }
    const dialogo = abrir()
    const reparto = within(dialogo).getByTestId('reparto-por-importe')
    expect(within(reparto).getByText('ESCUELA KEMPER')).toBeInTheDocument()
    expect(within(reparto).getByText('EKU9003173C9')).toBeInTheDocument()
    expect(within(reparto).getByText('UUID-1')).toBeInTheDocument()
    expect(
      within(dialogo).getByText(`La propina devuelta (${Currency(10)}) no entra: nunca formó parte de la factura.`),
    ).toBeInTheDocument()
  })
  it('🔴 M-3: con un ticket en la global, el texto dice «lo que queda de este ticket en la factura global»', () => {
    m.data = sinEvidencia()
    m.data.preview = { ...m.data.preview, facturaOriginal: { ...m.data.preview.facturaOriginal, esGlobal: true } }
    const dialogo = abrir()
    expect(within(dialogo).getByText(es.creditNote.byAmount.explainGlobal)).toBeInTheDocument()
    expect(within(dialogo).queryByText(es.creditNote.byAmount.explain)).not.toBeInTheDocument()
  })
  it('🔴 M-5: un redondeo del documento global lo dice («de la factura global»), no como uno de la factura', () => {
    m.data = sinEvidencia({ redondeo: [{ tratamiento: 'IVA_16', componente: 'IVA', cents: 3, ambito: 'DOCUMENTO_GLOBAL' }] })
    const dialogo = abrir()
    // T10 (N4 de la T8), cambio A PROPÓSITO: es una COTA ⇒ «hasta 3 ¢ … (de la factura global)».
    expect(
      // T10 ronda 1 (M7, cambia A PROPÓSITO): el ámbito va antes del punto.
      within(dialogo).getByText('IVA 16 %: Incluye hasta 3 ¢ de redondeo del SAT en el IVA (de la factura global).'),
    ).toBeInTheDocument()
  })
})

describe('cfdiService.emitRefundCreditNote — C2 · T9', () => {
  it('🔴 con la elección manda `{ modalidad, huella }`; sin ella, el POST de siempre sin body', async () => {
    m.post.mockResolvedValue({ data: { creditNote: { id: 'n1' } } })
    await cfdiService.emitRefundCreditNote('v1', 'r1', { modalidad: 'POR_IMPORTE', huella: HUELLA })
    expect(m.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/refunds/r1/credit-note', {
      modalidad: 'POR_IMPORTE',
      huella: HUELLA,
    })
    await cfdiService.emitRefundCreditNote('v1', 'r1')
    expect(m.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/refunds/r1/credit-note')
  })
})

// ─── C2 · Tarea 10: la nota que SÍ procede enseña el reparto por tasa, el redondeo y si la original es una global ──────────────────────
describe('RefundCreditNotePanel — C2 · T10 · lo que se acredita', () => {
  const elegible = (preview: Record<string, unknown> = {}) => ({
    creditNote: null,
    eligibility: { eligible: true, reason: null, message: null },
    preview: {
      facturaOriginal: { folio: 'F12', uuid: 'UUID-1', totalCents: 31600 },
      receptor: { rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER' },
      amountToCreditCents: 31600,
      tipRefundCents: 0,
      desglose: [
        { tratamiento: 'IVA_16', cents: 11600, baseCents: 10000, ivaCents: 1600 },
        { tratamiento: 'IVA_0', cents: 20000, baseCents: 20000, ivaCents: 0 },
      ],
      redondeo: [],
      usoCfdi: 'G02',
      ...preview,
    },
  })
  it('🔴 con dos tasas pinta «IVA 16 %» e «IVA 0 %» con su base y su IVA (en el panel y en la confirmación)', () => {
    m.data = elegible()
    render(<RefundCreditNotePanel refundId="r1" />)
    const reparto = screen.getByTestId('desglose-de-la-nota')
    expect(within(reparto).getByText('IVA 16 %')).toBeInTheDocument()
    expect(within(reparto).getByText(`${Currency(116)} (base ${Currency(100)} + IVA ${Currency(16)})`)).toBeInTheDocument()
    expect(within(reparto).getByText('IVA 0 %')).toBeInTheDocument()
    expect(within(reparto).getByText(`${Currency(200)} (base ${Currency(200)} + IVA ${Currency(0)})`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.cta }))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText('IVA 16 %')).toBeInTheDocument()
    expect(within(dialogo).getByText('IVA 0 %')).toBeInTheDocument()
  })
  it('🔴 con redondeo dice «Incluye 1 ¢ de redondeo del SAT en la base» (o «en el IVA»), y el del documento global «hasta N ¢ … (de la factura global)»', () => {
    m.data = elegible({
      redondeo: [
        { tratamiento: 'IVA_16', componente: 'BASE', cents: 1, ambito: 'FACTURA' },
        { tratamiento: 'IVA_16', componente: 'IVA', cents: 1, ambito: 'TICKET' },
        { tratamiento: 'IVA_16', componente: 'IVA', cents: 2, ambito: 'DOCUMENTO_GLOBAL' },
      ],
    })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText('IVA 16 %: Incluye 1 ¢ de redondeo del SAT en la base.')).toBeInTheDocument()
    // T10 ronda 1 (M7, cambia A PROPÓSITO): el ámbito va antes del punto.
    expect(screen.getByText('IVA 16 %: Incluye 1 ¢ de redondeo del SAT en el IVA (del ticket en la factura global).')).toBeInTheDocument()
    expect(screen.getByText('IVA 16 %: Incluye hasta 2 ¢ de redondeo del SAT en el IVA (de la factura global).')).toBeInTheDocument()
  })
  it('🔴 con `esGlobal` dice «Factura global (Público en General)»', () => {
    m.data = elegible({ facturaOriginal: { folio: 'G7', uuid: 'UUID-G', totalCents: 31600, esGlobal: true } })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.global)).toBeInTheDocument()
    expect(es.creditNote.global).toBe('Factura global (Público en General)')
  })
  it('🔴 la facturación apagada se DICE (la nota no se bloquea)', () => {
    m.data = elegible({
      avisoFacturacionApagada: 'La facturación de este comercio está apagada; esta nota corrige una factura que ya se emitió.',
    })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(/facturación de este comercio está apagada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.cta })).toBeInTheDocument()
  })
  it('control — un servidor anterior (sin desglose ni redondeo) pinta el panel de siempre', () => {
    m.data = elegible({ desglose: undefined, redondeo: undefined, usoCfdi: undefined })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.queryByTestId('desglose-de-la-nota')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.cta })).toBeInTheDocument()
  })
})

describe('RefundCreditNotePanel — C2 · T10 · la espera del XML y los motivos', () => {
  it('🔴 con ESPERA_XML dice «Estamos recuperando el XML de la factura; vuelve a intentarlo en unos minutos»', () => {
    // Con el texto del servidor (`MOTIVO_ESPERA_XML`) también: la pantalla dice el del plan (y vuelve a consultar a los 15 s, en el hook).
    const MOTIVO_ESPERA_XML =
      'Falta el XML de la factura original; lo estamos recuperando. La nota de crédito se podrá emitir en unos minutos.'
    m.data = { creditNote: null, eligibility: { eligible: false, reason: 'ESPERA_XML', message: MOTIVO_ESPERA_XML }, preview: null }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.waitingXml)).toBeInTheDocument()
    expect(screen.queryByText(MOTIVO_ESPERA_XML)).not.toBeInTheDocument()
    expect(es.creditNote.waitingXml).toBe('Estamos recuperando el XML de la factura; vuelve a intentarlo en unos minutos.')
  })
  it('🔴 sin `message` del servidor, el texto del motivo (`creditNote.reason.*`)', () => {
    m.data = { creditNote: null, eligibility: { eligible: false, reason: 'XML_IRRECUPERABLE', message: null }, preview: null }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.reason.XML_IRRECUPERABLE)).toBeInTheDocument()
  })
  // F6 (pulido D1): una venta devuelta COMPLETA sin factura ya no se puede facturar; el panel no puede mandar a «facturar la venta».
  it('🔴 D1: VENTA_DEVUELTA_COMPLETA ⇒ «ya no se factura por separado» (el texto del dashboard, en su idioma), sin Emitir ni «facturar la venta»', () => {
    m.data = {
      creditNote: null,
      eligibility: { eligible: false, reason: 'VENTA_DEVUELTA_COMPLETA', message: 'TEXTO EN ESPAÑOL DEL SERVIDOR' },
      preview: null,
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(es.creditNote.reason.VENTA_DEVUELTA_COMPLETA).toBe('Esta venta se devolvió completa: ya no se factura por separado.')
    expect(en.creditNote.reason.VENTA_DEVUELTA_COMPLETA).toBe('This sale was fully refunded: it is no longer invoiced on its own.')
    expect(screen.getByText(es.creditNote.reason.VENTA_DEVUELTA_COMPLETA)).toBeInTheDocument()
    expect(screen.queryByText('TEXTO EN ESPAÑOL DEL SERVIDOR')).not.toBeInTheDocument()
    expect(screen.queryByText(/primero se factura/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('control — con `message` del servidor manda el del servidor (trae folios y montos)', () => {
    m.data = {
      creditNote: null,
      eligibility: { eligible: false, reason: 'EXCEEDS_REMAINING', message: 'Ya no queda nada de la F12.' },
      preview: null,
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText('Ya no queda nada de la F12.')).toBeInTheDocument()
  })
  it('control — N4: cada motivo del servidor tiene su texto en es y en en (los textos se agregaron antes de las pruebas)', () => {
    // C3 · T8 (M12), cambio A PROPÓSITO: 24 con `EXTRAIDA_SIN_FACTURA` (la venta se sacó de la global y su factura aún no está timbrada).
    // F6 (T10), cambio A PROPÓSITO: 27 con `DESCONTADA_EN_LA_FACTURA`, `ESPERA_NOTA_DE_ARTICULOS` y `NOTA_CANCELADA`.
    // F6 (pulido D1), cambio A PROPÓSITO: 28 con `VENTA_DEVUELTA_COMPLETA` (sin factura y la venta ya se devolvió completa).
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toHaveLength(28)
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toContain('VENTA_DEVUELTA_COMPLETA')
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toContain('EXTRAIDA_SIN_FACTURA')
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toContain('DESCONTADA_EN_LA_FACTURA')
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toContain('ESPERA_NOTA_DE_ARTICULOS')
    expect(MOTIVOS_DE_BLOQUEO_DE_NOTA).toContain('NOTA_CANCELADA')
    for (const r of MOTIVOS_DE_BLOQUEO_DE_NOTA) {
      expect([r, typeof (es.creditNote.reason as Record<string, string>)[r]]).toEqual([r, 'string'])
      expect([r, typeof (en.creditNote.reason as Record<string, string>)[r]]).toEqual([r, 'string'])
    }
  })
})

// ─── C2 · Tarea 10, ronda 1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('RefundCreditNotePanel — C2 · T10 ronda 1', () => {
  const H = 'b'.repeat(64)
  const elegible = (preview: Record<string, unknown> = {}) => ({
    creditNote: null,
    eligibility: { eligible: true, reason: null, message: null },
    preview: {
      facturaOriginal: { folio: 'F12', uuid: 'UUID-1', totalCents: 11600 },
      receptor: { rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER' },
      amountToCreditCents: 11600,
      tipRefundCents: 0,
      desglose: [{ tratamiento: 'IVA_16', cents: 11600, baseCents: 10000, ivaCents: 1600 }],
      redondeo: [],
      ...preview,
    },
  })
  const emitirDesdeElPanel = async () => {
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.cta }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: es.creditNote.confirm.submit }))
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalled())
  }

  it('🔴 M9: la emisión normal manda la huella de la vista previa que se vio', async () => {
    m.data = elegible({ huella: H })
    m.mutateAsync.mockResolvedValue({ creditNote: { id: 'n1' } })
    render(<RefundCreditNotePanel refundId="r1" />)
    await emitirDesdeElPanel()
    expect(m.mutateAsync).toHaveBeenCalledWith({ refundId: 'r1', huella: H })
  })
  it('control — M9: un servidor sin `preview.huella` emite como siempre (sólo el id)', async () => {
    m.data = elegible()
    m.mutateAsync.mockResolvedValue({ creditNote: { id: 'n1' } })
    render(<RefundCreditNotePanel refundId="r1" />)
    await emitirDesdeElPanel()
    expect(m.mutateAsync).toHaveBeenCalledWith('r1')
  })
  it('🔴 M9: un 409 («La factura cambió…») enseña su texto, cierra el diálogo y recarga la vista previa', async () => {
    m.data = elegible({ huella: H })
    m.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { error: 'La factura cambió desde que la revisaste; vuelve a revisar la nota.' } },
    })
    render(<RefundCreditNotePanel refundId="r1" />)
    await emitirDesdeElPanel()
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'La factura cambió desde que la revisaste; vuelve a revisar la nota.',
        variant: 'destructive',
      }),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('🔴 M7: un componente de redondeo desconocido NO se pinta como «en la base»', () => {
    m.data = elegible({ redondeo: [{ tratamiento: 'IVA_16', componente: 'OTRO', cents: 1, ambito: 'FACTURA' }] })
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.queryByText(/en la base/)).not.toBeInTheDocument()
    expect(screen.getByText('IVA 16 %: Incluye 1 ¢ de redondeo del SAT.')).toBeInTheDocument()
  })

  it('🔴 M4: agotada la espera del XML, lo dice y ofrece «Volver a consultar» (que vuelve a pedirla)', () => {
    m.data = { creditNote: null, eligibility: { eligible: false, reason: 'ESPERA_XML', message: 'x' }, preview: null }
    m.agotada = true
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.waitingXmlStopped)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.retryXml }))
    expect(m.volverAConsultar).toHaveBeenCalledTimes(1)
  })
  // F6 (T10, H3, R4-1), cambio A PROPÓSITO: antes «sin botón»; ahora «Volver a consultar» está siempre que la nota no esté timbrada y haya
  // algo que esperar (ruling B6), sin decir que dejó de consultar.
  it('control — M4: mientras consulta sola, el texto de espera, el botón (siempre que no esté timbrada) y nada de "dejó de consultar"', () => {
    m.data = { creditNote: null, eligibility: { eligible: false, reason: 'ESPERA_XML', message: 'x' }, preview: null }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.waitingXml)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.retryXml })).toBeInTheDocument()
    expect(screen.queryByText(es.creditNote.waitingXmlStopped)).not.toBeInTheDocument()
  })
})

describe('cfdiService.emitRefundCreditNote — C2 · T10 ronda 1 (M9)', () => {
  it('🔴 la emisión normal con huella manda `{ huella }` (sin modalidad); sin nada, el POST de siempre sin body', async () => {
    m.post.mockResolvedValue({ data: { creditNote: { id: 'n1' } } })
    await cfdiService.emitRefundCreditNote('v1', 'r1', undefined, 'c'.repeat(64))
    expect(m.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/refunds/r1/credit-note', { huella: 'c'.repeat(64) })
    await cfdiService.emitRefundCreditNote('v1', 'r1')
    expect(m.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/refunds/r1/credit-note')
  })
})

// ─── C2 · ronda QA (D1, D2, D3, D7) ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('RefundCreditNotePanel — C2 · ronda QA', () => {
  const elegible = (preview: Record<string, unknown> = {}) => ({
    creditNote: null,
    eligibility: { eligible: true, reason: null, message: null },
    preview: {
      facturaOriginal: { folio: 'F12', etiqueta: 'F-12', uuid: 'UUID-1', totalCents: 11600 },
      receptor: { rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER' },
      amountToCreditCents: 11600,
      tipRefundCents: 0,
      ...preview,
    },
  })
  const PAC_EN_DUDA = { error: 'El PAC rechazó el timbrado', message: 'fetch failed', cfdiId: 'n1', timbreEnDuda: true }
  const emitir = async () => {
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.cta }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: es.creditNote.confirm.submit }))
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalled())
  }
  it('🔴 D1: 502 con `timbreEnDuda` ⇒ «No hubo respuesta clara del PAC» y que quedó en espera (nunca «rechazó», nunca «fetch failed»)', async () => {
    m.data = elegible()
    m.mutateAsync.mockRejectedValue({ response: { status: 502, data: PAC_EN_DUDA } })
    render(<RefundCreditNotePanel refundId="r1" />)
    await emitir()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({
        // C2-pulido (G5), cambia A PROPÓSITO: es una espera, no un error ⇒ ámbar, no rojo.
        variant: 'warning',
        title: es.creditNote.error.pacNoAnswer,
        description: es.creditNote.error.inDoubt,
        // C2-pulido (M2), cambia A PROPÓSITO: trae una instrucción («no la vuelvas a emitir») ⇒ dura lo de los avisos largos.
        duration: DURACION_AVISO_LARGO_MS,
      }),
    )
  })
  it('🔴 D1: 502 de un rechazo ⇒ «rechazó» + el porqué del PAC (`message`), no el mismo título dos veces', async () => {
    m.data = elegible()
    m.mutateAsync.mockRejectedValue({
      response: { status: 502, data: { error: 'El PAC rechazó el timbrado', message: 'RFC del receptor inválido', cfdiId: 'n1' } },
    })
    render(<RefundCreditNotePanel refundId="r1" />)
    await emitir()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: es.creditNote.error.pac,
        description: 'RFC del receptor inválido',
      }),
    )
  })
  it('🔴 D1: «Acreditar por importe» con el PAC en duda dice lo mismo', async () => {
    m.mutateAsync.mockRejectedValue({ response: { status: 502, data: PAC_EN_DUDA } })
    render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.confirm }))
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({
        // C2-pulido (G5), cambia A PROPÓSITO: es una espera, no un error ⇒ ámbar, no rojo.
        variant: 'warning',
        title: es.creditNote.error.pacNoAnswer,
        description: es.creditNote.error.inDoubt,
        // C2-pulido (M2), cambia A PROPÓSITO: trae una instrucción («no la vuelvas a emitir») ⇒ dura lo de los avisos largos.
        duration: DURACION_AVISO_LARGO_MS,
      }),
    )
  })
  it('🔴 D2: la nota EN DUDA (`recoveryOnly`) dice que la NOTA está en espera, no «La factura de esta venta se está procesando»', () => {
    m.data = {
      recoveryOnly: true,
      creditNote: { id: 'n1', status: 'STAMP_FAILED', uuid: null, serie: null, folio: null, totalCents: 5800, xmlUrl: null, pdfUrl: null },
      eligibility: {
        eligible: false,
        reason: null,
        message: 'La factura de esta venta se está procesando; intenta de nuevo en unos minutos.',
      },
      preview: null,
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.error.inDoubt)).toBeInTheDocument()
    expect(screen.queryByText(/La factura de esta venta se está procesando/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.cta })).not.toBeInTheDocument()
  })
  it('🔴 D3: con la facturación apagada, la rama «Acreditar por importe» también lo dice', () => {
    const aviso = 'La facturación de este comercio está apagada; esta nota corrige una factura que ya se emitió.'
    m.data = sinEvidencia()
    m.data.preview = { ...m.data.preview, avisoFacturacionApagada: aviso }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.byAmount.button })).toBeInTheDocument()
  })
  it('🔴 D7: la nota emitida se escribe «A-7» (como la lista), y la factura relacionada con su `etiqueta` en los dos diálogos', () => {
    m.data = {
      creditNote: { id: 'n1', status: 'STAMPED', uuid: 'UUID-N', serie: 'A', folio: '7', totalCents: 5800, xmlUrl: null, pdfUrl: null },
      eligibility: { eligible: false, reason: null, message: 'Este reembolso ya tiene su nota de crédito timbrada.' },
      preview: null,
    }
    const { unmount } = render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText('A-7')).toBeInTheDocument()
    expect(screen.queryByText('A7')).not.toBeInTheDocument()
    unmount()
    m.data = elegible()
    const normal = render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.cta }))
    expect(within(screen.getByRole('alertdialog')).getAllByText(/F-12/).length).toBeGreaterThan(0)
    expect(within(screen.getByRole('alertdialog')).queryByText('F12')).not.toBeInTheDocument()
    normal.unmount()
    m.data = sinEvidencia()
    m.data.preview = { ...m.data.preview, facturaOriginal: { folio: 'F12', etiqueta: 'F-12', uuid: 'UUID-1', totalCents: 25800 } }
    render(<RefundCreditNotePanel refundId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.byAmount.button }))
    expect(within(screen.getByTestId('reparto-por-importe')).getByText('F-12')).toBeInTheDocument()
  })
})

// ─── C2-pulido (G4 de la guía): el panel «Nota de crédito emitida» con PDF/XML no se desacomoda ─────────────────────────────────────────
// En el drawer (1440 px) la insignia «CFDI de Egreso» se partía en dos renglones fuera de su píldora y el UUID dejaba una «C» sola: los
// botones le quitaban el ancho al texto. Los botones van en su propio renglón y la insignia no se parte.
describe('RefundCreditNotePanel — C2-pulido · G4: nota emitida con PDF/XML', () => {
  it('🔴 la insignia no se parte y los botones van en su renglón (nunca al lado del texto)', () => {
    m.data = {
      creditNote: {
        id: 'n1',
        status: 'STAMPED',
        uuid: '8542B880-34FC-45C0-8E02-3B2A26BC7CCC',
        serie: 'A',
        folio: '107',
        totalCents: 26000,
        xmlUrl: 'https://x/n1.xml',
        pdfUrl: 'https://x/n1.pdf',
      },
      eligibility: { eligible: false, reason: null, message: 'Este reembolso ya tiene su nota de crédito timbrada.' },
      preview: null,
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.badge).className).toContain('whitespace-nowrap')
    const titulo = screen.getByText(es.creditNote.issued)
    const uuid = screen.getByText('8542B880-34FC-45C0-8E02-3B2A26BC7CCC')
    expect(uuid.className).toContain('break-all')
    for (const nombre of [es.creditNote.pdf, es.creditNote.xml]) {
      const boton = screen.getByRole('link', { name: nombre })
      // El primer contenedor que tiene al botón Y al texto apila (no es un renglón flex): el texto conserva todo el ancho.
      let comun = boton.parentElement!
      while (!comun.contains(titulo)) comun = comun.parentElement!
      expect(comun.contains(uuid)).toBe(true)
      expect(comun.classList.contains('flex') && !comun.classList.contains('flex-col')).toBe(false)
    }
  })
})

// ─── F6 (T10): la nota automática de una factura por el total ─────────────────────────────────────────────────────────────────────────
describe('RefundCreditNotePanel — F6: la nota automática de una factura por el total', () => {
  it('🔴 R7: RECUPERANDO (elegible: el job la emite) ⇒ su aviso ámbar en la rama que la ofrece', () => {
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'RECUPERANDO' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    const aviso = screen.getByText(es.creditNote.automatica.recuperando)
    expect(aviso).toBeInTheDocument()
    expect(aviso.className).toContain('text-amber-600')
  })
  it('🔴 ruling 1 del controlador: RECUPERANDO + ESPERA_XML (rama sin «Emitir nota») ⇒ su texto propio, sin «puedes emitirla ya»; elegible ⇒ el de B6 con el botón', () => {
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: false, reason: 'ESPERA_XML', message: 'x' },
      preview: null,
      automatica: { estado: 'RECUPERANDO' },
    }
    const esperaXml = render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.automatica.recuperandoEsperaXml).className).toContain('text-amber-600')
    expect(screen.queryByText(es.creditNote.automatica.recuperando)).not.toBeInTheDocument()
    expect(screen.queryByText(/puedes emitirla ya/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.cta })).not.toBeInTheDocument()
    esperaXml.unmount()
    m.data = { ...m.data, eligibility: { eligible: true, reason: null, message: null } }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.automatica.recuperando)).toBeInTheDocument()
    expect(screen.queryByText(es.creditNote.automatica.recuperandoEsperaXml)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.creditNote.cta })).toBeInTheDocument()
  })
  it('control — paridad es/en de los avisos de la nota automática', () => {
    expect(Object.keys(en.creditNote.automatica).sort()).toEqual(Object.keys(es.creditNote.automatica).sort())
    expect(Object.keys(es.creditNote.automatica).sort()).toEqual([
      'recuperando',
      'recuperandoEsperaXml',
      'recuperandoSinBoton',
      'requiere',
      'requiereSinMotivo',
    ])
    for (const k of Object.keys(es.creditNote.automatica) as Array<keyof typeof es.creditNote.automatica>)
      expect([k, typeof en.creditNote.automatica[k]]).toEqual([k, 'string'])
    expect(es.creditNote.automatica.recuperandoEsperaXml).toBe('Esta nota sale sola con su factura en cuanto llegue su XML.')
    expect(en.creditNote.automatica.recuperandoEsperaXml).toBe('This note goes out on its own with its invoice once its XML arrives.')
  })
  it('🔴 H4: REQUIERE_INTERVENCION ⇒ aviso neutral encima del motivo, que dice qué devolución revisar', () => {
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: {
        eligible: false,
        reason: 'ESPERA_NOTA_DE_ARTICULOS',
        message: 'Primero tiene que salir la nota por $58.00. Revisa esa devolución.',
      },
      preview: null,
      automatica: { estado: 'REQUIERE_INTERVENCION' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.automatica.requiere)).toBeInTheDocument()
    expect(screen.getByText(/Revisa esa devolución/)).toBeInTheDocument()
    expect(es.creditNote.automatica.requiere).not.toMatch(/no hace falta/i)
  })
  it('🔴 N6: su nota se canceló ⇒ se dice por qué y NO se ofrece «Emitir nota de crédito»', () => {
    m.data = {
      creditNote: { id: 'n1', status: 'CANCELLED' },
      recoveryOnly: false,
      eligibility: { eligible: false, reason: 'NOTA_CANCELADA', message: 'La nota de crédito de esta devolución se canceló.' },
      preview: null,
      automatica: { estado: 'REQUIERE_INTERVENCION' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText('La nota de crédito de esta devolución se canceló.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.cta })).not.toBeInTheDocument()
    // Fix ronda 1 (ruling T10-d): la nota SÍ salió y se canceló: nada que esperar ni «todavía no sale»; basta el motivo.
    expect(screen.queryByRole('button', { name: es.creditNote.retryXml })).not.toBeInTheDocument()
    expect(screen.queryByText(es.creditNote.automatica.requiere)).not.toBeInTheDocument()
    expect(screen.queryByText(/todavía no sale/)).not.toBeInTheDocument()
  })
  it('🔴 fix ronda 1 (Important): elegible + REQUIERE_INTERVENCION (el PAC la rechazó, T9-b) ⇒ el motivo del PAC (`lastError`) bajo el aviso', () => {
    m.data = {
      creditNote: { id: 'n1', status: 'STAMP_FAILED', lastError: 'el SAT rechazó la nota' },
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'REQUIERE_INTERVENCION' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.automatica.requiere)).toBeInTheDocument()
    expect(screen.getByText('el SAT rechazó la nota')).toBeInTheDocument()
  })
  it('🔴 fix ronda 1: elegible + REQUIERE_INTERVENCION SIN `lastError` ⇒ un aviso que no dice «abajo dice qué revisar»', () => {
    m.data = {
      creditNote: { id: 'n1', status: 'STAMP_FAILED', lastError: null },
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'REQUIERE_INTERVENCION' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.automatica.requiereSinMotivo)).toBeInTheDocument()
    expect(screen.queryByText(/abajo dice/)).not.toBeInTheDocument()
  })
  it('🔴 fix ronda 1 (ruling T10-c): elegible + RECUPERANDO SIN `cfdi:issue` (no hay botón) ⇒ no ofrece «puedes emitirla ya»', () => {
    m.permisos = []
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'RECUPERANDO' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByText(es.creditNote.noPermission)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.cta })).not.toBeInTheDocument()
    expect(screen.queryByText(/puedes emitirla ya/)).not.toBeInTheDocument()
    expect(screen.getByText(es.creditNote.automatica.recuperandoSinBoton)).toBeInTheDocument()
  })
  it('control — sin `automatica`, el panel de siempre', () => {
    m.data = { creditNote: null, recoveryOnly: false, eligibility: { eligible: false, reason: 'TIP_ONLY', message: null }, preview: null }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.queryByText(es.creditNote.automatica.recuperando)).not.toBeInTheDocument()
  })
  it('control (ruling B6) — sin nada que esperar (TIP_ONLY, o elegible sin nota automática) NO se ofrece «Volver a consultar»', () => {
    m.data = { creditNote: null, recoveryOnly: false, eligibility: { eligible: false, reason: 'TIP_ONLY', message: null }, preview: null }
    const tip = render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.queryByRole('button', { name: es.creditNote.retryXml })).not.toBeInTheDocument()
    tip.unmount()
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: {
        facturaOriginal: { folio: 'F12', uuid: 'UUID-1', totalCents: 11600 },
        receptor: null,
        amountToCreditCents: 5800,
        tipRefundCents: 0,
      },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByRole('button', { name: es.creditNote.cta })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.creditNote.retryXml })).not.toBeInTheDocument()
  })
  it('🔴 B6: con nota automática en la rama elegible, «Volver a consultar» está junto a «Emitir nota de crédito»', () => {
    m.data = {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'RECUPERANDO' },
    }
    render(<RefundCreditNotePanel refundId="r1" />)
    expect(screen.getByRole('button', { name: es.creditNote.cta })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.creditNote.retryXml }))
    expect(m.volverAConsultar).toHaveBeenCalledTimes(1)
  })
})
