/**
 * C1 · Tarea 13 (Codex C1-25) — en la lista de facturas, la fila de una global PRINCIPAL timbrada o cancelada ofrece «Emitir
 * complementaria» por SU id, de cualquier periodicidad (también de antes de cambiarla). Una complementaria, una factura individual
 * o una fila de un servidor que todavía no dice si es complementaria, no.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import type { Cfdi } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const m = vi.hoisted(() => ({
  filas: [] as unknown[],
  permisos: ['cfdi:configure', 'cfdi:issue'] as string[],
  consultar: vi.fn(),
  consultando: false,
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permisos.includes(p) }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `fecha(${d})` }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useCfdis: () => ({ data: { cfdis: m.filas, total: m.filas.length }, isLoading: false, isError: false }),
  useDownloadCfdiFile: () => ({ mutate: () => {} }),
  // C2 · T10 ronda 1 (I-1): «Consultar estado» tiene su propia mutación (`soloConsultar`): nunca la de cancelar.
  useCancelCfdi: () => ({ mutate: vi.fn(), isPending: false }),
  useConsultarCancelacion: () => ({ mutate: m.consultar, isPending: m.consultando }),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
// La tabla real (paginación, columnas guardadas) no es lo que se prueba: cada fila pinta sus celdas.
vi.mock('@/components/data-table', () => ({
  default: ({ data, columns }: { data: any[]; columns: any[] }) => (
    <div>
      {data.map(row => (
        <div key={row.id} data-testid={`fila-${row.id}`}>
          {columns.map(c => (
            <div key={c.id}>{c.cell?.({ row: { original: row } })}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))
// El menú de Radix no abre en jsdom: aquí siempre está abierto y cada opción es un botón.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/components/filters', () => ({
  FilterPillBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FilterPill: () => null,
  CheckboxFilterContent: () => null,
}))
vi.mock('../components/CancelCfdiDialog', () => ({
  CancelCfdiDialog: ({ cfdi }: { cfdi: { id: string } | null }) => (cfdi ? <div data-testid="cancelar">{cfdi.id}</div> : null),
}))
vi.mock('../components/ReplaceCfdiDialog', () => ({
  ReplaceCfdiDialog: ({ cfdi }: { cfdi: { id: string } | null }) => (cfdi ? <div data-testid="sustituir">{cfdi.id}</div> : null),
}))
vi.mock('../components/SendCfdiEmailDialog', () => ({ SendCfdiEmailDialog: () => null }))
vi.mock('../components/GlobalComplementariaDialog', () => ({
  GlobalComplementariaDialog: ({ emisorId, principalId }: { emisorId: string | null; principalId: string | null }) =>
    principalId ? <div data-testid="complementaria">{`${emisorId}:${principalId}`}</div> : null,
}))

import CfdiList from '../CfdiList'
import { olvidarCancelacionesEnDuda, recordarCancelacionEnDuda } from '../cfdiListFilters'

const ACCION = es.globalInvoice.periods.complementary

const factura = (over: Partial<Cfdi>): Cfdi => ({
  id: 'x',
  type: 'I',
  status: 'STAMPED',
  flow: 'GLOBAL_C',
  isGlobal: true,
  orderId: null,
  receptorRfc: 'XAXX010101000',
  receptorNombre: 'PUBLICO EN GENERAL',
  serie: 'G',
  folio: '1',
  uuid: 'U',
  subtotalCents: 10000,
  taxCents: 1600,
  totalCents: 11600,
  stampedAt: '2026-10-01T10:00:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  cancelStatus: null,
  xmlUrl: null,
  pdfUrl: null,
  globalPeriod: { periodicidad: '04', meses: '09', anio: 2026 },
  fiscalEmisorId: 'e1',
  complementariaDe: null,
  ...over,
})

const fila = (id: string) => screen.getByTestId(`fila-${id}`)

describe('CfdiList · «Emitir complementaria» (C1-25)', () => {
  it('🔴 la principal timbrada, la cancelada y la diaria de antes del cambio de periodicidad la traen, y abre el diálogo con SU id', () => {
    m.filas = [
      factura({ id: 'g1' }),
      factura({ id: 'g2', status: 'CANCELLED', cancelStatus: 'ACCEPTED' }),
      factura({ id: 'g3', globalPeriod: { periodicidad: '01', meses: '09', anio: 2026 } }),
    ]
    m.permisos = ['cfdi:configure', 'cfdi:issue']
    render(<CfdiList />)
    for (const id of ['g1', 'g2', 'g3']) expect(within(fila(id)).getByRole('button', { name: ACCION })).toBeInTheDocument()
    fireEvent.click(within(fila('g2')).getByRole('button', { name: ACCION }))
    expect(screen.getByTestId('complementaria').textContent).toBe('e1:g2')
  })

  it('control — una complementaria, una factura individual, una principal sin timbrar o una fila sin saber si es complementaria NO la traen', () => {
    m.filas = [
      factura({ id: 'c2', complementariaDe: 'g1' }),
      factura({ id: 'i1', isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null }),
      factura({ id: 'p1', status: 'VALIDATION_FAILED' }),
      factura({ id: 'viejo', complementariaDe: undefined }),
      factura({ id: 'sinEmisor', fiscalEmisorId: undefined }),
    ]
    render(<CfdiList />)
    for (const id of ['c2', 'i1', 'p1', 'viejo', 'sinEmisor'])
      expect(within(fila(id)).queryByRole('button', { name: ACCION })).not.toBeInTheDocument()
  })

  it('control — M7 (b): sin `cfdi:configure` ni la principal timbrada la trae', () => {
    m.filas = [factura({ id: 'g1' })]
    m.permisos = ['cfdi:view']
    render(<CfdiList />)
    expect(within(fila('g1')).queryByRole('button', { name: ACCION })).not.toBeInTheDocument()
  })
})

// ─── C2 · Tarea 10: la fila dice en qué va la cancelación y deja la salida que toca (I3 y M9 de la T2; C2-31) ──────────────────────────
describe('CfdiList · C2 · T10 · la cancelación en la fila', () => {
  const individual = (over: Partial<Cfdi>) =>
    factura({ isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null, complementariaDe: null, ...over })
  const CANCELAR = es.actions.cancel
  const CONSULTAR = es.actions.checkStatus
  const SUSTITUIR = es.actions.replace

  beforeEach(() => {
    m.permisos = ['cfdi:configure', 'cfdi:issue']
    m.consultar.mockReset()
  })

  // T10 ronda 1 (I-1, cambia A PROPÓSITO): «Consultar estado» manda sólo el id (la mutación pide `soloConsultar`); ya no repite el motivo.
  it('🔴 EN DUDA ⇒ «Cancelación en duda: la estamos confirmando con el SAT» y «Consultar estado» (SÓLO consulta); sin «Cancelar» ni «Sustituir»', () => {
    m.filas = [individual({ id: 'd', cancelStatus: 'REQUESTED', estadoCancelacion: 'CANCELACION_EN_DUDA' })]
    render(<CfdiList />)
    expect(within(fila('d')).getByText(es.cancelacion.lista.enDuda)).toBeInTheDocument()
    expect(es.cancelacion.lista.enDuda).toBe('Cancelación en duda: la estamos confirmando con el SAT')
    expect(within(fila('d')).queryByRole('button', { name: CANCELAR })).not.toBeInTheDocument()
    expect(within(fila('d')).queryByRole('button', { name: SUSTITUIR })).not.toBeInTheDocument()
    fireEvent.click(within(fila('d')).getByRole('button', { name: CONSULTAR }))
    expect(m.consultar).toHaveBeenCalledWith({ cfdiId: 'd' })
  })

  it('🔴 EN TRÁMITE (acusada) ⇒ «Cancelación en trámite ante el SAT» y «Consultar estado»', () => {
    m.filas = [individual({ id: 't', cancelStatus: 'REQUESTED', estadoCancelacion: 'EN_TRAMITE' })]
    render(<CfdiList />)
    expect(within(fila('t')).getByText('Cancelación en trámite ante el SAT')).toBeInTheDocument()
    fireEvent.click(within(fila('t')).getByRole('button', { name: CONSULTAR }))
    expect(m.consultar).toHaveBeenCalledWith({ cfdiId: 't' })
  })

  // T10 ronda 1 (I-1, cambia A PROPÓSITO): el aviso «en duda» de justo después de cancelar manda a «Consultar estado»; durante los primeros
  // 90 s la fila deriva ENVIANDO. Como la consulta ya NO puede enviar nada, se ofrece también ahí (antes se escondía para no ganar el envío).
  it('🔴 enviándose (o recién anotada) ⇒ lo dice y ofrece «Consultar estado» (sólo consulta); nunca «Cancelar»', () => {
    m.filas = [
      individual({ id: 'e', cancelStatus: 'REQUESTED', estadoCancelacion: 'ENVIANDO' }),
      individual({ id: 'a', cancelStatus: 'REQUESTED', estadoCancelacion: 'ANOTADA' }),
    ]
    render(<CfdiList />)
    for (const id of ['e', 'a']) {
      expect(within(fila(id)).getByText(es.cancelacion.lista.enviando)).toBeInTheDocument()
      expect(within(fila(id)).getByRole('button', { name: CONSULTAR })).toBeInTheDocument()
      expect(within(fila(id)).queryByRole('button', { name: CANCELAR })).not.toBeInTheDocument()
    }
  })

  it('🔴 I3: tras un RECHAZO (o una caducada) vuelven «Cancelar» y «Sustituir» (un intento nuevo lo pide una persona), y la fila dice por qué', () => {
    m.filas = [
      individual({
        id: 'r',
        cancelStatus: 'REJECTED',
        estadoCancelacion: 'RECHAZADA',
        motivoRechazoCancelacion:
          'La solicitud de cancelación caducó sin respuesta del receptor: la factura sigue vigente. Vuelve a pedirla.',
      }),
    ]
    render(<CfdiList />)
    expect(within(fila('r')).getByText(/caducó sin respuesta del receptor/)).toBeInTheDocument()
    fireEvent.click(within(fila('r')).getByRole('button', { name: CANCELAR }))
    expect(screen.getByTestId('cancelar').textContent).toBe('r')
    fireEvent.click(within(fila('r')).getByRole('button', { name: SUSTITUIR }))
    expect(screen.getByTestId('sustituir').textContent).toBe('r')
    expect(within(fila('r')).queryByRole('button', { name: CONSULTAR })).not.toBeInTheDocument()
  })

  // T10 ronda 1 (I-1, cambia A PROPÓSITO): la consulta ya no necesita el motivo.
  it('🔴 un servidor que no manda el estado fino: con REQUESTED la fila no ofrece «Cancelar» y sí «Consultar estado»', () => {
    m.filas = [individual({ id: 's', cancelStatus: 'REQUESTED' })]
    render(<CfdiList />)
    expect(within(fila('s')).getByRole('button', { name: CONSULTAR })).toBeInTheDocument()
    expect(within(fila('s')).queryByRole('button', { name: CANCELAR })).not.toBeInTheDocument()
  })

  it('🔴 I-1: «Consultar estado» se deshabilita mientras la consulta está en curso', () => {
    m.consultando = true
    try {
      m.filas = [individual({ id: 'd', cancelStatus: 'REQUESTED', estadoCancelacion: 'CANCELACION_EN_DUDA' })]
      render(<CfdiList />)
      expect(within(fila('d')).getByRole('button', { name: CONSULTAR })).toBeDisabled()
    } finally {
      m.consultando = false
    }
  })

  it('control — vigente sin cancelación: «Cancelar» y «Sustituir», sin texto de cancelación', () => {
    m.filas = [individual({ id: 'n', estadoCancelacion: null })]
    render(<CfdiList />)
    expect(within(fila('n')).getByRole('button', { name: CANCELAR })).toBeInTheDocument()
    expect(within(fila('n')).getByRole('button', { name: SUSTITUIR })).toBeInTheDocument()
    expect(within(fila('n')).queryByText(es.cancelacion.lista.enTramite)).not.toBeInTheDocument()
  })

  it('🔴 sin `cfdi:configure`: el texto de la cancelación sí, «Consultar estado» no', () => {
    m.permisos = ['cfdi:view']
    m.filas = [individual({ id: 'd', cancelStatus: 'REQUESTED', estadoCancelacion: 'CANCELACION_EN_DUDA' })]
    render(<CfdiList />)
    expect(within(fila('d')).queryByRole('button', { name: CONSULTAR })).not.toBeInTheDocument()
    expect(within(fila('d')).getByText(es.cancelacion.lista.enDuda)).toBeInTheDocument()
  })
})

// ─── C2 · Tarea 10, ronda 1 (I-2): «Terminar la sustitución» en la fila de la ORIGINAL ──────────────────────────────────────────────────
// Cuando la sustituta ya está TIMBRADA pero la cancelación de la original no salió (`cancelAviso`, la fila queda REJECTED) o no se pudo
// pedir (`cancelConflicto`, sin cancelación), la original sigue vigente junto a la nueva. Esa fila no ofrece «Corregir importe» (ya tiene
// sustituta): ofrece «Terminar la sustitución», que abre el MISMO diálogo de sustitución con esa original (el servidor sólo reanuda la
// cancelación; no timbra otra).
describe('CfdiList · C2 · T10 ronda 1 · I-2: «Terminar la sustitución»', () => {
  const original = (over: Partial<Cfdi>) =>
    factura({ isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null, complementariaDe: null, ...over })
  const sustituta = (status: string) => ({ id: 's1', uuid: 'U-S', serie: 'A', folio: '16', status, totalCents: 13500 })
  const TERMINAR = es.actions.finishReplace
  const SUSTITUIR = es.actions.replace
  beforeEach(() => {
    m.permisos = ['cfdi:configure', 'cfdi:issue']
  })

  it('🔴 sustituta TIMBRADA + cancelación de la original rechazada (no salió) o nunca pedida ⇒ aparece y abre el diálogo de sustitución con la ORIGINAL', () => {
    m.filas = [
      original({ id: 'aviso', cancelStatus: 'REJECTED', estadoCancelacion: 'RECHAZADA', replacedBy: [sustituta('STAMPED')] as any }),
      original({ id: 'conflicto', cancelStatus: null, estadoCancelacion: null, replacedBy: [sustituta('STAMPED')] as any }),
    ]
    render(<CfdiList />)
    for (const id of ['aviso', 'conflicto']) {
      expect(within(fila(id)).queryByRole('button', { name: SUSTITUIR })).not.toBeInTheDocument()
      fireEvent.click(within(fila(id)).getByRole('button', { name: TERMINAR }))
      expect(screen.getByTestId('sustituir').textContent).toBe(id)
    }
  })
  it('control — con una sustituta NO timbrada, con la cancelación viva o sin permiso, no aparece', () => {
    m.filas = [
      original({ id: 'sinTimbrar', cancelStatus: 'REJECTED', replacedBy: [sustituta('STAMP_FAILED')] as any }),
      original({ id: 'enTramite', cancelStatus: 'REQUESTED', estadoCancelacion: 'EN_TRAMITE', replacedBy: [sustituta('STAMPED')] as any }),
      original({ id: 'cancelada', status: 'CANCELLED', cancelStatus: 'ACCEPTED', replacedBy: [sustituta('STAMPED')] as any }),
      original({ id: 'sinSustituta', cancelStatus: null }),
    ]
    render(<CfdiList />)
    for (const id of ['sinTimbrar', 'enTramite', 'cancelada', 'sinSustituta'])
      expect(within(fila(id)).queryByRole('button', { name: TERMINAR })).not.toBeInTheDocument()
  })
  it('control — sin `cfdi:configure` no aparece', () => {
    m.permisos = ['cfdi:view']
    m.filas = [original({ id: 'aviso', cancelStatus: 'REJECTED', replacedBy: [sustituta('STAMPED')] as any })]
    render(<CfdiList />)
    expect(within(fila('aviso')).queryByRole('button', { name: TERMINAR })).not.toBeInTheDocument()
  })
})

// ─── C2 · Tarea 10, ronda 1 (M6): la insignia no contradice el texto de abajo ────────────────────────────────────────────────────────
describe('CfdiList · C2 · T10 ronda 1 · M6: la insignia según `estadoCancelacion`', () => {
  const individual = (over: Partial<Cfdi>) =>
    factura({ isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null, complementariaDe: null, ...over })
  it('🔴 enviándose ⇒ «Enviando cancelación»; en duda ⇒ «Cancelación en duda»; en trámite ⇒ «Cancelación en trámite»', () => {
    m.filas = [
      individual({ id: 'e', cancelStatus: 'REQUESTED', estadoCancelacion: 'ENVIANDO' }),
      individual({ id: 'd', cancelStatus: 'REQUESTED', estadoCancelacion: 'CANCELACION_EN_DUDA' }),
      individual({ id: 't', cancelStatus: 'REQUESTED', estadoCancelacion: 'EN_TRAMITE' }),
    ]
    render(<CfdiList />)
    expect(within(fila('e')).getByText(es.statusLabel.CANCEL_SENDING)).toBeInTheDocument()
    expect(within(fila('e')).queryByText(es.statusLabel.CANCEL_PENDING)).not.toBeInTheDocument()
    expect(within(fila('d')).getByText(es.statusLabel.CANCEL_IN_DOUBT)).toBeInTheDocument()
    expect(within(fila('d')).queryByText(es.statusLabel.CANCEL_PENDING)).not.toBeInTheDocument()
    expect(within(fila('t')).getByText(es.statusLabel.CANCEL_PENDING)).toBeInTheDocument()
  })
})

// ─── C2 · ronda QA (D4 y D6) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('CfdiList · C2 · ronda QA: timbre en duda (D6) y la duda ya conocida (D4)', () => {
  const individual = (over: Partial<Cfdi>) =>
    factura({ isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null, complementariaDe: null, ...over })
  beforeEach(() => olvidarCancelacionesEnDuda())
  it('🔴 D6: `STAMP_FAILED` con `timbreEnDuda` ⇒ «En espera del PAC», nunca «Rechazada por el SAT»; sin el campo, como antes', () => {
    m.filas = [
      individual({ id: 'duda', status: 'STAMP_FAILED', stampedAt: null, uuid: null, timbreEnDuda: true }),
      individual({ id: 'rechazo', status: 'STAMP_FAILED', stampedAt: null, uuid: null }),
    ]
    render(<CfdiList />)
    expect(within(fila('duda')).getByText(es.statusLabel.STAMP_IN_DOUBT)).toBeInTheDocument()
    expect(within(fila('duda')).queryByText(es.statusLabel.STAMP_FAILED)).not.toBeInTheDocument()
    expect(within(fila('rechazo')).getByText(es.statusLabel.STAMP_FAILED)).toBeInTheDocument()
  })
  it('🔴 D4: tras una respuesta `enDuda` de ESTA pestaña, la fila ENVIANDO dice «Cancelación en duda»; otra fila enviándose, no', () => {
    recordarCancelacionEnDuda('ya-dicha')
    m.filas = [
      individual({ id: 'ya-dicha', cancelStatus: 'REQUESTED', estadoCancelacion: 'ENVIANDO' }),
      individual({ id: 'otra', cancelStatus: 'REQUESTED', estadoCancelacion: 'ENVIANDO' }),
    ]
    render(<CfdiList />)
    expect(within(fila('ya-dicha')).getByText(es.statusLabel.CANCEL_IN_DOUBT)).toBeInTheDocument()
    expect(within(fila('ya-dicha')).getByText(es.cancelacion.lista.enDuda)).toBeInTheDocument()
    expect(within(fila('ya-dicha')).queryByText(es.cancelacion.lista.enviando)).not.toBeInTheDocument()
    expect(within(fila('otra')).getByText(es.cancelacion.lista.enviando)).toBeInTheDocument()
  })
})
