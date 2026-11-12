import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import es from '@/locales/es/loyalty.json'
import en from '@/locales/en/loyalty.json'
import { describirPromo, type PromoParaDescribir } from '../describirPromo'

/** Los textos de verdad (no las llaves): la vista previa es lo que el dueño lee para entender qué configuró. */
const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.init({
    lng: 'es',
    resources: { es: { loyalty: es }, en: { loyalty: en } },
    defaultNS: 'loyalty',
    interpolation: { escapeValue: false },
  })
})
const tEs = () => i18n.getFixedT('es', 'loyalty')
const tEn = () => i18n.getFixedT('en', 'loyalty')

const buenFin: PromoParaDescribir = {
  kind: 'MULTIPLY',
  multiplier: 2,
  extraStamps: null,
  extraPoints: null,
  startDate: '2026-11-13',
  endDate: '2026-11-17',
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  productNames: [],
  categoryNames: [],
  minSpend: null,
  limit: 'NONE',
}
const ambos = { sellos: true, puntos: true }

describe('describirPromo', () => {
  it('negocio con sellos y puntos: «Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1 y el doble de puntos.»', () => {
    expect(describirPromo(buenFin, ambos, tEs())).toBe('Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1 y el doble de puntos.')
  })

  it('sólo sellos no menciona puntos', () => {
    const texto = describirPromo(buenFin, { sellos: true, puntos: false }, tEs())
    expect(texto).toBe('Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1.')
    expect(texto).not.toMatch(/punto/)
  })

  it('sólo puntos no menciona sellos', () => {
    const texto = describirPromo({ ...buenFin, multiplier: 3 }, { sellos: false, puntos: true }, tEs())
    expect(texto).toBe('Del 13 al 17 de nov., cada visita da el triple de puntos.')
  })

  it('con martes 16:00–18:00 lo dice', () => {
    const texto = describirPromo({ ...buenFin, daysOfWeek: [2], timeFrom: '16:00', timeUntil: '18:00' }, ambos, tEs())
    expect(texto).toBe('Del 13 al 17 de nov., los martes de 16:00 a 18:00, cada visita da 2 sellos en vez de 1 y el doble de puntos.')
  })

  it('varios días van de lunes a domingo, sin importar el orden en que se marcaron', () => {
    const texto = describirPromo({ ...buenFin, daysOfWeek: [0, 4, 2] }, { sellos: true, puntos: false }, tEs())
    expect(texto).toContain('los martes, jueves y domingos,')
  })

  it('suma extra: cuenta los sellos de la visita y los puntos que se agregan', () => {
    const texto = describirPromo({ ...buenFin, kind: 'ADD', multiplier: null, extraStamps: 1, extraPoints: 50 }, ambos, tEs())
    expect(texto).toBe('Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1 y 50 puntos extra.')
  })

  it('sin fin, con gasto mínimo, productos y límite por cliente', () => {
    const texto = describirPromo(
      { ...buenFin, endDate: null, minSpend: 500, productNames: ['Café', 'Pan dulce'], limit: 'ONCE_PER_DAY' },
      ambos,
      tEs(),
    )
    expect(texto).toBe(
      'Desde el 13 de nov., cada visita de $500.00 o más que lleve Café o Pan dulce da 2 sellos en vez de 1 y el doble de puntos por esos productos. Cada cliente la gana 1 vez al día.',
    )
  })

  it('meses distintos y un solo día', () => {
    expect(describirPromo({ ...buenFin, endDate: '2026-12-02' }, { sellos: true, puntos: false }, tEs())).toMatch(
      /^Del 13 de nov\. al 2 de dic\., /,
    )
    expect(describirPromo({ ...buenFin, endDate: '2026-11-13' }, { sellos: true, puntos: false }, tEs())).toMatch(/^El 13 de nov\., /)
  })

  it('una suma que no toca lo que el negocio tiene prendido lo dice, no inventa', () => {
    const texto = describirPromo(
      { ...buenFin, kind: 'ADD', multiplier: null, extraStamps: 2, extraPoints: null },
      { sellos: false, puntos: true },
      tEs(),
    )
    expect(texto).toBe('Del 13 al 17 de nov., cada visita no da nada extra con tu programa actual.')
  })

  it('en inglés', () => {
    expect(describirPromo({ ...buenFin, daysOfWeek: [2], timeFrom: '16:00', timeUntil: '18:00' }, ambos, tEn())).toBe(
      'From Nov 13 to 17, on Tuesdays from 16:00 to 18:00, every visit gives 2 stamps instead of 1 and double points.',
    )
  })

  it('si empieza hoy (con `hoy`) dice que arranca al guardarla: «Desde ahora y hasta el 17 de nov.»', () => {
    const hoy = { ...buenFin, startDate: '2026-11-12', hoy: '2026-11-12' }
    expect(describirPromo(hoy, ambos, tEs())).toBe('Desde ahora y hasta el 17 de nov., cada visita da 2 sellos en vez de 1 y el doble de puntos.')
    expect(describirPromo(hoy, ambos, tEn())).toContain('Starting now through Nov 17,')
    expect(describirPromo({ ...hoy, endDate: null }, ambos, tEs())).toMatch(/^Desde ahora, cada visita/)
    expect(describirPromo({ ...hoy, endDate: '2026-11-12' }, ambos, tEs())).toMatch(/^Hoy, desde ahora, cada visita/)
    // Otro día, o sin `hoy` (la lista de promos ya guardadas), se queda como antes.
    expect(describirPromo({ ...buenFin, hoy: '2026-11-12' }, ambos, tEs())).toMatch(/^Del 13 al 17 de nov\./)
    expect(describirPromo({ ...buenFin, startDate: '2026-11-12' }, ambos, tEs())).toMatch(/^Del 12 al 17 de nov\./)
  })
})
