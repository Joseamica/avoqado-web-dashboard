// E6a-fix2 D1 [DINERO] (full-testing E6a): el servidor guardaba el ajuste, la respuesta no llegaba, la pantalla decía «Algo
// salió mal» y no releía; el dueño cerraba el modal, veía la tabla sin el ajuste, lo capturaba otra vez y el modal nuevo traía
// OTRA clave: dos ajustes, se pagaba dos veces. Con los hooks REALES y un QueryClient real (sólo el servicio es simulado), y un
// «servidor» de mentira que guarda por clave como el de verdad (misma clave ⇒ devuelve el que ya guardó, `yaExistia`).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AjusteManualModal } from '../components/AjusteManualModal'
import { olvidarBorradoresEnDuda } from '../llaveDelAjuste'

const m = vi.hoisted(() => ({ add: vi.fn(), toast: vi.fn(), preview: vi.fn(), team: vi.fn(), access: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d, venueTimezone: 'America/Mexico_City' }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions, onClose }: { open: boolean; children: ReactNode; actions?: ReactNode; onClose: () => void }) =>
    open ? (
      <div>
        <button type="button" onClick={onClose}>
          cerrar-modal
        </button>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect }: { items: Array<{ id: string; label: string }>; onSelect: (i: unknown) => void }) => (
    <div>
      {items.map(i => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          {i.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: (...a: unknown[]) => m.team(...a) } }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    addAdjustment: (...a: unknown[]) => m.add(...a),
    adjustmentPreview: (...a: unknown[]) => m.preview(...a),
    access: (...a: unknown[]) => m.access(...a),
    report: vi.fn(),
  },
}))

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const abrir = (qc: QueryClient, onOpenChange: (o: boolean) => void = vi.fn()) =>
  render(
    <QueryClientProvider client={qc}>
      <AjusteManualModal open onOpenChange={onOpenChange} sedes={['v1']} fecha="2026-10-08" etiqueta="octubre 2026" />
    </QueryClientProvider>,
  )
const guardar = () => screen.getByRole('button', { name: 'manualAdjust.save' })
async function llenar(monto = '25') {
  fireEvent.click(await screen.findByRole('button', { name: 'Carlos QA' }))
  fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: monto } })
  fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'FULLTEST dup' } })
}
type Cuerpo = { clientKey: string; staffId: string; sede: string; amount: number; reason: string }
/**
 * Guarda por clave, como el servidor: la misma clave devuelve el ajuste que ya guardó (`yaExistia`), y la misma clave con OTRO
 * contenido responde 409 CLAVE_REUTILIZADA con lo que ya se guardó (`details.guardado`, E6a-fix5; sin él con `detalles: false`,
 * como un servidor previo). `perder` es el número de llamada (1, 2…) cuya respuesta se pierde DESPUÉS de guardar (el servidor sí
 * lo guardó; al navegador no le llega nada).
 */
function servidor(perder: number[] = [1], { detalles = true }: { detalles?: boolean } = {}) {
  const guardados = new Map<string, Cuerpo>()
  let n = 0
  m.add.mockImplementation(async (_venueId: string, b: Cuerpo) => {
    n++
    const previo = guardados.get(b.clientKey)
    if (previo && (previo.amount !== b.amount || previo.staffId !== b.staffId || previo.sede !== b.sede || previo.reason !== b.reason)) {
      const guardado = { staffNombre: 'Carlos QA', amount: previo.amount.toFixed(2), reason: previo.reason, periodo: { start: '2026-10-01', end: '2026-10-31' } }
      throw {
        response: {
          status: 409,
          data: {
            code: 'CLAVE_REUTILIZADA',
            message: `Ya se guardó un ajuste con esta solicitud: +$${guardado.amount} para Carlos QA (${previo.reason}). Si querías otro distinto, ábrelo de nuevo.`,
            ...(detalles ? { details: { guardado } } : {}),
          },
        },
      }
    }
    const yaExistia = !!previo
    if (!yaExistia) guardados.set(b.clientKey, b)
    if (perder.includes(n)) throw new Error('Network Error')
    return { id: `e-${b.clientKey}`, periodId: 'p10', periodo: { start: '2026-10-01', end: '2026-10-31' }, staffId: b.staffId, sede: b.sede, amount: `${b.amount}`, reason: b.reason, yaExistia }
  })
  return guardados
}
const clave = (i: number) => (m.add.mock.calls[i][1] as Cuerpo).clientKey

