import { useTranslation } from 'react-i18next'

import type { DeviceFormFactorKey } from '@/lib/device-kind'

/**
 * Etiquetas de cada clase de aparato, en el idioma del usuario.
 *
 * Vive en su propio archivo (y no junto a `DeviceTypeCell`) porque un archivo que
 * exporta un componente Y un hook rompe el fast refresh de Vite.
 *
 * Lo comparten la columna "Tipo" y su filtro a propósito: si la columna dijera
 * "Terminal de mano" y el filtro otra cosa, el dueño no sabría que son lo mismo.
 *
 * ⚠️ Namespace `tpv` explícito. `Tpvs.tsx` llama sus claves como `t('tpv.filter.x')`
 * desde el namespace por defecto, donde NO resuelven: caen a su `defaultValue` en
 * español, así que esa página se ve en español aunque el usuario esté en inglés o
 * francés. Bug preexistente de esa pantalla; aquí no se hereda.
 */
export function useDeviceKindLabels(): Record<DeviceFormFactorKey, string> {
  const { t } = useTranslation('tpv')
  return {
    PHONE: t('deviceKind.phone', { defaultValue: 'Teléfono' }),
    TABLET: t('deviceKind.tablet', { defaultValue: 'Tablet' }),
    HANDHELD_POS: t('deviceKind.handheldPos', { defaultValue: 'Terminal de mano' }),
    COUNTERTOP_POS: t('deviceKind.countertopPos', { defaultValue: 'POS de mostrador' }),
    DESKTOP: t('deviceKind.desktop', { defaultValue: 'Computadora' }),
    UNKNOWN: t('deviceKind.unknown', { defaultValue: 'Sin identificar' }),
  }
}
