/**
 * Contabilidad electrónica (SAT, Anexo 24) service — gated PREMIUM (CFDI).
 *
 *   GET /api/v1/dashboard/venues/:venueId/accounting/electronic/catalogo?period=YYYY-MM
 *   GET …/accounting/electronic/balanza?period=YYYY-MM&tipoEnvio=N|C
 *
 * Devuelve el XML (catálogo de cuentas / balanza de comprobación) sin sellar + el nombre de archivo
 * oficial del SAT. El contador lo sella con la e.firma y lo envía por el portal del SAT.
 */
import api from '@/api'

export interface ContaElectronicaResponse {
  needsFiscalSetup: boolean
  empty: boolean
  rfc: string | null
  period: string
  filename: string | null
  xml: string | null
}

export async function getCatalogoXml(venueId: string, period?: string): Promise<ContaElectronicaResponse> {
  const res = await api.get<ContaElectronicaResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/electronic/catalogo`, { params: period ? { period } : {} })
  return res.data
}

export async function getBalanzaXml(venueId: string, period?: string, tipoEnvio: 'N' | 'C' = 'N'): Promise<ContaElectronicaResponse> {
  const res = await api.get<ContaElectronicaResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/electronic/balanza`, {
    params: { ...(period ? { period } : {}), tipoEnvio },
  })
  return res.data
}

/** Dispara la descarga de un XML en el navegador (Blob). */
export function downloadXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