beforeEach(() => {
  vi.clearAllMocks()
  olvidarBorradoresEnDuda()
  m.team.mockResolvedValue({ data: [{ staffId: 's-carlos', firstName: 'Carlos', lastName: 'QA', email: 'carlos@qa.mx' }], meta: { totalCount: 1, hasNextPage: false } })
  m.preview.mockResolvedValue(undefined)
  m.access.mockResolvedValue({ enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false })
})
afterEach(() => onlineManager.setOnline(true))

describe('ajuste manual con la respuesta perdida (D1)', () => {
  it('🔴 sin respuesta: no se cierra, dice que no sabe si se guardó, y reintentar manda la MISMA clave (un solo ajuste)', async () => {
    const guardados = servidor()
    const onOpenChange = vi.fn()
    abrir(cliente(), onOpenChange)
    await llenar()
    fireEvent.click(guardar())
    expect(await screen.findByText('manualAdjust.uncertain')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.generic' }))
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
    // Se dice que ya estaba: no se presenta como uno nuevo.
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('manualAdjust.alreadySaved') }))
  })

  it('🔴 cerrar el modal y capturar LO MISMO otra vez viaja con la misma clave: el servidor no guarda dos', async () => {
    const guardados = servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    const onOpenChange = vi.fn()
    abrir(qc, onOpenChange)
    await llenar()
    // El modal nuevo avisa que ese mismo ajuste quedó en duda.
    expect(screen.getByText('manualAdjust.uncertain')).toBeInTheDocument()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
  })

  it('un ajuste que SÍ se guardó gasta su clave: otro idéntico después es OTRO ajuste, no un reintento', async () => {
    const guardados = servidor([])
    const qc = cliente()
    const onOpenChange = vi.fn()
    const primero = abrir(qc, onOpenChange)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    primero.unmount()
    const otro = vi.fn()
    abrir(qc, otro)
    await llenar()
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    fireEvent.click(guardar())
    await waitFor(() => expect(otro).toHaveBeenCalledWith(false))
    expect(clave(1)).not.toBe(clave(0))
    expect(guardados.size).toBe(2)
  })

  it('la clave en duda no viaja con OTRO borrador (otro monto): ése es otro ajuste', async () => {
    servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar('25')
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    abrir(qc)
    await llenar('30')
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(clave(1)).not.toBe(clave(0))
  })

  it('un rechazo con desenlace (409) saca al borrador de la duda: corregirlo y volver a capturarlo estrena clave', async () => {
    m.add.mockRejectedValueOnce({ response: { status: 409, data: { code: 'PERIODO_CERRADO', message: 'Ese periodo ya está cerrado' } } })
    m.add.mockResolvedValueOnce({ id: 'e1', periodId: 'p', periodo: { start: '2026-10-01', end: '2026-10-31' }, yaExistia: false })
    const qc = cliente()
    const primero = abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'Ese periodo ya está cerrado', variant: 'destructive' }))
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    primero.unmount()
    abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(clave(1)).not.toBe(clave(0))
  })
})

// E6a-fix2 C5, hermano en el ajuste: sin red el guardado queda EN PAUSA. Se dice; cerrar el modal en pausa lo cancela de verdad
// (al volver la red no se guarda) y el borrador sale de la duda: nunca salió, volver a capturarlo es un ajuste nuevo.
describe('ajuste manual sin red (C5)', () => {
  it('🔴 en pausa dice que se guardará al volver la red; cerrar el modal lo cancela y al volver la red NO se guarda', async () => {
    servidor([])
    const qc = cliente()
    const onOpenChange = vi.fn()
    abrir(qc, onOpenChange)
    await llenar()
    onlineManager.setOnline(false)
    fireEvent.click(guardar())
    expect(await screen.findByText('offline.willSendAdjustment')).toBeInTheDocument()
    expect(m.add).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-modal' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    expect(m.add).not.toHaveBeenCalled()
  })

  it('cancelar en pausa NO borra una duda de antes: tras una respuesta perdida, el mismo ajuste sigue viajando con su clave', async () => {
    const guardados = servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar()
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    // Reabre el mismo ajuste sin red: queda en pausa y lo cancela al cerrar.
    const segundo = abrir(qc)
    await llenar()
    onlineManager.setOnline(false)
    fireEvent.click(guardar())
    await screen.findByText('offline.willSendAdjustment')
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-modal' }))
    segundo.unmount()
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    const onOpenChange = vi.fn()
    abrir(qc, onOpenChange)
    await llenar()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
  })

  it('sin cerrar, al volver la red se guarda una vez', async () => {
    const guardados = servidor([])
    const onOpenChange = vi.fn()
    abrir(cliente(), onOpenChange)
    await llenar()
    onlineManager.setOnline(false)
    fireEvent.click(guardar())
    await screen.findByText('offline.willSendAdjustment')
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(guardados.size).toBe(1)
  })
})

