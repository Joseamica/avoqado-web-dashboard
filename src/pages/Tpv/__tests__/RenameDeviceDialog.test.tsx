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
})
