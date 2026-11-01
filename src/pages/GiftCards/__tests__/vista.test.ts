import { describe, expect, it } from 'vitest'
import type { GiftCardSettingsView } from '@/types/giftCard'
import { decidirVista, verTarjetasEnAjustes } from '../vista'

const S: GiftCardSettingsView = {
  enabled: false,
  suggestedAmounts: [500, 1000, 2000],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 69999.99,
  llavesConfiguradas: true,
  hasCards: false,
  updatedAt: null,
}
const base = { settings: S, settingsLoading: false, tierLoading: false, tierResolved: true, hasAccess: true }

describe('decidirVista', () => {
  it('mientras llegan los ajustes: cargando', () => {
    expect(decidirVista({ ...base, settings: undefined, settingsLoading: true })).toBe('cargando')
  })
  it('🔴 con tarjetas vendidas SIEMPRE la lista, aunque esté apagado y sin plan (spec §6)', () => {
    expect(decidirVista({ ...base, settings: { ...S, hasCards: true }, hasAccess: false })).toBe('lista')
  })
  it('🔴 saldo a favor: un negocio con sólo sobres de saldo (sin vender tarjetas, sin módulo ni plan) ve la lista y sus reportes, no el cartel', () => {
    // El sobre es una GiftCard: `hasCards` (EXISTS en GiftCard) es true, así que las devoluciones a saldo siempre se pueden revisar.
    expect(decidirVista({ ...base, settings: { ...S, enabled: false, hasCards: true }, hasAccess: false, tierResolved: true })).toBe('lista')
  })
  it('prendido: la lista (aunque todavía no haya ninguna)', () => {
    expect(decidirVista({ ...base, settings: { ...S, enabled: true } })).toBe('lista')
  })
  it('nunca usadas y sin el plan COMPROBADO: el cartel', () => {
    expect(decidirVista({ ...base, hasAccess: false })).toBe('cartel')
  })
  it('nunca usadas con el plan: la invitación a prenderlas', () => {
    expect(decidirVista(base)).toBe('prender')
  })
  it('nunca usadas y el plan todavía cargando: cargando (no parpadea entre invitación y cartel)', () => {
    expect(decidirVista({ ...base, tierLoading: true, tierResolved: false })).toBe('cargando')
  })
  it('el plan no se pudo comprobar: no se adivina el cartel', () => {
    expect(decidirVista({ ...base, tierResolved: false, hasAccess: true })).toBe('prender')
  })
  it('los ajustes fallaron: la lista igual se puede ver (no depende de ellos)', () => {
    expect(decidirVista({ ...base, settings: undefined })).toBe('lista')
  })
  it('defensa (gratis): una respuesta sin `hasCards` cae en la lista, nunca en el cartel (ante la duda no se esconden saldos)', () => {
    const sinCampo: Partial<GiftCardSettingsView> = { ...S }
    delete sinCampo.hasCards
    expect(decidirVista({ ...base, settings: sinCampo as GiftCardSettingsView, hasAccess: false })).toBe('lista')
  })
})

// D6 r1 (M1): el hub de Ajustes sigue al menú lateral, que en la fase 1a esconde las tarjetas en marca blanca.
describe('verTarjetasEnAjustes', () => {
  it('con giftCards:read y fuera de marca blanca se ve', () => {
    expect(verTarjetasEnAjustes({ puedeLeer: true, marcaBlanca: false })).toBe(true)
  })
  it('en marca blanca no se ve, aunque tenga el permiso (como el menú lateral)', () => {
    expect(verTarjetasEnAjustes({ puedeLeer: true, marcaBlanca: true })).toBe(false)
  })
  it('sin giftCards:read no se ve', () => {
    expect(verTarjetasEnAjustes({ puedeLeer: false, marcaBlanca: false })).toBe(false)
  })
})
