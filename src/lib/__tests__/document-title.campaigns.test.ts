import { describe, it, expect } from 'vitest'
import { resolveRouteDocumentTitle } from '../document-title'

/**
 * El título de la pestaña sale de un mapa DISTINTO al de la miga de pan.
 *
 * El defecto que fija: `campaigns` estaba en el mapa del breadcrumb (`src/dashboard.tsx`) pero
 * NO en el de `document-title.ts`, así que la pestaña caía al humanizador del segmento de URL y
 * decía "Campaigns" — en inglés, con el dashboard en español, mientras el `<h1>` y la miga
 * decían "Campañas de correo". Encontrado en el /full-testing del 2026-09-07.
 */

/** Traductores falsos: devuelven la CLAVE traducida sólo si la conocen, si no el defaultValue. */
const DICCIONARIO: Record<string, string> = {
  'customersMenu.campaigns': 'Campañas de correo',
  'customersMenu.loyalty': 'Programa de lealtad',
}
const t = (key: string, opts?: { defaultValue?: string }) => DICCIONARIO[key] ?? opts?.defaultValue ?? key
const translators = { sidebarT: t, organizationT: t, commonT: t, menuT: t } as never

describe('resolveRouteDocumentTitle — campañas de correo', () => {
  it('traduce el título de /venues/:slug/campaigns en vez de humanizar la URL', () => {
    const titulo = resolveRouteDocumentTitle('/venues/tiers-pro/campaigns', translators)
    expect(titulo).toBe('Campañas de correo')
    // 🔴 Lo que hacía antes: capitalizar el segmento. Si vuelve a caer ahí, esto falla.
    expect(titulo).not.toBe('Campaigns')
  })

  it('también en white-label (/wl/venues/:slug/campaigns)', () => {
    expect(resolveRouteDocumentTitle('/wl/venues/tiers-pro/campaigns', translators)).toBe('Campañas de correo')
  })

  it('el vecino que ya funcionaba sigue igual', () => {
    expect(resolveRouteDocumentTitle('/venues/tiers-pro/loyalty', translators)).toBe('Programa de lealtad')
  })
})
