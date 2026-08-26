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

  async uploadImage(venueId: string, kind: 'logo' | 'icon', file: File): Promise<UploadImageResult> {
    const form = new FormData()
    form.append('image', file)
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/card-design/image?kind=${kind}`, form)
    return response.data
  },
}
