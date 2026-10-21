import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: { getPrivacyNotice: (...args: unknown[]) => mockGetPrivacyNotice(...args), updatePrivacyNotice: vi.fn() },
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/taqueria' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `F(${d})` }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}|${Object.values(o).join(',')}` : k) }),
}))
// La pestaña vive dentro de VenueEditLayout y usa sus acciones de cabecera. El recorrido real (otra pestaña deja sus botones y
// ésta los limpia) se prueba con el layout de verdad en `../__tests__/VenueEditLayout.test.tsx`; aquí basta con registrar la llamada.
const acciones: unknown[] = []
// Estable entre renders, como el `setActions` real (un setter de useState).
const setActions = (a: unknown) => {
  acciones.push(a)
}
vi.mock('../VenueEditLayout', () => ({ useVenueEditActions: () => ({ setActions }) }))
// El editor es el MISMO de Clientes (tiene sus pruebas): aquí sólo importa que esta pestaña lo abra con el negocio.
vi.mock('@/pages/Customers/components/PrivacyNoticeModal', () => ({
  PrivacyNoticeModal: ({ venueId, open }: { venueId: string; open: boolean }) =>
    open ? <div role="dialog" aria-label="editor-del-aviso" data-venue-id={venueId} /> : null,
}))

import PrivacyNotice from './PrivacyNotice'

const publicado = {
  id: 'n1',
  content: 'Texto del aviso',
  draftContent: null,
  contentHash: 'h',
  language: 'es',
  createdAt: '2026-10-01T18:00:00.000Z',
  esPlantilla: false,
}
const plantilla = {
  ...publicado,
  id: null,
  content: null,
  draftContent: 'Propuesta…',
  contentHash: null,
  createdAt: null,
  esPlantilla: true,
}

const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PrivacyNotice />
    </QueryClientProvider>,
  )
}

// Cuerpo con llaves a propósito: si el hook devuelve una función, Vitest la corre como limpieza tras la prueba — y `mockReset()`
// devuelve el propio mock (con el rechazo de la prueba de error dentro).
beforeEach(() => {
  mockGetPrivacyNotice.mockReset()
  acciones.length = 0
})

describe('Configuración del negocio → Aviso de privacidad', () => {
  it('con aviso publicado dice la fecha de la versión vigente y para qué se usa', async () => {
    mockGetPrivacyNotice.mockResolvedValue({ notice: publicado })
    pintar()
    expect(await screen.findByText('edit.privacy.published|F(2026-10-01T18:00:00.000Z)')).toBeInTheDocument()
    expect(mockGetPrivacyNotice).toHaveBeenCalledWith('venue-1')
    for (const uso of ['customers', 'campaigns', 'onlineOrdering']) expect(screen.getByText(`edit.privacy.uses.${uso}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'edit.privacy.edit' })).toBeInTheDocument()
    // `text-success` no se genera (el @theme no registra --color-success): el verde va por la variable `--success`.
    expect(screen.getByText(/edit\.privacy\.published/).querySelector('svg')).toHaveClass('text-(--success)')
  })

  it('al entrar limpia los botones de cabecera que dejó la pestaña anterior (aquí no hay nada que guardar arriba)', async () => {
    mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
    pintar()
    await screen.findByText('edit.privacy.notPublished')
    expect(acciones).toEqual([{}])
  })

  it('con sólo la plantilla dice que no está publicado (la propuesta no cuenta como aviso)', async () => {
    mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
    pintar()
    expect(await screen.findByText('edit.privacy.notPublished')).toBeInTheDocument()
    expect(screen.queryByText(/edit\.privacy\.published/)).toBeNull()
    expect(screen.getByRole('button', { name: 'edit.privacy.write' })).toBeInTheDocument()
  })

  it('si no se pudo consultar, lo dice (no finge «sin publicar»)', async () => {
    mockGetPrivacyNotice.mockRejectedValue(new Error('Network Error'))
    pintar()
    expect(await screen.findByText('edit.privacy.loadFailed')).toBeInTheDocument()
    expect(screen.queryByText('edit.privacy.notPublished')).toBeNull()
  })

  it('el botón abre el MISMO editor del aviso, con el negocio', async () => {
    mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
    pintar()
    expect(screen.queryByRole('dialog', { name: 'editor-del-aviso' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'edit.privacy.write' }))
    expect(screen.getByRole('dialog', { name: 'editor-del-aviso' })).toHaveAttribute('data-venue-id', 'venue-1')
  })
})
