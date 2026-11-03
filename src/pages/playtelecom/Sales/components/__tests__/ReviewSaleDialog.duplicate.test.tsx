import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const reviewMock = vi.fn()
const toastMock = vi.fn()

vi.mock('@/services/saleVerification.org.service', () => ({ reviewOrgSaleVerification: (...a: unknown[]) => reviewMock(...a) }))
vi.mock('@/services/saleVerification.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.service')>()),
  reviewSaleVerification: vi.fn(),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (...a: unknown[]) => toastMock(...a) }) }))

import { ReviewSaleDialog } from '../ReviewSaleDialog'

const sale = { id: 'sv-1', staff: { firstName: 'Josefina', lastName: 'Alvarado' } }

function renderDialog(props: { numberDuplicate?: boolean; mode?: 'approve' | 'reject' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ReviewSaleDialog
        open
        mode={props.mode ?? 'approve'}
        verification={sale}
        orgId="org-pt"
        onClose={() => {}}
        numberDuplicate={props.numberDuplicate}
      />
    </QueryClientProvider>,
  )
}

describe('ReviewSaleDialog — aprobar con número repetido', () => {
  beforeEach(() => vi.clearAllMocks())

  it('con número repetido pide confirmar y el botón dice «Aprobar igual»', async () => {
    reviewMock.mockResolvedValue({})
    renderDialog({ numberDuplicate: true })

    expect(screen.getByText('Esta venta tiene un número repetido. ¿Aprobarla igual?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar igual' }))
    await waitFor(() => expect(reviewMock).toHaveBeenCalledWith('org-pt', 'sv-1', expect.objectContaining({ decision: 'APPROVE' })))
  })

  it('sin número repetido queda igual que hoy', () => {
    renderDialog()
    expect(screen.queryByText(/número repetido/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar venta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar igual' })).not.toBeInTheDocument()
  })

  it('rechazar con número repetido no cambia nada', () => {
    renderDialog({ numberDuplicate: true, mode: 'reject' })
    expect(screen.queryByText(/número repetido/)).not.toBeInTheDocument()
  })

  it('un 403 SALE_APPROVE_FORBIDDEN muestra el mensaje del servidor en el aviso', async () => {
    reviewMock.mockRejectedValue({
      response: { status: 403, data: { code: 'SALE_APPROVE_FORBIDDEN', message: 'No tienes permiso para aprobar ni rechazar ventas' } },
    })
    renderDialog({ numberDuplicate: true })
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar igual' }))
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'No tienes permiso para aprobar ni rechazar ventas', variant: 'destructive' }),
      ),
    )
  })
})
