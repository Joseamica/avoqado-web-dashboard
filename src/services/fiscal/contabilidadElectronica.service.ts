/**
 * Contabilidad electrónica (SAT, Anexo 24) service — gated PREMIUM (CFDI).
 *
 *   GET /api/v1/dashboard/venues/:venueId/accounting/electronic/catalogo?period=YYYY-MM
 *   GET …/accounting/electronic/balanza?period=YYYY-MM&tipoEnvio=N|C
 *   GET …/accounting/electronic/polizas?period=YYYY-MM&tipoSolicitud=&numOrden=&numTramite=
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
  const res = await api.get<ContaElectronicaResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/electronic/catalogo`, {
    params: period ? { period } : {},
  })
  return res.data
}

export async function getBalanzaXml(venueId: string, period?: string, tipoEnvio: 'N' | 'C' = 'N'): Promise<ContaElectronicaResponse> {
  const res = await api.get<ContaElectronicaResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/electronic/balanza`, {
    params: { ...(period ? { period } : {}), tipoEnvio },
  })
  return res.data
}

/** SAT request type for the journal-entry XML (Anexo 24): AF/CO carry NumOrden, FC/DE carry NumTramite. */
export type PolizasTipoSolicitud = 'AF' | 'FC' | 'DE' | 'CO'

/**
 * Journal entries (pólizas) XML for the period.
 *
 * The SAT asks for this on REQUEST — a refund, an offset, an audit — never as a monthly
 * filing, which is why it carries a request type and a case number the other two exports
 * don't need. AF and CO travel with NumOrden; FC and DE with NumTramite. Sending the wrong
 * pairing gets the filing rejected, so the caller has to say which one it is; the backend
 * leaves the attribute out entirely when no number is captured, so the accountant can fill
 * it in.
 */
export async function getPolizasXml(
  venueId: string,
  period?: string,
  opts: { tipoSolicitud?: PolizasTipoSolicitud; numero?: string } = {},
): Promise<ContaElectronicaResponse> {
  const usaOrden = opts.tipoSolicitud === 'AF' || opts.tipoSolicitud === 'CO'
  const numero = opts.numero?.trim()
  const res = await api.get<ContaElectronicaResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/electronic/polizas`, {
    params: {
      ...(period ? { period } : {}),
      ...(opts.tipoSolicitud ? { tipoSolicitud: opts.tipoSolicitud } : {}),
      ...(numero ? (usaOrden ? { numOrden: numero } : { numTramite: numero }) : {}),
    },
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
