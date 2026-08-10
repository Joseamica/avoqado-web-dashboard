import { describe, expect, it } from 'vitest'

import { matchesLegacyProductSearch, normalizeCreateProductPayload } from '@/services/menu.service'
import { buildMasterCatalogErrorPresentation, describeMasterCatalogRowError } from '@/features/master-catalog/errors'

describe('legacy product compatibility with master catalog governance', () => {
  it('trims a submitted GTIN and omits a blank one at the API boundary', () => {
    expect(normalizeCreateProductPayload({ sku: '  SKU-01  ', gtin: '  000123  ', name: 'Coffee' })).toEqual({
      sku: '  SKU-01  ',
      gtin: '000123',
      name: 'Coffee',
    })
    expect(normalizeCreateProductPayload({ sku: 'SKU-02', gtin: '   ', name: 'Tea' })).toEqual({
      sku: 'SKU-02',
      name: 'Tea',
    })
  })

  it('finds legacy products by SKU or GTIN without querying the master catalog', () => {
    const product = {
      name: 'Sparkling water',
      sku: 'AGUA-001',
      gtin: '0007501234567',
      category: { name: 'Beverages' },
      modifierGroups: [],
    }

    expect(matchesLegacyProductSearch(product, 'agua-001')).toBe(true)
    expect(matchesLegacyProductSearch(product, '0007501234567')).toBe(true)
    expect(matchesLegacyProductSearch(product, 'not-present')).toBe(false)
  })

  it('builds an actionable catalog presentation only when catalog read access exists', () => {
    const error = {
      response: {
        status: 422,
        data: {
          code: 'CATALOG_GOVERNANCE_REQUIRED',
          message: 'Este producto debe crearse desde el Catálogo maestro.',
        },
      },
    }
    const t = (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key

    expect(buildMasterCatalogErrorPresentation(error, { organizationId: 'org-1', canRead: true, t })?.actionPath).toBe(
      '/organizations/org-1/master-catalog',
    )
    expect(buildMasterCatalogErrorPresentation(error, { organizationId: 'org-1', canRead: false, t })?.actionPath).toBeNull()
  })

  it('formats each bounded menu-import row without collapsing its SKU and position', () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      key === 'masterCatalog:errors.importRow'
        ? `Category ${options?.category}, product ${options?.product}, SKU ${options?.sku}`
        : ((options?.defaultValue as string) ?? key)

    expect(
      describeMasterCatalogRowError({ categoryOrdinal: 2, productOrdinal: 3, sku: 'SKU-03', code: 'CATALOG_GOVERNANCE_REQUIRED' }, t),
    ).toContain('Category 2, product 3, SKU SKU-03')
  })
})
