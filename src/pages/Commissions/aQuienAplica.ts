import type { CommissionCalcType } from '@/types/commission'
import { excepcionesAGuardar, ofreceTasaPorPersona } from './tasaDelEsquema'

/**
 * A quién aplica un esquema de comisión (final-comisiones-viejas, D-ELEGIDOS).
 *
 * «Sólo seleccionados» antes creaba una excepción (CommissionOverride) por cada elegido y no excluía a nadie: el servidor le pagaba a
 * todo el equipo. El servidor ahora restringe con `CommissionConfig.filterByStaff` + `staffIds` (como `filterByCategories` +
 * `categoryIds`): con `filterByStaff = true`, sólo cobra quien está en `staffIds`. Las excepciones siguen igual (tasa especial o
 * excluir).
 */

/** Si el servidor sabe restringir: lo dice o no. Si no hay ningún esquema que mirar, no se sabe. */
export type RestriccionPorPersona = 'disponible' | 'noDisponible' | 'desconocida'

/** El servidor que sabe restringir devuelve `filterByStaff` en cada esquema (aditivo); uno anterior no lo trae. */
export const servidorRestringePorPersona = (config: object) => typeof (config as { filterByStaff?: unknown }).filterByStaff === 'boolean'

/** Lo que dicen los esquemas que ya devolvió el servidor. Sin esquemas, `desconocida`: se comprueba al crear. */
export function restriccionEnElServidor(configs: ReadonlyArray<object> | undefined): RestriccionPorPersona {
  if (!configs || configs.length === 0) return 'desconocida'
  return configs.some(servidorRestringePorPersona) ? 'disponible' : 'noDisponible'
}

/** El esquema sólo aplica a las personas elegidas (y hay alguna). */
export const soloPersonasElegidas = (config: { filterByStaff?: boolean; staffIds?: string[] }) =>
  config.filterByStaff === true && (config.staffIds?.length ?? 0) > 0

interface PersonaDelPanel {
  staffId: string
  customRate: number | null
  excluded: boolean
}

/**
 * Lo que manda el panel según el modo de la tarjeta «Empleados».
 * - «Todos»: `filterByStaff: false`, sin elegidos; las personas de la tarjeta son excepciones, como siempre.
 * - «Sólo seleccionados»: `filterByStaff: true` + los elegidos en `staffIds`. Ya NO se crea una excepción para marcar a cada elegido;
 *   sólo viaja la de quien lleva tasa especial (con porcentaje: en un fijo la tasa especial no cuenta).
 */
export function aQuienAplicaAGuardar(
  calcType: CommissionCalcType,
  modo: 'all' | 'selected',
  personas: PersonaDelPanel[],
  tasaDelEsquema: number,
): {
  filterByStaff: boolean
  staffIds: string[]
  excepciones: Array<{ staffId: string; customRate: number | null; excludeFromCommissions: boolean }>
} {
  if (modo === 'all') {
    return {
      filterByStaff: false,
      staffIds: [],
      excepciones: excepcionesAGuardar(
        calcType,
        personas.map(p => ({ staffId: p.staffId, customRate: p.customRate ?? tasaDelEsquema, excluir: p.excluded })),
      ),
    }
  }
  const elegidas = personas.filter(p => !p.excluded)
  return {
    filterByStaff: true,
    staffIds: elegidas.map(p => p.staffId),
    excepciones: ofreceTasaPorPersona(calcType)
      ? elegidas
          .filter(p => p.customRate !== null)
          .map(p => ({ staffId: p.staffId, customRate: p.customRate, excludeFromCommissions: false }))
      : [],
  }
}
