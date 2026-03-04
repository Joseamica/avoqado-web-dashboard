import api from '@/api'

// Re-export LABEL_TYPES from purchaseOrder.service for shared usage
export { LABEL_TYPES } from './purchaseOrder.service'
export type { LabelTemplate as LabelTemplateOption } from './purchaseOrder.service'

export type BarcodeFormat = 'SKU' | 'GTIN' | 'NONE'

export interface ProductLabelConfig {
  labelType: string
  barcodeFormat: BarcodeFormat
  details: {
    sku: boolean
    gtin: boolean
    variantName: boolean
    price: boolean
    itemName: boolean
    unitAbbr: boolean
  }
  items: Array<{ productId: string; quantity: number }>
}

export const labelService = {
  generateProductLabels: async (
    venueId: string,
    config: ProductLabelConfig,
  ): Promise<{ blob: Blob; totalLabels: number }> => {
    const response = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/product-labels`,
      config,
      { responseType: 'blob' },
    )

    const totalLabels = parseInt(response.headers['x-total-labels'] || '0', 10)

    return {
      blob: response.data,
      totalLabels,
    }
  },
}
