/**
 * White-Label Presets
 *
 * Pre-configured feature sets for common business types.
 * These presets accelerate setup for new white-label dashboards.
 */

import type { WhiteLabelPreset, PresetName } from '@/types/white-label'

export const WHITE_LABEL_PRESETS: Record<PresetName, WhiteLabelPreset> = {
  telecom: {
    name: 'telecom',
    displayName: 'Telecom / Retail',
    description: 'Dashboard para tiendas de telefonía con control de inventario serializado (IMEI), promotores y comisiones.',
    theme: {
      primaryColor: '#FF6B00',
      brandName: 'Telecom Dashboard',
    },
    enabledFeatures: [
      { code: 'COMMAND_CENTER', source: 'module_specific' },
      { code: 'SERIALIZED_STOCK', source: 'module_specific' },
      { code: 'STORES_ANALYSIS', source: 'module_specific' },
      { code: 'PROMOTERS_AUDIT', source: 'module_specific' },
      { code: 'AVOQADO_COMMISSIONS', source: 'avoqado_core' },
    ],
    featureConfigs: {
      SERIALIZED_STOCK: {
        enabled: true,
        config: {
          showIMEI: true,
          lowStockThreshold: 10,
          requireSerialOnSale: true,
          trackWarranty: true,
        },
      },
      AVOQADO_COMMISSIONS: {
        enabled: true,
        config: {
          payoutFrequency: 'weekly',
          requireApproval: true,
          autoCalculate: true,
        },
      },
    },
  },

  jewelry: {
    name: 'jewelry',
    displayName: 'Joyería',
    description: 'Dashboard para joyerías con avalúos, consignación y control de piezas únicas.',
    theme: {
      primaryColor: '#C9A962',
      brandName: 'Jewelry Dashboard',
    },
    enabledFeatures: [
      { code: 'APPRAISALS', source: 'module_specific' },
      { code: 'CONSIGNMENT', source: 'module_specific' },
      { code: 'AVOQADO_REPORTS', source: 'avoqado_core' },
    ],
    featureConfigs: {
      APPRAISALS: {
        enabled: true,
        config: {
          requireCertificate: true,
          defaultCurrency: 'MXN',
          trackGoldPrice: true,
        },
      },
      CONSIGNMENT: {
        enabled: true,
        config: {
          defaultCommissionRate: 20,
          autoRenewDays: 90,
        },
      },
    },
  },

  retail: {
    name: 'retail',
    displayName: 'Retail General',
    description: 'Dashboard para retail general con reportes, propinas y comisiones del equipo.',
    theme: {
      primaryColor: '#3B82F6',
      brandName: 'Retail Dashboard',
    },
    enabledFeatures: [
      { code: 'AVOQADO_REPORTS', source: 'avoqado_core' },
      { code: 'AVOQADO_TIPS', source: 'avoqado_core' },
      { code: 'AVOQADO_COMMISSIONS', source: 'avoqado_core' },
    ],
    featureConfigs: {
      AVOQADO_TIPS: {
        enabled: true,
        config: {
          distributionMethod: 'equal',
          includeKitchen: false,
        },
      },
      AVOQADO_COMMISSIONS: {
        enabled: true,
        config: {
          payoutFrequency: 'biweekly',
          requireApproval: true,
          autoCalculate: true,
        },
      },
    },
  },

  custom: {
    name: 'custom',
    displayName: 'Personalizado',
    description: 'Empieza desde cero y selecciona exactamente las features que necesitas.',
    theme: {
      primaryColor: '#000000',
      brandName: 'Custom Dashboard',
    },
    enabledFeatures: [],
    featureConfigs: {},
  },
}

/**
 * Get preset by name
 */
export function getPreset(name: PresetName): WhiteLabelPreset {
  return WHITE_LABEL_PRESETS[name]
}

/**
 * Get all available presets
 */
export function getAllPresets(): WhiteLabelPreset[] {
  return Object.values(WHITE_LABEL_PRESETS)
}

/**
 * Get presets excluding custom
 */
export function getBusinessPresets(): WhiteLabelPreset[] {
  return Object.values(WHITE_LABEL_PRESETS).filter(p => p.name !== 'custom')
}
