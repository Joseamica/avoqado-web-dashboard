import api from '@/api'

/**
 * El diseño de la credencial que los clientes guardan en su cartera.
 *
 * Nota sobre las URLs de imagen: NO se escriben a mano — se obtienen subiendo el
 * archivo con `uploadImage`, que valida el PNG y sus dimensiones del lado del
 * servidor. Un dueño de negocio no tiene una URL a la mano, y Apple rechaza en
 * silencio cualquier imagen que no sea PNG.
 */
/**
 * Espejo EXACTO del enum del servidor. Un nombre distinto no falla al compilar: el
 * servidor cae al círculo por defecto y el negocio ve otra forma sin ningún error.
 */
export type WalletStampShape = 'CIRCLE' | 'STAR' | 'HEART' | 'SQUARE' | 'CUP' | 'SCISSORS' | 'DUMBBELL' | 'FLOWER' | 'BAG'

export interface WalletCardDesign {
  logoUrl: string | null
  iconUrl: string | null
  backgroundColor: string
  textColor: string
  labelColor: string
  stripColor: string
  stampFilledColor: string
  /** Null = se deriva del color del sello ganado. */
  stampEmptyColor: string | null
  stampShape: WalletStampShape
  /** El sello propio del negocio. Cuando existe, manda sobre `stampShape`. */
  stampImageUrl: string | null
}

export interface StripPreviewParams {
  earned: number
  required: number
  strip?: string | null
  filled?: string | null
  empty?: string | null
  shape?: WalletStampShape | null
}

export interface UploadImageResult {
  url: string
  design: WalletCardDesign
  /** La imagen sirve, pero no es la ideal. No son errores. */
  avisos: string[]
  dimensiones: { width: number; height: number }
}

export const walletCardService = {
  async getDesign(venueId: string): Promise<WalletCardDesign> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/loyalty/card-design`)
    return response.data
  },

  /**
   * Guardado PARCIAL: manda sólo lo que cambió. Enviar el objeto completo no es
   * necesario, y un campo ausente no borra lo que ya estaba guardado.
   */
  async updateDesign(venueId: string, patch: Partial<WalletCardDesign>): Promise<WalletCardDesign> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/loyalty/card-design`, patch)
    return response.data
  },

  /**
   * La banda de sellos, generada por el MISMO motor que produce el pase.
   *
   * 🔴 Se pide al servidor en vez de dibujarla en el navegador a propósito. Los nueve
   * iconos y el cálculo de contraste que decide el color de un sello sin ganar son
   * lógica delicada; tenerla dos veces garantiza que un día diverjan, y una vista
   * previa que diverge es peor que no tenerla — el negocio guarda convencido de haber
   * visto el resultado.
   *
   * Va por axios y no por `<img src>` porque el endpoint pide sesión, y una imagen en
   * otro origen no manda las cookies.
   */
  async getStripPreview(venueId: string, params: StripPreviewParams): Promise<Blob> {
    const query = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined) query.set(k, String(v))
    }
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/loyalty/card-design/strip.png?${query}`, {
      responseType: 'blob',
    })
    return response.data
  },

  async uploadImage(venueId: string, kind: 'logo' | 'icon' | 'stamp', file: File): Promise<UploadImageResult> {
    const form = new FormData()
    form.append('image', file)
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/card-design/image?kind=${kind}`, form)
    return response.data
  },
}

// ==========================================
// CARTILLA DE SELLOS — avance y canje del premio
// ==========================================

export interface StampRewardToClaim {
  id: string
  rewardLabel: string
  rewardType: 'FREE_PRODUCT' | 'FIXED_AMOUNT' | 'PERCENTAGE'
  rewardValue: number | null
  expiresAt: string | null
  createdAt: string
}

export interface StampCardStatus {
  stampsEarned: number
  /** 🔴 Viene de la CARTILLA, no de la configuración: quien va a la mitad conserva su meta. */
  stampsRequired: number
  rewardLabel: string
  pendingRewards: number
  rewardsToClaim: StampRewardToClaim[]
}

export const stampCardService = {
  async getStatus(venueId: string, customerId: string): Promise<StampCardStatus> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/loyalty/customers/${customerId}/stamp-card`)
    return response.data
  },

  /** 🔴 DINERO: baja lo que el cliente paga. El servidor protege contra el doble canje. */
  async redeem(venueId: string, rewardId: string, orderId: string): Promise<{ discountAmount: number; rewardLabel: string }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/stamp-rewards/${rewardId}/redeem`, { orderId })
    return response.data
  },
}

/**
 * La liga publica que el iPhone abre para guardar la tarjeta en Wallet.
 *
 * 🔴 Se arma con `api.defaults.baseURL`, NO leyendo `import.meta.env.VITE_API_URL`:
 * ese baseURL ya paso por `resolveApiBaseUrl()`, que en desarrollo cae a
 * same-origin cuando el dashboard se abre desde un tunel. Leyendo la variable a
 * pelo, la liga apuntaria a `localhost` y el telefono del cliente —que no es esta
 * maquina— la abriria contra el vacio. Es justo el caso en el que se prueba esto.
 *
 * El slug va codificado: es texto que el negocio elige, no un id garantizado.
 */
export function buildWalletPassUrl(venueSlug: string, customerId: string, baseUrl?: string): string {
  const base = (baseUrl ?? api.defaults.baseURL ?? '').replace(/\/+$/, '')
  return `${base}/api/v1/public/venues/${encodeURIComponent(venueSlug)}/wallet/apple/${encodeURIComponent(customerId)}`
}

/**
 * La liga del cartel del mostrador: el portal publico del negocio, abierto directo en
 * la cuenta del cliente (`#cuenta`).
 *
 * 🔴 Apunta al PORTAL, nunca a la ruta del `.pkpass`. La diferencia es de seguridad,
 * no de comodidad: la ruta del pase lleva el id del cliente dentro, asi que un QR
 * impreso con ella entregaria SIEMPRE la misma tarjeta — la de quien lo imprimio.
 * Mandando al portal, cada quien se identifica con su telefono y recibe LA SUYA.
 */
export function buildPosterUrl(venueSlug: string): string {
  const host = (import.meta.env.VITE_BOOKING_URL as string | undefined) || 'https://book.avoqado.io'
  return `${host.replace(/\/+$/, '')}/${encodeURIComponent(venueSlug)}#cuenta`
}
