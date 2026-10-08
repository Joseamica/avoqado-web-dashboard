// E6a-fix3 C5 (hermano de «marcar pagado»): sin red, crear, renombrar o archivar un nivel se queda EN PAUSA y se manda solo al volver
// la red. Son formularios en línea (no hay diálogo que cerrar), así que el aviso trae su botón «Cancelar envío». Hooks REALES,
// QueryClient real y la red apagada con `onlineManager`; sólo el servicio es simulado.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NivelesSection } from '../components/NivelesSection'

const m = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    access: async () => ({ enabled: true }),
    createLevel: (...a: unknown[]) => m.create(...a),
    updateLevel: (...a: unknown[]) => m.update(...a),
  },
}))

const NIVELES = [{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }]

beforeEach(() => {
  vi.clearAllMocks()
  m.create.mockResolvedValue({})
  m.update.mockResolvedValue({})
})
afterEach(() => onlineManager.setOnline(true))

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <NivelesSection activos={NIVELES} />
    </QueryClientProvider>,
  )
const agregarSinRed = async () => {
  montar()
  fireEvent.change(screen.getByPlaceholderText('levels.namePlaceholder'), { target: { value: 'Coach' } })
  onlineManager.setOnline(false)
  fireEvent.click(screen.getByRole('button', { name: /levels\.add/ }))
  await screen.findByText('offline.willSendSave')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('niveles sin red (C5)', () => {
  it('🔴 agregar en pausa dice que se enviará al volver la red y ofrece «Cancelar envío»', async () => {
    await agregarSinRed()
    expect(m.create).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'offline.cancelSend' })).toBeEnabled()
  })
  it('🔴 cancelar el envío es de verdad: al volver la red NO se crea, y el nombre escrito se conserva', async () => {
    await agregarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'offline.cancelSend' }))
    await waitFor(() => expect(screen.queryByText('offline.willSendSave')).toBeNull())
    await volverLaRed()
    expect(m.create).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('levels.namePlaceholder')).toHaveValue('Coach')
    fireEvent.click(screen.getByRole('button', { name: /levels\.add/ }))
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1))
  })
  it('sin cancelar, al volver la red se crea una vez y se limpia el campo', async () => {
    await agregarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByPlaceholderText('levels.namePlaceholder')).toHaveValue(''))
    expect(screen.queryByText('offline.willSendSave')).toBeNull()
  })
  it('🔴 archivar sin red también queda en pausa y se puede cancelar', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /levels\.archiveLevel/ }))
    const confirmar = await screen.findByRole('button', { name: 'levels.archiveConfirm' })
    onlineManager.setOnline(false)
    fireEvent.click(confirmar)
    await screen.findByText('offline.willSendSave')
    fireEvent.click(screen.getByRole('button', { name: 'offline.cancelSend' }))
    await volverLaRed()
    expect(m.update).not.toHaveBeenCalled()
  })
  it('🔴 renombrar sin red también queda en pausa y se puede cancelar', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /levels\.rename/ }))
    fireEvent.change(screen.getByLabelText('levels.newName'), { target: { value: 'Coach Senior' } })
    onlineManager.setOnline(false)
    fireEvent.click(screen.getByRole('button', { name: 'levels.save' }))
    await screen.findByText('offline.willSendSave')
    fireEvent.click(screen.getByRole('button', { name: 'offline.cancelSend' }))
    await volverLaRed()
    expect(m.update).not.toHaveBeenCalled()
  })
})

// E6a-fix4 (revisión de E6b): candado SÍNCRONO contra el doble clic en agregar, renombrar y archivar. Dos clics que llegan antes
// de que React vuelva a pintar (dentro del mismo `act`) no alcanzan a ver el botón apagado: sin candado, dos envíos.
describe('niveles: doble clic (candado)', () => {
  it('🔴 agregar: dos clics seguidos crean UN nivel; al terminar, el candado se suelta', async () => {
    montar()
    fireEvent.change(screen.getByPlaceholderText('levels.namePlaceholder'), { target: { value: 'Coach' } })
    const agregar = screen.getByRole('button', { name: /levels\.add/ })
    act(() => {
      agregar.click()
      agregar.click()
    })
    await waitFor(() => expect(screen.getByPlaceholderText('levels.namePlaceholder')).toHaveValue(''))
    expect(m.create).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByPlaceholderText('levels.namePlaceholder'), { target: { value: 'Senior' } })
    fireEvent.click(screen.getByRole('button', { name: /levels\.add/ }))
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(2))
  })
  it('🔴 renombrar: dos clics seguidos mandan UN cambio', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /levels\.rename/ }))
    fireEvent.change(screen.getByLabelText('levels.newName'), { target: { value: 'Coach Senior' } })
    const guardar = screen.getByRole('button', { name: 'levels.save' })
    act(() => {
      guardar.click()
      guardar.click()
    })
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'levels.renamed' }))
    expect(m.update).toHaveBeenCalledTimes(1)
  })
  it('al terminar de renombrar, el candado se suelta: archivar después sí se manda', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /levels\.rename/ }))
    fireEvent.change(screen.getByLabelText('levels.newName'), { target: { value: 'Coach Senior' } })
    fireEvent.click(screen.getByRole('button', { name: 'levels.save' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'levels.renamed' }))
    fireEvent.click(screen.getByRole('button', { name: /levels\.archiveLevel/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'levels.archiveConfirm' }))
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(2))
  })
  it('🔴 archivar: dos clics seguidos en la confirmación mandan UN archivo', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /levels\.archiveLevel/ }))
    const confirmar = await screen.findByRole('button', { name: 'levels.archiveConfirm' })
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'levels.archived' }))
    expect(m.update).toHaveBeenCalledTimes(1)
  })
})
