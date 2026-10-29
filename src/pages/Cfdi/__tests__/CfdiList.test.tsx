/**
 * C1 · Tarea 13 (Codex C1-25) — en la lista de facturas, la fila de una global PRINCIPAL timbrada o cancelada ofrece «Emitir
 * complementaria» por SU id, de cualquier periodicidad (también de antes de cambiarla). Una complementaria, una factura individual
 * o una fila de un servidor que todavía no dice si es complementaria, no.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import es from '@/locales/es/cfdi.json'
import type { Cfdi } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const leer = (k: string) => k.split('.').reduce<any>((o, s) => o?.[s], es as any)
  // Plurales de i18next: `clave_one` / `clave_other` cuando la base no existe.
  const raw = leer(key) ?? (typeof opts?.count === 'number' ? leer(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : undefined)
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
  extracciones: undefined as { total: number; enProceso: number } | undefined,
  conFacturacion: true,
  ultimosFiltros: {} as Record<string, unknown>,
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permisos.includes(p) }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: m.conFacturacion }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { timezone: 'America/Mexico_City' }, fullBasePath: '/venues/demo' }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `fecha(${d})` }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useCfdis: (filtros: Record<string, unknown>) => {
    m.ultimosFiltros = filtros
    return { data: { cfdis: m.filas, total: m.filas.length }, isLoading: false, isError: false }
  },
  useDownloadCfdiFile: () => ({ mutate: () => {} }),
  // C3 (ola final, I-1): el aviso de ventas sacadas de la global sin factura del cliente.
  useExtraccionesPendientes: () => ({ data: m.extracciones }),
  // C2 · T10 ronda 1 (I-1): «Consultar estado» tiene su propia mutación (`soloConsultar`): nunca la de cancelar.
  useCancelCfdi: () => ({ mutate: vi.fn(), isPending: false }),
  useConsultarCancelacion: () => ({ mutate: m.consultar, isPending: m.consultando }),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
// La tabla real (paginación, columnas guardadas) no es lo que se prueba: cada fila pinta sus celdas.
vi.mock('@/components/data-table', () => ({
  default: ({ data, columns, toolbarLeft }: { data: any[]; columns: any[]; toolbarLeft?: ReactNode }) => (
    <div>
      {toolbarLeft}
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
// «Nueva factura»: el buscador y la ventana de «Facturar» tienen sus propias pruebas; aquí sólo importa qué se abre y con qué venta.
vi.mock('../components/PickOrderToInvoiceDialog', () => ({
  PickOrderToInvoiceDialog: ({ open, onSelect }: { open: boolean; onSelect: (id: string) => void }) =>
    open ? (
      <button type="button" data-testid="buscador" onClick={() => onSelect('orden-7')}>
        elegir
      </button>
    ) : null,
}))
vi.mock('../components/IssueCfdiDialog', () => ({
  IssueCfdiDialog: ({
    orderId,
    onOpenChange,
    onIssued,
  }: {
    orderId: string
    onOpenChange: (o: boolean) => void
    onIssued?: (factura: { receptorRfc: string; stampedAt?: string }) => void
  }) => (
    <>
      <button type="button" data-testid="facturar" onClick={() => onOpenChange(false)}>
        {orderId}
      </button>
      <button
        type="button"
        data-testid="timbrada"
        onClick={() => {
          onIssued?.({ receptorRfc: 'EKU9003173C9' })
          onOpenChange(false)
        }}
      >
        timbrar
      </button>
      <button
        type="button"
        data-testid="timbrada-vieja"
        onClick={() => {
          onIssued?.({ receptorRfc: 'EKU9003173C9', stampedAt: '2025-01-15T18:00:00.000Z' })
          onOpenChange(false)
        }}
      >
        timbrar (recuperada de otro mes)
      </button>
    </>
  ),
}))
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

// ─── C2-pulido (G3 de la guía): una nota de crédito (CFDI de EGRESO) se distingue y su menú no ofrece lo que no aplica a un egreso ─────
// La A-107/A-108 de la guía salían como «Personal · Timbrada» sin marca, y «Corregir importe (sustituir)» sobre ellas acababa en un 500 del
// servidor. Un egreso sí se descarga, se reenvía (va al correo de la factura original) y se cancela (el SAT lo exige antes que la original).
describe('CfdiList · C2-pulido · G3: la nota de crédito en la lista', () => {
  const individual = (over: Partial<Cfdi>) =>
    factura({ isGlobal: false, flow: 'STAFF_B', orderId: 'o1', globalPeriod: null, complementariaDe: null, ...over })
  const NOTA = es.list.creditNoteBadge
  const SUSTITUIR = es.actions.replace
  const TERMINAR = es.actions.finishReplace

  beforeEach(() => {
    m.permisos = ['cfdi:configure', 'cfdi:issue']
  })

  it('🔴 `type: EGRESO` ⇒ insignia «Nota de crédito»; sin «Corregir importe» ni «Terminar la sustitución»; sí descargar, reenviar y cancelar', () => {
    const sustituta = { id: 's1', uuid: 'U-S', serie: 'A', folio: '16', status: 'STAMPED', totalCents: 100 }
    m.filas = [
      individual({ id: 'nota', type: 'EGRESO' }),
      individual({ id: 'notaRechazada', type: 'EGRESO', cancelStatus: 'REJECTED', replacedBy: [sustituta] as any }),
    ]
    render(<CfdiList />)
    expect(NOTA).toBe('Nota de crédito')
    for (const id of ['nota', 'notaRechazada']) {
      expect(within(fila(id)).getByText(NOTA)).toBeInTheDocument()
      expect(within(fila(id)).queryByRole('button', { name: SUSTITUIR })).not.toBeInTheDocument()
      expect(within(fila(id)).queryByRole('button', { name: TERMINAR })).not.toBeInTheDocument()
      expect(within(fila(id)).getByRole('button', { name: es.actions.downloadXml })).toBeInTheDocument()
      expect(within(fila(id)).getByRole('button', { name: es.actions.sendEmail })).toBeInTheDocument()
      expect(within(fila(id)).getByRole('button', { name: es.actions.cancel })).toBeInTheDocument()
    }
  })

  it('control — una factura de venta (`INGRESO`, o un servidor que manda otra letra) no lleva la insignia y sí ofrece «Corregir importe»', () => {
    m.filas = [individual({ id: 'venta', type: 'INGRESO' }), individual({ id: 'vieja', type: 'I' })]
    render(<CfdiList />)
    for (const id of ['venta', 'vieja']) {
      expect(within(fila(id)).queryByText(NOTA)).not.toBeInTheDocument()
      expect(within(fila(id)).getByRole('button', { name: SUSTITUIR })).toBeInTheDocument()
    }
  })
})

// ─── C3 · Tarea 8 (Codex C3-6/C3-10): la nota que sacó un ticket de la factura global dice en qué va la factura del cliente ─────────────
// «Falta» sólo cuando NO hay ninguna factura del cliente viva; si hay una viva sin timbrar (envío incierto, sustitución en curso) se está
// confirmando con el SAT y NO se vuelve a pedir.
describe('CfdiList · C3 · T8: la extracción de la global y la factura del cliente', () => {
  const extraccion = (over: Partial<Cfdi>) =>
    factura({
      isGlobal: false,
      flow: 'STAFF_B',
      orderId: 'o1',
      globalPeriod: null,
      complementariaDe: null,
      type: 'EGRESO',
      esExtraccion: true,
      ...over,
    })
  const EXTRACCION = es.list.extraccion
  const FALTA = es.list.facturaDelClientePendiente
  const EN_PROCESO = es.list.facturaDelClienteEnProceso

  beforeEach(() => {
    m.permisos = ['cfdi:configure', 'cfdi:issue']
  })

  it('🔴 la fila de la extracción dice «Extracción de la global» (no «Nota de crédito») y, según la factura del cliente, falta o se está confirmando', () => {
    m.filas = [
      extraccion({ id: 'falta', facturaDelCliente: 'FALTA', facturaDelClientePendiente: true }),
      extraccion({ id: 'proceso', facturaDelCliente: 'EN_PROCESO', facturaDelClientePendiente: false }),
      extraccion({ id: 'timbrada', facturaDelCliente: 'TIMBRADA', facturaDelClientePendiente: false }),
    ]
    render(<CfdiList />)
    expect([EXTRACCION, FALTA, EN_PROCESO]).toEqual([
      'Extracción de la global',
      'Falta la factura del cliente: vuelve a facturar la venta.',
      'La factura del cliente se está confirmando con el SAT.',
    ])
    for (const id of ['falta', 'proceso', 'timbrada']) {
      expect(within(fila(id)).getByText(EXTRACCION)).toBeInTheDocument()
      expect(within(fila(id)).queryByText(es.list.creditNoteBadge)).not.toBeInTheDocument()
    }
    expect(within(fila('falta')).getByText(FALTA)).toBeInTheDocument()
    expect(within(fila('falta')).queryByText(EN_PROCESO)).not.toBeInTheDocument()
    expect(within(fila('proceso')).getByText(EN_PROCESO)).toBeInTheDocument()
    expect(within(fila('proceso')).queryByText(FALTA)).not.toBeInTheDocument()
    for (const texto of [FALTA, EN_PROCESO]) expect(within(fila('timbrada')).queryByText(texto)).not.toBeInTheDocument()
  })

  it('control — una nota de crédito normal sigue diciendo «Nota de crédito», y un servidor anterior (sin los campos) no pinta avisos', () => {
    m.filas = [
      extraccion({ id: 'nota', esExtraccion: false, facturaDelCliente: null, facturaDelClientePendiente: false }),
      extraccion({ id: 'viejo', esExtraccion: undefined }),
    ]
    render(<CfdiList />)
    for (const id of ['nota', 'viejo']) {
      expect(within(fila(id)).getByText(es.list.creditNoteBadge)).toBeInTheDocument()
      expect(within(fila(id)).queryByText(EXTRACCION)).not.toBeInTheDocument()
      for (const texto of [FALTA, EN_PROCESO]) expect(within(fila(id)).queryByText(texto)).not.toBeInTheDocument()
    }
  })
})

describe('CfdiList · aviso de ventas sacadas de la global sin factura del cliente (C3, I-1)', () => {
  beforeEach(() => {
    m.filas = []
    m.extracciones = undefined
  })

  it('🔴 sin pendientes (0) o sin respuesta del servidor no se ve el aviso', () => {
    m.extracciones = { total: 0, enProceso: 0 }
    const { rerender } = render(<CfdiList />)
    expect(screen.queryByTestId('aviso-extracciones-pendientes')).not.toBeInTheDocument()
    m.extracciones = undefined
    rerender(<CfdiList />)
    expect(screen.queryByTestId('aviso-extracciones-pendientes')).not.toBeInTheDocument()
  })

  it('🔴 con N pendientes la página de Facturación lo dice con el número', () => {
    m.extracciones = { total: 2, enProceso: 3 }
    render(<CfdiList />)
    const aviso = screen.getByTestId('aviso-extracciones-pendientes')
    expect(aviso).toHaveTextContent('2 ventas se sacaron de tu factura global')
    expect(aviso).toHaveTextContent('Además, 3 se están procesando.')
  })
})

describe('CfdiList — F6: la factura por el total con notas automáticas que faltan', () => {
  beforeEach(() => {
    m.extracciones = undefined
  })

  it('🔴 R7/N10: la fila dice cuántas faltan (ámbar) y, desplegada, un enlace por devolución que se reconoce por su importe', () => {
    m.filas = [
      factura({
        id: 'f1',
        type: 'INGRESO',
        isGlobal: false,
        flow: 'STAFF_B',
        orderId: 'o1',
        globalPeriod: null,
        status: 'STAMPED',
        serie: 'F',
        folio: '9',
        uuid: 'U-1',
        receptorNombre: 'CLIENTE',
        receptorRfc: 'EKU9003173C9',
        totalCents: 11600,
        stampedAt: '2026-10-13T12:00:00.000Z',
        updatedAt: '2026-10-13T12:00:00.000Z',
        notasDeDevolucionPendientes: [
          { refundPaymentId: 'r1', importeCents: 5000, fecha: '2026-10-10T15:00:00.000Z' },
          { refundPaymentId: 'r2', importeCents: 3000, fecha: '2026-10-11T15:00:00.000Z' },
        ],
      }),
    ]
    render(
      <MemoryRouter>
        <CfdiList />
      </MemoryRouter>,
    )
    const resumen = within(fila('f1')).getByText(traducir('list.notasDeDevolucionPendientes', { count: 2 }))
    expect(resumen).toBeInTheDocument()
    // El número va al principio: al final caía solo en otro renglón (guía de Facturación, 14-oct).
    expect(resumen).toHaveTextContent(/^Faltan 2 notas de crédito de devoluciones$/)
    expect(traducir('list.notasDeDevolucionPendientes', { count: 1 })).toBe('Falta 1 nota de crédito de una devolución')
    // Lo que falta, en ámbar (nunca rojo).
    expect(resumen.closest('details')?.className).toContain('text-amber-600')
    const enlaces = within(fila('f1'))
      .getAllByRole('link', { hidden: true })
      .filter(a => a.getAttribute('href')?.includes('/payments/'))
    expect(enlaces.map(a => a.getAttribute('href'))).toEqual(['/venues/demo/payments/r1', '/venues/demo/payments/r2'])
    expect(enlaces[0]).toHaveTextContent('50.00')
    expect(enlaces[1]).toHaveTextContent('30.00')
  })

  it('control — sin `notasDeDevolucionPendientes` (o vacías), la fila de siempre', () => {
    m.filas = [
      factura({ id: 'f2', type: 'INGRESO', isGlobal: false, flow: 'STAFF_B', orderId: 'o2', globalPeriod: null }),
      factura({
        id: 'f3',
        type: 'INGRESO',
        isGlobal: false,
        flow: 'STAFF_B',
        orderId: 'o3',
        globalPeriod: null,
        notasDeDevolucionPendientes: [],
      }),
    ]
    render(
      <MemoryRouter>
        <CfdiList />
      </MemoryRouter>,
    )
    for (const id of ['f2', 'f3']) {
      const aPagos = within(fila(id))
        .queryAllByRole('link', { hidden: true })
        .filter(a => a.getAttribute('href')?.includes('/payments/'))
      expect([id, aPagos]).toEqual([id, []])
      expect(within(fila(id)).queryByText(/Faltan? \d+ notas? de crédito/)).not.toBeInTheDocument()
    }
  })
})

// ─── «Nueva factura» (founder, 28-oct): el botón lo ven los mismos que facturan desde Pedidos ─────────────────────────────────────────
describe('CfdiList · «Nueva factura»', () => {
  const BOTON = es.list.newInvoice

  beforeEach(() => {
    m.filas = []
    m.conFacturacion = true
  })

  it('con `cfdi:issue` y `orders:read` aparece; elegir una venta abre «Facturar» con ESA venta y al cerrarla se va', () => {
    m.permisos = ['cfdi:view', 'cfdi:issue', 'orders:read']
    render(<CfdiList />)

    expect(screen.queryByTestId('buscador')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    fireEvent.click(screen.getByTestId('buscador'))

    expect(screen.queryByTestId('buscador')).not.toBeInTheDocument()
    expect(screen.getByTestId('facturar').textContent).toBe('orden-7')
    fireEvent.click(screen.getByTestId('facturar'))
    expect(screen.queryByTestId('facturar')).not.toBeInTheDocument()
  })

  it('🔴 Codex plan r1 #4 y código r1 #2: al timbrar se quitan los filtros y se busca por el RFC de la factura nueva', async () => {
    m.permisos = ['cfdi:view', 'cfdi:issue', 'orders:read']
    render(<CfdiList />)

    fireEvent.click(screen.getByRole('button', { name: es.filters.receptorRfc }))
    fireEvent.change(screen.getByLabelText(es.filters.receptorRfc), { target: { value: 'xaxx' } })
    await waitFor(() => expect(m.ultimosFiltros.receptorRfc).toBe('XAXX'))

    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    fireEvent.click(screen.getByTestId('buscador'))
    fireEvent.click(screen.getByTestId('timbrada'))

    await waitFor(() => expect(m.ultimosFiltros.receptorRfc).toBe('EKU9003173C9'))
    expect(m.ultimosFiltros).toMatchObject({ page: 1, status: ['STAMPED'] })
    expect(screen.getByLabelText(es.filters.receptorRfc)).toHaveValue('EKU9003173C9')
    expect(screen.queryByTestId('timbrada')).not.toBeInTheDocument()
  })

  it('🔴 Codex código r4: una factura recuperada de un mes anterior amplía el rango desde su día, en el huso del negocio', async () => {
    m.permisos = ['cfdi:view', 'cfdi:issue', 'orders:read']
    render(<CfdiList />)

    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    fireEvent.click(screen.getByTestId('buscador'))
    fireEvent.click(screen.getByTestId('timbrada-vieja'))

    await waitFor(() => expect(m.ultimosFiltros.receptorRfc).toBe('EKU9003173C9'))
    expect(m.ultimosFiltros).toMatchObject({ page: 1, status: ['STAMPED'], from: '2025-01-15' })
  })

  it('control — sin permiso de facturar, sin ver ventas o sin la función de facturación, no aparece', () => {
    for (const [permisos, conFacturacion] of [
      [['cfdi:view', 'orders:read'], true],
      [['cfdi:view', 'cfdi:issue'], true],
      [['cfdi:view', 'cfdi:issue', 'orders:read'], false],
    ] as const) {
      m.permisos = [...permisos]
      m.conFacturacion = conFacturacion
      const { unmount } = render(<CfdiList />)
      expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
      unmount()
    }
  })
})
