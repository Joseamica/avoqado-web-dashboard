/**
 * La orientación EXIF (tag 0x0112 del IFD0) de un JPEG, leyendo su segmento APP1. 1-8, o null si no es JPEG, no trae
 * Exif o los bytes no alcanzan. Sólo hace falta la cabecera: el APP1 va antes de la imagen (SOS).
 */
export function orientacionExif(bytes: Uint8Array): number | null {
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (v.getUint16(0) !== 0xffd8) return null // SOI
    let i = 2
    while (v.getUint8(i) === 0xff) {
      const marca = v.getUint8(i + 1)
      if (marca === 0xda) return null // SOS: empezó la imagen y no hubo Exif
      if (marca === 0xe1 && v.getUint32(i + 4) === 0x45786966 && v.getUint16(i + 8) === 0) {
        const tiff = i + 10 // tras «Exif\0\0»
        const le = v.getUint16(tiff) === 0x4949 // «II» = Intel; «MM» = Motorola
        const ifd = tiff + v.getUint32(tiff + 4, le)
        for (let k = 0, n = v.getUint16(ifd, le); k < n; k++) {
          const entrada = ifd + 2 + k * 12
          if (v.getUint16(entrada, le) === 0x0112) {
            const o = v.getUint16(entrada + 8, le)
            return o >= 1 && o <= 8 ? o : null
          }
        }
        return null
      }
      i += 2 + v.getUint16(i + 2)
    }
    return null
  } catch {
    return null // RangeError: bytes truncados
  }
}

/**
 * 🔴 Codex F2 bloque 3 #2: un JPEG con orientación EXIF (foto de celular) se ve derecho en el navegador, pero el server
 * guarda los bytes tal cual y la tablet/Windows los decodifican SIN aplicar EXIF: salía girado o reflejado. Se endereza
 * aquí, una vez, en el origen: si la orientación es distinta de 1 se re-codifica con ella ya aplicada (el JPEG del canvas
 * no lleva Exif). PNG, WebP y JPEG derecho salen intactos (el mismo `File`, mismos bytes y mismo sha256). Si el navegador
 * no puede re-codificar, se devuelve el original: no se bloquea al usuario (se vería girado, como antes).
 *
 * ponytail: sólo el panel endereza; una subida directa por API (sin el panel) con EXIF girado se vería girada en la tablet.
 * Mejora: normalizar también en el server (`customerDisplayAsset.service.ts`) antes de calcular el sha256.
 */
export async function enderezarLogo(archivo: File): Promise<File> {
  if (archivo.type !== 'image/jpeg') return archivo
  try {
    const orientacion = orientacionExif(new Uint8Array(await archivo.slice(0, 128 * 1024).arrayBuffer()))
    if (orientacion === null || orientacion === 1) return archivo
    const mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    try {
      const lienzo = document.createElement('canvas')
      lienzo.width = mapa.width
      lienzo.height = mapa.height
      const contexto = lienzo.getContext('2d')
      if (!contexto) return archivo
      contexto.drawImage(mapa, 0, 0)
      const blob = await new Promise<Blob | null>(listo => lienzo.toBlob(listo, 'image/jpeg', 0.92))
      return blob ? new File([blob], archivo.name, { type: 'image/jpeg' }) : archivo
    } finally {
      mapa.close()
    }
  } catch {
    return archivo
  }
}
