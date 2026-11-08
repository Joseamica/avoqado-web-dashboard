/**
 * Aparatos claros, Paso 1 (8-nov-2026): en el Ruteo, las categorías de áreas de vales SIN comanda (sólo sacan vale) no son
 * «sin ruta» ni disparan «Sin estación por defecto». Quién es «Sólo vale» lo decide el SERVIDOR (`areaTicketOnly`, por el menú
 * de cada PC que emite); un SERVIDOR viejo no manda los campos y todo se ve como hoy.
 */
export interface ResumenDelServidor {
  hasDefault: boolean
  unroutedCategories: number
  areaTicketOnlyUnrouted?: number
  areasWithoutComanda?: Array<{ id: string; name: string }>
}

export function resumenDelRuteo(data: ResumenDelServidor) {
  const soloVale = data.areaTicketOnlyUnrouted ?? 0
  const sinRuta = Math.max(0, data.unroutedCategories - soloVale)
  const areas = data.areasWithoutComanda ?? []
  return {
    sinRuta,
    conSoloVale: areas.length > 0,
    // Sin «Sólo vale» queda como hoy (el aviso sale siempre que no hay default); sólo se calla si ellas explican todo lo sin ruta.
    avisoSinDefault: !data.hasDefault && !(soloVale > 0 && sinRuta === 0),
    areas,
  }
}

/** La etiqueta reemplaza al selector «Sin asignar»; una categoría que ya tiene estación conserva su selector. */
export const muestraSoloVale = (c: { areaTicketOnly?: boolean; printStationId: string | null }) =>
  c.areaTicketOnly === true && c.printStationId === null
