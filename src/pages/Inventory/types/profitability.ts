/**
 * Types for the Profitability page. Real data comes from
 * `pricingApi.getProfitability(venueId)`. Mock rows below are kept as a
 * fallback so the page still renders for QA when the backend isn't reachable.
 */

import type { ProfitabilityApiRow, ProfitabilityStatus as ApiStatus, ProfitabilityStrategy } from '@/services/inventory.service'

export type ProfitabilityType = 'RECIPE' | 'QUANTITY'
export type ProfitabilityStatus = ApiStatus
export type PricingStrategy = ProfitabilityStrategy

/** Shape used by mock data — subset of the API row, all required. */
export interface ProfitabilityRow {
  productId: string
  name: string
  category: string | null
  type: ProfitabilityType
  price: number
  cost: number
  strategy: PricingStrategy
  costLastUpdatedAt: string | null
  priceLastUpdatedAt: string | null
}

/** Derived row consumed by the UI. */
export interface DerivedRow {
  productId: string
  name: string
  category: string | null
  type: ProfitabilityType
  price: number
  /** Unit cost — null when no cost is set (UNDEFINED status). */
  cost: number | null
  strategy: PricingStrategy
  costLastUpdatedAt: string | null
  priceLastUpdatedAt: string | null
  /** Cost as fraction of price. Null when cost is null. */
  costPct: number | null
  /** Absolute margin in money. Null when cost is null. */
  marginAmount: number | null
  /** Margin fraction = (price - cost) / price. Null when cost is null. */
  marginPct: number | null
  status: ProfitabilityStatus
  /** Cost was bumped more recently than price → user might be losing margin */
  costDrift: boolean
}

export interface CategoryPolicy {
  category: string
  targetMarginPct: number
  productsBelow: number
}

export interface GlobalPolicy {
  defaultTargetMarginPct: number
  rounding: 'NONE' | 'NEAREST_50' | 'PSYCHOLOGICAL_99' | 'WHOLE'
  computeBy: 'MARGIN' | 'MARKUP'
  costChangeAlertThresholdPct: number
}

// ---- Status thresholds ----------------------------------------------------

export const STATUS_THRESHOLDS = {
  EXCELLENT: 0.65,
  HEALTHY: 0.5,
  ACCEPTABLE: 0.35,
} as const

export function classifyStatus(marginPct: number | null): ProfitabilityStatus {
  if (marginPct === null) return 'UNDEFINED'
  if (marginPct >= STATUS_THRESHOLDS.EXCELLENT) return 'EXCELLENT'
  if (marginPct >= STATUS_THRESHOLDS.HEALTHY) return 'HEALTHY'
  if (marginPct >= STATUS_THRESHOLDS.ACCEPTABLE) return 'ACCEPTABLE'
  return 'POOR'
}

export function deriveRow(row: ProfitabilityRow): DerivedRow {
  const marginAmount = row.price - row.cost
  const marginPct = row.price > 0 ? marginAmount / row.price : 0
  const costPct = row.price > 0 ? row.cost / row.price : 0
  const costDrift =
    !!row.costLastUpdatedAt &&
    !!row.priceLastUpdatedAt &&
    new Date(row.costLastUpdatedAt).getTime() > new Date(row.priceLastUpdatedAt).getTime()
  return {
    ...row,
    cost: row.cost,
    costPct,
    marginAmount,
    marginPct,
    status: classifyStatus(marginPct),
    costDrift,
  }
}

/** Convert an API row (backend `getProfitability` response) into the UI shape. */
export function apiRowToDerived(api: ProfitabilityApiRow): DerivedRow {
  return {
    productId: api.productId,
    name: api.name,
    category: api.category,
    type: api.type,
    price: api.price,
    cost: api.cost,
    strategy: api.strategy,
    costLastUpdatedAt: api.costLastUpdatedAt,
    priceLastUpdatedAt: api.priceLastUpdatedAt,
    costPct: api.costPct,
    marginAmount: api.marginAmount,
    marginPct: api.marginPct,
    status: api.status,
    costDrift: api.costDrift,
  }
}

// ---- Mock data ------------------------------------------------------------
// 12 recipes (Shake bar/coffee) + the 34 Half & Half quantity products =
// realistic mix to stress-test the curve and table.

const HH = (n: number, name: string, price: number, cost: number, cat = 'Half & Half'): ProfitabilityRow => ({
  productId: `mock-hh-${n.toString().padStart(3, '0')}`,
  name,
  category: cat,
  type: 'QUANTITY',
  price,
  cost,
  strategy: 'MANUAL',
  costLastUpdatedAt: '2026-05-13T18:25:00Z',
  priceLastUpdatedAt: '2026-05-13T18:00:00Z',
})

