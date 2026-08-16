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

// 🔴 El import va DESPUÉS de los mocks a propósito: `vi.mock` se iza, pero su
// factory corre al importar el módulo. Si el componente se importara arriba, las
// consts `mockPut`/`mockCan` aún no existirían (TDZ) y el archivo reventaría.
// Mismo patrón que CashReconciliationSetting.test.tsx.
import { ManagerPinOverrideSetting } from './ManagerPinOverrideSetting'

function renderSetting(storedSetting = false) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ManagerPinOverrideSetting venueId="venue-1" storedSetting={storedSetting} />
    </QueryClientProvider>,
  )
  return { ...view, invalidateSpy }
}

describe('ManagerPinOverrideSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockImplementation((permission: string) => permission === 'venues:update')
    mockPut.mockResolvedValue({ data: { managerPinOverrideEnabled: true } })
  })

  it('nace apagado y manda el booleano exacto al prenderlo', async () => {
    const { invalidateSpy } = renderSetting(false)

    const toggle = screen.getByRole('switch', { name: 'edit.managerPinOverride.switchLabel' })
    expect(toggle).not.toBeChecked()

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', {
        managerPinOverrideEnabled: true,
      }),
    )
    expect(toggle).toBeChecked()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['get-venue-data', 'venue-1'] })
  })

  it('se puede apagar', async () => {
    renderSetting(true)

    fireEvent.click(screen.getByRole('switch', { name: 'edit.managerPinOverride.switchLabel' }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', {
        managerPinOverrideEnabled: false,
      }),
    )
  })

  it('🔴 es core: se ve y se puede prender sin ningún gate de plan', () => {
    renderSetting(false)

    // Se renderiza sin que ningún hook de tier esté mockeado — si el componente
    // dependiera de `useTierFeatureAccess`, este test no llegaría hasta aquí.
    expect(screen.getByText('edit.managerPinOverride.title')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'edit.managerPinOverride.switchLabel' })).toBeEnabled()
  })

  it('sin permiso venues:update el switch queda deshabilitado y no manda nada', () => {
    mockCan.mockReturnValue(false)
    renderSetting(false)

    const toggle = screen.getByRole('switch', { name: 'edit.managerPinOverride.switchLabel' })
    expect(toggle).toBeDisabled()

    fireEvent.click(toggle)
    expect(mockPut).not.toHaveBeenCalled()
    expect(screen.getByText('edit.managerPinOverride.readOnly')).toBeInTheDocument()
  })

  it('revierte el switch si el PUT falla', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 500 } })
    renderSetting(false)

    const toggle = screen.getByRole('switch', { name: 'edit.managerPinOverride.switchLabel' })
    fireEvent.click(toggle)

    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })
})
