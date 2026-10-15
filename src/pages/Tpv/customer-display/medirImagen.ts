/**
 * El ancho y el alto de una imagen, en el navegador, para avisar ANTES de subirla. Es cortesía: el server vuelve a medir
 * por los bytes (spec §5.4) y su respuesta manda. null = el navegador no la pudo decodificar.
 */
export async function medirImagen(archivo: File): Promise<{ ancho: number; alto: number } | null> {
  try {
    const mapa = await createImageBitmap(archivo)
    const medidas = { ancho: mapa.width, alto: mapa.height }
    mapa.close()
    return medidas
  } catch {
    return null
  }
}
