import { describe, expect, it } from 'vitest'

import { catalogLeafFamilies, prepareCatalogItemUpdate } from './catalog-item-command'
import type { CatalogItemCommand, CatalogItemDetail, CatalogReference } from './types'

function command(): CatalogItemCommand {
  return {
    sku: '000123',
    kind: 'RETAIL_PRODUCT',
    name: 'Jarabe',
    description: 'Botella',
    imageUrl: 'https://example.com/jarabe.png',
    brandId: 'brand-1',
    manufacturerId: 'manufacturer-1',
    familyId: 'leaf-1',
    presentationLabel: '1 L',
    unit: 'LITER',
    taxRate: '0.1600',
    satProductKey: '01010101',
    satUnitKey: 'LTR',
    objetoImp: '02',
    productType: 'REGULAR',
    iepsMode: 'NONE',
    iepsRate: null,
    iepsQuota: null,
    iepsQuotaUnit: null,
    businessTypes: ['RESTAURANT'],
    organizationValues: [
      { kind: 'SALE_PRICE', amount: '125.00', currency: 'MXN' },
      { kind: 'PURCHASE_COST', amount: '82.00', currency: 'MXN' },
    ],
  }
}

function item(): CatalogItemDetail {
  return {
    ...command(),
    id: 'item-1',
    organizationId: 'org-1',
    status: 'ACTIVE',
    revision: 9,
    bindingSummary: { total: 2 },
    brand: { id: 'brand-1', name: 'Avoqado', status: 'ACTIVE', revision: 1 },
    manufacturer: { id: 'manufacturer-1', name: 'Avoqado', status: 'ACTIVE', revision: 1 },
    family: {
      id: 'leaf-1',
      name: 'Jarabes',
      status: 'ACTIVE',
      revision: 1,
      parent: { id: 'root-1', name: 'Bebidas', status: 'ACTIVE', revision: 1 },
    },
    organizationValues: [
      { id: 'sale-mxn', kind: 'SALE_PRICE', amount: '120.00', currency: 'MXN', revision: 4, active: true },
      { id: 'cost-mxn', kind: 'PURCHASE_COST', amount: '80.00', currency: 'MXN', revision: 5, active: true },
      { id: 'sale-usd', kind: 'SALE_PRICE', amount: '7.50', currency: 'USD', revision: 6, active: true },
      { id: 'old-cost', kind: 'PURCHASE_COST', amount: '75.00', currency: 'USD', revision: 3, active: false },
    ],
    createdById: 'staff-1',
    updatedById: 'staff-1',
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    validation: { state: 'READY', summary: null },
  }
}

describe('catalog item command authority', () => {
  it('preserves every active currency and sends exact rule revisions on update', () => {
    expect(prepareCatalogItemUpdate(item(), command())).toEqual(
      expect.objectContaining({
        expectedRevision: 9,
        organizationValueDeactivations: [],
        organizationValues: [
          { kind: 'SALE_PRICE', amount: '125.00', currency: 'MXN', expectedRuleRevision: 4 },
          { kind: 'PURCHASE_COST', amount: '82.00', currency: 'MXN', expectedRuleRevision: 5 },
          { kind: 'SALE_PRICE', amount: '7.50', currency: 'USD', expectedRuleRevision: 6 },
        ],
      }),
    )
  })

  it('only exposes active leaf families with an active parent', () => {
    const references = [
      { id: 'root', name: 'Bebidas', status: 'ACTIVE', revision: 1, parent: null },
      {
        id: 'leaf',
        name: 'Jarabes',
        status: 'ACTIVE',
        revision: 1,
        parent: { id: 'root', name: 'Bebidas', status: 'ACTIVE' },
      },
      {
        id: 'retired-parent',
        name: 'Legacy',
        status: 'ACTIVE',
        revision: 1,
        parent: { id: 'old-root', name: 'Legacy root', status: 'RETIRED' },
      },
    ] satisfies CatalogReference[]

    expect(catalogLeafFamilies(references)).toEqual([references[1]])
  })
})
