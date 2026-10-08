import { useTranslation } from 'react-i18next'

import { getDeviceRole, type DeviceListInput, type DeviceListStatus } from '../deviceListPresentation'

/** «Sin conexión · hace 2 h». Sólo el estado sin conexión lleva el «hace cuánto». */
export function useDeviceStatusLabel() {
  const { t } = useTranslation('tpv')
  return (status: DeviceListStatus): string => {
    const base = t(`list.status.${status.key}`)
    if (status.key !== 'offline' || !status.lastSeen) return base
    const ago = t(`list.lastSeen.${status.lastSeen.unit}`, { count: status.lastSeen.count })
    return `${base} · ${ago}`
  }
}

/** «NEXGO N86 · Terminal de cobro». El modelo ya suele traer la marca; no se repite. */
export function useDeviceSubtitle() {
  const { t } = useTranslation('tpv')
  return (device: DeviceListInput): string => {
    const role = t(`list.role.${getDeviceRole(device)}`)
    const model = device.model?.trim()
    return model ? `${model} · ${role}` : role
  }
}
