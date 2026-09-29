import { publicApi } from '@/api'
import type { TierId } from '@/config/plan-catalog'

export const FEATURE_CATEGORIES = ['sell', 'customers', 'inventory', 'money', 'team', 'ai', 'custom'] as const
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number]
export interface FeatureCatalogEntry {
  id: string
  featureCode: string | null
  name: string
  names: Record<'es' | 'en' | 'fr', string>
  category: FeatureCategory
  minimumTier: TierId | null
  offering: 'INCLUDED' | 'CONFIGURABLE' | 'CONTACT'
}

export interface FeatureCatalogPage {
  catalogVersion: string
  items: FeatureCatalogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getFeatureCatalog(
  params: { q?: string; category?: FeatureCategory; page: number; pageSize: number },
  signal?: AbortSignal,
) {
  const response = await publicApi.get<{ data: FeatureCatalogPage }>('/api/v1/public/feature-catalog', { params, signal })
  return response.data.data
}
