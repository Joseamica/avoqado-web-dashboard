import api from '@/api'

/**
 * Expediente del personal.
 *
 * 🔴 Datos personales sensibles. El archivo NUNCA sale del navegador hacia Storage: va al
 * servidor (multipart), que lo guarda en un prefijo privado que ni la PAX ni el navegador
 * pueden leer. Para abrirlo se pide una URL firmada que caduca en minutos. La lista trae
 * sólo metadatos, nunca una URL — así no es una colección de llaves permanentes.
 */

export type StaffDocumentType =
  | 'ID'
  | 'CURP'
  | 'SOCIAL_SECURITY'
  | 'RFC'
  | 'CONTRACT'
  | 'CERTIFICATION'
  | 'MEDICAL'
  | 'OTHER'

export interface StaffDocument {
  id: string
  type: StaffDocumentType
  label: string | null
  fileName: string
  mimeType: string
  sizeBytes: number
  expiresAt: string | null
  notes: string | null
  createdAt: string
  uploadedBy: { firstName: string; lastName: string } | null
}

export interface AddStaffDocumentInput {
  type: StaffDocumentType
  label?: string | null
  expiresAt?: string | null
  notes?: string | null
}

export interface SignedDocumentUrl {
  url: string
  expiresInMinutes: number
  fileName: string
  mimeType: string
}

export const staffDocumentService = {
  async list(venueId: string, staffId: string): Promise<StaffDocument[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team/${staffId}/documents`)
    return Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
  },

  /** Sube el archivo POR EL SERVIDOR. `file` va en el campo `file` del formulario. */
  async add(venueId: string, staffId: string, input: AddStaffDocumentInput, file: File): Promise<StaffDocument> {
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('type', input.type)
    if (input.label) form.append('label', input.label)
    if (input.expiresAt) form.append('expiresAt', input.expiresAt)
    if (input.notes) form.append('notes', input.notes)
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/team/${staffId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  /** URL que caduca. Se pide en el momento de abrir, nunca antes. */
  async getUrl(venueId: string, documentId: string): Promise<SignedDocumentUrl> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/staff-documents/${documentId}/url`)
    return response.data
  },

  async remove(venueId: string, documentId: string): Promise<void> {
    await api.delete(`/api/v1/dashboard/venues/${venueId}/staff-documents/${documentId}`)
  },
}
