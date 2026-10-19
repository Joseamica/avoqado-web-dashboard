import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { enderezarLogo, orientacionExif } from '../enderezarLogo'

/** Un JPEG mínimo (SOI · APP0 JFIF · APP1 Exif con UN tag de orientación · SOS · EOI), como el de una foto de celular. */
function jpeg(orientacion: number | null, orden: 'II' | 'MM' = 'MM'): Uint8Array<ArrayBuffer> {
  const le = orden === 'II'
  const u16 = (n: number) => (le ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
  const u32 = (n: number) =>
    le ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
  const ascii = (s: string) => [...s].map(c => c.charCodeAt(0))
  const app0 = [0xff, 0xe0, 0, 16, ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]
  // TIFF: cabecera (orden, 42, IFD0 en 8) · IFD0 con 1 entrada: 0x0112 SHORT×1 = orientación · siguiente IFD = 0
  const tiff = [
    ...ascii(orden),
    ...u16(42),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientacion ?? 1),
    0,
    0,
    ...u32(0),
  ]
  const exif = [...ascii('Exif'), 0, 0, ...tiff]
  const app1 = orientacion === null ? [] : [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff, ...exif]
  return new Uint8Array([0xff, 0xd8, ...app0, ...app1, 0xff, 0xda, 0, 2, 0xff, 0xd9])
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

/** jsdom no trae createImageBitmap ni canvas: se doblan, y la prueba ve qué recibió cada uno. */
function doblarDecodificador() {
  const mapa = { width: 600, height: 800, close: vi.fn() }
  const crear = vi.fn().mockResolvedValue(mapa)
  vi.stubGlobal('createImageBitmap', crear)
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  const lienzos: { ancho: number; alto: number; tipo?: string; calidad?: unknown }[] = []
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb, tipo, calidad) {
    lienzos.push({ ancho: this.width, alto: this.height, tipo, calidad })
    cb(new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 3])], { type: 'image/jpeg' }))
  })
  return { crear, mapa, drawImage, lienzos }
}

// jsdom no trae Blob.arrayBuffer (los navegadores sí): se completa con su FileReader.
beforeAll(() => {
  if (!Blob.prototype.arrayBuffer)
    Blob.prototype.arrayBuffer = function (this: Blob) {
      return new Promise<ArrayBuffer>(listo => {
        const lector = new FileReader()
        lector.onload = () => listo(lector.result as ArrayBuffer)
        lector.readAsArrayBuffer(this)
      })
    }
})
afterEach(() => vi.unstubAllGlobals())

describe('orientacionExif', () => {
  it('lee la orientación del APP1 Exif, en los dos órdenes de bytes (Motorola e Intel)', () => {
    expect(orientacionExif(jpeg(6, 'MM'))).toBe(6)
    expect(orientacionExif(jpeg(6, 'II'))).toBe(6)
    expect(orientacionExif(jpeg(3))).toBe(3)
    expect(orientacionExif(jpeg(1))).toBe(1)
  })

  it('JPEG sin Exif, PNG, bytes truncados o un valor fuera de 1-8 ⇒ null', () => {
    expect(orientacionExif(jpeg(null))).toBeNull()
    expect(orientacionExif(PNG)).toBeNull()
    expect(orientacionExif(jpeg(6).slice(0, 40))).toBeNull()
    expect(orientacionExif(jpeg(9))).toBeNull()
    expect(orientacionExif(new Uint8Array())).toBeNull()
  })
})

describe('enderezarLogo', () => {
  it('🔴 JPEG con orientación 6: se re-codifica con la orientación ya aplicada y se sube ESE archivo', async () => {
    const { crear, mapa, drawImage, lienzos } = doblarDecodificador()
    const original = new File([jpeg(6)], 'foto.jpg', { type: 'image/jpeg' })
    const enderezado = await enderezarLogo(original)
    expect(crear).toHaveBeenCalledWith(original, { imageOrientation: 'from-image' })
    expect(drawImage).toHaveBeenCalledWith(mapa, 0, 0)
    expect(lienzos).toEqual([{ ancho: 600, alto: 800, tipo: 'image/jpeg', calidad: 0.92 }])
    expect(mapa.close).toHaveBeenCalled()
    expect(enderezado).not.toBe(original)
    expect(enderezado.name).toBe('foto.jpg')
    expect(enderezado.type).toBe('image/jpeg')
    expect(orientacionExif(new Uint8Array(await enderezado.arrayBuffer()))).toBeNull() // el canvas no escribe Exif
  })

  it('PNG, JPEG sin Exif y JPEG con orientación 1: el MISMO archivo (bytes idénticos) y sin decodificar', async () => {
    const { crear } = doblarDecodificador()
    for (const archivo of [
      new File([PNG], 'logo.png', { type: 'image/png' }),
      new File([jpeg(null)], 'sin-exif.jpg', { type: 'image/jpeg' }),
      new File([jpeg(1)], 'derecho.jpg', { type: 'image/jpeg' }),
    ]) {
      expect(await enderezarLogo(archivo)).toBe(archivo)
    }
    expect(crear).not.toHaveBeenCalled()
  })

  it('si el navegador no puede re-codificar, se sube el original (no se bloquea al usuario)', async () => {
    const { crear } = doblarDecodificador()
    crear.mockRejectedValue(new Error('decode'))
    const original = new File([jpeg(6)], 'foto.jpg', { type: 'image/jpeg' })
    expect(await enderezarLogo(original)).toBe(original)
  })
})
