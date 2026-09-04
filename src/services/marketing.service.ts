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

// ────────────────────────────────────────────────────────────────────────────
// Campañas de correo a clientes (fase 1C-B)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un bloque de contenido. Espejo EXACTO de `campaignBlocks.ts` del servidor, que los
 * valida con un `discriminatedUnion` de Zod y los renderiza a HTML él mismo.
 *
 * 🔴 El dashboard NUNCA escribe HTML: por eso no hay nada que sanitizar aquí — el riesgo
 * no se mitiga, no existe. Si algún día llega un `type` que esta versión no conoce, se
 * IGNORA al pintar (nunca revienta la pantalla), igual que hacen los anuncios.
 */
export type CampaignBlock =
	| { type: 'heading'; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'image'; url: string; alt: string }
	| { type: 'button'; label: string; url: string }
	| { type: 'divider' }

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ENQUEUED' | 'SENDING' | 'SENT' | 'CANCELLED' | 'BLOCKED' | 'EXPIRED'

export type CampaignAudience = 'ALL_CONSENTED' | 'GROUP' | 'TAGS'

/** Lo que devuelve la LISTA: acotado a propósito — el cuerpo del correo no viaja aquí. */
export interface CampaignListItem {
	id: string
	name: string
	subject: string
	status: CampaignStatus
	audience: CampaignAudience
	customerGroupId: string | null
	tags: string[]
	totalRecipients: number
	sentCount: number
	failedCount: number
	skippedCount: number
	scheduledFor: string | null
	createdAt: string
	updatedAt: string
}

/** El DETALLE sí trae el contenido: el editor lo necesita para reabrir la campaña. */
export interface CampaignDetail extends CampaignListItem {
	contentBlocks: CampaignBlock[] | null
	htmlBody: string
	textBody: string
	linkDomains: string[]
}

export interface CampaignListResponse {
	items: CampaignListItem[]
	total: number
	page: number
	pageSize: number
}

export interface UpsertCampaignRequest {
	name: string
	subject: string
	bloques: CampaignBlock[]
	audience: CampaignAudience
	customerGroupId?: string
	tags?: string[]
}

export interface CampaignPreview {
	/** A cuántos clientes le llegaría HOY. El servidor lo cuenta; no se estima aquí. */
	totalDestinatarios: number
	/** Ata contenido + audiencia + conteo. Si algo cambia, `publish` lo rechaza. */
	token: string
	expiraEn: string
}

// ────────────────────────────────────────────────────────────────────────────
// Felicitación automática de cumpleaños (fase 2)
// ────────────────────────────────────────────────────────────────────────────

export type BirthdayAutomationStatus = 'ACTIVE' | 'PAUSED'

export interface BirthdayAutomation {
	id: string
	status: BirthdayAutomationStatus
	subject: string
	contentBlocks: CampaignBlock[] | null
	daysBefore: number
	/**
	 * Última fecha civil que el barrido evaluó, en la zona del negocio. `null` = todavía no
	 * ha corrido ninguna vez.
	 */
	lastEvaluatedLocalDate: string | null
	createdAt: string
	updatedAt: string
}

export interface UpsertBirthdayAutomationRequest {
	subject: string
	bloques: CampaignBlock[]
	daysBefore: number
	/** 🔴 `true` exige `marketing:send` en el servidor: encender es autorizar envíos. */
	activa: boolean
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

	// ── Campañas ──────────────────────────────────────────────────────────────
	//
	// 🔴 Estos endpoints responden SIN el envoltorio `{ data: … }` que sí usa el aviso de
	// privacidad de arriba (`res.json({ items, total, … })` contra `res.json({ data: { notice } })`).
	// Leerlos como si lo tuvieran devuelve `undefined` sin un solo error — exactamente el
	// defecto que dejó el detalle de los anuncios cargando para siempre en los tres clientes.
	// Por eso cada método declara de dónde lee.

	// Permiso: marketing:manage (NO `:read` — ése lo tienen roles de piso).
	async listCampaigns(venueId: string, params: { page?: number; pageSize?: number } = {}): Promise<CampaignListResponse> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/campaigns`, { params })
		return response.data
	},

	// Permiso: marketing:manage
	async getCampaign(venueId: string, id: string): Promise<CampaignDetail> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/campaigns/${id}`)
		return response.data
	},

	// Permiso: marketing:manage
	async createCampaign(venueId: string, data: UpsertCampaignRequest): Promise<{ id: string }> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/campaigns`, data)
		return response.data
	},

	// Permiso: marketing:manage. Guardar un borrador devuelve la campaña a DRAFT.
	async updateCampaign(venueId: string, id: string, data: UpsertCampaignRequest): Promise<{ id: string }> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/campaigns/${id}`, data)
		return response.data
	},

	// Permiso: marketing:manage. NO manda nada: cuenta destinatarios y firma el token.
	async previewCampaign(venueId: string, id: string): Promise<CampaignPreview> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/campaigns/${id}/preview`)
		return response.data
	},

	// 🔴 Permiso: marketing:send, y NO se hereda de `:manage`. Es irreversible y le llega
	// a los clientes del negocio. El token viene de `previewCampaign`; si el contenido o la
	// audiencia cambiaron desde entonces, el servidor lo rechaza.
	async publishCampaign(venueId: string, id: string, token: string): Promise<unknown> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/campaigns/${id}/publish`, { token })
		return response.data
	},

	// ── Felicitación de cumpleaños ────────────────────────────────────────────
	//
	// ⚠️ Estas DOS sí llevan el envoltorio `{ data: … }` (`res.json({ data: { automation } })`),
	// al revés que las de campañas de arriba. No es un descuido: son controladores distintos
	// escritos en fases distintas. Leerlo mal devuelve `undefined` sin un solo error.

	// Permiso: marketing:manage. `automation` es `null` si nunca se ha configurado — y eso
	// NO es lo mismo que «configurada y pausada».
	async getBirthdayAutomation(venueId: string): Promise<{ automation: BirthdayAutomation | null }> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/birthday-automation`)
		return response.data.data
	},

	// 🔴 Permiso: `marketing:manage` para editar, pero `marketing:send` si `activa` es true —
	// el servidor lo decide leyendo el cuerpo. Encender es autorizar envíos recurrentes.
	async saveBirthdayAutomation(venueId: string, data: UpsertBirthdayAutomationRequest): Promise<unknown> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/birthday-automation`, data)
		return response.data.data
	},

}

export default marketingService
