import api from '@/api'

/**
 * Expediente del personal.
 *
 * 🔴 Datos personales sensibles. El backend los guarda tras un permiso propio
 * (`staff-documents:*`), no tras `teams:read`. Dar de baja un documento no borra la fila.
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
  fileUrl: string
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
  fileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
  expiresAt?: string | null
  notes?: string | null
}

export const staffDocumentService = {
  async list(venueId: string, staffId: string): Promise<StaffDocument[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team/${staffId}/documents`)
    return Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
  },

  async add(venueId: string, staffId: string, input: AddStaffDocumentInput): Promise<StaffDocument> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/team/${staffId}/documents`, input)
    return response.data
  },

  async remove(venueId: string, documentId: string): Promise<void> {
    await api.delete(`/api/v1/dashboard/venues/${venueId}/staff-documents/${documentId}`)
  },
}
