import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPut = vi.fn()
const mockToast = vi.fn()
const mockCan = vi.fn()

vi.mock('@/api', () => ({ default: { put: (...args: unknown[]) => mockPut(...args) } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

// Import después de los mocks (mismo patrón que ManagerPinOverrideSetting.test.tsx).
import { DiscountReasonsSetting } from './DiscountReasonsSetting'

const URL = '/api/v1/dashboard/venues/venue-1/settings'

function renderSetting(storedRequired = false, storedReasons: string[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DiscountReasonsSetting venueId="venue-1" storedRequired={storedRequired} storedReasons={storedReasons} />
    </QueryClientProvider>,
  )
}

const elSwitch = () => screen.getByRole('switch', { name: 'edit.discountReasons.switchLabel' })

describe('DiscountReasonsSetting (encargo f998c8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockImplementation((p: string) => p === 'venues:update')
    mockPut.mockResolvedValue({ data: {} })
  })

  it('con la lista vacía el switch no se puede prender y lo explica', () => {
    renderSetting(false, [])
    expect(elSwitch()).toBeDisabled()
    expect(screen.getByText('edit.discountReasons.needsOne')).toBeInTheDocument()
  })

  it('agregar un motivo manda la lista limpia; luego el switch ya se puede prender', async () => {
    renderSetting(false, [])
    fireEvent.change(screen.getByLabelText('edit.discountReasons.newPlaceholder'), { target: { value: '  Queja   del cliente ' } })
    fireEvent.click(screen.getByText('edit.discountReasons.add'))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(URL, { discountReasons: ['Queja del cliente'] }))
    expect(screen.getByText('Queja del cliente')).toBeInTheDocument()
    await waitFor(() => expect(elSwitch()).not.toBeDisabled())
    fireEvent.click(elSwitch())
    await waitFor(() => expect(mockPut).toHaveBeenLastCalledWith(URL, { discountReasonRequired: true }))
  })

  it('un repetido (sin importar mayúsculas) no se manda y se explica', () => {
    renderSetting(false, ['Queja del cliente'])
    fireEvent.change(screen.getByLabelText('edit.discountReasons.newPlaceholder'), { target: { value: 'queja DEL cliente' } })
    expect(screen.getByText('edit.discountReasons.duplicate')).toBeInTheDocument()
    expect(screen.getByText('edit.discountReasons.add').closest('button')).toBeDisabled()
  })

  it('renombrar manda la lista con el nombre nuevo en su lugar', async () => {
    renderSetting(false, ['A', 'B'])
    fireEvent.click(screen.getAllByLabelText('edit.discountReasons.rename')[0])
    const input = screen.getByLabelText('edit.discountReasons.renameLabel')
    fireEvent.change(input, { target: { value: 'A nuevo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(URL, { discountReasons: ['A nuevo', 'B'] }))
  })

  it('prendido con un solo motivo: no se puede quitar y dice por qué', () => {
    renderSetting(true, ['A'])
    expect(screen.getByLabelText('edit.discountReasons.remove')).toBeDisabled()
    expect(screen.getAllByText('edit.discountReasons.lastOneHint').length).toBeGreaterThan(0)
  })

  it('si el SERVIDOR rechaza, la lista vuelve a como estaba y se ve su mensaje', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 400, data: { message: 'El motivo «A» está repetido.' } } })
    renderSetting(false, ['A'])
    fireEvent.change(screen.getByLabelText('edit.discountReasons.newPlaceholder'), { target: { value: 'B' } })
    fireEvent.click(screen.getByText('edit.discountReasons.add'))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'El motivo «A» está repetido.', variant: 'destructive' }),
      ),
    )
    expect(screen.queryByText('B')).not.toBeInTheDocument()
  })

  it('sin permiso: todo de sólo lectura', () => {
    mockCan.mockReturnValue(false)
    renderSetting(true, ['A', 'B'])
    expect(elSwitch()).toBeDisabled()
    expect(screen.queryByLabelText('edit.discountReasons.newPlaceholder')).not.toBeInTheDocument()
    expect(screen.getByText('edit.discountReasons.readOnly')).toBeInTheDocument()
  })
})
