import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PagoDeClaseCard } from '../components/PagoDeClaseCard'
import { NivelDePagoSection } from '@/pages/Team/components/NivelDePagoSection'

const m = vi.hoisted(() => ({
  pay: vi.fn(),
  adjust: vi.fn(),
  assign: vi.fn(),
  modalNivel: vi.fn(),
  can: vi.fn(),
  access: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.can(p) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }),
}))
// El modal de pantalla completa real es Radix con portal; aquí sólo importa su contenido y sus acciones.
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) =>
    open ? (
      <div>
        {actions}
        {children}
      </div>
    ) : null,
}))
// Select nativo: el de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select aria-label="nivel" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/pages/StaffPay/components/AsignarNivelModal', () => ({
  AsignarNivelModal: (p: any) => {
    m.modalNivel(p)
    return <div data-testid="asignar-nivel-modal">{p.payLevelName}</div>
  },
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: (enabled?: boolean) => m.access(enabled),
  useClassPay: (...a: unknown[]) => m.pay(...a),
  useAdjustClass: () => ({ mutateAsync: m.adjust, isPending: false }),
  useStaffPayLevels: () => ({
    data: [
      { id: 'l1', name: 'Coach', sortOrder: 0, archivedAt: null },
      { id: 'l2', name: 'Head Coach', sortOrder: 1, archivedAt: null },
    ],
    isLoading: false,
  }),
  useStaffPayAssignments: () => ({
    data: [{ staffId: 'st1', payLevelId: 'l1', payLevelName: 'Coach', effectiveFrom: '2026-09-01' }],
    isLoading: false,
  }),
  useAssignLevel: () => ({ mutate: m.assign, mutateAsync: m.assign }),
}))

const conRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

const pago = (extra: Record<string, unknown> = {}) => ({
  classSessionId: 's1',
  estado: 'OK',
  motivo: null,
  monto: '570.00',
  conteo: 8,
  conteoCalculado: 8,
  maxCount: 10,
  countMode: 'BOOKED',
  staffName: 'Ana',
  payLevelName: 'Head Coach',
  ajuste: null,
  anclada: false,
  ...extra,
})

const prenderPermisos = () => {
  m.can.mockReturnValue(true)
  // Igual que react-query: deshabilitado ⇒ sin datos.
  m.access.mockImplementation((enabled = true) => ({ data: enabled ? { enabled: true } : undefined }))
}

describe('PagoDeClaseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prenderPermisos()
  })

  it('muestra monto y conteo', () => {
    m.pay.mockReturnValue({
      data: {
        estado: 'OK',
        monto: '570.00',
        conteo: 8,
        maxCount: 10,
        countMode: 'BOOKED',
        staffName: 'Ana',
        payLevelName: 'Head Coach',
        ajuste: null,
      },
    })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText(/570/)).toBeInTheDocument()
    expect(screen.getByText(/classCard.seats/)).toHaveTextContent('"count":8')
    // El modo de conteo va junto al conteo (spec §7.2).
    expect(screen.getByText(/classCard\.mode\.BOOKED/)).toBeInTheDocument()
  })

  it('sin staffpay:read no pregunta nada al servidor y no pinta nada', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:read' && p !== 'staffpay:manage')
    m.pay.mockReturnValue({ data: undefined })
    const { container } = conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(m.access).toHaveBeenCalled()
    expect(m.access.mock.calls.every(([enabled]) => enabled === false)).toBe(true)
    expect(m.pay.mock.calls.every(([, enabled]) => enabled === false)).toBe(true)
    expect(container).toBeEmptyDOMElement()
  })

  it('con «No se paga» prendido, un conteo inválido ya no bloquea guardar', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.exclude' }))
    fireEvent.change(screen.getByLabelText('adjust.count'), { target: { value: '9.5' } })
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'Clase interna' } })
    expect(screen.getByRole('button', { name: 'adjust.save' })).toBeEnabled()
  })

  it('una excepción se explica con su motivo', () => {
    m.pay.mockReturnValue({ data: { estado: 'EXCEPCION', motivo: 'COACH_SIN_NIVEL', monto: null, conteo: 2, maxCount: 10, ajuste: null } })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    expect(screen.getByText('reasons.COACH_SIN_NIVEL')).toBeInTheDocument()
  })

  it('el ajuste no se puede guardar hasta que el motivo tenga 3 letras', () => {
    m.pay.mockReturnValue({ data: pago() })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.fixCount' }))
    const guardar = screen.getByRole('button', { name: 'adjust.save' })
    expect(guardar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('adjust.count'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'ab' } })
    expect(guardar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'abc' } })
    expect(guardar).toBeEnabled()
    fireEvent.click(guardar)
    expect(m.adjust).toHaveBeenCalledWith({ payCountOverride: 9, payAmountOverride: null, payExcluded: false, reason: 'abc' })
  })

  it('una clase sin coach se resuelve con «No se paga esta clase»', () => {
    m.pay.mockReturnValue({ data: pago({ estado: 'EXCEPCION', motivo: 'SIN_COACH', monto: null, staffName: null, payLevelName: null }) })
    conRouter(<PagoDeClaseCard sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'classCard.exclude' }))
    fireEvent.change(screen.getByLabelText('adjust.reason'), { target: { value: 'Clase de prueba interna' } })
    fireEvent.click(screen.getByRole('button', { name: 'adjust.save' }))
    expect(m.adjust).toHaveBeenCalledWith({
      payCountOverride: null,
      payAmountOverride: null,
      payExcluded: true,
      reason: 'Clase de prueba interna',
    })
  })
})

describe('NivelDePagoSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prenderPermisos()
  })

  it('elegir otro nivel abre la confirmación con su vista previa; no asigna directo', () => {
    render(<NivelDePagoSection staffId="st1" staffName="Ana López" />)
    expect(screen.queryByTestId('asignar-nivel-modal')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('nivel'), { target: { value: 'l2' } })
    expect(screen.getByTestId('asignar-nivel-modal')).toHaveTextContent('Head Coach')
    expect(m.modalNivel).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: 'st1', payLevelId: 'l2', staffName: 'Ana López' }))
    expect(m.assign).not.toHaveBeenCalled()
  })
})
