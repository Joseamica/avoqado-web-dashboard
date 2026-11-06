// Guía de cliente «Arma el plano de tu salón» (9-oct): al escribirla salieron dos textos que confunden al dueño.
// Se prueban sobre los JSON reales (las demás pruebas del plano usan las llaves, no el texto).
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/floorPlan.json'
import es from '@/locales/es/floorPlan.json'

describe('textos del plano que la guía puso a prueba', () => {
  it('🔴 la sección de paredes de la paleta no se llama como un área («Salón»)', () => {
    // El arranque rápido propone «Salón» como nombre de la primera área. Con la sección también llamada «Salón», en la
    // pestaña «Terraza» la paleta parecía decir que paredes, barra y puerta eran del Salón.
    expect(es.tools.roomSection).toBe('Paredes y más')
    expect(es.tools.roomSection).not.toBe(es.newArea.namePlaceholder)
    expect(en.tools.roomSection).not.toBe(en.newArea.namePlaceholder)
  })

  it('🔴 el estado vacío no promete que el punto de venta ya dibuja el plano igual', () => {
    // Hoy sólo la terminal PAX acomoda las mesas por su posición; las apps de Android e iOS dibujan el plano en la fase
    // siguiente. La vista del mesero ya lo dice en futuro («se actualizará»); el estado vacío lo afirmaba en presente.
    expect(es.page.emptyBody).not.toMatch(/punto de venta/i)
    expect(en.page.emptyBody).not.toMatch(/point of sale/i)
  })
})

describe('🔴 D20: ningún texto del plano le antepone «mesa» al número', () => {
  // El número de una mesa puede ya traer la palabra («Mesa 1» en la demo). Los textos reciben el NOMBRE ya armado
  // (`tableName`), así que ninguno puede volver a escribir «mesa {{…}}» o «table {{…}}» delante.
  const plano = (o: unknown): string[] => (typeof o === 'string' ? [o] : Object.values(o as object).flatMap(plano))
  it.each([
    ['es', es],
    ['en', en],
  ])('%s', (_, dict) => {
    expect(plano(dict).filter(s => /\b(mesas?|tables?)\s*\{\{/i.test(s))).toEqual([])
  })
})
