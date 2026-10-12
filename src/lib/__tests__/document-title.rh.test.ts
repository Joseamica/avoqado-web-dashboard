import { describe, it, expect } from 'vitest'
import { resolveRouteDocumentTitle } from '../document-title'

/**
 * RH fase 1a: `rh/puestos` es una ruta nueva y el título de la pestaña sale de un mapa DISTINTO al de la miga de pan.
 * Sin rama propia, la pestaña caía al humanizador del segmento de URL y decía "Rh | Avoqado".
 */

/** Traductores falsos: devuelven la clave traducida sólo si la conocen, si no el defaultValue (como en campaigns). */
const DICCIONARIO: Record<string, string> = {
  'rh:menu.title': 'RH',
  'rh:menu.positions': 'Puestos',
  'routes.teams': 'Equipo',
}
const t = (key: string, opts?: { defaultValue?: string }) => DICCIONARIO[key] ?? opts?.defaultValue ?? key
const translators = { sidebarT: t, organizationT: t, commonT: t, menuT: t } as never

describe('resolveRouteDocumentTitle — RH', () => {
  it('/venues/:slug/rh/puestos dice «Puestos» (no «Rh»)', () => {
    const titulo = resolveRouteDocumentTitle('/venues/demo/rh/puestos', translators)
    expect(titulo).toBe('Puestos')
    expect(titulo).not.toBe('Rh')
  })

  it('/venues/:slug/rh (la miga «RH») dice «RH»', () => {
    expect(resolveRouteDocumentTitle('/venues/demo/rh', translators)).toBe('RH')
  })

  it('también por la familia white-label (aunque esa ruta la bloquea NotWhiteLabelRoute)', () => {
    expect(resolveRouteDocumentTitle('/wl/venues/demo/rh/puestos', translators)).toBe('Puestos')
  })

  it('el vecino que ya funcionaba sigue igual (team)', () => {
    expect(resolveRouteDocumentTitle('/venues/demo/team', translators)).toBe('Equipo')
  })
})
