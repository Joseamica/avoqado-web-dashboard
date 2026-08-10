/**
 * Candado "Revisar por promotor" en el diálogo de Editar (Asana 1217299209026114).
 *
 * Bug original: se podía dejar una venta en "Revisar por promotor" sin decirle al
 * promotor qué corregir — la columna RAZÓN quedaba en "—" y su TPV en rojo sin
 * instrucciones.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditSaleDialog } from './EditSaleDialog'
import type { OrgSaleRow } from '@/services/saleVerification.org.service'

const editMock = vi.fn().mockResolvedValue({})
vi.mock('@/services/saleVerification.org.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.org.service')>()),
  editOrgSaleVerification: (...args: unknown[]) => editMock(...args),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const row = {
  id: 'sv-1',
  status: 'PENDING',
  serialNumbers: ['8952140064479454713F'],
  saleType: 'LINEA_NUEVA',
  venue: { name: 'BAE MEZQUITAL' },
  payment: { amount: 0, paymentForm: 'OTHER' },
} as unknown as OrgSaleRow

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <EditSaleDialog open row={row} orgId="org-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

function renderDialogFor(rowOverride: OrgSaleRow) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <EditSaleDialog open row={rowOverride} orgId="org-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

/** El Select de Radix necesita abrirse antes de poder elegir la opción. */
async function selectRevisarPorPromotor() {
  const triggers = screen.getAllByRole('combobox')
  fireEvent.keyDown(triggers[triggers.length - 1], { key: 'Enter' })
  fireEvent.click(await screen.findByText('Revisar por promotor'))
}

beforeEach(() => editMock.mockClear())

describe('EditSaleDialog — candado "Revisar por promotor"', () => {
  it('no muestra el bloque de revisión mientras el estado no sea "Revisar por promotor"', () => {
    renderDialog()
    expect(screen.queryByText(/motivos de revisión/i)).not.toBeInTheDocument()
  })

  it('despliega el bloque de revisión al elegir "Revisar por promotor"', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    expect(await screen.findByText(/motivos de revisión/i)).toBeInTheDocument()
    expect(screen.getByText(/observaciones/i)).toBeInTheDocument()
  })

  it('bloquea el guardado si no hay observación para el promotor', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    await screen.findByText(/motivos de revisión/i)
    fireEvent.change(screen.getByPlaceholderText(/explica por qué editas/i), {
      target: { value: 'Corrección de documentación' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/mínimo 5 caracteres/i)).toBeInTheDocument()
    expect(editMock).not.toHaveBeenCalled()
  })

  it('manda reviewNotes y rejectionReasons cuando el estado es "Revisar por promotor"', async () => {
    renderDialog()
    await selectRevisarPorPromotor()
    await screen.findByText(/motivos de revisión/i)
    fireEvent.change(screen.getByPlaceholderText(/explica por qué editas/i), {
      target: { value: 'Corrección de documentación' },
    })
    fireEvent.change(screen.getByPlaceholderText(/qué debe corregir el promotor/i), {
      target: { value: 'Falta la imagen de vinculación' },
    })
    fireEvent.click(screen.getByLabelText(/falta imagen de vinculación/i))
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(editMock).toHaveBeenCalled())
    expect(editMock.mock.calls[0][2]).toMatchObject({
      status: 'FAILED',
      reviewNotes: 'Falta la imagen de vinculación',
      rejectionReasons: ['REVIEW_MISSING_LINKING_IMAGE'],
    })
  })

  it('conserva las instrucciones existentes al editar una venta que ya está FAILED', async () => {
    renderDialogFor({
      ...row,
      status: 'FAILED',
      reviewNotes: 'Corrige la imagen de portabilidad',
      rejectionReasons: ['REVIEW_PORTABILIDAD'],
    } as OrgSaleRow)

    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: '100' } })
    fireEvent.change(screen.getByPlaceholderText(/explica por qué editas/i), {
      target: { value: 'Corrección del monto capturado' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(editMock).toHaveBeenCalledTimes(1))
    expect(editMock.mock.calls[0][2]).toMatchObject({
      amount: 100,
      status: 'FAILED',
      reviewNotes: 'Corrige la imagen de portabilidad',
      rejectionReasons: ['REVIEW_PORTABILIDAD'],
    })
  })
})
