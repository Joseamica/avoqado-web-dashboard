import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CerrarPeriodoModal } from '../components/CerrarPeriodoModal'

const m = vi.hoisted(() => ({ preview: vi.fn(), close: vi.fn(), refetch: vi.fn(), toast: vi.fn(), sedes: vi.fn(), can: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, title, children, actions }: { open: boolean; title: string; children: ReactNode; actions?: ReactNode }) =>
    open ? (
      <div>
        <header>
          <h2>{title}</h2>
          {actions}
        </header>
        {children}
      </div>
    ) : null,
}))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => (id === 'v1' ? 'Prado Norte' : id) }))
vi.mock('@/hooks/useStaffPay', () => ({
  useClosePreview: () => m.preview(),
  useClosePeriod: () => ({ mutateAsync: m.close, isPending: false }),
  useStaffPaySedes: (enabled?: boolean) => m.sedes(enabled),
}))
// El diálogo de E3c tiene sus propias pruebas: aquí sólo importa con qué sede y en qué modo se abre.
vi.mock('../components/ParticipacionSedeDialog', () => ({
  ParticipacionSedeDialog: ({ sede, accion, focoDeVuelta }: { sede: { venueId: string }; accion: string; focoDeVuelta?: string }) => (
    <div data-testid="participacion" data-foco={focoDeVuelta}>
      {accion} {sede.venueId}
    </div>
  ),
}))

const ok = { periodo: { id: null, start: '2026-08-01', end: '2026-08-31', venueIds: ['v1'] }, puedeCerrar: true, bloqueos: [], clases: 72, excluidas: 0, personas: 4, totalServicios: '36620.00', totalAjustes: '0.00', total: '36620.00', huerfanas: 0, huella: 'h1' }
beforeEach(() => {
  vi.clearAllMocks()
  m.sedes.mockReturnValue({ data: undefined })
  m.can.mockReturnValue(true)
})

