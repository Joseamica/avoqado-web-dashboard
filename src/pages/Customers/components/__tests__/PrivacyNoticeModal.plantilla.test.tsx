import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrivacyNoticeModal } from '../PrivacyNoticeModal'

/**
 * El editor abre con una PROPUESTA cuando el negocio no tiene aviso propio.
 *
 * Por qué importa, y no es cosmético: sin aviso publicado el servidor RECHAZA capturar
 * consentimiento de marketing (`consent.service.ts` exige una fila real de
 * `PrivacyNoticeVersion`, con una consulta propia que a propósito NO cae a la plantilla).
 * Así que un negocio sin aviso no puede pedirle permiso a un solo cliente — y hoy NINGÚN
 * venue tiene aviso escrito. Abrir el editor en blanco deja al dueño ante una hoja vacía
 * y un texto legal que no sabe redactar: es el paso donde la feature entera se detiene.
 *
 * El servidor ya manda la propuesta (`draftContent` + `esPlantilla: true`,
 * `consent.service.ts:58-71`); el dashboard la estaba tirando porque su tipo no la
 * declaraba y `notice?.content ?? ''` precargaba vacío.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: (d: string) => d }),
}))

const mockGetPrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: {
    getPrivacyNotice: (...args: unknown[]) => mockGetPrivacyNotice(...args),
    updatePrivacyNotice: vi.fn(),
  },
}))

const PLANTILLA = 'Aviso de Privacidad\n\nCafé de Prueba, con domicilio en Calle 1, es responsable...'

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PrivacyNoticeModal venueId="v1" open onClose={() => {}} />
    </QueryClientProvider>,
  )
}

const areaDeTexto = () => screen.getByTestId('privacy-notice-textarea') as HTMLTextAreaElement

describe('PrivacyNoticeModal — precarga de la propuesta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sin aviso propio: el textarea abre CON la propuesta del servidor, no vacío', async () => {
    mockGetPrivacyNotice.mockResolvedValue({
      notice: {
        id: null,
        content: null,
        draftContent: PLANTILLA,
        contentHash: null,
        language: 'es',
        createdAt: null,
        esPlantilla: true,
      },
    })

    abrir()

    await waitFor(() => expect(areaDeTexto().value).toBe(PLANTILLA))
  })

  it('y lo DICE: se avisa que es una propuesta por revisar, no un aviso ya publicado', async () => {
    mockGetPrivacyNotice.mockResolvedValue({
      notice: {
        id: null,
        content: null,
        draftContent: PLANTILLA,
        contentHash: null,
        language: 'es',
        createdAt: null,
        esPlantilla: true,
      },
    })

    abrir()

    // Precargar sin decirlo sería peor que no precargar: el dueño publicaría un texto
    // legal creyendo que ya era suyo, sin haberlo leído.
    await waitFor(() => expect(screen.getByTestId('privacy-notice-template-hint')).toBeInTheDocument())
  })

  // ---- REGRESIÓN: el camino que ya funcionaba ----

  it('con aviso propio: precarga SU texto y NO enseña el aviso de propuesta', async () => {
    mockGetPrivacyNotice.mockResolvedValue({
      notice: {
        id: 'n1',
        content: 'El aviso que el negocio ya escribió.',
        draftContent: null,
        contentHash: 'h',
        language: 'es',
        createdAt: '2026-09-01T00:00:00.000Z',
        esPlantilla: false,
      },
    })

    abrir()

    await waitFor(() => expect(areaDeTexto().value).toBe('El aviso que el negocio ya escribió.'))
    expect(screen.queryByTestId('privacy-notice-template-hint')).not.toBeInTheDocument()
  })

  it('una respuesta sin notice no revienta ni inventa texto', async () => {
    mockGetPrivacyNotice.mockResolvedValue({ notice: null })

    abrir()

    await waitFor(() => expect(areaDeTexto()).toBeInTheDocument())
    expect(areaDeTexto().value).toBe('')
    expect(screen.queryByTestId('privacy-notice-template-hint')).not.toBeInTheDocument()
  })
})
