/**
 * Aparatos claros, Paso 1: los cuadros de arriba de la ficha del aparato (papel, comanda y menú) con su «Cambiar».
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const acceso = vi.hoisted(() => ({ permisos: [] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => acceso.permisos.includes(p) }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}(${Object.values(o).join(',')})` : k) }),
}))

import { DeviceRoleSummary } from '../components/DeviceRoleSummary'
import { papelDelAparato } from '../papelDelAparato'

const BASE = '/venues/galeterie'
const panaderia = { id: 'a1', name: 'Panadería', sendsComanda: false, active: true }
const pintar = (props: Parameters<typeof DeviceRoleSummary>[0]) =>
  render(
    <MemoryRouter>
      <DeviceRoleSummary {...props} />
    </MemoryRouter>,
  )
const cuadro = (tour: string) => document.querySelector(`[data-tour="${tour}"]`) as HTMLElement

beforeEach(() => {
  acceso.permisos = ['area-tickets:configure']
})

describe('DeviceRoleSummary', () => {
  it('PC que emite vales de Panadería sin comanda, con su menú: tres cuadros con su «Cambiar»', () => {
    pintar({
      papel: papelDelAparato({ canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', areaTicketsEnabled: true, fulfillmentArea: panaderia }),
      deviceMenus: { menus: [{ id: 'm1', name: 'Cremería y Panadería' }], needsAppUpdate: false },
      fullBasePath: BASE,
    })
    expect(within(cuadro('device-role-papel')).getByText('device.role.issues')).toBeInTheDocument()
    expect(within(cuadro('device-role-papel')).getByText('device.role.issuesArea(Panadería)')).toBeInTheDocument()
    expect(within(cuadro('device-role-papel')).getByRole('link')).toHaveAttribute('href', `${BASE}/settings/area-tickets#terminals`)
    expect(within(cuadro('device-role-comanda')).getByText('device.role.comandaOff')).toBeInTheDocument()
    expect(within(cuadro('device-role-comanda')).getByRole('link')).toHaveAttribute('href', `${BASE}/settings/area-tickets#areas`)
    expect(within(cuadro('device-role-menu')).getByText('Cremería y Panadería')).toBeInTheDocument()
    expect(within(cuadro('device-role-menu')).getByRole('link')).toHaveAttribute('href', `${BASE}/devices?tab=menus`)
  })

  it('la caja: «Cobra», sin cuadro de comanda; «Todos los menús» y el aviso de actualizar la app', () => {
    pintar({
      papel: papelDelAparato({ canCheckoutAreaTickets: true, areaTicketsEnabled: true }),
      deviceMenus: { menus: [], needsAppUpdate: false },
      fullBasePath: BASE,
    })
    expect(within(cuadro('device-role-papel')).getByText('device.role.charges')).toBeInTheDocument()
    expect(cuadro('device-role-comanda')).toBeNull()
    expect(within(cuadro('device-role-menu')).getByText('device.role.allMenus')).toBeInTheDocument()
  })

  it('una app vieja que no aplica el menú lo dice', () => {
    pintar({ papel: null, deviceMenus: { menus: [{ id: 'm1', name: 'Café' }], needsAppUpdate: true }, fullBasePath: BASE })
    expect(screen.getByText('device.role.menuNeedsUpdate')).toBeInTheDocument()
    expect(cuadro('device-role-papel')).toBeNull()
  })

  it('sin permiso de Vales por área no hay «Cambiar» a esa pantalla (el letrero sí)', () => {
    acceso.permisos = []
    pintar({ papel: papelDelAparato({ canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', areaTicketsEnabled: true, fulfillmentArea: panaderia }), fullBasePath: BASE })
    expect(within(cuadro('device-role-papel')).queryByRole('link')).toBeNull()
    expect(within(cuadro('device-role-comanda')).queryByRole('link')).toBeNull()
  })

  it('sin vales ni menú (TPV o SERVIDOR viejo): no pinta nada', () => {
    const { container } = pintar({ papel: null, fullBasePath: BASE })
    expect(container).toBeEmptyDOMElement()
  })

  it('«Emitir» prendido sin área: dice «Cobra» y por qué, en ámbar (Codex r1 #2)', () => {
    pintar({ papel: papelDelAparato({ canIssueAreaTickets: true, areaTicketsEnabled: true, fulfillmentArea: null }), fullBasePath: BASE })
    expect(within(cuadro('device-role-papel')).getByText('device.role.charges')).toBeInTheDocument()
    expect(within(cuadro('device-role-papel')).getByText('device.role.emitirSinEfecto.sinArea')).toBeInTheDocument()
    expect(cuadro('device-role-comanda')).toBeNull()
  })

  it('Codex r3 #2: con «Preparar después de pagar» y comanda prendida no promete «Manda comanda»', () => {
    pintar({
      papel: papelDelAparato({
        canIssueAreaTickets: true,
        defaultWorkspace: 'AREA_OPERATIONS',
        areaTicketsEnabled: true,
        fulfillmentArea: { ...panaderia, sendsComanda: true, fulfillmentMode: 'PREPARE_ON_PAID' },
      }),
      fullBasePath: BASE,
    })
    expect(cuadro('device-role-papel')).not.toBeNull()
    expect(cuadro('device-role-comanda')).toBeNull()
  })
})
