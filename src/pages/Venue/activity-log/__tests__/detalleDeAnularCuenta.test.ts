import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone, detailValueOf, toDetailRows } from '../formatActivity'

type Bitacora = {
  activityLog: {
    actions: Record<string, string>
    detailKeys: Record<string, string>
    detailValues: Record<string, Record<string, string>>
  }
}

// hz:nube0000:na9a2722 (encargo 2095be): al anular una cuenta, el detalle de la bitácora decía «Desde · cancelOrder» y pintaba un
// JSON con ids (`orderDiscountIds`, `porDescuento`). El SERVIDOR (`orderCancelGuard.ts`) escribe:
//   ORDER_CANCEL_LOYALTY_RETURNED       { camino, orderDiscountIds, pointsRefunded, stampRewardsReturned, filasQuitadas,
//                                         clientasConPremio, usosDevueltos }
//   ORDER_CANCEL_DISCOUNT_USES_RETURNED { camino, usosDevueltos, porDescuento }
// y `camino` es uno de: cancelOrder, abandonedOrdersCleanup, cancelAreaTicketCheckout, returnGiftBalance, updateOrder, deleteOrder,
// voidItems (y mesa, mostrador, reapertura en DESCUENTO_SOBRE_TOPE).
const CAMINOS = [
  'cancelOrder',
  'abandonedOrdersCleanup',
  'cancelAreaTicketCheckout',
  'returnGiftBalance',
  'updateOrder',
  'deleteOrder',
  'voidItems',
  'mesa',
  'mostrador',
  'reapertura',
]
const ID_1 = 'cmhvejgq300ad2gtxbrawgh7w'
const ID_2 = 'cmtdlxl300aakna2agcago6qk'

function filas(bundle: unknown, data: Record<string, unknown>) {
  const b = (bundle as Bitacora).activityLog
  return toDetailRows(
    data,
    key => b.detailKeys[key] ?? null,
    w => ({ yes: 'Sí', no: 'No', empty: '—' })[w],
    (key, value) => b.detailValues[key]?.[value] ?? null,
  )
}

describe('bitácora: el detalle de anular una cuenta se lee sin códigos ni ids (na9a2722)', () => {
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(`${lng}: cada camino tiene su nombre`, () => {
      const b = (bundle as unknown as Bitacora).activityLog
      for (const c of CAMINOS) expect(b.detailValues.camino[c], c).toEqual(expect.stringMatching(/\S/))
    })

    it(`${lng}: lealtad devuelta al cancelar, sin ids ni nombres crudos de campo`, () => {
      const rows = filas(bundle, {
        camino: 'cancelOrder',
        orderDiscountIds: [ID_1, ID_2],
        pointsRefunded: 50,
        stampRewardsReturned: [ID_1],
        filasQuitadas: 2,
        clientasConPremio: [ID_2],
        usosDevueltos: 0,
      })
      for (const r of rows) {
        expect(r.label, r.key).not.toBe(r.key)
        expect(r.value, r.key).not.toMatch(/cmhvejgq|cmtdlxl|cancelOrder|[[{]/)
      }
    })
  }

  it('en español se lee como lo dice el POS', () => {
    const rows = filas(es, { camino: 'cancelOrder', usosDevueltos: 2, porDescuento: { [ID_1]: 2 } })
    expect(rows.map(r => [r.label, r.value])).toEqual([
      ['Desde', 'Cancelar la cuenta en el POS'],
      ['Usos devueltos', '2'],
      ['Descuentos', '1'],
    ])
  })

  it('las pantallas leen el mapa del idioma: también un valor con «:» (payCashOrder:cola)', () => {
    const t = (key: string) => (key === 'activityLog.detailValues' ? (es as unknown as Bitacora).activityLog.detailValues : key)
    const valueOf = detailValueOf(t)
    expect(valueOf('camino', 'cancelOrder')).toBe('Cancelar la cuenta en el POS')
    expect(valueOf('canal', 'payCashOrder:cola')).toBe('Efectivo cobrado sin internet')
    expect(valueOf('camino', 'caminoNuevo')).toBeNull()
    expect(detailValueOf(() => 'activityLog.detailValues')('camino', 'cancelOrder')).toBeNull()
  })

  it('un camino que el DASHBOARD todavía no conoce sale como viene, no vacío', () => {
    expect(filas(es, { camino: 'caminoNuevo' })[0].value).toBe('caminoNuevo')
  })
})

// Las entidades de las acciones nuevas (encargo 2095be): sin texto, «Sobre qué» decía `LoyaltyPromotion` o `MercadoPagoWebhookEvent`.
describe('bitácora: «Sobre qué» de las acciones nuevas tiene nombre', () => {
  const ENTIDADES = [
    'HybridCampaign',
    'KioskQrKey',
    'LoyaltyPromotion',
    'CheckoutSession',
    'MercadoPagoWebhookEvent',
    'OrganizationPaymentConfig',
    'OrganizationPricingStructure',
    'SupportDataAcceptance',
    'SupportDataUnlock',
    'SupportWhatsappLink',
  ]
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(lng, () => {
      const entities = (bundle as unknown as { activityLog: { entities: Record<string, string> } }).activityLog.entities
      for (const e of ENTIDADES) expect(entities[e], e).toEqual(expect.stringMatching(/\S/))
    })
  }
})

describe('bitácora: lo que el dueño debe revisar (descuento sobre el tope, mesas sin internet) se resalta', () => {
  for (const a of [
    'DESCUENTO_SOBRE_TOPE',
    'DESCUENTO_SIN_APROBACION_SIN_RED',
    'MESA_SIN_RED_EN_CUENTA_APARTE',
    'RONDA_TARDIA_EN_CUENTA_APARTE',
  ]) {
    it(`${a} → atención`, () => expect(actionTone(a)).toBe('attention'))
  }
})
