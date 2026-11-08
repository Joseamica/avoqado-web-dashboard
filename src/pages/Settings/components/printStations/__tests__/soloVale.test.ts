import { describe, expect, it } from 'vitest'
import { muestraSoloVale, resumenDelRuteo } from '../soloVale'

const CREMERIA = [{ id: 'a1', name: 'Cremería' }]

describe('resumenDelRuteo (Aparatos claros, Paso 1)', () => {
  it('La Galeterie: 16 sin ruta, todas «Sólo vale» → 0 sin ruta y sin aviso amarillo', () => {
    expect(resumenDelRuteo({ hasDefault: false, unroutedCategories: 16, areaTicketOnlyUnrouted: 16, areasWithoutComanda: CREMERIA })).toEqual({
      sinRuta: 0,
      conSoloVale: true,
      avisoSinDefault: false,
      areas: CREMERIA,
    })
  })

  it('si quedan otras sin ruta, cuentan sólo ésas y el aviso sigue', () => {
    expect(resumenDelRuteo({ hasDefault: false, unroutedCategories: 18, areaTicketOnlyUnrouted: 16, areasWithoutComanda: CREMERIA })).toMatchObject({
      sinRuta: 2,
      avisoSinDefault: true,
    })
  })

  it('sin vales (o SERVIDOR viejo) todo queda como hoy: el aviso sale siempre que no hay estación por defecto', () => {
    expect(resumenDelRuteo({ hasDefault: false, unroutedCategories: 3 })).toEqual({ sinRuta: 3, conSoloVale: false, avisoSinDefault: true, areas: [] })
    expect(resumenDelRuteo({ hasDefault: false, unroutedCategories: 0 })).toMatchObject({ sinRuta: 0, avisoSinDefault: true })
    expect(resumenDelRuteo({ hasDefault: true, unroutedCategories: 0 })).toMatchObject({ sinRuta: 0, avisoSinDefault: false })
  })

  it('con estación por defecto no hay aviso, aunque haya «Sólo vale»', () => {
    expect(resumenDelRuteo({ hasDefault: true, unroutedCategories: 0, areaTicketOnlyUnrouted: 0, areasWithoutComanda: CREMERIA })).toMatchObject({
      sinRuta: 0,
      conSoloVale: true,
      avisoSinDefault: false,
    })
  })
})

describe('muestraSoloVale', () => {
  it('sólo en una categoría «Sólo vale» SIN estación: la etiqueta reemplaza al «Sin asignar»', () => {
    expect(muestraSoloVale({ areaTicketOnly: true, printStationId: null })).toBe(true)
  })
  it('si ya tiene estación, se respeta y se ve su selector', () => {
    expect(muestraSoloVale({ areaTicketOnly: true, printStationId: 'st1' })).toBe(false)
  })
  it('las demás categorías (o un SERVIDOR viejo) siguen con su selector', () => {
    expect(muestraSoloVale({ printStationId: null })).toBe(false)
  })
})
