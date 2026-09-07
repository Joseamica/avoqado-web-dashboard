/**
 * seleccionAsignable — qué SIMs de las marcadas se pueden asignar de verdad.
 *
 * 🔴 Existe por una regresión de producción (PlayTelecom, 2026-09-07): «Avoqado ya no
 * permite asignar chips de forma masiva, solo lo hace de uno por uno».
 *
 * `VenueSimCustodyPanel` resolvía la selección buscándola en la lista que tiene en
 * pantalla (`mySims.find(...)`). Eso era correcto mientras esa lista fuera TODO el
 * inventario del supervisor; desde que la búsqueda es del servidor (bcbc9e7c, 1-sep)
 * la lista trae SÓLO lo que coincide con lo tecleado, así que al escribir la segunda
 * terminación la primera salía de la lista y se caía de la selección. El check seguía
 * marcado por dentro y era inerte: el botón bajaba a «Asignar a Promotor (1)», o
 * desaparecía. Ninguna prueba lo vio porque la línea NO cambió — cambió el significado
 * de la lista de la que dependía.
 *
 * La regla, entonces: **la selección se acuerda de lo que marcó**. El estado de custodia
 * se guarda al marcar (el checkbox sólo existe en filas SUPERVISOR_HELD, así que ya lo
 * teníamos en la mano) y no se vuelve a pedir nada al servidor.
 *
 * Con un matiz que la deja siempre igual o mejor que antes: si la SIM SÍ sigue visible,
 * gana el estado FRESCO. Así, si alguien más la movió mientras el supervisor armaba su
 * paquete, se cae sola en vez de viajar a un rechazo del backend.
 */
import type { SimCustodyState } from '@/services/simCustody.service'

/** Lo mínimo que hay que recordar de una SIM marcada. */
export interface SimMarcada {
  serialNumber: string
  custodyState: SimCustodyState
}

interface FilaVisible {
  serialNumber: string
  custodyState?: SimCustodyState | null
}

const ASIGNABLE: SimCustodyState = 'SUPERVISOR_HELD'

/**
 * Devuelve los ICCID que se pueden mandar a un promotor, en el orden en que el
 * supervisor los fue marcando (el Map preserva el orden de inserción, así que las
 * fichas de la pantalla no bailan al teclear).
 *
 * @param seleccion  lo marcado, con la foto del estado al momento de marcarlo
 * @param visibles   las filas que el servidor mandó para la búsqueda/filtro de AHORA
 */
export function seleccionAsignable(seleccion: ReadonlyMap<string, SimMarcada>, visibles: ReadonlyArray<FilaVisible>): string[] {
  const frescas = new Map<string, SimCustodyState>()
  for (const fila of visibles) {
    frescas.set(fila.serialNumber, (fila.custodyState ?? 'ADMIN_HELD') as SimCustodyState)
  }

  const asignables: string[] = []
  for (const [serialNumber, marcada] of seleccion) {
    // El estado fresco gana cuando lo hay; si la SIM ya no está en pantalla porque el
    // supervisor cambió de búsqueda, vale la foto que guardamos al marcarla.
    const estado = frescas.get(serialNumber) ?? marcada.custodyState
    if (estado === ASIGNABLE) asignables.push(serialNumber)
  }
  return asignables
}