const RX = (n: number, name: string, price: number, cost: number, cat: string, drift = false): ProfitabilityRow => ({
  productId: `mock-rx-${n.toString().padStart(3, '0')}`,
  name,
  category: cat,
  type: 'RECIPE',
  price,
  cost,
  strategy: 'MANUAL',
  costLastUpdatedAt: drift ? '2026-05-12T10:00:00Z' : '2026-04-20T10:00:00Z',
  priceLastUpdatedAt: drift ? '2026-03-01T10:00:00Z' : '2026-04-20T10:00:00Z',
})

export const mockProfitabilityRows: ProfitabilityRow[] = [
  // ── Half & Half (the catalog we just inserted) ──
  HH(1, 'Clockwork Orange', 95, 68),
  HH(2, 'Rise and Shine', 95, 68),
  HH(3, 'Blue Sky', 95, 68),
  HH(4, 'Flat Belly', 102, 73),
  HH(5, 'Ginger Kale', 102, 73),
  HH(6, 'Super Greens', 102, 73),
  HH(7, 'Black Lemonade', 102, 73),
  HH(8, 'Shot Slim', 59, 42),
  HH(9, 'Shot Antiviral', 59, 42),
  HH(10, 'Shot Digest', 59, 42),
  HH(11, 'Shot Ginger', 59, 42),
  HH(12, 'Shot Boost', 59, 42),
  HH(13, 'Jicamas 200gr', 216, 154),
  HH(14, 'Pepinos 200gr', 216, 154),
  HH(15, 'Jicamas 60gr', 81, 58),
  HH(16, 'Pepinos 60gr', 81, 58),
  HH(17, 'Doradita Plátano', 92, 66),
  HH(18, 'Gordita Plátano', 92, 66),
  HH(19, 'Doradita de Avena', 98, 70),
  HH(20, 'Gordita de Avena', 98, 70),
  HH(21, 'Doradita de Avena c/ Chocolate', 109, 78),
  HH(22, 'Gordita de Avena con Chocolate', 109, 78),
  HH(23, 'Doradita Keto Cacao', 148, 106),
  HH(24, 'Doradita Keto Almendra', 148, 106),
  HH(25, 'Fresa Enchilada Frasco', 238, 170),
  HH(26, 'Mango Enchilado', 193, 138),
  HH(27, 'Nuez Enchilada', 193, 138),
  HH(28, 'Piña Enchilada', 169, 121),
  HH(29, 'Almendra Enchilada', 162, 116),
  HH(30, 'Kiwi Enchilado', 162, 116),
  HH(31, 'Arándano Enchilado', 154, 110),
  HH(32, 'Mix Half & Half', 207, 148),
  HH(33, 'Blueberry', 255, 182),
  HH(34, 'Mix Gourmet', 216, 154),

  // ── Recipes from Shake bar / café (mixed margins) ──
  RX(1, 'Cappuccino chico 8 oz', 55, 8.02, 'Shake bar'),
  RX(2, 'Cappuccino grande 12 oz', 75, 14.56, 'Shake bar'),
  RX(3, 'Café Americano chico', 45, 0.14, 'Shake bar'),
  RX(4, 'Matcha latte chico', 65, 18.4, 'Shake bar'),
  RX(5, 'Matcha latte grande', 75, 24.1, 'Shake bar'),
  RX(6, 'Latte Chico', 70, 12.3, 'Shake bar'),
  RX(7, 'Iced Chai Latte', 85, 27.0, 'Shake bar'),
  RX(8, 'Chai elixir', 110, 76.97, 'Shake bar', true),
  RX(9, 'Brewed strength', 118, 61.84, 'Shake bar', true),
  RX(10, 'Blueberry Bliss', 110, 65.47, 'Shake bar', true),
  RX(11, 'Cacao Strength Glow Latte Leche Coco', 92, 57.82, 'Shake bar', true),
  RX(12, 'Scoop Protein Life Chocolate', 40, 32.75, 'Shake bar', true),

  // ── Salads (recipe, healthy margin) ──
  RX(13, 'Ensalada César', 235, 78, 'Healthy Wifey'),
  RX(14, 'Ensalada Good Gut', 250, 95, 'Healthy Wifey'),
  RX(15, 'Panini Búffalo', 135, 52, 'Healthy Wifey'),
]
