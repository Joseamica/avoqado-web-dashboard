import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RenameDeviceDialog } from '../components/RenameDeviceDialog'

const { apiPut, toast } = vi.hoisted(() => ({ apiPut: vi.fn(), toast: vi.fn() }))

vi.mock('@/api', () => ({ default: { put: apiPut, get: vi.fn(), post: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const onOpenChange = vi.fn()

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RenameDeviceDialog venueId="v1" device={{ id: 'd1', name: 'Caja 1' }} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
  return queryClient
}
const input = () => screen.getByLabelText('device.rename.label')
const save = () => screen.getByRole('button', { name: 'device.rename.save' })

describe('RenameDeviceDialog', () => {
  beforeEach(() => {
    apiPut.mockReset()
    toast.mockReset()
    onOpenChange.mockReset()
    apiPut.mockResolvedValue({ data: {} })
  })

  it('manda sólo el nombre', async () => {
    const qc = renderDialog()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    fireEvent.change(input(), { target: { value: '  Caja 2 ' } })
    fireEvent.click(save())
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    expect(apiPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/tpv/d1', { name: 'Caja 2' })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tpv', 'v1', 'd1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tpvs', 'v1'] })
  })

  it.each(['', '   '])('no deja guardar vacío ni sólo espacios (%j)', value => {
    renderDialog()
    fireEvent.change(input(), { target: { value } })
    expect(save()).toBeDisabled()
    fireEvent.click(save())
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('doble clic manda una sola vez', async () => {
    apiPut.mockReturnValue(new Promise(() => {}))
    renderDialog()
    fireEvent.change(input(), { target: { value: 'Caja 2' } })
    await act(async () => {
      save().click()
      save().click()
    })
    expect(apiPut).toHaveBeenCalledTimes(1)
  })

  it('si falla, dice el error y no cierra', async () => {
    apiPut.mockRejectedValue(new Error('boom'))
    renderDialog()
    fireEvent.change(input(), { target: { value: 'Caja 2' } })
    fireEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent('device.rename.error')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('cancelar y volver a abrir enseña el nombre actual y sin el error de antes (Codex final #5)', async () => {
    apiPut.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const ui = (open: boolean, name = 'Caja 1') => (
      <QueryClientProvider client={queryClient}>
        <RenameDeviceDialog venueId="v1" device={{ id: 'd1', name }} open={open} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )
    const { rerender } = render(ui(true))
    fireEvent.change(input(), { target: { value: 'Borrador' } })
    fireEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent('device.rename.error')
    fireEvent.click(screen.getByRole('button', { name: 'device.rename.cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    rerender(ui(false))
    rerender(ui(true, 'Caja norte'))
    expect(input()).toHaveValue('Caja norte')
    expect(screen.queryByRole('alert')).toBeNull()
    apiPut.mockResolvedValue({ data: {} })
    fireEvent.click(save())
    await waitFor(() => expect(apiPut).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/tpv/d1', { name: 'Caja norte' }))
  })

  it('guardar, cancelar con el guardado en vuelo y reabrir: «Guardar» sigue apagado y sale una sola petición (Codex r2)', async () => {
    let terminar: (v: unknown) => void = () => {}
    apiPut.mockImplementation(() => new Promise(r => (terminar = r)))
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const ui = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <RenameDeviceDialog venueId="v1" device={{ id: 'd1', name: 'Caja 1' }} open={open} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )
    const { rerender } = render(ui(true))
    fireEvent.change(input(), { target: { value: 'Nombre primero' } })
    fireEvent.click(save())
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'device.rename.cancel' }))
    rerender(ui(false))
    rerender(ui(true))
    fireEvent.change(input(), { target: { value: 'Nombre segundo' } })
    expect(save()).toBeDisabled()
    expect(screen.getByText('device.rename.saving')).toBeInTheDocument()
    fireEvent.click(save())
    fireEvent.submit(input().closest('form')!)
    expect(apiPut).toHaveBeenCalledTimes(1)
    await act(async () => terminar({ data: {} }))
    await waitFor(() => expect(screen.queryByText('device.rename.saving')).toBeNull())
  })
})
