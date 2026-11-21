/**
 * D14 v2 (5-nov-2026): lo que manda el panel al guardar un descuento o cupón.
 */
import { describe, expect, it } from 'vitest'
import {
  categoriasParaGuardar,
  limiteParaGuardar,
  siCambio,
  soloLoQueCambio,
  vigenciaDelFormulario,
  vigenciaParaFormulario,
  vigenciaParaGuardar,
} from '../paraGuardar'
import { zonaValida } from '@/utils/datetime'

describe('Límite de usos al guardar', () => {
  it('🔴 Codex r4 #3: editar con el campo vacío manda null (vuelve ilimitado)', () => {
    expect(limiteParaGuardar(undefined, true)).toBeNull()
    expect(limiteParaGuardar(null, true)).toBeNull()
  })
  it('crear con el campo vacío: se omite', () => {
    expect(limiteParaGuardar(undefined, false)).toBeUndefined()
  })
  it('🔴 un 0 se manda tal cual (antes `0 || undefined` lo volvía «ilimitado» sin decirlo); lo decide el SERVIDOR', () => {
    expect(limiteParaGuardar(0, false)).toBe(0)
    expect(limiteParaGuardar(0, true)).toBe(0)
    expect(limiteParaGuardar(5, true)).toBe(5)
  })
})

describe('Categorías al guardar', () => {
  it('🔴 «Categorías» sin elegir manda [] (el SERVIDOR responde; un viejo vacío se conserva)', () => {
    expect(categoriasParaGuardar('CATEGORY', [])).toEqual([])
    expect(categoriasParaGuardar('CATEGORY', undefined)).toEqual([])
  })
  it('acepta opciones del selector o ids', () => {
    expect(categoriasParaGuardar('CATEGORY', [{ value: 'c1', label: 'Pan' }, 'c2'])).toEqual(['c1', 'c2'])
  })
  it('otro alcance no manda la lista', () => {
    expect(categoriasParaGuardar('ORDER', ['c1'])).toBeUndefined()
  })
})

describe('Al editar, sólo lo que cambió (Codex D14 v2 r1 #1)', () => {
  it('🔴 un límite sin tocar no se manda: no pisa el que otra persona guardó en medio', () => {
    expect(siCambio(limiteParaGuardar(undefined, true), null)).toBeUndefined() // abierto sin límite, sigue vacío
    expect(siCambio(limiteParaGuardar(undefined, true), undefined)).toBeUndefined()
    expect(siCambio(0, 0)).toBeUndefined()
  })
  it('lo que sí cambió se manda (vaciar = null, nuevo número)', () => {
    expect(siCambio(limiteParaGuardar(undefined, true), 5)).toBeNull()
    expect(siCambio(3, 5)).toBe(3)
    expect(siCambio(0, 5)).toBe(0)
  })
  it('categorías: mismo conjunto no se manda; otro sí', () => {
    expect(siCambio(['b', 'a'], ['a', 'b'])).toBeUndefined()
    expect(siCambio([], [])).toBeUndefined()
    expect(siCambio([], ['a'])).toEqual([])
    expect(siCambio(['c'], ['a'])).toEqual(['c'])
  })
})

describe('Al editar se quita todo lo que no cambió (Codex D14 v2 r3)', () => {
  const abierto = { name: 'Martes', scope: 'ORDER', targetCategoryIds: [], maxTotalUses: 5, active: true }

  it('🔴 A cambia sólo el nombre: no reenvía el alcance (no regresa a «Orden completa» lo que B restringió)', () => {
    const enviado = soloLoQueCambio(
      { name: 'Martes 2x1', scope: 'ORDER', targetCategoryIds: undefined, maxTotalUses: 5, active: true },
      abierto,
    )
    expect(enviado).toEqual({ name: 'Martes 2x1' })
  })
  it('lo que sí cambió se manda, también null al vaciar un límite', () => {
    expect(soloLoQueCambio({ scope: 'CATEGORY', targetCategoryIds: ['c1'], maxTotalUses: null }, abierto)).toEqual({
      scope: 'CATEGORY',
      targetCategoryIds: ['c1'],
      maxTotalUses: null,
    })
  })
  it('al crear (sin abierto) se manda todo', () => {
    expect(soloLoQueCambio({ name: 'X' }, undefined)).toEqual({ name: 'X' })
  })
})

/**
 * D37 (21-nov-2026): «Válido desde/hasta» es un DÍA DEL NEGOCIO. Antes el panel mandaba 'YYYY-MM-DD' y el SERVIDOR lo guardaba a las
 * 00:00 UTC: un cupón «hasta el 1-dic» dejaba de servir el 30-nov a las 6 p. m. en México. Misma regla que BundleEditor y el MCP.
 */
