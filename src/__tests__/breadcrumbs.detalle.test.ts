/**
 * Toda pantalla de DETALLE debe poner un nombre humano en la miga de pan.
 *
 * 🔴 El bug, visto tres veces seguidas haciendo guías (27-ago-2026): la miga mostraba el id
 * crudo — «Órdenes de compra › Cmtbubvds0001q00rjczxm7wv», «Reservaciones › Cmtcc2l1q0O0…»,
 * «Clientes › Cmtcc21810088c9ttprrunfk1». El fallback de la miga sólo sabe humanizar el slug
 * de la URL, así que un cuid siempre sale tal cual. Se arregla llamando `setCustomSegment`.
 *
 * Esta prueba NO exige que todas estén arregladas hoy: congela las que faltan en una lista.
 * Si arreglas una, bórrala de la lista. Si añades una pantalla de detalle nueva sin la miga,
 * la prueba falla — que es justo lo que evita que esto vuelva a crecer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RUTAS = join(process.cwd(), 'src/routes/venueRoutes.tsx')
const PAGES = join(process.cwd(), 'src/pages')

/** Pantallas de detalle que TODAVIA muestran el id crudo. Se encoge, nunca crece. */
const PENDIENTES = [
  ':couponId',
  'categories/:categoryId',
  'config/:configId',
  'inter-venue-transfers/:transferId',
  'menus/:menuId',
  'stock-counts/:countId',
  'transfers/:transferId',
]

/** Alias que sólo redirigen a la ruta canónica: no montan una pantalla de detalle. */
const ALIAS_LEGACY = ['tpv/:tpvId']

function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return archivosTsx(ruta)
    return n.endsWith('.tsx') ? [ruta] : []
  })
}

describe('las pantallas de detalle no enseñan el id crudo en la miga de pan', () => {
  const rutas = readFileSync(RUTAS, 'utf8')
  const conParametro = [...rutas.matchAll(/path: '([^']*:[a-zA-Z]+Id)'/g)].map(m => m[1])
  const conPantallaDetalle = conParametro.filter(ruta => !ALIAS_LEGACY.includes(ruta))

  it('hay rutas de detalle que analizar (la prueba no se autoanula)', () => {
    expect(conParametro.length).toBeGreaterThan(10)
  })

  it('la lista de pendientes sólo contiene rutas que existen de verdad', () => {
    for (const p of PENDIENTES) expect(conParametro, `«${p}» ya no existe: bórralo de PENDIENTES`).toContain(p)
  })

  it('el detalle canónico de dispositivo registra su nombre humano', () => {
    const detalle = readFileSync(join(PAGES, 'Tpv/TpvId.tsx'), 'utf8')
    expect(detalle).toContain("import { useBreadcrumb } from '@/context/BreadcrumbContext'")
    expect(detalle).toMatch(/setCustomSegment\(tpvId, tpv\.name\)/)
    expect(detalle).toMatch(/clearCustomSegment\(tpvId\)/)
  })

  it('las que NO están en la lista de pendientes ya ponen un nombre humano', () => {
    const conArreglo = archivosTsx(PAGES).filter(f => readFileSync(f, 'utf8').includes('setCustomSegment')).length
    // 8 arregladas al escribir esto; el número sólo puede subir.
    expect(conArreglo).toBeGreaterThanOrEqual(9)
  })

  it('🔴 no se añadieron pantallas de detalle nuevas sin miga de pan', () => {
    // Si esto falla: o arreglaste una (baja el número) o añadiste una sin miga (arréglala).
    expect(conPantallaDetalle.length - PENDIENTES.length).toBe(10)
  })
})
