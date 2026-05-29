// src/config/tpvCatalog.ts
//
// This file mirrors avoqado-server/src/config/tpvCatalog.ts.
// Keep them in sync — update both when changing prices or specs.

export interface TpvSpecs {
  dimensions?: string
  weight?: string
  battery?: string
  display?: string
  os?: string
  connectivity?: string[]
  scanner?: string
  camera?: string
  printer?: string
}

export interface TpvCatalogEntry {
  brand: string
  model: string
  name: string
  description: string
  unitPriceCents: number // MXN, sin IVA
  image: string
  features: string[]
  specs: TpvSpecs
}

export const TPV_CATALOG: Record<string, TpvCatalogEntry> = {
  PAX_A910S: {
    brand: 'PAX',
    model: 'A910S',
    name: 'PAX A910S',
    description: 'Potente TPV de bolsillo con pagos integrados',
    unitPriceCents: 400_000,
    image: '/images/tpv/pax-a910s.png',
    features: [
      'Pantalla táctil 5"',
      'Escáner integrado',
      'Cámara para QR',
      'SIM con internet 4G incluida — sin costo adicional',
    ],
    specs: {
      dimensions: 'TBD',
      weight: 'TBD',
      battery: 'TBD',
      display: '5", 720x1280',
      os: 'Android 8.1',
      connectivity: ['4G LTE', 'WiFi 2.4/5GHz', 'Bluetooth 4.2'],
      scanner: '1D/2D',
      camera: '2MP rear',
      printer: 'Térmica 58mm',
    },
  },
  NEXGO_N62: {
    brand: 'NEXGO',
    model: 'N62',
    name: 'NexGo N62',
    description: 'TPV compacto, ideal para movilidad',
    unitPriceCents: 180_000,
    image: '/images/tpv/nexgo-n62.png',
    features: [
      'Pantalla compacta',
      'Escáner por cámara',
      'Batería extendida',
      'SIM con internet 4G incluida — sin costo adicional',
    ],
    specs: {
      dimensions: 'TBD',
      weight: 'TBD',
      battery: 'TBD',
      display: 'TBD',
      os: 'Android',
      connectivity: ['4G LTE'],
      scanner: 'Cámara',
    },
  },
  NEXGO_N86: {
    brand: 'NEXGO',
    model: 'N86',
    name: 'NexGo N86',
    description: 'TPV premium con pantalla grande y escáner físico',
    unitPriceCents: 300_000,
    image: '/images/tpv/nexgo-n86.png',
    features: [
      'Pantalla 6"',
      'Escáner físico 1D/2D',
      'Cámara para QR',
      'SIM con internet 4G incluida — sin costo adicional',
    ],
    specs: {
      dimensions: 'TBD',
      weight: 'TBD',
      battery: 'TBD',
      display: '6"',
      os: 'Android',
      connectivity: ['4G LTE', 'WiFi'],
      scanner: '1D/2D',
    },
  },
}

export const TAX_RATE = 0.16

export type TpvCatalogKey = keyof typeof TPV_CATALOG

export function formatMxnCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export interface CartLine {
  catalogKey: TpvCatalogKey
  quantity: number
}

export function calculateCartTotals(cart: CartLine[]) {
  let subtotalCents = 0
  for (const line of cart) {
    const entry = TPV_CATALOG[line.catalogKey]
    if (!entry) continue
    subtotalCents += entry.unitPriceCents * line.quantity
  }
  const taxCents = Math.round(subtotalCents * TAX_RATE)
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}