describe('Vigencia en el día del negocio (D37)', () => {
  const CDMX = 'America/Mexico_City'
  const TIJUANA = 'America/Tijuana'
  const LA = 'America/Los_Angeles'

  it('🔴 «hasta el 1-dic» en México termina a las 23:59:59.999 del 1-dic (no a las 6 p. m. del 30-nov)', () => {
    expect(vigenciaParaGuardar('2026-12-01', CDMX, 'hasta')).toBe('2026-12-02T05:59:59.999Z')
    expect(vigenciaParaGuardar('2026-12-01', CDMX, 'desde')).toBe('2026-12-01T06:00:00.000Z')
  })

  it('con horario de verano (Tijuana y Los Ángeles), también el día en que cambia la hora', () => {
    expect(vigenciaParaGuardar('2026-07-15', TIJUANA, 'hasta')).toBe('2026-07-16T06:59:59.999Z')
    // 1-nov-2026: termina el horario de verano; el día empieza en UTC-7 y acaba en UTC-8.
    expect(vigenciaParaGuardar('2026-11-01', TIJUANA, 'desde')).toBe('2026-11-01T07:00:00.000Z')
    expect(vigenciaParaGuardar('2026-11-01', TIJUANA, 'hasta')).toBe('2026-11-02T07:59:59.999Z')
    expect(vigenciaParaGuardar('2026-03-08', LA, 'hasta')).toBe('2026-03-09T06:59:59.999Z')
  })

  it('al abrir, lo guardado se enseña como el día del negocio (no el día en UTC) y la caja nunca recibe un instante completo', () => {
    expect(vigenciaParaFormulario('2026-12-02T05:59:59.999Z', CDMX)).toBe('2026-12-01')
    expect(vigenciaParaFormulario('2026-12-01T06:00:00.000Z', CDMX)).toBe('2026-12-01')
    // Lo guardado con la regla vieja (00:00 UTC) vence la tarde anterior en México: se enseña ese día, que es cuando de verdad vence.
    expect(vigenciaParaFormulario('2026-12-01T00:00:00.000Z', CDMX)).toBe('2026-11-30')
    expect(vigenciaParaFormulario(null, CDMX)).toBe('')
    expect(vigenciaParaFormulario(undefined, CDMX)).toBe('')
  })

  it('ida y vuelta: lo que se guarda se vuelve a abrir con el mismo día', () => {
    for (const zona of [CDMX, TIJUANA, LA]) {
      for (const dia of ['2026-01-31', '2026-03-08', '2026-11-01', '2026-12-31']) {
        expect(vigenciaParaFormulario(vigenciaParaGuardar(dia, zona, 'desde'), zona)).toBe(dia)
        expect(vigenciaParaFormulario(vigenciaParaGuardar(dia, zona, 'hasta'), zona)).toBe(dia)
      }
    }
  })

  it('crear: vacío se omite; con fecha va el instante del día del negocio', () => {
    expect(vigenciaDelFormulario({ validFrom: '2026-12-01', validUntil: '2026-12-01' }, CDMX)).toEqual({
      validFrom: '2026-12-01T06:00:00.000Z',
      validUntil: '2026-12-02T05:59:59.999Z',
    })
    expect(vigenciaDelFormulario({ validFrom: '', validUntil: '' }, CDMX)).toEqual({ validFrom: undefined, validUntil: undefined })
    expect(vigenciaDelFormulario({}, CDMX)).toEqual({ validFrom: undefined, validUntil: undefined })
  })

  const abierto = { validFrom: '2026-12-10T06:00:00.000Z', validUntil: '2026-12-21T05:59:59.999Z' }

  it('🔴 editar sin tocar las fechas: no se manda ninguna (no mueve lo guardado, tampoco lo viejo a 00:00 UTC)', () => {
    expect(vigenciaDelFormulario({ validFrom: '2026-12-10', validUntil: '2026-12-20' }, CDMX, abierto)).toEqual({
      validFrom: undefined,
      validUntil: undefined,
    })
    const viejo = { validFrom: null, validUntil: '2026-12-01T00:00:00.000Z' }
    expect(vigenciaDelFormulario({ validFrom: '', validUntil: '2026-11-30' }, CDMX, viejo)).toEqual({
      validFrom: undefined,
      validUntil: undefined,
    })
  })

  it('🔴 Codex r1 #3: si cambia una, van LAS DOS como las vio la persona (la otra con su instante tal cual): dos ediciones a la vez no dejan el rango al revés', () => {
    expect(vigenciaDelFormulario({ validFrom: '2026-12-15', validUntil: '2026-12-20' }, CDMX, abierto)).toEqual({
      validFrom: '2026-12-15T06:00:00.000Z',
      validUntil: '2026-12-21T05:59:59.999Z',
    })
    expect(vigenciaDelFormulario({ validFrom: '2026-12-10', validUntil: '2026-12-12' }, CDMX, abierto)).toEqual({
      validFrom: '2026-12-10T06:00:00.000Z',
      validUntil: '2026-12-13T05:59:59.999Z',
    })
  })

  it('🔴 Codex r1 #2: vaciar una fecha al editar no la quita (como antes; quitarla haría que el cupón herede la del descuento)', () => {
    expect(vigenciaDelFormulario({ validFrom: '2026-12-10', validUntil: '' }, CDMX, abierto)).toEqual({
      validFrom: undefined,
      validUntil: undefined,
    })
    expect(vigenciaDelFormulario({ validFrom: '2026-12-12', validUntil: '' }, CDMX, abierto)).toEqual({
      validFrom: '2026-12-12T06:00:00.000Z',
      validUntil: '2026-12-21T05:59:59.999Z',
    })
  })

  it('🔴 Codex r1 #4: una zona mal escrita se toma como la de México (no guarda 1970 ni rompe la lista)', () => {
    expect(zonaValida('America/Tijuna')).toBe(CDMX)
    expect(zonaValida('')).toBe(CDMX)
    expect(zonaValida(undefined)).toBe(CDMX)
    expect(zonaValida(TIJUANA)).toBe(TIJUANA)
  })
})
