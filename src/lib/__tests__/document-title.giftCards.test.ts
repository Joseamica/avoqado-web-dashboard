import { describe, expect, it } from 'vitest'
import { resolveRouteDocumentTitle } from '../document-title'

const DICCIONARIO: Record<string, string> = { 'customersMenu.giftCards': 'Tarjetas de regalo' }
const t = (key: string, opts?: { defaultValue?: string }) => DICCIONARIO[key] ?? opts?.defaultValue ?? key
const translators = { sidebarT: t, organizationT: t, commonT: t, menuT: t } as never

describe('resolveRouteDocumentTitle — tarjetas de regalo', () => {
  it('la lista se titula traducida (no «Gift Cards» humanizado de la URL)', () => {
    expect(resolveRouteDocumentTitle('/venues/iq/gift-cards', translators)).toBe('Tarjetas de regalo')
    expect(resolveRouteDocumentTitle('/wl/venues/iq/gift-cards', translators)).toBe('Tarjetas de regalo')
  })
  it('la configuración también', () => {
    expect(resolveRouteDocumentTitle('/venues/iq/settings/gift-cards', translators)).toBe('Tarjetas de regalo')
  })
})
