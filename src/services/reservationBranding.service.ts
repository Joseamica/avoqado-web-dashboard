import api from '@/api'

/** Per-venue branding for the public reservation pages (book.avoqado.io
 *  citas/clases). Mirrors DEFAULT_RESERVATION_BRANDING in avoqado-server.
 *  `accentColor` null = inherit the venue's primaryColor (the server resolves
 *  it to a concrete color on read). */
export interface ReservationBranding {
  showLogo: boolean
  accentColor: string | null
  buttonShape: 'rounded' | 'square' | 'pill'
  /** One of the whitelisted fonts (see payment-link-fonts.ts). Server validates
   *  with a Zod enum so arbitrary values can't slip through. */
  fontFamily: string
  showHeroImage: boolean
  showDescriptions: boolean
  showDuration: boolean
  showPrices: boolean
}

export const DEFAULT_RESERVATION_BRANDING: ReservationBranding = {
  showLogo: true,
  accentColor: null,
  buttonShape: 'rounded',
  fontFamily: 'DM Sans',
  showHeroImage: true,
  showDescriptions: true,
  showDuration: true,
  showPrices: true,
}

const reservationBrandingService = {
  async getBranding(venueId: string): Promise<ReservationBranding> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reservations/branding/config`)
    return response.data?.data ?? response.data
  },

  async updateBranding(venueId: string, branding: Partial<ReservationBranding>): Promise<ReservationBranding> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/reservations/branding/config`, branding)
    return response.data?.data ?? response.data
  },
}

export default reservationBrandingService
