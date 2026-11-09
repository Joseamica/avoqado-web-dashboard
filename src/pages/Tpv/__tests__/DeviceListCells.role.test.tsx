import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { TpvListDevice } from '@/services/tpv.service'
import { DeviceNameCell, DeviceRoleCell } from '../components/DeviceListCells'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { area?: string }) => (o?.area ? `${k}|${o.area}` : k) }),
}))
vi.mock('../components/useDeviceListLabels', () => ({ useDeviceSubtitle: () => () => 'sub', useDeviceStatusLabel: () => () => 'x' }))

const pos = (o: Partial<TpvListDevice> = {}) =>
  ({ id: 'd1', name: 'Caja', type: 'POS_ANDROID', selfRegistered: true, model: 'SM-X', ...o }) as TpvListDevice
const vales = { enabled: true, activeAreaCount: 2 }
const role = (d: TpvListDevice, v: typeof vales | undefined) =>
  render(
    <MemoryRouter>
      <DeviceRoleCell device={d} vales={v} linkTo="d1" />
    </MemoryRouter>,
  )

describe('DeviceRoleCell', () => {
  it('Emite · área', () => {
    role(
      pos({ canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', fulfillmentArea: { id: 'a', name: 'Panadería', active: true, sendsComanda: true }, areaRoleChosenAt: 'x' }),
      vales,
    )
    expect(screen.getByText('device.papel.emite|Panadería')).toBeTruthy()
    expect(screen.queryByText('list.unconfigured')).toBeNull()
  })
  it('Cobra vales y Sin elegir', () => {
    const a = role(pos({ canCheckoutAreaTickets: true, areaRoleChosenAt: 'x' }), vales)
    expect(screen.getByText('device.papel.cobraVales')).toBeTruthy()
    a.unmount()
    role(pos({ areaRoleChosenAt: 'x' }), vales)
    expect(screen.getByText('device.papel.sinElegir')).toBeTruthy()
  })
  it('Sin configurar sólo si necesitaConfigurar, y es un Link a la ficha', () => {
    role(pos(), vales)
    expect(screen.getByText('list.unconfigured').closest('a')?.getAttribute('href')).toBe('/d1')
  })
  it('servidor viejo: Punto de venta, sin Sin configurar', () => {
    role(pos(), undefined)
    expect(screen.getByText('device.papel.puntoDeVenta')).toBeTruthy()
    expect(screen.queryByText('list.unconfigured')).toBeNull()
  })
  it('terminal de cobro', () => {
    role(pos({ type: 'TPV_ANDROID' }), vales)
    expect(screen.getByText('device.papel.terminalDeCobro')).toBeTruthy()
  })
})

describe('DeviceNameCell · Nombre de fábrica', () => {
  const nombre = (d: TpvListDevice, onRename?: () => void) => render(<DeviceNameCell device={d} name={d.name} onRename={onRename} />)
  it('sólo si el nombre es el de fábrica; Cambiar llama onRename', () => {
    const onRename = vi.fn()
    const a = nombre(pos({ name: 'SM-X (2)' }), onRename)
    expect(screen.getByText('list.factoryName')).toBeTruthy()
    fireEvent.click(screen.getByText('list.factoryNameChange'))
    expect(onRename).toHaveBeenCalled()
    a.unmount()
    nombre(pos({ name: 'Caja 1' }), onRename)
    expect(screen.queryByText('list.factoryName')).toBeNull()
  })
  it('sin permiso no hay Cambiar', () => {
    nombre(pos({ name: 'SM-X' }))
    expect(screen.getByText('list.factoryName')).toBeTruthy()
    expect(screen.queryByText('list.factoryNameChange')).toBeNull()
  })
})
