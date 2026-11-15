/**
 * «Foto de entrada» vive en Equipo → Asistencia con el resto del checador (encargo b0c1a1, 15-nov). Antes estaba escondida
 * dentro de turnos de caja en Editar negocio y el servidor no la leía.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/api'
import AsistenciaSettings from '@/pages/Team/AsistenciaSettings'

vi.mock('@/api', () => ({ default: { put: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const put = vi.mocked(api.put)

function pintar(settings: Record<string, unknown>, canEdit = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AsistenciaSettings venueId="venue-1" settings={settings} canEdit={canEdit} />
    </QueryClientProvider>,
  )
}

describe('AsistenciaSettings — foto de entrada', () => {
  beforeEach(() => vi.clearAllMocks())

  it('apagada de fábrica; al prenderla guarda requireClockInPhoto en los ajustes del negocio', async () => {
    put.mockResolvedValue({ data: { data: { requireClockInPhoto: true } } })
    pintar({ attendanceEnabled: true })
    const sw = screen.getByRole('switch', { name: 'venue:attendance.photoTitle' })
    expect(sw).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(sw)

    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', { requireClockInPhoto: true }))
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))
  })

  it('si el servidor la rechaza, regresa a como estaba', async () => {
    put.mockRejectedValue(new Error('boom'))
    pintar({ attendanceEnabled: true, requireClockInPhoto: false })
    const sw = screen.getByRole('switch', { name: 'venue:attendance.photoTitle' })
    fireEvent.click(sw)
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
  })

  it('sin permiso de editar se ve pero no se toca; con el checador apagado no aparece (lo explica disabledHint)', () => {
    const { unmount } = pintar({ attendanceEnabled: true, requireClockInPhoto: true }, false)
    expect(screen.getByRole('switch', { name: 'venue:attendance.photoTitle' })).toBeDisabled()
    unmount()
    pintar({ attendanceEnabled: false, requireClockInPhoto: true })
    expect(screen.queryByRole('switch', { name: 'venue:attendance.photoTitle' })).toBeNull()
    expect(screen.getByText('venue:attendance.disabledHint')).toBeInTheDocument()
  })
})
