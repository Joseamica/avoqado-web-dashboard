/**
 * Banking Hub — contrato UI-first para Beneficiarios, Reportes y Dispersiones.
 * (SPEI externo ya se graduó: su envío real vive en financialConnection.service.ts.)
 * Sin backend propio todavía (roadmap Fase B del plan del hub Bancos). Drop-in later: cuando
 * exista backend real, cambiar el cuerpo de cada función por `api.*` y quitar los badges — las
 * firmas ya son provider-agnósticas y no cambian.
 *
 * Reads (beneficiarios, tendencia): stub en memoria, se resetea al recargar la página — honesto
 * sobre no ser durable, nunca pretende ser más de lo que es.
 * Dinero (dispersión): SIEMPRE lanza BankingHubNotImplementedError. La UI ya deja el submit
 * deshabilitado, pero el stub nunca finge un envío exitoso aunque alguien lo invoque directo.
 */

export class BankingHubNotImplementedError extends Error {
  constructor(action: string) {
    super(`${action} no está implementado todavía.`)
    this.name = 'BankingHubNotImplementedError'
  }
}

const delay = <T,>(value: T, ms = 300): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), ms))

// ── Beneficiarios (Beta: CRUD funcional, almacenamiento en memoria por venue — no persiste al recargar) ──

export interface Beneficiary {
  id: string
  name: string
  clabe: string
  bankName: string | null
  alias: string | null
  createdAt: string
}

export type BeneficiaryInput = Pick<Beneficiary, 'name' | 'clabe' | 'bankName' | 'alias'>

const beneficiariesByVenue = new Map<string, Beneficiary[]>()

function beneficiaryStore(venueId: string): Beneficiary[] {
  if (!beneficiariesByVenue.has(venueId)) beneficiariesByVenue.set(venueId, [])
  return beneficiariesByVenue.get(venueId)!
}

export class DuplicateClabeError extends Error {
  constructor() {
    super('Ya existe un beneficiario con esa CLABE.')
    this.name = 'DuplicateClabeError'
  }
}

export const beneficiariesService = {
  async list(venueId: string): Promise<Beneficiary[]> {
    return delay([...beneficiaryStore(venueId)].sort((a, b) => a.name.localeCompare(b.name)))
  },

  async create(venueId: string, input: BeneficiaryInput): Promise<Beneficiary> {
    if (beneficiaryStore(venueId).some(b => b.clabe === input.clabe)) throw new DuplicateClabeError()
    const beneficiary: Beneficiary = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input }
    beneficiaryStore(venueId).push(beneficiary)
    return delay(beneficiary)
  },

  async update(venueId: string, id: string, input: BeneficiaryInput): Promise<Beneficiary> {
    const list = beneficiaryStore(venueId)
    const idx = list.findIndex(b => b.id === id)
    if (idx === -1) throw new Error('Beneficiario no encontrado')
    if (list.some(b => b.id !== id && b.clabe === input.clabe)) throw new DuplicateClabeError()
    list[idx] = { ...list[idx], ...input }
    return delay(list[idx])
  },

  async remove(venueId: string, id: string): Promise<void> {
    const list = beneficiaryStore(venueId)
    const idx = list.findIndex(b => b.id === id)
    if (idx !== -1) list.splice(idx, 1)
    return delay(undefined)
  },
}

// ── Reportes: tendencia Mock. Los totales reales de la página vienen de
// financialConnectionAPI.getMovementStats (ya existe, ya probado) — este stub SOLO cubre
// la proyección de tendencia, que no tiene fuente real todavía. ──

export interface ReportTrendPoint {
  label: string
  amount: number
}

export interface ReportTrend {
  isMock: true
  points: ReportTrendPoint[]
}

/**
 * Curva suave determinística (sin Math.random) para que no "salte" entre renders/refetches.
 * `locale` viene de i18n.language del caller — los meses del eje deben seguir el idioma activo,
 * no quedar fijos en español para usuarios en/fr.
 */
export async function getReportTrend(months = 6, locale = 'es-MX'): Promise<ReportTrend> {
  const now = new Date()
  const points: ReportTrendPoint[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const base = 18000 + i * 2100
    const wave = Math.sin(i * 0.9) * 3200
    return {
      label: d.toLocaleDateString(locale, { month: 'short' }),
      amount: Math.max(0, Math.round(base + wave)),
    }
  })
  return delay({ isMock: true as const, points })
}

// ── SPEI externo: YA NO es stub — el envío real vive en financialConnection.service.ts
// (sendSpeiOut), con backend real en avoqado-server. Este archivo conserva solo lo UI-first. ──

// ── Dispersiones — MUEVE DINERO en lote. Sin backend todavía: el stub lanza siempre. ──

export interface DispersionItemInput {
  clabe: string
  beneficiaryName: string
  amount: number
  concept: string
}

export interface DispersionInput {
  financialAccountId: string
  items: DispersionItemInput[]
}

export interface DispersionResult {
  ok: boolean
  total: number
  succeeded: number
  failed: number
}

export const dispersionService = {
  async run(_venueId: string, _input: DispersionInput): Promise<DispersionResult> {
    throw new BankingHubNotImplementedError('La dispersión de pagos')
  },
}
