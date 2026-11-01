import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Menus from '../Menus'

const rows = [
  { id: '1', name: 'Ambos', appliesToDevices: true, appliesToOnline: true },
  { id: '2', name: 'Solo-ap', appliesToDevices: true, appliesToOnline: false },
  { id: '3', name: 'Solo-web', appliesToDevices: false, appliesToOnline: true },
]

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), Link: () => null }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: rows, isLoading: false }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v', fullBasePath: '/venues/x' }) }))
vi.mock('@/services/menu.service', () => ({ getMenus: vi.fn() }))
vi.mock('../components/MenuWizardDialog', () => ({ MenuWizardDialog: () => null }))
vi.mock('../../MenuMakerLayout', () => ({ useMenuMakerHeader: () => ({ setHeader: vi.fn() }) }))
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
