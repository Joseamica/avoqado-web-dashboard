import api from '@/api'
import type { TerminalType } from '@/types'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}`

export interface DeviceMenusCounts {
  categories: number
  products: number
}

export interface DeviceMenusTerminalRow {
  id: string
  name: string
  type: TerminalType
  model: string | null
  version: string | null
  areaName: string | null
  needsAppUpdate: boolean
  /** Menús elegidos; [] = «Todos los menús». */
  menus: Array<{ id: string; name: string }>
  /** Lo que muestra HOY (con app vieja, todo). */
  sees: DeviceMenusCounts
  /** Lo que mostrará al actualizar la app; null si no aplica (Ruling 11). */
  seesAfterUpdate: DeviceMenusCounts | null
}

export interface DeviceMenusPage {
  everything: DeviceMenusCounts
  terminals: DeviceMenusTerminalRow[]
  total: number
  page: number
  pageSize: number
}

export interface DeviceMenuOption {
  id: string
  name: string
  appliesToOnline: boolean
  /** Categorías directas del menú, encendidas o apagadas (Ruling 15). */
  categoryCount: number
}

export interface DeviceMenuOptionsPage {
  menus: DeviceMenuOption[]
  total: number
  page: number
  pageSize: number
}

export async function getDeviceMenus(venueId: string, params: { page: number; pageSize: number }): Promise<DeviceMenusPage> {
  const res = await api.get(`${base(venueId)}/tpvs/menus`, { params })
  return res.data
}

export async function getDeviceMenuOptions(
  venueId: string,
  params: { search?: string; page: number; pageSize: number },
): Promise<DeviceMenuOptionsPage> {
  const res = await api.get(`${base(venueId)}/tpvs/menus/options`, { params })
  return res.data
}

/** `menuIds: []` = «Todos los menús». */
export async function setTerminalMenus(venueId: string, tpvId: string, menuIds: string[]): Promise<DeviceMenusTerminalRow> {
  const res = await api.put(`${base(venueId)}/tpv/${tpvId}/menus`, { menuIds })
  return res.data
}
