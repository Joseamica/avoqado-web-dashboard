import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EditBrandIdentityModal } from '../EditBrandIdentityModal'

// Reporte del founder (18-nov): «al reemplazar la imagen o agregar el logo grande no se ve la que ya está». En Mindform la
// imagen con su logo está guardada como FOTO DE PORTADA y no como logotipo: el paso 1 enseñaba sólo los dos logotipos
// (vacíos) y la portada aparecía hasta el paso 2. El paso 1 debe enseñar todo lo que ya tiene el negocio.
const m = vi.hoisted(() => ({
  get: vi.fn(),
  venue: { venueId: 'v1', venueSlug: 'mindform' },
}))
vi.mock('@/api', () => ({ default: { get: m.get, put: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => m.venue }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/firebase', () => ({ storage: {}, buildStoragePath: (p: string) => p }))
vi.mock('firebase/storage', () => ({ getDownloadURL: async () => '', ref: () => ({}), uploadBytesResumable: () => ({}) }))

const PORTADA = 'https://x/portada-con-el-logo.png'

describe('EditBrandIdentityModal · la portada que ya existe se ve en el paso 1', () => {
  it('sin logotipos y con portada: al abrir, la portada actual está a la vista con su «Reemplazar»', async () => {
    m.get.mockResolvedValue({ data: { id: 'v1', name: 'Mindform', logo: '', logoFull: null, heroImageUrl: PORTADA, primaryColor: null } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <EditBrandIdentityModal open onClose={() => undefined} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('onlineBooking.brandIdentity.heroPhoto')).toBeTruthy()
    // alt="" la vuelve decorativa (sin rol «img»), así que se busca por su liga. Se ESPERA: el paso 1 se pinta en cuanto llega la
    // lectura y la portada entra un render después (el efecto que copia lo leído al formulario). Con el CI cargado, revisar sin
    // esperar la veía vacía (hz:47b359b5:D10, 20-nov: dos rojos seguidos en develop).
    await waitFor(() => expect(Array.from(document.querySelectorAll('img')).filter(i => i.getAttribute('src') === PORTADA)).toHaveLength(1))
    expect(screen.getByText('onlineBooking.brandIdentity.replace')).toBeTruthy()
    // Seguimos en el paso 1: el botón para ir al 2 está ahí.
    expect(screen.getByText('onlineBooking.brandIdentity.next')).toBeTruthy()
  })
})
