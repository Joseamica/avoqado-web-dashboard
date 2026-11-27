/**
 * La hora de corte de la «salida olvidada», por sucursal (founder 26-nov: «A», como Toast y Square). El back-office pidió las
 * 22:00. Vacía = la de fábrica (4:00 a. m.).
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
const URL = '/api/v1/dashboard/venues/venue-1/settings'

function pintar(settings: Record<string, unknown> | null | undefined, canEdit = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AsistenciaSettings venueId="venue-1" settings={settings} canEdit={canEdit} />
    </QueryClientProvider>,
  )
}

const campo = () => screen.getByLabelText('venue:attendance.forgottenCutoffTitle') as HTMLInputElement

describe('AsistenciaSettings — hora de corte de la salida olvidada', () => {
  beforeEach(() => vi.clearAllMocks())

  it('vacía de fábrica; al escribir 22:00 y salir del campo la guarda', async () => {
    put.mockResolvedValue({ data: { data: { salidaOlvidadaCorte: '22:00' } } })
    pintar({ attendanceEnabled: true })
    expect(campo().value).toBe('')

    fireEvent.change(campo(), { target: { value: '22:00' } })
    fireEvent.blur(campo())

    await waitFor(() => expect(put).toHaveBeenCalledWith(URL, { salidaOlvidadaCorte: '22:00' }))
    await waitFor(() => expect(campo().value).toBe('22:00'))
  })

  it('borrarla regresa a la de fábrica (manda null); sin cambio no guarda nada', async () => {
    put.mockResolvedValue({ data: { data: { salidaOlvidadaCorte: null } } })
    pintar({ attendanceEnabled: true, salidaOlvidadaCorte: '22:00' })
    fireEvent.blur(campo())
    expect(put).not.toHaveBeenCalled()

    fireEvent.change(campo(), { target: { value: '' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(put).toHaveBeenCalledWith(URL, { salidaOlvidadaCorte: null }))
  })

  it('si el servidor la rechaza, regresa a la guardada', async () => {
    put.mockRejectedValue(new Error('boom'))
    pintar({ attendanceEnabled: true, salidaOlvidadaCorte: '22:00' })
    fireEvent.change(campo(), { target: { value: '23:00' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(campo().value).toBe('22:00'))
  })

  it('Codex r1 #3: una sucursal SIN fila de ajustes (null) guarda su primer corte', async () => {
    put.mockResolvedValue({ data: { data: { salidaOlvidadaCorte: '22:00' } } })
    pintar(null)
    fireEvent.change(campo(), { target: { value: '22:00' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(put).toHaveBeenCalledWith(URL, { salidaOlvidadaCorte: '22:00' }))
  })

  it('Codex r1 #4: un segundo cambio rápido se guarda aunque los ajustes todavía no se recarguen', async () => {
    put.mockImplementation(async (_u, body) => ({ data: { data: body } }))
    pintar({ attendanceEnabled: true, salidaOlvidadaCorte: '22:00' })
    fireEvent.change(campo(), { target: { value: '23:00' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(put).toHaveBeenCalledWith(URL, { salidaOlvidadaCorte: '23:00' }))
    await waitFor(() => expect(campo()).not.toBeDisabled())

    fireEvent.change(campo(), { target: { value: '22:00' } })
    fireEvent.blur(campo())
    await waitFor(() => expect(put).toHaveBeenLastCalledWith(URL, { salidaOlvidadaCorte: '22:00' }))
  })

  it('con los ajustes sin cargar, salir del campo vacío no guarda nada encima', () => {
    pintar(undefined)
    fireEvent.blur(campo())
    expect(put).not.toHaveBeenCalled()
  })

  it('con la salida olvidada apagada no aparece; sin permiso se ve pero no se toca', () => {
    const { unmount } = pintar({ attendanceEnabled: true, salidaOlvidadaEnabled: false })
    expect(screen.queryByLabelText('venue:attendance.forgottenCutoffTitle')).toBeNull()
    unmount()
    pintar({ attendanceEnabled: true }, false)
    expect(campo()).toBeDisabled()
  })
})
