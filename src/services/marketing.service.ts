import api from '@/api'

/**
 * Aviso de privacidad (fase 0 de campañas de correo a clientes).
 *
 * 🔴 Inmutable por versión: el PUT SIEMPRE crea una versión nueva; las anteriores
 * no se pueden editar ni leer desde este servicio. Pero el GET sí trae el texto
 * COMPLETO de la versión vigente (`content`) — `consent.service.ts` →
 * `getCurrentPrivacyNotice` lo selecciona a propósito, porque es contenido del
 * PROPIO negocio (no dato personal de un tercero) y el editor lo necesita para
 * precargar el textarea, no sólo sus metadatos.
 */
export interface PrivacyNotice {
	/** `null` cuando lo que llega es la PLANTILLA de precarga (no hay versión guardada). */
	id: string | null
	/** El aviso REALMENTE publicado. `null` mientras el negocio no haya guardado ninguno. */
	content: string | null
	/**
	 * Propuesta que el servidor arma con los datos del negocio para que el editor no abra
	 * en blanco (`consent.service.ts` → `plantillaDeAviso`). Llega SÓLO junto con
	 * `esPlantilla: true`, y NO cuenta como aviso publicado.
	 */
	draftContent: string | null
	contentHash: string | null
	language: string
	createdAt: string | null
	/**
	 * 🔴 `true` = esto es una PROPUESTA, no un aviso vigente. Quien decida si el negocio
	 * "ya tiene aviso" debe mirar `content` / `esPlantilla`, NUNCA `Boolean(notice)`: desde
	 * que existe la plantilla, la respuesta trae siempre un objeto y ese chequeo es siempre
	 * verdadero — así se habilitó por error la casilla de consentimiento en negocios sin
	 * aviso, que es justo lo que el servidor rechaza.
	 */
	esPlantilla: boolean
}

// El candado "¿ya tiene aviso publicado?" vive en `@/lib/privacy-notice` — módulo puro y
// sin efectos, para que un `vi.mock` de ESTE servicio no lo deje undefined en los tests.

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
