import { describe, expect, it } from 'vitest'

import { ORG_DEFAULT_TPV_SETTINGS } from '@/pages/Organization/orgTpvDefaults'
import { DEFAULT_TPV_SETTINGS } from '@/services/tpv-settings.service'

/**
 * Los defaults que PINTA el dashboard deben ser los que GUARDA el servidor
 * (`avoqado-server/src/services/dashboard/tpv.dashboard.service.ts`, DEFAULT_TPV_SETTINGS).
 *
 * 🔴 Por qué importa (8-oct-2026): el dashboard decía `true` en «Pedir PIN» y «Mostrar órdenes»
 * mientras el servidor guarda `false`. Al crear una terminal el switch salía prendido sin estarlo,
 * y en «Ajustes de terminales» de la organización —que con «Guardar y aplicar» empuja TODOS los
 * valores a TODAS las terminales— una organización sin ajustes guardados escribía ese `true` falso.
 */
const SERVER_DEFAULTS = {
  requirePinLogin: false,
  showOrderManagement: false,
  showReviewScreen: true,
  showTipScreen: true,
  showReceiptScreen: true,
  requireAvoqadoServerForCardPayment: true,
  kioskModeEnabled: false,
  showQuickPayment: true,
  showCheckout: true,
  showCryptoOption: false,
  cellularFailoverMode: 'OFF',
} as const

describe('defaults de ajustes de terminal = los del servidor', () => {
  it.each(Object.entries(SERVER_DEFAULTS))('%s en la terminal', (key, value) => {
    expect(DEFAULT_TPV_SETTINGS[key as keyof typeof DEFAULT_TPV_SETTINGS]).toBe(value)
  })

  it.each(Object.entries(SERVER_DEFAULTS))('%s en la organización', (key, value) => {
    expect(ORG_DEFAULT_TPV_SETTINGS[key as keyof typeof ORG_DEFAULT_TPV_SETTINGS]).toBe(value)
  })

  it('la organización NO trae trackPromoterLocationOverride: «Guardar y aplicar» lo empujaría a todas las terminales', () => {
    expect('trackPromoterLocationOverride' in ORG_DEFAULT_TPV_SETTINGS).toBe(false)
  })
})
