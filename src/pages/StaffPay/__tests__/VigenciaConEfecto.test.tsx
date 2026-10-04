import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AsignarNivelModal } from '../components/AsignarNivelModal'
import { PublicarTablaModal } from '../components/PublicarTablaModal'

const m = vi.hoisted(() => ({ assign: vi.fn(), publish: vi.fn(), periodos: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) =>
    open ? (
      <div>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useAssignLevel: () => ({ mutateAsync: m.assign }),
  usePublishTable: () => ({ mutateAsync: m.publish }),
  useStaffPayPeriods: (enabled: boolean) => m.periodos(enabled),
}))

const pintar = () =>
  render(
    <AsignarNivelModal
      open
      onOpenChange={vi.fn()}
      staffId="s1"
      staffName="Ana"
      payLevelId="hc"
      payLevelName="Head Coach"
      hoy="2026-10-03"
    />,
  )
const aviso = () => screen.findByText(/^vigencia\.(effect|effectNone|effectWithOlder|effectOnlyOlder|effectTotal)/)
const SEP = { start: '2026-09-01', end: '2026-09-30' }
const OCT = { start: '2026-10-01', end: '2026-10-31' }

beforeEach(() => {
  vi.clearAllMocks()
  m.periodos.mockReturnValue({ data: undefined })
})

