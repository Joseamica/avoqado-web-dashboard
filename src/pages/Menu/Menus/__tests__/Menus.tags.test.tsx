import type { ReactNode } from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Menus from '../Menus'

const rows = [
  { id: '1', name: 'Ambos', appliesToDevices: true, appliesToOnline: true },
  { id: '2', name: 'Solo-ap', appliesToDevices: true, appliesToOnline: false },
  { id: '3', name: 'Solo-web', appliesToDevices: false, appliesToOnline: true },
]

const cabecera = vi.hoisted(() => ({ set: vi.fn() }))
const acceso = vi.hoisted(() => ({ permisos: [] as string[] }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => acceso.permisos.includes(p) }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: rows, isLoading: false }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v', fullBasePath: '/venues/x' }) }))
vi.mock('@/services/menu.service', () => ({ getMenus: vi.fn() }))
vi.mock('../components/MenuWizardDialog', () => ({ MenuWizardDialog: () => null }))
vi.mock('../../MenuMakerLayout', () => ({ useMenuMakerHeader: () => ({ setHeader: cabecera.set }) }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('@/components/multiple-cell-values', () => ({ ItemsCell: () => null }))
vi.mock('@/components/data-table', () => ({
  default: ({ data, columns }: any) => {
    const col = columns.find((c: any) => c.id === 'name')
    return (
      <div>
        {data.map((r: any) => (
          <div key={r.id}>{col.cell({ cell: { getValue: () => r.name }, row: { original: r } })}</div>
        ))}
      </div>
    )
  },
}))

describe('Menus: etiqueta de dónde se usa', () => {
  it('la lista marca Sólo aparatos y Sólo tienda en línea, y nada cuando son las dos', () => {
    render(<Menus />)
    expect(screen.getAllByText('menus.dondeSeUsa.soloAparatos')).toHaveLength(1)
    expect(screen.getAllByText('menus.dondeSeUsa.soloTiendaEnLinea')).toHaveLength(1)
    expect(screen.getByText('Ambos').parentElement?.textContent).toBe('Ambos')
  })
})

describe('Menus: «¿En qué aparatos se ve?»', () => {
  // La cabecera va a MenuMakerLayout por setHeader: se pintan las acciones de la última llamada.
  const acciones = () => render(<>{cabecera.set.mock.lastCall?.[0].actions}</>)

  beforeEach(() => {
    acceso.permisos = []
  })

  it('con tpv:read enlaza a Dispositivos › Qué muestra cada aparato', () => {
    acceso.permisos = ['tpv:read']
    render(<Menus />)
    acciones()
    expect(screen.getByRole('link', { name: 'menus.dondeSeUsa.enQueAparatos' })).toHaveAttribute('href', '/venues/x/devices?tab=menus')
  })

  it('sin tpv:read no lo enseña (la ruta de Dispositivos lo pide)', () => {
    render(<Menus />)
    acciones()
    expect(screen.queryByText('menus.dondeSeUsa.enQueAparatos')).not.toBeInTheDocument()
    expect(screen.getByText('menus.newMenu')).toBeInTheDocument()
  })
})
