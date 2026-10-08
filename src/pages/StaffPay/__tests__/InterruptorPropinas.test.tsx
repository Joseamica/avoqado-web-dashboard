import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterruptorPropinas } from '../components/InterruptorPropinas'

const m = vi.hoisted(() => ({ tips: vi.fn(), can: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/useStaffPay', () => ({ useSetTips: () => ({ mutateAsync: m.tips, isPending: false }) }))
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: any) => (open ? <div role="alertdialog">{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <>{children}</>,
  AlertDialogHeader: ({ children }: any) => <>{children}</>,
  AlertDialogFooter: ({ children }: any) => <>{children}</>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogCancel: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  AlertDialogAction: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  m.can.mockReturnValue(true)
})

describe('InterruptorPropinas (decisión D2, spec §11)', () => {
  it('apagado de fábrica, con su explicación; prender pide confirmar y dice qué pasa', async () => {
    m.tips.mockResolvedValue({ encendidas: true })
    render(<InterruptorPropinas encendidas={false} />)
    expect(screen.getByText('tips.help')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'tips.label' }))
    expect(m.tips).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('tips.onHelp')
    fireEvent.click(screen.getByRole('button', { name: 'tips.onConfirm' }))
    await waitFor(() => expect(m.tips).toHaveBeenCalledWith(true))
    expect(m.toast).toHaveBeenCalledWith({ title: 'tips.turnedOn' })
  })

  // E6a-fix F12, hermano de «Activar pago al personal» (QA H9): cada clic abre o cierra una ventana de propinas.
  it('🔴 dos clics seguidos en confirmar mandan UN solo cambio (candado síncrono)', () => {
    m.tips.mockReturnValue(new Promise(() => undefined))
    render(<InterruptorPropinas encendidas={false} />)
    fireEvent.click(screen.getByRole('switch', { name: 'tips.label' }))
    const confirmar = screen.getByRole('button', { name: 'tips.onConfirm' })
    fireEvent.click(confirmar)
    fireEvent.click(confirmar)
    expect(m.tips).toHaveBeenCalledTimes(1)
  })

  it('apagar explica que lo que ya ganó el derecho a entrar no se pierde', () => {
    render(<InterruptorPropinas encendidas />)
    fireEvent.click(screen.getByRole('switch', { name: 'tips.label' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('tips.offHelp')
  })

  it('sin staffpay:close se ve pero no se mueve, y dice por qué', () => {
    m.can.mockReturnValue(false)
    render(<InterruptorPropinas encendidas={false} />)
    expect(screen.getByRole('switch', { name: 'tips.label' })).toBeDisabled()
    expect(screen.getByText('tips.noPermission')).toBeInTheDocument()
  })

  it('si el servidor no lo cambia, lo dice y el interruptor se queda como estaba (sin red: online-only)', async () => {
    m.tips.mockRejectedValue({ response: { status: 403, data: { message: 'No tienes permiso en la sede Norte' } } })
    render(<InterruptorPropinas encendidas={false} />)
    fireEvent.click(screen.getByRole('switch', { name: 'tips.label' }))
    fireEvent.click(screen.getByRole('button', { name: 'tips.onConfirm' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'No tienes permiso en la sede Norte', variant: 'destructive' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('switch', { name: 'tips.label' })).not.toBeChecked()
  })
})
