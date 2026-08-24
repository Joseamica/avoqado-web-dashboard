import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CustomersAwaitingApproval } from '../CustomersAwaitingApproval'
import type { CustomersAwaitingApprovalResponse } from '@/types/customer'

// t devuelve la clave: los textos se prueban por i18n, no por copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d }) }))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// 🔴 La ruta real del módulo es `use-access` (con guiones). Hay otro test en este repo que
// mockea `useAccess` y por eso su mock no surte efecto — no repetir ese error.
const mockCan = vi.fn()
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: mockCan, canAny: () => true, canAll: () => true, role: 'OWNER' }),
}))
vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockGetAwaiting = vi.fn()
const mockDecide = vi.fn()
vi.mock('@/services/customer.service', () => ({
  default: {
    getCustomersAwaitingApproval: (...a: unknown[]) => mockGetAwaiting(...a),
    decideCustomerApproval: (...a: unknown[]) => mockDecide(...a),
  },
}))

/**
 * 🔴 Fixture TIPADO a propósito.
 *
 * La primera versión de este test usaba un objeto suelto, y por eso NO cazó que la respuesta
 * estaba tipada con la meta de las listas viejas (`totalCount`) mientras el server devuelve
 * `{ page, pageSize, total }`: el conteo salía `undefined` en pantalla y el repo ni siquiera
 * compilaba. Con el tipo puesto aquí, ese desajuste rompe el test antes que la pantalla.
 */
const RESPONSE_FIXTURE: CustomersAwaitingApprovalResponse = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
}

const ANA = {
  id: 'cust-1',
  firstName: 'Ana',
  lastName: 'López',
  email: 'ana@test.com',
  phone: null,
  approvalStatus: 'PENDING' as const,
  approvalVersion: 2,
  approvalRequestedAt: '2026-09-01T10:00:00.000Z',
  accountActivatedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
}

function renderTray() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CustomersAwaitingApproval venueId="venue-1" />
    </QueryClientProvider>,
  )
}

describe('CustomersAwaitingApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockReturnValue(true)
    mockGetAwaiting.mockResolvedValue({ ...RESPONSE_FIXTURE, data: [ANA], meta: { ...RESPONSE_FIXTURE.meta, total: 1 } })
    mockDecide.mockResolvedValue({ approvalStatus: 'APPROVED', approvalVersion: 3, changed: true })
  })

  it('🔴 sin el permiso `customers:approve` no consulta ni pinta nada', async () => {
    mockCan.mockReturnValue(false)

    const { container } = renderTray()

    await waitFor(() => expect(container).toBeEmptyDOMElement())
    // No basta con ocultar la UI: el endpoint respondería 403 y ensuciaría la consola.
    expect(mockGetAwaiting).not.toHaveBeenCalled()
  })

  it('🔴 sin nadie esperando no se pinta: no es una sección permanente', async () => {
    mockGetAwaiting.mockResolvedValue(RESPONSE_FIXTURE)

    const { container } = renderTray()

    await waitFor(() => expect(mockGetAwaiting).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lista a quien espera, con su nombre y su contacto', async () => {
    renderTray()

    expect(await screen.findByText('Ana López')).toBeDefined()
    expect(screen.getByText('ana@test.com')).toBeDefined()
  })

  it('🔴 aprobar manda el `expectedVersion` DE LA FILA, no un número inventado', async () => {
    renderTray()
    const user = userEvent.setup()

    await user.click(await screen.findByText('approval.actions.approve'))

    await waitFor(() =>
      expect(mockDecide).toHaveBeenCalledWith('venue-1', 'cust-1', expect.objectContaining({ decision: 'APPROVED', expectedVersion: 2 })),
    )
  })

  it('🔴 un 409 se explica como "alguien más ya decidió", no como error genérico', async () => {
    mockDecide.mockRejectedValue({ response: { status: 409, data: { message: 'conflict' } } })
    renderTray()
    const user = userEvent.setup()

    await user.click(await screen.findByText('approval.actions.approve'))

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'approval.toasts.conflict' })))
  })

  it('🔴 tras un 409 el diálogo de rechazo se CIERRA: la decisión ajena ya es la buena', async () => {
    mockDecide.mockRejectedValue({ response: { status: 409, data: { message: 'conflict' } } })
    renderTray()
    const user = userEvent.setup()

    await user.click(await screen.findByText('approval.actions.reject'))
    expect(await screen.findByPlaceholderText('approval.reject.placeholder')).toBeDefined()

    const rejectButtons = screen.getAllByText('approval.actions.reject')
    await user.click(rejectButtons[rejectButtons.length - 1])

    // Sin esto, el usuario se queda mirando un formulario que ya no aplica a nadie.
    await waitFor(() => expect(screen.queryByPlaceholderText('approval.reject.placeholder')).toBeNull())
  }, 20000)

  // Timeout explícito: `user.type` escribe letra por letra y con la máquina cargada se pasa
  // de los 5 s por default de vitest. El motivo es corto por la misma razón.
  it('🔴 rechazar pide motivo y lo manda: ese texto es el que le llega al cliente por correo', async () => {
    renderTray()
    const user = userEvent.setup()

    await user.click(await screen.findByText('approval.actions.reject'))
    const textarea = await screen.findByPlaceholderText('approval.reject.placeholder')
    await user.type(textarea, 'Cupo lleno')

    // El botón del diálogo es el segundo con esa clave (el de la fila sigue montado).
    const rejectButtons = screen.getAllByText('approval.actions.reject')
    await user.click(rejectButtons[rejectButtons.length - 1])

    await waitFor(() =>
      expect(mockDecide).toHaveBeenCalledWith(
        'venue-1',
        'cust-1',
        expect.objectContaining({ decision: 'REJECTED', reason: 'Cupo lleno', expectedVersion: 2 }),
      ),
    )
  }, 20000)
})
