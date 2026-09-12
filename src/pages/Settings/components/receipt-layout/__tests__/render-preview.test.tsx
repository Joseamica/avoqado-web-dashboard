/**
 * No es una prueba: es un generador de VISTA PREVIA.
 *
 * Renderiza el diseñador REAL con los textos reales de `locales/es/receiptLayout.json` y
 * vuelca el HTML a disco, para poder MIRAR la pantalla sin iniciar sesión.
 *
 * 🔴 Vale la pena porque encuentra la clase de defecto que ninguna de las 85 pruebas de esta
 * carpeta ve: dos elementos que se pisan, un texto que no cabe, una clave de i18n sin traducir
 * saliendo cruda, un contraste que no se lee. Las pruebas comprueban que el texto ESTÉ, no
 * cómo se LEE.
 *
 * APAGADO por defecto para no escribir archivos en cada `vitest run`:
 *
 *   VISTA_PREVIA=1 npx vitest run src/pages/Settings/components/receipt-layout/__tests__/render-preview.test.tsx
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/receiptLayout.json'
import { ReceiptDesignerModal } from '@/pages/Settings/components/receipt-layout/ReceiptDesignerModal'
import { receiptLayoutService, type LogicalLine, type ReceiptBlock } from '@/services/receiptLayout.service'

vi.mock('@/services/receiptLayout.service', async importActual => {
  const real = await importActual<typeof import('@/services/receiptLayout.service')>()
  return { ...real, receiptLayoutService: { preview: vi.fn(), save: vi.fn(), reset: vi.fn(), get: vi.fn(), templates: vi.fn() } }
})
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))

// 🔴 `t` REAL contra el español: si una clave faltara, saldría cruda en la vista previa —
// que es justo uno de los defectos que se quieren ver.
function traducir(clave: string, vars?: Record<string, unknown>): string {
  const valor = clave.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), es as any)
  if (typeof valor !== 'string') return clave
  return valor.replace(/\{\{(\w+)\}\}/g, (_m, v) => String(vars?.[v] ?? `{{${v}}}`))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir }) }))

const SALIDA = '/tmp/vista-previa-ticket'

const BLOQUES: ReceiptBlock[] = [
  { type: 'logo', size: 'M', align: 'center' },
  { type: 'businessName', align: 'center', emphasis: 'double' },
  { type: 'fiscal', align: 'center' },
  { type: 'address', align: 'center' },
  { type: 'separator', style: 'line' },
  { type: 'orderInfo', showOrderType: true },
  { type: 'staff' },
  { type: 'items', showModifiers: true, showNotes: false },
  { type: 'totals', showSubtotal: true, showTax: true, showDiscount: true, showTip: true },
  { type: 'payment', showChange: true, showCardLastFour: true },
  { type: 'areaDelivery' },
  { type: 'qr', caption: 'Escanea para tu recibo y factura' },
  { type: 'text', lines: ['Gracias por su compra, esperamos verle de nuevo.'], align: 'center', emphasis: 'normal' },
  { type: 'signature' },
]

const t = (text: string, align: 'left' | 'center' | 'right' = 'left', bold = false, double = false): LogicalLine => ({
  kind: 'text',
  text,
  align,
  bold,
  double,
})

/** El ticket canónico de Testarudo, tal como lo produce el intérprete a 48 columnas. */
const LINEAS: LogicalLine[] = [
  { kind: 'image', ref: 'logo', widthPct: 60 },
  t('Testarudo Cafe', 'center', false, true),
  t('TESTARUDO CAFE S.A.P.I. DE C.V.', 'center'),
  t('RFC: TCA2501231A6', 'center'),
  t('Av. Universidad 1200, Del Valle, CDMX', 'center'),
  t('------------------------------------------------'),
  t('Orden #:                                    1042'),
  t('Fecha:                          12/09/2026 11:58'),
  t('Tipo:                                  Mostrador'),
  t('Atendio:                            Ana Martinez'),
  t('------------------------------------------------'),
  t('Cant Articulo                              Total'),
  t('   2 Cafe Americano                       $90.00'),
  t('     + Leche de almendra'),
  t('   1 Croissant de almendra                $65.00'),
  t('------------------------------------------------'),
  t('Subtotal:                                $155.00'),
  t('IVA:                                      $24.80'),
  t('Propina:                                  $20.00'),
  t('TOTAL:                                   $175.00', 'left', true),
  t('Pago: Tarjeta                            VISA*42'),
  t('Autorizacion:                             O4BNRD'),
  { kind: 'feed', lines: 1 },
  t('VALE POR SU PEDIDO EN BARRA', 'center', true),
  t('B-17', 'center', false, true),
  { kind: 'feed', lines: 1 },
  { kind: 'qr', data: 'https://avoqado.io/r/abc123' },
  t('Escanea para tu recibo y factura', 'center'),
  t('Gracias por su compra, esperamos verle de nuevo.', 'center'),
  { kind: 'feed', lines: 1 },
  { kind: 'image', ref: 'avoqadoMark', widthPct: 15 },
  t('Powered by Avoqado', 'center'),
  { kind: 'cut' },
]

describe('vista previa del diseñador de tickets', () => {
  it.skipIf(!process.env.VISTA_PREVIA)('vuelca el HTML para mirarlo', async () => {
    fs.mkdirSync(SALIDA, { recursive: true })
    vi.mocked(receiptLayoutService.preview).mockResolvedValue({ lines: LINEAS, problems: [], dropped: 0 })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ReceiptDesignerModal
          open
          onClose={() => {}}
          venueId="v1"
          venueName="Testarudo Cafe"
          blocks={BLOQUES}
          revision={7}
          // Con los dos avisos PUESTOS: es el estado que más elementos apila y donde
          // algo se pisa si se va a pisar.
          readiness={{ fiscalEmisor: false, logo: true }}
          devices={{ supporting: 1, notSupporting: [{ name: 'Sunmi D3 Mostrador', platform: 'POS_ANDROID', appVersion: '2.17.1' }] }}
          canManage
          fiscalHref="/venues/testarudo/facturacion"
        />
      </QueryClientProvider>,
    )

    // 🔴 Esperar a que EXISTA no basta: hay que esperar a que la vista previa RESUELVA, o se
    // captura el papel vacío (el defecto que ya costó una pasada en el checador).
    await screen.findByText('TOTAL:                                   $175.00', { normalizer: s => s })
    await waitFor(() => expect(document.querySelector('[data-paper]')).toBeTruthy())

    const dialogo = document.querySelector('[role="dialog"]')
    const html = (dialogo ?? document.body).outerHTML
    fs.writeFileSync(path.join(SALIDA, 'disenador.html'), html)
    expect(html.length).toBeGreaterThan(2000)
  })
})
