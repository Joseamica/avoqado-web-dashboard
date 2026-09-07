/**
 * Regresión de producción (PlayTelecom, 2026-09-07):
 * «Avoqado ya no permite asignar chips de forma masiva, solo lo hace de uno por uno.
 *  Antes podía ir escribiendo las terminaciones de cada ICCID hasta llegar a las 20 por
 *  paquete. Después de ahí las asignaba todas juntas.»
 *
 * Tercer defecto del mismo commit (bcbc9e7c, 1-sep) que movió el panel del supervisor de
 * «todo el inventario en el navegador» a páginas del servidor. Los dos primeros están en
 * `custodiaSeRefresca.regression.test.tsx`. Este es el que quedó: la selección se resolvía
 * contra la lista VISIBLE, que desde ese commit sólo trae lo que coincide con la búsqueda.
 *
 * La línea culpable nunca cambió — cambió el significado de la lista de la que dependía.
 * Por eso ni el compilador ni las pruebas la vieron, y por eso la guardia estructural del
 * final vale tanto como los casos de arriba.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { seleccionAsignable, type SimMarcada } from '../seleccionAsignable'

const PANEL = path.resolve(__dirname, '../components/VenueSimCustodyPanel.tsx')

const marcada = (serialNumber: string, custodyState: SimMarcada['custodyState'] = 'SUPERVISOR_HELD'): [string, SimMarcada] => [
  serialNumber,
  { serialNumber, custodyState },
]

describe('seleccionAsignable — la selección se acuerda de lo que marcó', () => {
  it('🔴 conserva lo marcado aunque la búsqueda actual ya no lo muestre (el defecto reportado)', () => {
    // El supervisor marcó dos SIMs tecleando una terminación a la vez. Al teclear la
    // segunda, el servidor sólo devolvió esa: la primera dejó de estar en pantalla.
    const seleccion = new Map([marcada('8952140061234567890'), marcada('8952140069876543210')])
    const visibles = [{ serialNumber: '8952140069876543210', custodyState: 'SUPERVISOR_HELD' as const }]

    // Antes del arreglo esto devolvía ['…9876543210'] — una sola, y el botón decía (1).
    expect(seleccionAsignable(seleccion, visibles)).toEqual(['8952140061234567890', '8952140069876543210'])
  })

  it('arma el paquete de 20 aunque la lista visible esté vacía', () => {
    // Caso real del reporte: 20 por paquete. Tras teclear una terminación que no existe,
    // el servidor devuelve cero filas — y las 20 marcadas siguen siendo asignables.
    const seleccion = new Map(Array.from({ length: 20 }, (_, i) => marcada(`895214006${String(i).padStart(10, '0')}`)))

    expect(seleccionAsignable(seleccion, [])).toHaveLength(20)
  })

  it('respeta el orden en que se fueron marcando, para que las fichas no bailen', () => {
    const seleccion = new Map([marcada('333'), marcada('111'), marcada('222')])

    expect(seleccionAsignable(seleccion, [])).toEqual(['333', '111', '222'])
  })

  it('el estado FRESCO gana: si sigue visible y ya se movió, se cae sola', () => {
    // Otro supervisor se la llevó mientras éste armaba su paquete. La lista de ahora lo
    // sabe; la foto que guardamos al marcar, no. Vale la de ahora — así no viaja a un
    // rechazo del backend.
    const seleccion = new Map([marcada('111'), marcada('222')])
    const visibles = [{ serialNumber: '111', custodyState: 'PROMOTER_HELD' as const }]

    expect(seleccionAsignable(seleccion, visibles)).toEqual(['222'])
  })

  it('una fila visible sin estado cuenta como ADMIN_HELD, no como asignable', () => {
    const seleccion = new Map([marcada('111')])

    expect(seleccionAsignable(seleccion, [{ serialNumber: '111', custodyState: null }])).toEqual([])
  })

  it('sin nada marcado no hay nada que asignar', () => {
    expect(seleccionAsignable(new Map(), [{ serialNumber: '111', custodyState: 'SUPERVISOR_HELD' }])).toEqual([])
  })
})

describe('guardia estructural — que no vuelva a nacer el mismo defecto', () => {
  const fuente = fs.readFileSync(PANEL, 'utf8')

  it('el panel resuelve la selección con la función, no buscándola en la lista visible', () => {
    expect(fuente).toContain('seleccionAsignable(')
  })

  it('🔴 el panel NO busca lo seleccionado dentro de `mySims`', () => {
    // `mySims` es UNA PÁGINA del servidor, no el inventario. Cualquier decisión tomada
    // recorriéndola («¿qué marqué?», «¿cuántas hay?») vuelve a mentir en cuanto el
    // supervisor teclea. Si necesitas un dato de una SIM, guárdalo al marcarla.
    expect(fuente).not.toMatch(/mySims\.find\(/)
  })

  it('🔴 la selección guarda el estado de cada SIM, no sólo su número', () => {
    // Un `Set<string>` obliga a ir a buscar el estado a algún lado — y el único lado
    // disponible es la lista visible, que es justo el defecto.
    expect(fuente).toMatch(/useState<Map<string,\s*SimMarcada>>/)
  })
})