// E6a-fix4 C-n2 (re-prueba, variante C de D1): la respuesta del $9 se pierde, el dueño cambia el monto a $10 en el MISMO modal y el
// servidor responde CLAVE_REUTILIZADA. Antes: «Esta solicitud ya se usó para otro ajuste. Vuelve a abrir el formulario.» sin decir
// que el $9 SÍ quedó; si reabría y capturaba $10, quedaban $9 + $10.
describe('cambiar un ajuste que quedó en duda (C-n2)', () => {
  const montoA = (v: string) => fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: v } })
  it('🔴 mientras el borrador está en duda, editar el monto avisa que el anterior pudo haberse guardado', async () => {
    servidor()
    abrir(cliente())
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    montoA('10')
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    expect(screen.getByText('manualAdjust.uncertainEdited:{"monto":"+$9.00","persona":"Carlos QA"}')).toBeInTheDocument()
    // Volver al mismo borrador vuelve al aviso de siempre.
    montoA('9')
    expect(screen.getByText('manualAdjust.uncertain')).toBeInTheDocument()
    expect(screen.queryByText(/manualAdjust\.uncertainEdited/)).toBeNull()
  })

  it('🔴 409 CLAVE_REUTILIZADA: dice lo que YA se guardó, relee el periodo, saca el borrador de la duda y no deja guardar otro aquí', async () => {
    const guardados = servidor()
    const qc = cliente()
    const releer = vi.spyOn(qc, 'invalidateQueries')
    const onOpenChange = vi.fn()
    const primero = abrir(qc, onOpenChange)
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    montoA('10')
    releer.mockClear()
    fireEvent.click(guardar())
    expect(
      await screen.findByText(
        'manualAdjust.keyReusedSaved:{"monto":"+$9.00","persona":"Carlos QA","motivo":"FULLTEST dup","start":"2026-10-01","end":"2026-10-31"}',
      ),
    ).toBeInTheDocument()
    expect(guardados.size).toBe(1)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(releer).toHaveBeenCalledWith({ queryKey: ['staff-pay', 'v1'] })
    // Nada de «no sabemos» ni de «revisa antes de cambiarlo»: ya se sabe.
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    expect(screen.queryByText(/manualAdjust\.uncertainEdited/)).toBeNull()
    // Este modal ya no guarda: otro ajuste distinto se agrega abriendo uno nuevo.
    expect(guardar()).toBeDisabled()
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    // El $9 salió de la duda: capturarlo otra vez en un modal nuevo ya no dice «no sabemos».
    primero.unmount()
    abrir(qc)
    await llenar('9')
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
  })

  it('servidor previo (sin `details.guardado`): muestra su mensaje, relee y saca el borrador de la duda', async () => {
    servidor([1], { detalles: false })
    const qc = cliente()
    const releer = vi.spyOn(qc, 'invalidateQueries')
    abrir(qc)
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    montoA('10')
    releer.mockClear()
    fireEvent.click(guardar())
    expect(await screen.findByText('Ya se guardó un ajuste con esta solicitud: +$9.00 para Carlos QA (FULLTEST dup). Si querías otro distinto, ábrelo de nuevo.')).toBeInTheDocument()
    expect(releer).toHaveBeenCalledWith({ queryKey: ['staff-pay', 'v1'] })
    expect(guardar()).toBeDisabled()
    montoA('9')
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
  })

  it('🔴 en OTRO modal: un borrador en duda que se edita viaja con la clave de la duda (nunca $25 + $30)', async () => {
    const guardados = servidor()
    const qc = cliente()
    const primero = abrir(qc)
    await llenar('25')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    primero.unmount()
    abrir(qc)
    await llenar('25')
    expect(screen.getByText('manualAdjust.uncertain')).toBeInTheDocument()
    montoA('30')
    expect(screen.getByText('manualAdjust.uncertainEdited:{"monto":"+$25.00","persona":"Carlos QA"}')).toBeInTheDocument()
    fireEvent.click(guardar())
    await screen.findByText(/^manualAdjust\.keyReusedSaved/)
    expect(clave(1)).toBe(clave(0))
    expect(guardados.size).toBe(1)
  })

  it('una duda que ya tuvo desenlace (el reintento dio 409 PERIODO_CERRADO) no sigue avisando al editar', async () => {
    m.add.mockRejectedValueOnce(new Error('Network Error'))
    m.add.mockRejectedValueOnce({ response: { status: 409, data: { code: 'PERIODO_CERRADO', message: 'Ese periodo ya está cerrado' } } })
    abrir(cliente())
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.click(guardar())
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'Ese periodo ya está cerrado', variant: 'destructive' }))
    expect(screen.queryByText('manualAdjust.uncertain')).toBeNull()
    montoA('10')
    expect(screen.queryByText(/manualAdjust\.uncertainEdited/)).toBeNull()
  })

  it('si el anterior NO llegó a guardarse, el cambio se guarda solo (uno, el nuevo) y la duda se acaba', async () => {
    const guardados = new Map<string, Cuerpo>()
    m.add.mockImplementationOnce(async () => {
      throw new Error('Network Error')
    })
    m.add.mockImplementation(async (_v: string, b: Cuerpo) => {
      guardados.set(b.clientKey, b)
      return { id: 'e1', periodId: 'p10', periodo: { start: '2026-10-01', end: '2026-10-31' }, yaExistia: false }
    })
    const onOpenChange = vi.fn()
    abrir(cliente(), onOpenChange)
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    montoA('10')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect([...guardados.values()].map(b => b.amount)).toEqual([10])
    expect(clave(1)).toBe(clave(0))
  })
})

