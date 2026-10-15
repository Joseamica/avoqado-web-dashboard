import { describe, expect, it } from 'vitest'
import type { CustomerDisplayDesign } from '@/services/customerDisplay.service'
import { revisarDestinos, tieneElDisenoDelOrigen } from '../copia'
import { DISENO_DE_FABRICA } from '../model'

const ORIGEN: CustomerDisplayDesign = {
  ...DISENO_DE_FABRICA,
  theme: 'DARK',
  accentColor: '#0E7C66',
  logoAssetId: 'logo-1',
  welcomeText: 'Hola',
  thanksText: 'Vuelve pronto',
  slides: [{ assetId: 's1' }],
  slideSeconds: 10,
  showPromotions: true,
}

describe('tieneElDisenoDelOrigen (la misma regla que `valoresCopiados` del server)', () => {
  it('sin Pro: marca, textos, logo y segundos viajan; las imágenes y el interruptor de promos del DESTINO se quedan', () => {
    const destino: CustomerDisplayDesign = { ...ORIGEN, slides: [], showPromotions: false }
    expect(tieneElDisenoDelOrigen(destino, ORIGEN, false)).toBe(true)
    expect(tieneElDisenoDelOrigen(destino, ORIGEN, true)).toBe(false)
  })

  it('con Pro también cuentan las imágenes (en orden) y el interruptor de promos', () => {
    expect(tieneElDisenoDelOrigen({ ...ORIGEN, slides: [{ assetId: 's1' }] }, ORIGEN, true)).toBe(true)
    expect(tieneElDisenoDelOrigen({ ...ORIGEN, slides: [{ assetId: 's2' }] }, ORIGEN, true)).toBe(false)
    expect(tieneElDisenoDelOrigen({ ...ORIGEN, showPromotions: false }, ORIGEN, true)).toBe(false)
  })

  it('cualquier campo que la copia lleva siempre y no coincide ⇒ no lo tiene', () => {
    for (const cambio of [
      { theme: 'LIGHT' as const },
      { accentColor: null },
      { logoAssetId: null },
      { welcomeText: null },
      { thanksText: 'Otro' },
      { slideSeconds: 8 },
    ]) {
      expect(tieneElDisenoDelOrigen({ ...ORIGEN, ...cambio }, ORIGEN, false), JSON.stringify(cambio)).toBe(false)
    }
  })

  it('el color no distingue mayúsculas (el server lo guarda validado; aquí no se adivina su forma)', () => {
    expect(tieneElDisenoDelOrigen({ ...ORIGEN, accentColor: '#0e7c66' }, ORIGEN, false)).toBe(true)
  })
})

describe('revisarDestinos', () => {
  const destinos = [
    { terminalId: 'a', name: 'A' },
    { terminalId: 'b', name: 'B' },
    { terminalId: 'c', name: 'C' },
  ]
  it('reparte en «ya lo tienen», «no lo tienen» y «no se pudo revisar», en el orden en que se eligieron', () => {
    const r = revisarDestinos(destinos, [{ design: { ...ORIGEN }, conImagenes: true }, null, { design: DISENO_DE_FABRICA, conImagenes: false }], ORIGEN)
    expect(r).toEqual({ conElDiseno: ['A'], sinElDiseno: ['C'], sinRevisar: ['B'] })
  })
})
