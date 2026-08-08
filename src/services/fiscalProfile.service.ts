import api from '@/api'

/**
 * Datos fiscales del venue como RECEPTOR de las facturas de Avoqado (no confundir con los
 * datos de emisor que un venue captura para facturar a SUS PROPIOS clientes vía CFDI —
 * ver `src/pages/Cfdi/*`). Esta pantalla nunca pide ni acepta CSD (.cer/.key).
 *
 * @see avoqado-server src/controllers/dashboard/fiscalProfile.dashboard.controller.ts
 */

/** Campo del formulario al que apunta un error de validación del SAT. */
export type SatValidationField = 'razonSocial' | 'rfc' | 'regimenFiscal' | 'codigoPostal' | 'email' | 'otro'

export interface SatValidationError {
  field: SatValidationField
  message: string
}

/**
 * Resultado de validar los datos del receptor contra el padrón del SAT (sin gastar timbre).
 * `null` = no se pudo validar (el proveedor fiscal no respondió) — NO significa que los datos
 * sean inválidos. Sólo `valid === false` es un rechazo real del SAT.
 */
export interface SatValidationResult {
  valid: boolean
  errors: SatValidationError[]
}

export type FiscalValidationStatus = 'PENDING' | 'VALID' | 'INVALID'

export interface VenueFiscalProfile {
  id: string
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  defaultUsoCfdi: string
  email: string | null
  constanciaUrl: string | null
  validationStatus: FiscalValidationStatus
  validatedAt: string | null
}

export interface VenueFiscalProfileInput {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  /** Opcional: el backend usa 'G03' (Gastos en general) por defecto si se omite. */
  defaultUsoCfdi?: string
  email?: string
}

export interface UpdateFiscalProfileResult {
  profile: VenueFiscalProfile
  validation: SatValidationResult | null
}

/** Tipos de archivo que el backend acepta para la constancia (uploadConstanciaSchema). */
export const ALLOWED_CONSTANCIA_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const

/** Lee un File como base64 sin el prefijo `data:...;base64,`. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
  })
}

export const fiscalProfileService = {
  /**
   * Obtiene el perfil fiscal del venue como receptor. `null` si el venue todavía no lo captura.
   * @permission venue-fiscal-profile:manage (OWNER)
   */
  async getProfile(venueId: string): Promise<VenueFiscalProfile | null> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/fiscal-profile`)
    return response.data?.data ?? null
  },

  /**
   * Crea o actualiza el perfil fiscal. El backend valida los datos contra el padrón del SAT
   * sin gastar timbre y regresa el veredicto en `validation` (puede ser `null`, ver el tipo).
   * @permission venue-fiscal-profile:manage (OWNER)
   */
  async updateProfile(venueId: string, data: VenueFiscalProfileInput): Promise<UpdateFiscalProfileResult> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/fiscal-profile`, data)
    return {
      profile: response.data.data,
      validation: response.data.validation ?? null,
    }
  },

  /**
   * Sube la Constancia de Situación Fiscal (PDF/PNG/JPG) como respaldo del perfil ya guardado.
   * Requiere que el perfil exista (el backend responde 404 NO_PROFILE si no).
   * @permission venue-fiscal-profile:manage (OWNER)
   */
  async uploadConstancia(venueId: string, file: File): Promise<VenueFiscalProfile> {
    const fileBase64 = await fileToBase64(file)
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/fiscal-profile/constancia`, {
      fileBase64,
      contentType: file.type,
    })
    return response.data.data
  },
}

export default fiscalProfileService
