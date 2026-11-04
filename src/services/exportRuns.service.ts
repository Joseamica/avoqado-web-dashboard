import api from '@/api'

export type ExportRunStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED'
export interface ExportRunState {
  kind?: string
  status: ExportRunStatus
  processedRows: number
  totalRows: number
  format: 'csv' | 'xlsx'
  changedToFormat?: 'csv'
  waitingForPayments: boolean
  expiresAt?: string
  failureCode?: string | null
}
export type ResultadoPedido = { kind: 'archivo'; blob: Blob } | { kind: 'run'; runId: string; format: 'csv' | 'xlsx'; changedToFormat?: 'csv' }

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/exports`

export const exportRunsService = {
  /** 200 = archivo (carril directo); 202 = pedido en segundo plano. Errores (4xx) llegan como Blob: los lee el diálogo. */
  async pedir(venueId: string, kind: string, body: { format: 'csv' | 'xlsx'; columns: string[]; filters: Record<string, unknown> }): Promise<ResultadoPedido> {
    const res = await api.post(`${base(venueId)}/${kind}`, body, { responseType: 'blob', validateStatus: s => s === 200 || s === 202 })
    if (res.status === 200) return { kind: 'archivo', blob: res.data as Blob }
    const json = JSON.parse(await (res.data as Blob).text())
    return { kind: 'run', runId: json.data.runId, format: json.data.format, changedToFormat: json.data.changedToFormat }
  },
  async estado(venueId: string, runId: string): Promise<ExportRunState> {
    return (await api.get(`${base(venueId)}/${runId}/status`)).data.data
  },
  async urlDescarga(venueId: string, runId: string): Promise<{ url: string; fileName: string }> {
    return (await api.get(`${base(venueId)}/${runId}/download`)).data.data
  },
  async recientes(venueId: string, kind: string): Promise<(ExportRunState & { id: string; createdAt: string })[]> {
    return (await api.get(base(venueId), { params: { kind } })).data.data
  },
  /** Siempre 202: el servidor reintenta en segundo plano con lo guardado. */
  async reintentar(venueId: string, runId: string): Promise<{ runId: string }> {
    return { runId: (await api.post(`${base(venueId)}/${runId}/retry`)).data.data.runId }
  },
}

/** Baja un Blob con su nombre (carril directo). El servidor no expone Content-Disposition por CORS. */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

/** La liga firmada ya trae `attachment`: navegar a ella descarga sin salir de la página. */
export function abrirDescarga(url: string): void {
  window.location.assign(url)
}
