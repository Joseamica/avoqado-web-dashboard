import api from '@/api'

/**
 * Diseño del ticket en papel (spec § 7.2, servidor en la Fase 1).
 *
 * 🔴 Los tipos se COPIAN del contrato del servidor
 * (`avoqado-server/src/services/shared/receiptLayout/types.ts`), no se inventan: son repos
 * distintos, así que un nombre que no coincida no lo caza ningún typecheck — el papel
 * simplemente pintaría mal.
 */

/** Un bloque de la receta. La FORMA la valida el servidor; aquí sólo se transporta. */
export type ReceiptBlock = { type: string } & Record<string, unknown>

/** Lo que el intérprete del servidor produce. Discriminada por `kind`: el papel la pinta tal cual. */
export type LogicalLine =
  | { kind: 'text'; text: string; align: 'left' | 'center' | 'right'; bold: boolean; double: boolean }
  | { kind: 'image'; ref: 'logo' | 'avoqadoMark'; widthPct: number }
  | { kind: 'qr'; data: string }
  | { kind: 'barcode'; data: string }
  | { kind: 'feed'; lines: number }
  | { kind: 'cut' }

export interface LayoutProblem {
  code: string
  message: string
  blockType?: string
  index?: number
}

export interface ReceiptReadiness {
  fiscalEmisor: boolean
  logo: boolean
}

export interface ReceiptDevices {
  supporting: number
  /**
   * `brand` (PAX, NEXGO…) la manda el servidor desde el 12-sep: una PAX y una Nexgo son el mismo
   * `TPV_ANDROID`. Opcional porque un servidor anterior no la trae.
   */
  notSupporting: Array<{ name: string; platform: string; brand?: string | null; appVersion: string | null }>
}

/** Lo que devuelven las TRES rutas de la receta (GET, PUT y DELETE). */
export interface ReceiptLayoutRead {
  blocks: ReceiptBlock[]
  schemaVersion: number
  /** 0 = no hay fila guardada. Se manda de vuelta como `expectedRevision`. */
  revision: number
  source: 'custom' | 'default'
  updatedAt: string | null
}

/**
 * 🔴 Sólo el GET añade `readiness` y `devices`; el PUT y el DELETE devuelven el `Read` pelón.
 * Por eso quien escriba en la caché tiene que FUSIONAR: reemplazar con la respuesta de un
 * guardado borraría los dos avisos honestos justo después de tocar el ticket.
 */
export type ReceiptLayoutResponse = ReceiptLayoutRead & {
  readiness: ReceiptReadiness
  devices: ReceiptDevices
}

export interface ReceiptPreview {
  lines: LogicalLine[]
  problems: LayoutProblem[]
  dropped: number
}

export type TemplateId = 'canonical' | 'retail' | 'restaurant' | 'appointments' | 'minimal'

export interface ReceiptTemplate {
  id: TemplateId
  name: string
  description: string
  blocks: ReceiptBlock[]
  hash: string
}

export type SampleSale = 'retail' | 'restaurant' | 'appointments'
/** Milímetros del papel, que es como lo pide el servidor. El PAPEL se mide en columnas: 48 / 32. */
export type PaperMm = 80 | 58

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/receipt-layout`

export const receiptLayoutService = {
  async get(venueId: string): Promise<ReceiptLayoutResponse> {
    const { data } = await api.get(base(venueId))
    return data.data
  },

  async save(venueId: string, blocks: ReceiptBlock[], expectedRevision: number): Promise<ReceiptLayoutRead> {
    const { data } = await api.put(base(venueId), { blocks, expectedRevision })
    return data.data
  },

  /** DELETE con cuerpo: axios lo manda en `config.data`, no como segundo argumento. */
  async reset(venueId: string, expectedRevision: number): Promise<ReceiptLayoutRead> {
    const { data } = await api.delete(base(venueId), { data: { expectedRevision } })
    return data.data
  },

  async preview(venueId: string, blocks: ReceiptBlock[], paperWidth: PaperMm, sample: SampleSale = 'retail'): Promise<ReceiptPreview> {
    const { data } = await api.post(`${base(venueId)}/preview`, { blocks, paperWidth, sample })
    return data.data
  },

  async templates(venueId: string): Promise<ReceiptTemplate[]> {
    const { data } = await api.get(`${base(venueId)}/templates`)
    return data.data
  },
}
