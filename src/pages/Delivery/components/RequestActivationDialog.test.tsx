// src/pages/Delivery/components/RequestActivationDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockCreateActivationRequest = vi.fn()
vi.mock('@/services/delivery.service', () => ({
  createActivationRequest: (...args: unknown[]) => mockCreateActivationRequest(...args),
}))

import { RequestActivationDialog } from './RequestActivationDialog'

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <RequestActivationDialog venueId="venue-1" open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
  return { invalidateSpy, onOpenChange }
}

function submitButton() {
  return screen.getByText('requestDialog.submit').closest('button')!
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RequestActivationDialog', () => {
  it('renderiza los 3 canales solicitables y arranca con enviar deshabilitado (sin selección)', () => {
    renderDialog()

    expect(screen.getByLabelText('Uber Eats')).toBeInTheDocument()
    expect(screen.getByLabelText('Rappi')).toBeInTheDocument()
    expect(screen.getByLabelText('DiDi Food')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('seleccionar un canal habilita enviar; pega a createActivationRequest con requestedChannels correctos y nota vacía → undefined', async () => {
    mockCreateActivationRequest.mockResolvedValue({ id: 'req-1' })
    const { onOpenChange, invalidateSpy } = renderDialog()

    fireEvent.click(screen.getByLabelText('Uber Eats'))
    expect(submitButton()).not.toBeDisabled()

    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mockCreateActivationRequest).toHaveBeenCalledWith('venue-1', { requestedChannels: ['UBER_EATS'], note: undefined }),
    )
    // Must invalidate the EXACT queryKey useDeliveryStatus reads — this is what flips TEASER → PENDING.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['deliveryActivation', 'venue-1'] }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('con nota escrita, la envía recortada (trim)', async () => {
    mockCreateActivationRequest.mockResolvedValue({ id: 'req-1' })
    renderDialog()

    fireEvent.click(screen.getByLabelText('Rappi'))
    fireEvent.change(screen.getByPlaceholderText('requestDialog.notePlaceholder'), { target: { value: '  ya tengo cuenta  ' } })
    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mockCreateActivationRequest).toHaveBeenCalledWith('venue-1', { requestedChannels: ['RAPPI'], note: 'ya tengo cuenta' }),
    )
  })

  it('desmarcar un canal ya seleccionado lo quita de requestedChannels', async () => {
    mockCreateActivationRequest.mockResolvedValue({ id: 'req-1' })
    renderDialog()

    fireEvent.click(screen.getByLabelText('Uber Eats'))
    fireEvent.click(screen.getByLabelText('Rappi'))
    fireEvent.click(screen.getByLabelText('Uber Eats')) // uncheck
    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mockCreateActivationRequest).toHaveBeenCalledWith('venue-1', { requestedChannels: ['RAPPI'], note: undefined }),
    )
  })

  it('en error, muestra toast destructivo y NO cierra el dialog', async () => {
    mockCreateActivationRequest.mockRejectedValue({ response: { data: { message: 'boom' } } })
    const { onOpenChange } = renderDialog()

    fireEvent.click(screen.getByLabelText('DiDi Food'))
    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'requestDialog.toastError', description: 'boom', variant: 'destructive' }),
      ),
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('reabrir el dialog limpia selección y nota de un envío previo', () => {
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <RequestActivationDialog venueId="venue-1" open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByLabelText('Uber Eats'))
    expect(submitButton()).not.toBeDisabled()

    // Close then reopen — a fresh queryClient/provider per open, matching how the page would remount state.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RequestActivationDialog venueId="venue-1" open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    )
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RequestActivationDialog venueId="venue-1" open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(submitButton()).toBeDisabled()
  })
})
