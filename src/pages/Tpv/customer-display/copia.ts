import type { CustomerDisplayDesign } from '@/services/customerDisplay.service'

/**
 * Lógica PURA de «Copiar a otras cajas» para reconciliar una respuesta PERDIDA (Codex #9). Sin React ni red.
 *
 * ¿El destino ya muestra el diseño del origen? 🔴 La misma regla que la copia del server (`valoresCopiados`,
 * `customerDisplayDesign.service.ts`): marca, textos, logo y segundos viajan SIEMPRE; las imágenes y el interruptor de
 * promos, sólo con el plan Pro (sin él, los del DESTINO se quedan). `conImagenes` es el `entitlements.slides` que el server
 * contesta con la vista del destino.
 */
export function tieneElDisenoDelOrigen(destino: CustomerDisplayDesign, origen: CustomerDisplayDesign, conImagenes: boolean): boolean {
  const siempre =
    destino.theme === origen.theme &&
    (destino.accentColor ?? '').toUpperCase() === (origen.accentColor ?? '').toUpperCase() &&
    destino.logoAssetId === origen.logoAssetId &&
    destino.welcomeText === origen.welcomeText &&
    destino.thanksText === origen.thanksText &&
    destino.slideSeconds === origen.slideSeconds
  if (!siempre || !conImagenes) return siempre
  return (
    destino.showPromotions === origen.showPromotions &&
    JSON.stringify(destino.slides.map(s => s.assetId)) === JSON.stringify(origen.slides.map(s => s.assetId))
  )
}

/** Lo que se leyó de UN destino tras la respuesta perdida; `null` = esa lectura también falló. */
export type DestinoReleido = { design: CustomerDisplayDesign; conImagenes: boolean } | null

export interface RevisionDeLaCopia {
  conElDiseno: string[]
  sinElDiseno: string[]
  sinRevisar: string[]
}

/**
 * Reparte los destinos (en el orden en que se eligieron) según lo que el server TIENE ahora. No se decide con el token:
 * a la persona le importa qué muestra cada caja, y un token distinto también puede ser de otra persona que guardó.
 */
export function revisarDestinos(
  destinos: { name: string }[],
  releidos: DestinoReleido[],
  origen: CustomerDisplayDesign,
): RevisionDeLaCopia {
  const r: RevisionDeLaCopia = { conElDiseno: [], sinElDiseno: [], sinRevisar: [] }
  destinos.forEach((d, i) => {
    const leido = releidos[i]
    if (!leido) r.sinRevisar.push(d.name)
    else if (tieneElDisenoDelOrigen(leido.design, origen, leido.conImagenes)) r.conElDiseno.push(d.name)
    else r.sinElDiseno.push(d.name)
  })
  return r
}
