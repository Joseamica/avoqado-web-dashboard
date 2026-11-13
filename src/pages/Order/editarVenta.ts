/**
 * Diálogo «Editar venta» (sólo SUPERADMIN) — D70.
 *
 * Antes mandaba SIEMPRE todos los campos, con la fecha recortada al minuto y en UTC escrita como si fuera hora local:
 * cada guardado movía la fecha de la venta hasta 59 s (o 6 h si el servidor no corría en UTC), aunque nadie la tocara.
 * Ahora el campo muestra la hora local y sólo viaja lo que cambió; la fecha, como instante completo con zona.
 */
export interface ValoresDeEdicion {
  status: string
  customerName: string
  tableId: string
  servedById: string
  createdAt: string
  orderNumber: string
  type: string
}

export interface CambiosDeVenta {
  status?: string
  customerName?: string
  tableId?: string | null
  servedById?: string | null
  createdAt?: string
  orderNumber?: string
  type?: string
}

const dos = (n: number) => String(n).padStart(2, '0')

/** ISO del servidor → valor de `<input type="datetime-local">` en la hora local del navegador. */
export function fechaParaElCampo(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Sólo los campos que cambiaron respecto a como se abrió el diálogo. */
export function cambiosDeLaVenta(inicial: ValoresDeEdicion, actual: ValoresDeEdicion): CambiosDeVenta {
  const cambios: CambiosDeVenta = {}
  if (actual.status !== inicial.status) cambios.status = actual.status
  if (actual.customerName !== inicial.customerName) cambios.customerName = actual.customerName
  if (actual.tableId !== inicial.tableId) cambios.tableId = actual.tableId || null
  if (actual.servedById !== inicial.servedById) cambios.servedById = actual.servedById || null
  if (actual.orderNumber !== inicial.orderNumber) cambios.orderNumber = actual.orderNumber
  if (actual.type !== inicial.type) cambios.type = actual.type
  if (actual.createdAt !== inicial.createdAt && actual.createdAt) {
    // `datetime-local` sin zona: el navegador lo lee como hora local.
    const d = new Date(actual.createdAt)
    if (!Number.isNaN(d.getTime())) cambios.createdAt = d.toISOString()
  }
  return cambios
}
