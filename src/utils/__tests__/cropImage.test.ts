import { describe, it, expect } from 'vitest'
import { fitWithinBounds } from '@/utils/cropImage'

/**
 * Regresion del 2026-09-10: no se podia subir NINGUNA foto de producto.
 *
 * `croppedAreaPixels` de react-easy-crop viene en pixeles del ARCHIVO ORIGINAL, asi que
 * una foto de celular (4032x3024) daba un recorte de 4032 px de ancho y el uploader lo
 * RECHAZABA por "exceder el maximo permitido: 2000x2000". El maximo tiene que encoger,
 * no rechazar.
 */
describe('fitWithinBounds', () => {
  it('encoge una foto de celular al tope conservando la proporcion', () => {
    // El caso real: 4032x3024 es lo que produce la camara trasera de casi cualquier telefono.
    expect(fitWithinBounds(4032, 3024, 2000, 2000)).toEqual({ width: 2000, height: 1500 })
  })

  it('no toca una imagen que ya cabe', () => {
    expect(fitWithinBounds(800, 600, 2000, 2000)).toEqual({ width: 800, height: 600 })
  })

  it('no toca una imagen que cabe exactamente en el tope', () => {
    expect(fitWithinBounds(2000, 2000, 2000, 2000)).toEqual({ width: 2000, height: 2000 })
  })

  it('conserva la proporcion en un recorte muy alto', () => {
    const r = fitWithinBounds(1500, 6000, 2000, 2000)
    expect(r).toEqual({ width: 500, height: 2000 })
    expect(r.width / r.height).toBeCloseTo(1500 / 6000, 5)
  })

  it('usa el lado que mas restringe cuando los topes son distintos', () => {
    expect(fitWithinBounds(4000, 2000, 1000, 1800)).toEqual({ width: 1000, height: 500 })
  })

  it('sin topes devuelve el tamano original: los llamadores viejos no cambian', () => {
    expect(fitWithinBounds(4032, 3024)).toEqual({ width: 4032, height: 3024 })
    expect(fitWithinBounds(4032, 3024, 0, 0)).toEqual({ width: 4032, height: 3024 })
  })

  it('nunca devuelve 0: un canvas de 0px lanza en el navegador', () => {
    const r = fitWithinBounds(10000, 1, 100, 100)
    expect(r.width).toBeGreaterThanOrEqual(1)
    expect(r.height).toBeGreaterThanOrEqual(1)
  })

  it('redondea a enteros: canvas.width no acepta fracciones', () => {
    const r = fitWithinBounds(3333, 2777, 2000, 2000)
    expect(Number.isInteger(r.width)).toBe(true)
    expect(Number.isInteger(r.height)).toBe(true)
  })
})
