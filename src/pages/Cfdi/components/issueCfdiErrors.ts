/**
 * Qué aviso ve el usuario cuando «Facturar» no emite (409 / 404). Función pura para poder probarla.
 *
 * Los avisos que traen una INSTRUCCIÓN (cancela la FT-901, usa «Corregir importe», revisa la configuración)
 * se quedan más tiempo: en 5 s no da tiempo de leerlos (/full-testing, 24-sep-2026).
 */
export const DURACION_AVISO_LARGO_MS = 15000

export interface AvisoFacturar {
  title: string
  description: string
  duration?: number
}

export function avisoDeErrorAlFacturar(
  status: 409 | 404,
  data: { code?: string; error?: string },
  t: (key: string) => string,
): AvisoFacturar {
  const aviso = elegirAviso(status, data, t)
  // El texto del servidor suele empezar con la misma frase del título: no se lee dos veces.
  const repetido = aviso.description.startsWith(aviso.title) ? aviso.description.slice(aviso.title.length).trim() : null
  return repetido ? { ...aviso, description: repetido } : aviso
}

function elegirAviso(status: 409 | 404, data: { code?: string; error?: string }, t: (key: string) => string): AvisoFacturar {
  const description = data.error || ''
  if (status === 409) {
    if (data.code === 'CFDI_ALREADY_ISSUED')
      return { title: t('issueDialog.errors.alreadyIssued'), description, duration: DURACION_AVISO_LARGO_MS }
    if (data.code === 'CFDI_CANCEL_PENDING')
      return { title: t('issueDialog.errors.cancelPending'), description, duration: DURACION_AVISO_LARGO_MS }
    return { title: t('issueDialog.errors.conflict'), description }
  }
  // 404: la venta no es de este negocio ≠ no se sabe quién la factura.
  if (data.code === 'ORDER_NOT_FOUND') return { title: t('issueDialog.errors.orderNotFound'), description }
  return { title: t('issueDialog.errors.notFound'), description, duration: DURACION_AVISO_LARGO_MS }
}
