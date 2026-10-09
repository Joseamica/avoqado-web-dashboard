import type { EditorDoc, FloorPlanDto } from './types'

export type PlanLimits = FloorPlanDto['limits']

/**
 * Cuánto cabe todavía en el plano. Los topes (`limits` del GET) son los del servidor, que rechaza el plano que los pasa
 * (400): el editor no deja llegar ahí y lo dice. Las mesas cuentan todas, también las «Sin acomodar».
 */
export function roomLeft(doc: EditorDoc, limits: PlanLimits): PlanLimits {
  return {
    areas: limits.areas - doc.areas.length,
    tables: limits.tables - doc.tables.length,
    elements: limits.elements - doc.elements.length,
  }
}
