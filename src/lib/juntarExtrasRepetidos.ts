/**
 * La misma opción elegida varias veces (grupo que deja repetir, encargo a508f4) llega como varios renglones iguales: el
 * SERVIDOR guarda uno por vez. Para leerla se junta en uno con su número («2 × Flautas Cochinita»), en el orden en que
 * apareció, como el «Consolidate modifiers» de Toast y el POS de ANDROID. El precio que sale es el de todas las veces.
 */
export interface ExtraDeLaVenta {
  name?: string | null
  price?: number | string | null
  quantity?: number | null
  modifier?: { name?: string | null } | null
}

export interface ExtraJunto {
  name: string
  veces: number
  /** Lo que suman todas las veces, en pesos. */
  price: number
}

export function juntarExtrasRepetidos(extras: ExtraDeLaVenta[] | null | undefined): ExtraJunto[] {
  const juntos = new Map<string, ExtraJunto>()
  for (const extra of extras ?? []) {
    const name = extra.name ?? extra.modifier?.name ?? ''
    const unitario = Number(extra.price ?? 0)
    const veces = extra.quantity && extra.quantity > 0 ? extra.quantity : 1
    // Mismo nombre y mismo precio = la misma opción. Con otro precio (se cambió entre dos rondas) se ve aparte.
    const llave = `${name}\u0000${unitario}`
    const previo = juntos.get(llave)
    if (previo) {
      previo.veces += veces
      previo.price += unitario * veces
    } else juntos.set(llave, { name, veces, price: unitario * veces })
  }
  return [...juntos.values()]
}

/** «2 × Flautas Cochinita» o el nombre solo si fue una vez. */
export const nombreConVeces = (extra: ExtraJunto) => (extra.veces > 1 ? `${extra.veces} × ${extra.name}` : extra.name)
