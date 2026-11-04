import type { OrgSaleRow } from '@/services/saleVerification.org.service'

export interface ClientSaleFilters {
  status: string[]
  saleType: string[]
  paymentForm: string[]
  venue: string[]
}

/**
 * Filtros que sólo se aplican en el navegador (el servidor los sirve de forma amplia).
 * UNA sola función para la tabla y para el Excel: así lo exportado es siempre lo que se ve en pantalla.
 */
export function applyClientSaleFilters(data: OrgSaleRow[], f: ClientSaleFilters): OrgSaleRow[] {
  return data.filter(r => {
    if (f.status.length > 1 && !f.status.includes(r.status)) return false
    // saleType filtered client-side for any selection: the server only knows
    // isPortabilidad (bool), but saleType now has 3 values (eSIM overrides),
    // so the boolean pre-narrow alone can't isolate eSIM / línea nueva.
    if (f.saleType.length >= 1 && !f.saleType.includes(r.saleType)) return false
    if (f.paymentForm.length > 1 && !f.paymentForm.includes(r.payment?.paymentForm ?? 'NONE')) return false
    if (f.venue.length > 1 && !f.venue.includes(r.venue.id)) return false
    return true
  })
}
