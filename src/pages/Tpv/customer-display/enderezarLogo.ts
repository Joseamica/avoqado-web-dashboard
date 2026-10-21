/**
 * La orientación EXIF (tag 0x0112 del IFD0) de un JPEG: 1-8, o null si no es JPEG, no trae Exif o viene truncado.
 * 🔴 Codex r2: el APP1 «Exif» puede venir TARDE, tras APP0/APP2/COM/XMP que suman más que cualquier corte fijo. Por eso se
 * salta de segmento en segmento desde el SOI leyendo sólo su cabecera de 4 bytes, hasta el Exif o hasta SOS/EOI: nunca se
 * lee el archivo entero, sólo cabeceras y el APP1 que toque.
 */
export async function orientacionExif(archivo: Blob): Promise<number | null> {
  const leer = async (desde: number, largo: number) => new DataView(await archivo.slice(desde, desde + largo).arrayBuffer())
  try {
    if ((await leer(0, 2)).getUint16(0) !== 0xffd8) return null // SOI
    for (let i = 2; i + 4 <= archivo.size;) {
      const cabecera = await leer(i, 4)
      const marca = cabecera.getUint16(0)
      const largo = cabecera.getUint16(2) // incluye sus 2 bytes
      if (marca === 0xffda || marca === 0xffd9 || marca >> 8 !== 0xff || largo < 2) return null // empezó la imagen: no hubo Exif
      if (marca === 0xffe1) {
        const v = await leer(i + 4, largo - 2)
        if (v.byteLength >= 6 && v.getUint32(0) === 0x45786966 && v.getUint16(4) === 0) {
          const tiff = 6 // tras «Exif\0\0»
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
        // otro APP1 (XMP): se sigue buscando
      }
      i += 2 + largo
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
    const orientacion = await orientacionExif(archivo)
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
