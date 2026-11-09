import api from '@/api'

// Contratos del SERVIDOR (avoqado-server, Tareas 2, 6, 7 y 8 del bloque 1 de la app de campo).
// Base: /api/v1/dashboard/organizations/:orgId/celulares-de-campo

export type EstadoDelPromotor = 'SIN_CELULAR' | 'CODIGO_SIN_USAR' | 'ACTIVO'

export interface SucursalDelPromotor {
  venueId: string
  /** Para poner el PIN desde la sucursal (`PATCH /venues/:venueId/team/:staffVenueId`). */
  staffVenueId: string
  nombre: string
  tienePin: boolean
}

export interface FilaDePromotor {
  staffId: string
  nombre: string
  telefono: string | null
  sucursales: SucursalDelPromotor[]
  estado: EstadoDelPromotor
  codigo: { codigo: string; expiraAt: string } | null
  celular: {
    id: string
    marca: string | null
    modelo: string | null
    versionApp: string | null
    activadoAt: string
    vistoAt: string | null
    porSubir: number
  } | null
  ultimaChecada: { at: string; conUbicacion: boolean; venueId: string } | null
  porRevisar: number
}

export interface CelularesDeCampo {
  /** false: ninguna sucursal de la organización tiene inventario serializado. */
  disponible: boolean
  items: FilaDePromotor[]
  total: number
  conteos: Record<EstadoDelPromotor, number>
  porRevisar: number
}

export interface FiltrosDeCelulares {
  q?: string
  venueId?: string
  estado?: EstadoDelPromotor
  page: number
  pageSize: number
}

export interface CodigoGenerado {
  staffId: string
  nombre: string
  telefono: string | null
  codigo: string
  expiraAt: string
}

export interface CodigosGenerados {
  generados: CodigoGenerado[]
  omitidos: { staffId: string; motivo: 'NO_ES_PROMOTOR' }[]
  /** Los sin celular que quedaron fuera del tope de 200 por llamada. */
  restantes: number
}

/** `venueId`: sólo los de esa sucursal, para generar exactamente los N que enseña `conteos.SIN_CELULAR` del filtro activo. */
export type PedirCodigos = { staffIds: string[] } | { todosLosSinCelular: true; venueId?: string }

export interface CelularDesvinculado {
  desvinculadoAt: string
  graciaHasta: string
  porSubir: number
  huellasReportadas: number
  yaEstaba: boolean
}

export type TipoDeEnvio = 'VENTA' | 'ENTRADA' | 'SALIDA' | 'CUSTODIA_ACEPTAR' | 'CUSTODIA_RECHAZAR' | 'EVIDENCIA'
export type MotivoDeRetencion = 'PERSONA_DADA_DE_BAJA' | 'FUERA_DE_PLAZO' | 'NO_REPORTADA' | 'SIN_PERMISO' | 'RECHAZADO' | 'APLICADO_EN_GRACIA' | 'CELULAR_PERDIDO'
export type EstadoDelRetenido = 'PENDIENTE' | 'APLICANDO' | 'APLICADO' | 'DESCARTADO'

export interface RetenidoDeCampo {
  id: string
  staffId: string
  nombre: string
  venueId: string
  sucursal: string
  tipo: TipoDeEnvio
  motivo: MotivoDeRetencion
  rechazo: { code: string; message: string; detalle?: unknown } | null
  resumen: string
  createdAt: string
  estado: EstadoDelRetenido
}

export interface FiltrosDeRetenidos {
  staffId?: string
  venueId?: string
  /** Un estado o varios separados por coma (`PENDIENTE,APLICANDO` = sin resolver). */
  estado?: string
  page: number
  pageSize: number
}

export interface RetenidoResuelto {
  estado: 'APLICADO' | 'DESCARTADO'
  resultado?: unknown
  repetida: boolean
}

const base = (orgId: string) => `/api/v1/dashboard/organizations/${orgId}/celulares-de-campo`

export const getCelularesDeCampo = async (orgId: string, params: FiltrosDeCelulares): Promise<CelularesDeCampo> => {
  const response = await api.get(base(orgId), { params })
  return response.data.data
}

export const generarCodigosDeCelular = async (orgId: string, body: PedirCodigos): Promise<CodigosGenerados> => {
  const response = await api.post(`${base(orgId)}/codigos`, body)
  return response.data.data
}

/** `perdidoORobado`: la gracia no acepta nada solo; todo lo que llegue queda en «Por revisar» (motivo `CELULAR_PERDIDO`). */
export const desvincularCelularDeCampo = async (
  orgId: string,
  celularId: string,
  opciones: { perdidoORobado?: boolean } = {},
): Promise<CelularDesvinculado> => {
  const response = await api.post(`${base(orgId)}/${celularId}/desvincular`, opciones.perdidoORobado ? { perdidoORobado: true } : {})
  return response.data.data
}

export const getRetenidosDeCampo = async (orgId: string, params: FiltrosDeRetenidos): Promise<{ items: RetenidoDeCampo[]; total: number }> => {
  const response = await api.get(`${base(orgId)}/retenidos`, { params })
  return response.data.data
}

export const resolverRetenidoDeCampo = async (
  orgId: string,
  retenidoId: string,
  body: { accion: 'APLICAR' | 'DESCARTAR'; nota?: string },
): Promise<RetenidoResuelto> => {
  const response = await api.post(`${base(orgId)}/retenidos/${retenidoId}/resolver`, body)
  return response.data.data
}
