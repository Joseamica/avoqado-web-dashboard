import Papa from 'papaparse'
import type {
  BulkOnboardingState,
  BulkVenueEntry,
  BulkVenueTerminal,
  PricingConfig,
  SettlementConfig,
} from '../types'

interface Organization {
  id: string
  slug: string
  name: string
}

interface ParseResult {
  state: Partial<BulkOnboardingState>
  warnings: string[]
  format: 'json' | 'csv'
}

const RATE_KEYS = ['debitRate', 'creditRate', 'amexRate', 'internationalRate'] as const

/** Auto-detect decimal format (0.025) and convert to percentage (2.5) */
function migrateRates(pricing: Partial<PricingConfig>): PricingConfig {
  const p = { ...pricing } as PricingConfig
  if (p.debitRate != null && p.debitRate < 1) {
    for (const key of RATE_KEYS) {
      if (typeof p[key] === 'number') p[key] *= 100
    }
  }
  return p
}

function parseTerminals(item: Record<string, unknown>): BulkVenueTerminal[] {
  // Support both "terminals" array and "terminal_serial_N" columns
  if (Array.isArray(item.terminals)) {
    return item.terminals.map((t: Record<string, string>) => ({
      clientId: crypto.randomUUID(),
      serialNumber: t.serialNumber || '',
      name: t.name || '',
      type: t.type || 'TPV_ANDROID',
      brand: t.brand,
      model: t.model,
    }))
  }

  // CSV-style terminal_serial_1, terminal_name_1, terminal_type_1
  const terminals: BulkVenueTerminal[] = []
  for (let i = 1; i <= 10; i++) {
    const serial = item[`terminal_serial_${i}`] as string | undefined
    if (!serial) break
    terminals.push({
      clientId: crypto.randomUUID(),
      serialNumber: serial,
      name: (item[`terminal_name_${i}`] as string) || `Terminal ${i}`,
      type: (item[`terminal_type_${i}`] as string) || 'TPV_ANDROID',
    })
  }
  return terminals
}

function parseVenueItem(item: Record<string, unknown>): BulkVenueEntry {
  return {
    clientId: crypto.randomUUID(),
    name: (item.name as string) || 'Sin nombre',
    address: item.address as string | undefined,
    city: item.city as string | undefined,
    state: item.state as string | undefined,
    country: item.country as string | undefined,
    zipCode: item.zipCode as string | undefined,
    phone: item.phone as string | undefined,
    email: item.email as string | undefined,
    website: item.website as string | undefined,
    latitude: item.latitude != null ? Number(item.latitude) : undefined,
    longitude: item.longitude != null ? Number(item.longitude) : undefined,
    type: item.type as string | undefined,
    entityType: item.entityType as string | undefined,
    rfc: item.rfc as string | undefined,
    legalName: item.legalName as string | undefined,
    terminals: parseTerminals(item),
    pricingOverride: item.pricing ? migrateRates(item.pricing as PricingConfig) : undefined,
    settlementOverride: item.settlement ? (item.settlement as SettlementConfig) : undefined,
  }
}

export function parseJsonTemplate(text: string, orgs: Organization[]): ParseResult {
  const parsed = JSON.parse(text)
  const warnings: string[] = []
  const state: Partial<BulkOnboardingState> = {}

  // Resolve organization
  if (parsed.organizationSlug) {
    const org = orgs.find(o => o.slug === parsed.organizationSlug)
    if (org) {
      state.organizationId = org.id
    } else {
      warnings.push(`Organización "${parsed.organizationSlug}" no encontrada. Selecciónala manualmente.`)
    }
  }

  // Defaults
  if (parsed.defaults) {
    state.defaults = {
      venueType: parsed.defaults.venueType || 'RESTAURANT',
      timezone: parsed.defaults.timezone || 'America/Mexico_City',
      currency: parsed.defaults.currency || 'MXN',
      country: parsed.defaults.country || 'MX',
      entityType: parsed.defaults.entityType || '',
    }
  }

  // Pricing
  if (parsed.pricing) {
    state.pricing = migrateRates(parsed.pricing)
  }

  // Settlement
  if (parsed.settlement) {
    state.settlement = {
      debitDays: parsed.settlement.debitDays ?? 1,
      creditDays: parsed.settlement.creditDays ?? 3,
      amexDays: parsed.settlement.amexDays ?? 5,
      internationalDays: parsed.settlement.internationalDays ?? 7,
      otherDays: parsed.settlement.otherDays ?? 3,
      dayType: parsed.settlement.dayType || 'BUSINESS_DAYS',
      cutoffTime: parsed.settlement.cutoffTime,
      cutoffTimezone: parsed.settlement.cutoffTimezone,
    }
  }

  // Venues
  if (Array.isArray(parsed.venues)) {
    state.venues = parsed.venues.map((item: Record<string, unknown>) => parseVenueItem(item))
    if (state.venues!.length === 0) {
      warnings.push('La plantilla no contiene venues.')
    }
  }

  return { state, warnings, format: 'json' }
}

export function parseCsvTemplate(text: string): ParseResult {
  const warnings: string[] = []

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0) {
    const errorMsgs = result.errors.slice(0, 3).map(e => e.message)
    warnings.push(`Errores en CSV: ${errorMsgs.join('; ')}`)
  }

  const venues: BulkVenueEntry[] = result.data
    .filter(row => row.name?.trim())
    .map(row => parseVenueItem(row as unknown as Record<string, unknown>))

  if (venues.length === 0) {
    warnings.push('No se encontraron venues válidos en el CSV.')
  }

  return {
    state: { venues },
    warnings,
    format: 'csv',
  }
}