// G2 (hermano): sin red, la vista previa del ajuste (las devoluciones que se descontarán solas) quedaba EN PAUSA y el aviso
// simplemente no salía: el dueño podía capturar un bono «para compensar» sin saber que la devolución ya se descuenta sola.
describe('la vista previa del ajuste sin red (G2)', () => {
  it('🔴 dice que las devoluciones pendientes se revisan al volver la red; al volver la red se revisan', async () => {
    servidor([])
    m.preview.mockResolvedValue({ staffId: 's-carlos', avisoPendientes: { total: '0.00', porDestino: [] } })
    abrir(cliente())
    fireEvent.click(await screen.findByRole('button', { name: 'Carlos QA' }))
    onlineManager.setOnline(false)
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'FULLTEST dup' } })
    expect(await screen.findByText('offline.willCalculatePending')).toBeInTheDocument()
    expect(m.preview).not.toHaveBeenCalled()
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(m.preview).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('offline.willCalculatePending')).toBeNull())
  })
})

// G3 (guía E6c): tras el 409 CLAVE_REUTILIZADA el resumen seguía diciendo «Se suman $10.00 al recibo de…», aunque ese cambio NO se
// guardó y «Guardar» ya estaba apagado. Lo único que vale ya es lo que se guardó.
describe('el resumen tras el 409 CLAVE_REUTILIZADA (G3)', () => {
  it('🔴 el resumen del cambio que no se guardó desaparece; queda lo que sí se guardó', async () => {
    servidor()
    abrir(cliente())
    await llenar('9')
    fireEvent.click(guardar())
    await screen.findByText('manualAdjust.uncertain')
    await waitFor(() => expect(guardar()).toBeEnabled())
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '10' } })
    expect(screen.getByText(/^manualAdjust\.summaryBonus/)).toBeInTheDocument()
    fireEvent.click(guardar())
    await screen.findByText(/^manualAdjust\.keyReusedSaved/)
    expect(guardar()).toBeDisabled()
    expect(screen.queryByText(/^manualAdjust\.summaryBonus/)).toBeNull()
    expect(screen.queryByText('manualAdjust.goesTo')).toBeNull()
  })
})
