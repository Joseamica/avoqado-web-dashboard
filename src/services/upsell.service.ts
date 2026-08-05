import api from '@/api'

/**
 * Upsell "¿Algo más?" — cliente de API.
 *
 * Spec: Avoqado-HQ/specs/upsell-pantalla-cliente-2026-08-03.md
 *
 * Aquí vive TODA la configuración de la función. Sin estas pantallas, el motor
 * existe en el POS pero nadie puede prenderlo ni decirle qué sugerir.
 */

export type UpsellTriggerType = 'PRODUCT' | 'CATEGORY' | 'ALWAYS'
export type UpsellOrigin = 'OWNER' | 'BASKET_DATA' | 'AI' | 'PROMOTION'
export type UpsellRuleStatus = 'PROPOSED' | 'ACTIVE' | 'DISMISSED' | 'INACTIVE'

export interface UpsellRuleProduct {
	id: string
	name: string
	price: number
	imageUrl: string | null
	upsellEnabled: boolean
}

export interface UpsellRule {
	id: string
	venueId: string
	triggerType: UpsellTriggerType
	triggerProductIds: string[]
	triggerCategoryIds: string[]
	suggestedProductId: string
	suggestedProduct: UpsellRuleProduct | null
	headline: string | null
	origin: UpsellOrigin
	status: UpsellRuleStatus
	/** Sólo BASKET_DATA. Es LIFT, no confianza: la confianza premia al producto ubicuo. */
	lift: number | null
	supportCount: number | null
	/** La frase que el dueño lee para decidir si aprueba. */
	rationale: string | null
	priority: number
	daysOfWeek: number[]
	timeFrom: string | null
	timeUntil: string | null
	approvedAt: string | null
	createdAt: string
}

/** Las tres perillas. `tablePaying` exige red en el POS (spec R1). */
export interface UpsellSurfaces {
	counter: boolean
	tableOrdering: boolean
	tablePaying: boolean
}

export interface UpsellPerformance {
	hasData: boolean
	shownCount: number
	acceptedCount: number
	acceptanceRate: number
	/**
	 * 🔴 Ventas ATRIBUIDAS, no "ingreso incremental": es el dinero de las líneas que
	 * el upsell puso en órdenes pagadas. NO descuenta lo que el cliente habría
	 * comprado igual. Para eso está `measuredLift`.
	 */
	attributedSales: number
	holdoutCount: number
	avgTicketShown: number
	avgTicketHoldout: number
	/** El aumento REAL contra el grupo de control. `null` = todavía no hay muestra. */
	measuredLift: number | null
}

export interface CreateUpsellRuleRequest {
	triggerType: UpsellTriggerType
	triggerProductIds?: string[]
	triggerCategoryIds?: string[]
	suggestedProductId: string
	headline?: string | null
	priority?: number
	daysOfWeek?: number[]
	timeFrom?: string | null
	timeUntil?: string | null
}

export interface UpdateUpsellRuleRequest {
	headline?: string | null
	priority?: number
	daysOfWeek?: number[]
	timeFrom?: string | null
	timeUntil?: string | null
}

export interface UpsellAiGenerateResult {
	runId: string
	proposed: number
	discarded: number
	message?: string
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}`

export const upsellService = {
	// ==================== REGLAS ====================

	async getRules(venueId: string, status?: UpsellRuleStatus): Promise<UpsellRule[]> {
		const qs = status ? `?status=${status}` : ''
		const response = await api.get(`${base(venueId)}/upsell-rules${qs}`)
		return response.data.data
	},

	async createRule(venueId: string, payload: CreateUpsellRuleRequest): Promise<UpsellRule> {
		const response = await api.post(`${base(venueId)}/upsell-rules`, payload)
		return response.data.data
	},

	async updateRule(venueId: string, ruleId: string, payload: UpdateUpsellRuleRequest): Promise<UpsellRule> {
		const response = await api.patch(`${base(venueId)}/upsell-rules/${ruleId}`, payload)
		return response.data.data
	},

	/** `PROPOSED` → `ACTIVE`. Lo que el dueño hace con una propuesta del job o de la IA. */
	async approveRule(venueId: string, ruleId: string): Promise<UpsellRule> {
		const response = await api.post(`${base(venueId)}/upsell-rules/${ruleId}/approve`)
		return response.data.data
	},

	/** Rechazo permanente: los generadores nunca la vuelven a proponer. */
	async dismissRule(venueId: string, ruleId: string): Promise<UpsellRule> {
		const response = await api.post(`${base(venueId)}/upsell-rules/${ruleId}/dismiss`)
		return response.data.data
	},

	async deleteRule(venueId: string, ruleId: string): Promise<void> {
		await api.delete(`${base(venueId)}/upsell-rules/${ruleId}`)
	},

	// ==================== GENERACIÓN POR IA (PREMIUM) ====================

	/**
	 * Genera propuestas leyendo el menú del negocio. **Único punto de la función que
	 * cuesta PREMIUM** (`UPSELL_AI`) — el resto del motor es PRO.
	 *
	 * 🔴 Gasta tokens de Avoqado, así que el backend impone arrendamiento, cooldown
	 * de 24 h y tope de propuestas. Los rechazos vienen con `code` para poder decir
	 * algo útil (`COOLDOWN`, `ALREADY_RUNNING`, `NO_CATALOG`) en vez de "error".
	 */
	async generateWithAi(venueId: string): Promise<UpsellAiGenerateResult> {
		const response = await api.post(`${base(venueId)}/upsell-rules/generate`)
		return { ...response.data.data, message: response.data.message }
	},

	// ==================== LAS TRES PERILLAS ====================

	async getSurfaces(venueId: string): Promise<UpsellSurfaces> {
		const response = await api.get(`${base(venueId)}/upsell-surfaces`)
		return response.data.data
	},

	async setSurfaces(venueId: string, surfaces: UpsellSurfaces): Promise<UpsellSurfaces> {
		const response = await api.put(`${base(venueId)}/upsell-surfaces`, surfaces)
		return response.data.data
	},

	// ==================== EL VETO POR PRODUCTO ====================

	/**
	 * Marca (o desmarca) productos como sugeribles. Acepta varios para la acción
	 * masiva desde la lista de productos.
	 *
	 * 🔴 `enabled: false` impide que el producto se sugiera por CUALQUIER capa,
	 * incluidas la IA y el motor de datos. Es el veto del dueño.
	 */
	async setProductsEnabled(venueId: string, productIds: string[], enabled: boolean): Promise<number> {
		const response = await api.put(`${base(venueId)}/upsell-products`, { productIds, enabled })
		return response.data.data.updated
	},

	// ==================== DESEMPEÑO ====================

	async getPerformance(venueId: string, from?: string, to?: string): Promise<UpsellPerformance> {
		const params = new URLSearchParams()
		if (from) params.append('from', from)
		if (to) params.append('to', to)
		const qs = params.toString() ? `?${params.toString()}` : ''
		const response = await api.get(`${base(venueId)}/upsell-performance${qs}`)
		return response.data.data
	},
}
