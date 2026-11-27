/**
 * «Salida olvidada · revisar» (hz:f0a89d19:D3): la corrección del gerente, RENDERIZADA. La hora que se teclea es la del
 * NEGOCIO (no la del navegador), y se manda en UTC.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CorregirSalidaOlvidada, SalidaOlvidadaBadge } from '@/pages/Attendance/SalidaOlvidada'
import { notaDeLaSalidaOlvidada } from '@/pages/Attendance/salidaOlvidadaNota'
import { attendanceService } from '@/services/attendance.service'

vi.mock('@/services/attendance.service', () => ({ attendanceService: { corregirSalidaOlvidada: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const corregir = vi.mocked(attendanceService.corregirSalidaOlvidada)
const ENTRADA = {
  id: 'te-1',
  clockInTime: '2026-11-03T15:00:00.000Z', // 09:00 en CDMX
  clockOutTime: '2026-11-03T15:00:00.000Z',
  totalHours: 0,
  salidaOlvidada: true,
  notes: null,
} as any

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <CorregirSalidaOlvidada entry={ENTRADA} venueId="venue-1" venueTimezone="America/Mexico_City" staffName="Isaac" />
    </QueryClientProvider>,
  )
  return { invalidar }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CorregirSalidaOlvidada', () => {
  it('abre con la hora de la entrada en la zona del negocio y manda la salida tecleada en UTC', async () => {
    corregir.mockResolvedValue({ timeEntryId: 'te-1', clockOutTime: '2026-11-04T00:00:00.000Z', totalHours: 9 })
    const { invalidar } = montar()

    fireEvent.click(screen.getByText('forgotten.fix'))
    const input = screen.getByLabelText('forgotten.label') as HTMLInputElement
    expect(input.value).toBe('2026-11-03T09:00')

    fireEvent.change(input, { target: { value: '2026-11-03T18:00' } })
    fireEvent.click(screen.getByText('forgotten.save'))

    await waitFor(() => expect(corregir).toHaveBeenCalledWith('venue-1', 'te-1', '2026-11-04T00:00:00.000Z'))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['attendance'] }))
    expect(toast).toHaveBeenCalledWith({ title: 'forgotten.saved' })
  })

  it('si el servidor la rechaza, enseña su mensaje y no cierra', async () => {
    corregir.mockRejectedValue({ response: { data: { message: 'La salida no puede estar en el futuro.' } } })
    montar()

    fireEvent.click(screen.getByText('forgotten.fix'))
    fireEvent.click(screen.getByText('forgotten.save'))

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'La salida no puede estar en el futuro.', variant: 'destructive' }))
    expect(screen.getByLabelText('forgotten.label')).toBeTruthy()
  })
})

describe('CorregirSalidaOlvidada · un solo envío y la bitácora de marca blanca (hz:0433f0cb:D3)', () => {
  it('dos clics en el mismo instante en «Guardar» mandan una sola corrección', async () => {
    corregir.mockReturnValue(new Promise(() => undefined))
    montar()

    fireEvent.click(screen.getByText('forgotten.fix'))
    const guardar = screen.getByText('forgotten.save')
    fireEvent.click(guardar)
    fireEvent.click(guardar)

    await waitFor(() => expect(corregir).toHaveBeenCalledTimes(1))
  })

  // Codex D3 r1 #5: si la respuesta se perdió, el reintento automático recibe 409 aunque la salida sí quedó corregida.
  it('si ya no está como «Salida olvidada» (otro guardado ganó o la respuesta se perdió), lo dice sin error, cierra y refresca', async () => {
    corregir.mockRejectedValue({ response: { status: 409, data: { code: 'NO_ES_SALIDA_OLVIDADA', message: 'Esta checada ya no está como «Salida olvidada».' } } })
    const { invalidar } = montar()

    fireEvent.click(screen.getByText('forgotten.fix'))
    fireEvent.click(screen.getByText('forgotten.save'))

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'forgotten.alreadyFixed' }))
    expect(screen.queryByLabelText('forgotten.label')).toBeNull()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['stores-analysis'] })
  })

  it('al guardar también refresca la bitácora de asistencia de los gerentes', async () => {
    corregir.mockResolvedValue({ timeEntryId: 'te-1', clockOutTime: '2026-11-04T00:00:00.000Z', totalHours: 9 })
    const { invalidar } = montar()

    fireEvent.click(screen.getByText('forgotten.fix'))
    fireEvent.click(screen.getByText('forgotten.save'))

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['stores-analysis'] }))
  })
})

describe('SalidaOlvidadaBadge y la nota', () => {
  it('pinta la marca', () => {
    render(<SalidaOlvidadaBadge />)
    expect(screen.getByText('forgotten.badge')).toBeTruthy()
  })

  it('la nota es la de la salida tardía que no se usó, si la hay', () => {
    expect(notaDeLaSalidaOlvidada({ notes: null })).toBeNull()
    expect(notaDeLaSalidaOlvidada({ notes: 'otra cosa' })).toBeNull()
    expect(
      notaDeLaSalidaOlvidada({ notes: 'x\nSalida del celular de las 12:58 del 9-nov: llegó después del día del turno y no se usó.' }),
    ).toContain('12:58')
  })
})