describe('vigencia de un nivel o una tabla (revisión final I-2)', () => {
  it('dos periodos abiertos: «12 clases en septiembre de 2026 y 3 en octubre de 2026», y los cerrados no cambian', async () => {
    m.assign.mockResolvedValue({
      clasesQueCambian: 15,
      porPeriodo: [
        { ...SEP, clases: 12 },
        { ...OCT, clases: 3 },
      ],
      periodosSinContar: 0,
    })
    pintar()
    const texto = await aviso()
    expect(texto).toHaveTextContent(
      'vigencia.effect:{"lista":"vigencia.list:{\\"inicio\\":\\"vigencia.part:{\\\\\\"count\\\\\\":12,\\\\\\"periodo\\\\\\":\\\\\\"septiembre de 2026\\\\\\"}\\",\\"ultimo\\":\\"vigencia.partMore:{\\\\\\"count\\\\\\":3,\\\\\\"periodo\\\\\\":\\\\\\"octubre de 2026\\\\\\"}\\"}"}',
    )
    expect(texto.parentElement).toHaveTextContent('vigencia.closedUnchanged')
    // La simulación es lo único que se pide al abrir (enabled=false para la lista de periodos: sin petición nueva).
    expect(m.assign).toHaveBeenCalledWith({ staffId: 's1', payLevelId: 'hc', effectiveFrom: '2026-10-03', simular: true })
    expect(m.periodos).toHaveBeenCalledWith(false)
  })

  it('un periodo con clases (los de 0 no se nombran): «3 clases de octubre de 2026»', async () => {
    m.assign.mockResolvedValue({
      clasesQueCambian: 3,
      porPeriodo: [
        { ...SEP, clases: 0 },
        { ...OCT, clases: 3 },
      ],
      periodosSinContar: 0,
    })
    pintar()
    expect(await aviso()).toHaveTextContent('vigencia.effect:{"lista":"vigencia.part:{\\"count\\":3,\\"periodo\\":\\"octubre de 2026\\"}"}')
  })

  it('total 0: «No cambia el pago de ninguna clase todavía»', async () => {
    m.assign.mockResolvedValue({ clasesQueCambian: 0, porPeriodo: [{ ...OCT, clases: 0 }], periodosSinContar: 0 })
    pintar()
    expect(await aviso()).toHaveTextContent('vigencia.effectNone')
  })

  it('con periodos abiertos más viejos SIN contar, no afirma que cambian: dice que no se contaron y que pueden cambiar', async () => {
    m.assign.mockResolvedValue({ clasesQueCambian: 3, porPeriodo: [{ ...OCT, clases: 3 }], periodosSinContar: 2 })
    pintar()
    const texto = await aviso()
    expect(texto).toHaveTextContent(/^vigencia\.effect:/)
    expect(texto.parentElement).toHaveTextContent('vigencia.notCountedMonths:{"count":2}')
  })

  it('una fecha en un periodo cerrado: el mensaje del server en línea, botón apagado, «min» y el atajo a la primera fecha', async () => {
    m.assign.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'FECHA_EN_PERIODO_CERRADO',
          message: 'Agosto ya se cerró: el nivel no puede empezar antes del 1 sep 2026.',
          details: { primeraFechaPermitida: '2026-09-01' },
        },
      },
    })
    pintar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Agosto ya se cerró: el nivel no puede empezar antes del 1 sep 2026.')
    expect(m.toast).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeDisabled()
    expect(screen.getByLabelText('assign.effectiveFrom')).toHaveAttribute('min', '2026-09-01')
    m.assign.mockResolvedValue({ clasesQueCambian: 12, porPeriodo: [{ ...SEP, clases: 12 }], periodosSinContar: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'vigencia.useDate:{"fecha":"dia(2026-09-01)"}' }))
    expect(screen.getByLabelText('assign.effectiveFrom')).toHaveValue('2026-09-01')
    await waitFor(() => expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con la lista de periodos en caché, el «min» ya está desde el principio y una fecha cerrada se explica', async () => {
    m.periodos.mockReturnValue({
      data: {
        periodicidad: 'MONTHLY',
        items: [
          { start: '2026-10-01', end: '2026-10-31', estado: 'OPEN' },
          { start: '2026-08-01', end: '2026-08-31', estado: 'CLOSED' },
          { start: '2026-07-01', end: '2026-07-31', estado: 'CLOSED' },
        ],
      },
    })
    m.assign.mockResolvedValue({ clasesQueCambian: 0, porPeriodo: [], periodosSinContar: 0 })
    pintar()
    expect(screen.getByLabelText('assign.effectiveFrom')).toHaveAttribute('min', '2026-09-01')
    // Una fecha DENTRO de un mes cerrado de la lista no se deja confirmar, y se explica (aunque el server aún no conteste).
    fireEvent.change(screen.getByLabelText('assign.effectiveFrom'), { target: { value: '2026-08-15' } })
    expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('vigencia.closedLocal:{"periodo":"agosto de 2026","fecha":"dia(2026-09-01)"}')
    fireEvent.click(screen.getByRole('button', { name: 'vigencia.useDate:{"fecha":"dia(2026-09-01)"}' }))
    expect(screen.getByLabelText('assign.effectiveFrom')).toHaveValue('2026-09-01')
  })

  it('cerrados fuera de orden (agosto cerrado, septiembre abierto, octubre cerrado): septiembre NO se bloquea; octubre sí, explicado', async () => {
    m.periodos.mockReturnValue({
      data: {
        periodicidad: 'MONTHLY',
        items: [
          { start: '2026-11-01', end: '2026-11-30', estado: 'OPEN' },
          { start: '2026-10-01', end: '2026-10-31', estado: 'CLOSED' },
          { start: '2026-09-01', end: '2026-09-30', estado: 'OPEN' },
          { start: '2026-08-01', end: '2026-08-31', estado: 'CLOSED' },
        ],
      },
    })
    m.assign.mockResolvedValue({ clasesQueCambian: 4, porPeriodo: [{ ...SEP, clases: 4 }], periodosSinContar: 0 })
    render(
      <AsignarNivelModal
        open
        onOpenChange={vi.fn()}
        staffId="s1"
        staffName="Ana"
        payLevelId="hc"
        payLevelName="Head Coach"
        hoy="2026-11-03"
      />,
    )
    // Con un mes abierto ANTES del último cerrado, la lista no impone su mínimo (el server sí acepta septiembre): sólo queda
    // la orilla del rango del contrato (hoy − 24 meses).
    expect(screen.getByLabelText('assign.effectiveFrom')).toHaveAttribute('min', '2024-11-03')
    fireEvent.change(screen.getByLabelText('assign.effectiveFrom'), { target: { value: '2026-09-15' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('assign.effectiveFrom'), { target: { value: '2026-10-10' } })
    expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('vigencia.closedLocal:{"periodo":"octubre de 2026","fecha":"dia(2026-11-01)"}')
  })

  it('fuera del rango del contrato (hoy ± 24 meses): no se simula, botón apagado, se explica y el atajo lleva a la orilla (A11)', async () => {
    m.assign.mockResolvedValue({ clasesQueCambian: 0, porPeriodo: [], periodosSinContar: 0 })
    pintar()
    await aviso()
    const input = screen.getByLabelText('assign.effectiveFrom')
    expect(input).toHaveAttribute('min', '2024-10-03')
    expect(input).toHaveAttribute('max', '2028-10-03')
    const llamadas = m.assign.mock.calls.length
    fireEvent.change(input, { target: { value: '1900-01-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent('vigencia.outOfRange:{"desde":"dia(2024-10-03)","hasta":"dia(2028-10-03)"}')
    expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeDisabled()
    expect(m.assign.mock.calls.length).toBe(llamadas)
    fireEvent.click(screen.getByRole('button', { name: 'vigencia.useDate:{"fecha":"dia(2024-10-03)"}' }))
    expect(input).toHaveValue('2024-10-03')
    fireEvent.change(input, { target: { value: '2999-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'vigencia.useDate:{"fecha":"dia(2028-10-03)"}' }))
    expect(input).toHaveValue('2028-10-03')
  })

  it('el 400 FECHA_FUERA_DE_RANGO del server se explica en línea, igual que el de un periodo cerrado', async () => {
    m.assign.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'FECHA_FUERA_DE_RANGO',
          message: 'La vigencia debe estar entre el 3 oct 2024 y el 3 oct 2028',
          details: { desde: '2024-10-03', hasta: '2028-10-03' },
        },
      },
    })
    pintar()
    expect(await screen.findByRole('alert')).toHaveTextContent('La vigencia debe estar entre el 3 oct 2024 y el 3 oct 2028')
    expect(m.toast).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'assign.confirm' })).toBeDisabled()
  })

  it('«meses» o «periodos» sale de la periodicidad de la lista, también sin periodos en la simulación', async () => {
    m.periodos.mockReturnValue({ data: { periodicidad: 'SEMIMONTHLY', items: [] } })
    m.assign.mockResolvedValue({ clasesQueCambian: 0, porPeriodo: [], periodosSinContar: 0 })
    pintar()
    expect((await aviso()).parentElement).toHaveTextContent('vigencia.closedUnchangedPeriods')
  })

  it('al publicar una tabla: mismo aviso, y un 400 al GUARDAR también se explica en línea (no en un aviso genérico)', async () => {
    m.publish.mockImplementation(async (b: { simular?: boolean }) => {
      if (b.simular) return { clasesQueCambian: 3, porPeriodo: [{ ...OCT, clases: 3 }], periodosSinContar: 0 }
      throw {
        response: {
          status: 400,
          data: { code: 'FECHA_EN_PERIODO_CERRADO', message: 'Septiembre ya se cerró.', details: { primeraFechaPermitida: '2026-10-01' } },
        },
      }
    })
    render(<PublicarTablaModal open onOpenChange={vi.fn()} tableId="t1" maxCount={10} grid={{}} hoy="2026-10-03" />)
    await aviso()
    fireEvent.click(screen.getByRole('button', { name: 'publish.confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Septiembre ya se cerró.')
    expect(m.toast).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'publish.confirm' })).toBeDisabled()
  })
})
