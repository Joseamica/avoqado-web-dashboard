import api from '@/api'

/**
 * Aviso de privacidad (fase 0 de campañas de correo a clientes).
 *
 * 🔴 Inmutable por versión: el GET sólo devuelve METADATOS de la versión vigente
 * (`id`, `contentHash`, `language`, `createdAt`) — el servidor NUNCA regresa el
 * texto guardado (`consent.service.ts` → `getCurrentPrivacyNotice`, seleccionado
 * a propósito sin `content`). El PUT crea SIEMPRE una versión nueva; las
 * anteriores no se pueden editar ni leer desde este servicio.
 */
export interface PrivacyNotice {
	id: string
	contentHash: string
	language: string
	createdAt: string
}

export interface PrivacyNoticeResponse {
	notice: PrivacyNotice | null
}

export type PrivacyNoticeLanguage = 'es' | 'en' | 'fr'

export interface UpsertPrivacyNoticeRequest {
	content: string
	language?: PrivacyNoticeLanguage
}

export const marketingService = {
	// Permiso: marketing:read
	async getPrivacyNotice(venueId: string): Promise<PrivacyNoticeResponse> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/privacy-notice`)
		return response.data.data
	},

	// Permiso: marketing:manage. Crea una versión nueva — nunca edita la anterior.
	async updatePrivacyNotice(venueId: string, data: UpsertPrivacyNoticeRequest): Promise<PrivacyNoticeResponse> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/privacy-notice`, data)
		return response.data.data
	},
}

export default marketingService