describe('CerrarPeriodoModal', () => {
  it('dice qué va a pasar y confirma con la huella del preview', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockResolvedValue({ periodId: 'p1', yaCerrado: false })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('"count":72')
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('close.people')
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('Prado Norte')
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.close).toHaveBeenCalledWith({ fecha: '2026-08-15', huellaEsperada: 'h1', confirmarHuerfanas: false }))
  })

  it('doble clic síncrono en «Cerrar» manda UNA sola vez (candado síncrono)', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockReturnValue(new Promise(() => undefined))
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const boton = screen.getByRole('button', { name: 'close.confirm' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(m.close).toHaveBeenCalledTimes(1)
  })

  it('con el nombre del periodo, el botón dice qué se cierra («Cerrar agosto 2026»)', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" etiqueta="agosto 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByRole('button', { name: /close\.confirmNamed/ })).toHaveTextContent('agosto 2026')
  })

  it('nombra sólo las sedes donde hay dinero (sedesConDinero), no todo el alcance (QA defecto 8)', () => {
    m.preview.mockReturnValue({ data: { ...ok, periodo: { ...ok.periodo, venueIds: ['v1', 'v2'] }, sedesConDinero: ['v1'] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('"sedes":"Prado Norte"')
  })

  it('si ninguna sede del alcance trae dinero (sedesConDinero vacío), omite «en …» en vez de dejar «en : $X»', () => {
    m.preview.mockReturnValue({ data: { ...ok, sedesConDinero: [] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.willFreezeNoVenue/)).toHaveTextContent('"count":72')
    expect(screen.queryByText(/close\.willFreeze:/)).toBeNull()
  })

  it('los ajustes del cierre llevan el mismo «−» que la tabla (QA defecto 14)', () => {
    m.preview.mockReturnValue({ data: { ...ok, totalAjustes: '-150.00', total: '36470.00' }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.adjustmentsIncluded/)).toHaveTextContent('"total":"−$150.00"')
  })

  it('con bloqueos los explica y no deja confirmar', () => {
    m.preview.mockReturnValue({ data: { ...ok, puedeCerrar: false, bloqueos: [{ codigo: 'EXCEPCIONES', n: 2 }] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.block\.EXCEPCIONES/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
  })

  it('el bloqueo de excepciones lleva a la lista para resolverlas', () => {
    const verExcepciones = vi.fn()
    m.preview.mockReturnValue({ data: { ...ok, puedeCerrar: false, bloqueos: [{ codigo: 'EXCEPCIONES', n: 2 }] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} onVerExcepciones={verExcepciones} />)
    fireEvent.click(screen.getByRole('button', { name: 'period.seeExceptions' }))
    expect(verExcepciones).toHaveBeenCalled()
  })

  it('con reservas sin horario exige la casilla antes de confirmar', () => {
    m.preview.mockReturnValue({ data: { ...ok, huerfanas: 3 }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const confirmar = screen.getByRole('button', { name: 'close.confirm' })
    expect(confirmar).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirmar).not.toBeDisabled()
  })

  it('si los números cambiaron, avisa y vuelve a cargar el preview', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue({ response: { status: 409, data: { code: 'HUELLA_CAMBIO', message: 'Los números cambiaron' } } })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'close.changed' }))
  })

  it('otro rechazo del server (4xx) dice el motivo y recarga el preview para mostrar los bloqueos reales', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue({ response: { status: 403, data: { message: 'No tienes permiso en BSF' } } })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No tienes permiso en BSF', variant: 'destructive' }))
  })

  it('un error de red sólo avisa (no hay preview nuevo que pedir)', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue(new Error('Network Error'))
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.generic' })))
    expect(m.refetch).not.toHaveBeenCalled()
  })

  it('si el periodo ya estaba cerrado, lo dice con su total (no «Periodo cerrado» como si fuera nuevo)', async () => {
    const onCerrado = vi.fn()
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockResolvedValue({ periodId: 'p1', total: '36620.00', yaCerrado: true })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={onCerrado} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(onCerrado).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/close\.alreadyClosed.*36,620\.00/) }))
  })

  it('si el preview falla, dice por qué, deja reintentar y no deja cerrar', () => {
    m.preview.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Sin conexión con el servidor' } } }, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText('Sin conexión con el servidor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.refetch).toHaveBeenCalled()
  })

  it('en el celular el botón de confirmar va abajo y el título es corto: no se enciman (QA defecto 4)', () => {
    const ancho = window.innerWidth
    window.innerWidth = 390
    try {
      m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
      render(<CerrarPeriodoModal open fecha="2026-07-15" etiqueta="julio de 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
      const encabezado = screen.getByRole('banner')
      expect(encabezado).toHaveTextContent('close.titleLoading')
      expect(within(encabezado).queryByRole('button')).toBeNull()
      expect(screen.getByRole('button', { name: /close\.confirmNamed/ })).toHaveTextContent('julio de 2026')
    } finally {
      window.innerWidth = ancho
    }
  })

  it('en pantalla grande el botón sigue arriba y el título nombra el periodo', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-07-15" etiqueta="julio de 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
    const encabezado = screen.getByRole('banner')
    expect(encabezado).toHaveTextContent('close.titleNamed')
    expect(within(encabezado).getByRole('button', { name: /close\.confirmNamed/ })).toBeInTheDocument()
  })

  // ── Fase 3 (E5b): el cierre dice cuántas clases, comisiones y propinas congela, sede por sede (pantalla 3 del founder) ──
  const ventas = (extra: Record<string, unknown>) => ({ ...ok, reversos: 0, propinasSinDueno: { n: 0, total: '0.00' }, ...extra })
  /** El mock de `t` imprime `llave:{json}`: se lee el JSON de la llave (los textos anidados vienen escapados adentro). */
  const textoDe = (clave: string, dentro: HTMLElement = document.body) =>
    JSON.parse(within(dentro).getByText(new RegExp(`^${clave.replace(/\./g, '\\.')}:`)).textContent!.slice(clave.length + 1))

  it('nombra clases, comisiones y propinas (spec §11): «Se congelan 72 clases, 41 comisiones y 230 propinas»', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 41, propinas: 230 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const o = textoDe('close.willFreezeSales')
    expect(o.count).toBe(343)
    expect(o.lista).toBe('close.classes:{"count":72}, close.commissions:{"count":41} y close.tips:{"count":230}')
    expect(o.sedes).toBe('Prado Norte')
  })

  it('un tipo en cero no se nombra: un salón sin clases sólo congela comisiones', () => {
    m.preview.mockReturnValue({ data: ventas({ clases: 0, personas: 2, comisiones: 5, propinas: 0 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.willFreezeSales').lista).toBe('close.commissions:{"count":5}')
  })

  it('una cafetería que sólo reparte propinas: «Se congelan 12 propinas», no «0 clases»', () => {
    m.preview.mockReturnValue({ data: ventas({ clases: 0, personas: 3, comisiones: 0, propinas: 12 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const o = textoDe('close.willFreezeSales')
    expect(o.lista).toBe('close.tips:{"count":12}')
    expect(o.count).toBe(12)
  })

  // E6a-fix F5 (E5b duda 1): un periodo con sólo ajustes (o sólo anuladas) no dice «Se congelan 0 clases de 1 persona…».
  it('🔴 sólo ajustes: «Se congelan los recibos de 1 persona…», sin nombrar «0 clases»', () => {
    m.preview.mockReturnValue({
      data: ventas({ clases: 0, personas: 1, comisiones: 0, propinas: 0, totalServicios: '0.00', totalAjustes: '-100.00', total: '-100.00' }),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.queryByText(/close\.willFreeze(NoVenue)?:/)).toBeNull()
    expect(screen.queryByText(/close\.classes/)).toBeNull()
    const o = textoDe('close.willFreezeReceipts')
    expect(o).toMatchObject({ personas: 'close.people:{"count":1}', sedes: 'Prado Norte', total: '−$100.00' })
    expect(o.count).toBe(1)
    expect(screen.getByText(/close\.adjustmentsIncluded/)).toBeInTheDocument()
  })

  it('🔴 sólo ajustes en una sede que ya salió del alcance: la misma frase sin «en …»', () => {
    m.preview.mockReturnValue({
      data: ventas({ clases: 0, personas: 2, comisiones: 0, propinas: 0, totalAjustes: '50.00', total: '50.00', sedesConDinero: [] }),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.willFreezeReceiptsNoVenue')).toMatchObject({ personas: 'close.people:{"count":2}', count: 2 })
  })

  it('sólo comisiones (sin clases ni propinas): nombra sólo las comisiones', () => {
    m.preview.mockReturnValue({ data: ventas({ clases: 0, personas: 1, comisiones: 1, propinas: 0 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const o = textoDe('close.willFreezeSales')
    expect(o.lista).toBe('close.commissions:{"count":1}')
    expect(o.count).toBe(1)
    expect(screen.queryByText(/close\.willFreezeReceipts/)).toBeNull()
  })

  it('sin sedes con dinero, la frase con ventas omite «en …» (como la de clases)', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 2, sedesConDinero: [] }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.willFreezeSalesNoVenue').count).toBe(74)
  })

  it('avisa de las propinas sin persona y de las comisiones anuladas, sin bloquear el cierre', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 3, propinas: 10, reversos: 2, propinasSinDueno: { n: 3, total: '240.00' } }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.tipsWithoutOwner/)).toHaveTextContent('"count":3')
    expect(textoDe('close.tipsWithoutOwner').total).toBe('$240.00')
    expect(screen.getByText(/close\.reversals/)).toHaveTextContent('"count":2')
    expect(screen.getByRole('button', { name: 'close.confirm' })).not.toBeDisabled()
  })

  it('sin propinas sin persona ni anuladas no hay avisos de más', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 3 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.queryByText(/close\.tipsWithoutOwner/)).toBeNull()
    expect(screen.queryByText(/close\.reversals/)).toBeNull()
    expect(screen.queryByText(/close\.commissionsToReview/)).toBeNull()
  })

  it('cobros o devoluciones con comisión por revisar: avisa en ámbar y no bloquea (resolución 16)', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 3, comisionesPorRevisar: 2 }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const aviso = screen.getByText(/close\.commissionsToReview/)
    expect(aviso).toHaveTextContent('"count":2')
    expect(aviso.closest('[role="note"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'close.confirm' })).not.toBeDisabled()
  })

  // Pre-flight E5b #1 y #2: la sede activa que perdió el plan bloquea EN ROJO y nombra la sede; nunca la llave cruda.
  const cuenta = (cl = 0, co = 0, pr = 0, sinValorar = 0) => ({
    clases: { n: cl, total: `${cl * 500}.00`, pendientesDeValoracion: sinValorar },
    comisiones: { n: co, total: `${co * 100}.00` },
    propinas: { n: pr, total: `${pr * 70}.00` },
  })
  const sede = (venueId: string, nombre: string, estado: string, entra = cuenta(), fuera = cuenta()) => ({
    venueId,
    nombre,
    estado,
    entra,
    fuera,
    pendientes: { n: 0, total: '0.00' },
  })
  const sinPlan = (venueIds: string[], otrasConPlan: boolean, porSede?: unknown[]) =>
    ventas({ puedeCerrar: false, bloqueos: [{ codigo: 'SEDE_ACTIVA_SIN_PLAN', venueIds, otrasConPlan }], ...(porSede ? { porSede } : {}) })
  const wellnessEnSedes = (puedeDesactivar: boolean) => ({
    data: {
      activado: true,
      startDate: '2026-08-01',
      periodo: { start: '2026-08-01', end: '2026-08-31' },
      sedes: [
        { venueId: 'v2', nombre: 'Wellness', zona: 'America/Mexico_City', tienePlan: false, estado: 'ACTIVA_SIN_PLAN', desde: '2026-08-01', hasta: null, minimo: null, puedeActivar: false, puedeDesactivar, fueraEstePeriodo: cuenta() },
      ],
    },
  })

  it('sede activa sin plan con otra sede con plan: en rojo, la nombra, no deja cerrar y abre «Desactivar» de Sedes', () => {
    m.sedes.mockReturnValue(wellnessEnSedes(true))
    m.preview.mockReturnValue({
      data: sinPlan(['v2'], true, [sede('v1', 'Prado Norte', 'ACTIVA', cuenta(72)), sede('v2', 'Wellness', 'ACTIVA_SIN_PLAN')]),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.block.SEDE_ACTIVA_SIN_PLAN_otras')).toEqual({ count: 1, sedes: 'Wellness' })
    expect(screen.queryByText(/^close\.block\.SEDE_ACTIVA_SIN_PLAN$/)).toBeNull()
    expect(screen.getByText(/close\.block\.SEDE_ACTIVA_SIN_PLAN_otras/).closest('li')).toHaveClass('text-destructive')
    expect(screen.getByRole('alert')).toHaveClass('border-destructive')
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
    expect(m.sedes).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: /close\.deactivateSede/ }))
    expect(screen.getByTestId('participacion')).toHaveTextContent('desactivar v2')
  })

  // E6a-fix F8 (QA H3): el respaldo del foco del diálogo es un lugar DENTRO de este modal, enfocable.
  it('🔴 «Desactivar <sede>» abre el diálogo con el foco de vuelta al resumen de ESTE modal (no a la página de fondo)', () => {
    m.sedes.mockReturnValue(wellnessEnSedes(true))
    m.preview.mockReturnValue({ data: sinPlan(['v2'], true, [sede('v2', 'Wellness', 'ACTIVA_SIN_PLAN')]), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close\.deactivateSede/ }))
    const selector = screen.getByTestId('participacion').getAttribute('data-foco')
    expect(selector).toBeTruthy()
    const ancla = document.querySelector(selector!)
    expect(ancla).toHaveAttribute('data-tour', 'staffpay-close-summary')
    expect(ancla).toHaveAttribute('tabindex', '-1')
  })

  it('sin ninguna sede con plan: dice que hay que renovar, no ofrece desactivar y no pide las sedes', () => {
    m.sedes.mockReturnValue(wellnessEnSedes(true))
    m.preview.mockReturnValue({
      data: sinPlan(['v2', 'v3'], false, [sede('v2', 'Wellness', 'ACTIVA_SIN_PLAN'), sede('v3', 'Roma', 'ACTIVA_SIN_PLAN')]),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.block.SEDE_ACTIVA_SIN_PLAN_ninguna')).toEqual({ count: 2, sedes: 'Wellness y Roma' })
    expect(screen.queryByRole('button', { name: /close\.deactivateSede/ })).toBeNull()
    expect(m.sedes).not.toHaveBeenCalledWith(true)
  })

  it('sin permiso para desactivar esa sede, el bloqueo se explica pero no hay botón', () => {
    m.sedes.mockReturnValue(wellnessEnSedes(false))
    m.preview.mockReturnValue({ data: sinPlan(['v2'], true, [sede('v2', 'Wellness', 'ACTIVA_SIN_PLAN')]), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.block\.SEDE_ACTIVA_SIN_PLAN_otras/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close\.deactivateSede/ })).toBeNull()
  })

  // E6a-fix F3, hermano: el mismo diálogo y la misma ruta que en Sedes (exige «Cerrar periodos» en la sede ACTUAL).
  it('🔴 sin «Cerrar periodos» en esta sede no ofrece «Desactivar <sede>» (terminaría en 403) y dice desde dónde', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    m.sedes.mockReturnValue(wellnessEnSedes(true))
    m.preview.mockReturnValue({ data: sinPlan(['v2'], true, [sede('v2', 'Wellness', 'ACTIVA_SIN_PLAN')]), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.queryByRole('button', { name: /close\.deactivateSede/ })).toBeNull()
    // E6a-fix2 K3: y nombra desde dónde sí puede (las sedes con alguna acción en `GET /sedes`).
    expect(screen.getByText(/sedes\.cambiaDeSedeA/)).toHaveTextContent('"sedes":"Wellness"')
  })

  it('un server sin `porSede` igual nombra la sede del bloqueo (con el nombre de la sesión)', () => {
    m.preview.mockReturnValue({ data: sinPlan(['v1'], true), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(textoDe('close.block.SEDE_ACTIVA_SIN_PLAN_otras').sedes).toBe('Prado Norte')
  })

  it('los demás bloqueos siguen en ámbar', () => {
    m.preview.mockReturnValue({ data: { ...ok, puedeCerrar: false, bloqueos: [{ codigo: 'EXCEPCIONES', n: 2 }] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByRole('alert')).not.toHaveClass('border-destructive')
    expect(screen.getByText(/close\.block\.EXCEPCIONES/).closest('li')).not.toHaveClass('text-destructive')
  })

  // Pre-flight E5b #3: por sede, qué entra y qué no entra en ESTE cierre (nunca «de este periodo»: incluye sobrantes).
  it('por sede, en el orden del server: qué entra y qué no entra en este cierre, con las clases sin valorar aparte', () => {
    m.preview.mockReturnValue({
      data: ventas({
        comisiones: 1,
        periodo: { ...ok.periodo, venueIds: ['v2', 'v1'] },
        porSede: [sede('v2', 'Wellness', 'SIN_ACTIVAR', cuenta(), cuenta(0, 0, 1, 1)), sede('v1', 'Prado Norte', 'ACTIVA', cuenta(3, 1), cuenta())],
      }),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const filas = within(screen.getByRole('region', { name: 'close.bySede.title' })).getAllByRole('listitem')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('Wellness')
    expect(filas[0]).toHaveTextContent('sedes.estado.SIN_ACTIVAR')
    expect(within(filas[0]).getByText('close.bySede.entraNada')).toBeInTheDocument()
    expect(textoDe('close.bySede.fuera', filas[0]).cuenta).toBe(
      'sedes.cuenta.propinas:{"count":1,"total":"$70.00"} y sedes.cuenta.sinValorar:{"count":1}',
    )
    expect(filas[1]).toHaveTextContent('Prado Norte')
    expect(filas[1]).toHaveTextContent('sedes.estado.ACTIVA')
    expect(textoDe('close.bySede.entra', filas[1]).cuenta).toBe(
      'sedes.cuenta.clases:{"count":3,"total":"$1,500.00"} y sedes.cuenta.comisiones:{"count":1,"total":"$100.00"}',
    )
    expect(within(filas[1]).queryByText(/close\.bySede\.fuera/)).toBeNull()
  })

  it('una sola sede activa sin nada fuera: no repite el resumen «Por sede»', () => {
    m.preview.mockReturnValue({ data: ventas({ porSede: [sede('v1', 'Prado Norte', 'ACTIVA', cuenta(72))] }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.queryByRole('region', { name: 'close.bySede.title' })).toBeNull()
  })

  it('una sola sede con algo que no entra sí dice «Por sede»', () => {
    m.preview.mockReturnValue({
      data: ventas({ porSede: [sede('v1', 'Prado Norte', 'ACTIVA', cuenta(72), cuenta(0, 2))] }),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const region = screen.getByRole('region', { name: 'close.bySede.title' })
    expect(textoDe('close.bySede.fuera', region).cuenta).toBe('sedes.cuenta.comisiones:{"count":2,"total":"$200.00"}')
  })

  // Pre-flight E5b #4: las devoluciones que este cierre NO descuenta, por destino (no bloquean ni entran en el total).
  it('dice las devoluciones pendientes por destino, con el mismo texto que el recibo, sin bloquear', () => {
    m.preview.mockReturnValue({
      data: ventas({
        comisiones: 3,
        pendientes: {
          n: 3,
          total: '-80.00',
          porDestino: [
            { seDescuenta: { tipo: 'AL_CERRAR', periodo: { start: '2026-09-01', end: '2026-09-30' } }, n: 2, total: '-50.00', porSede: [] },
            { seDescuenta: { tipo: 'PERIODO_POSTERIOR_A', origen: { start: '2026-07-01', end: '2026-07-31' } }, n: 1, total: '-30.00', porSede: [] },
          ],
        },
      }),
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const lineas = within(screen.getByRole('region', { name: 'close.pendingTitle' })).getAllByRole('listitem')
    expect(lineas).toHaveLength(2)
    expect(lineas[0]).toHaveTextContent('period.pendingLine')
    expect(lineas[0]).toHaveTextContent('−$50.00')
    expect(lineas[0]).toHaveTextContent('period.pendingAtClose')
    expect(lineas[0]).toHaveTextContent('septiembre de 2026')
    expect(lineas[1]).toHaveTextContent('−$30.00')
    expect(lineas[1]).toHaveTextContent('period.pendingAfter')
    expect(lineas[1]).toHaveTextContent('julio de 2026')
    expect(screen.getByRole('button', { name: 'close.confirm' })).not.toBeDisabled()
  })

  it('sin devoluciones pendientes no hay sección', () => {
    m.preview.mockReturnValue({ data: ventas({ comisiones: 3, pendientes: { n: 0, total: '0.00', porDestino: [] } }), isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.queryByRole('region', { name: 'close.pendingTitle' })).toBeNull()
  })
})
