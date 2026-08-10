import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogItemsPage from '../CatalogItemsPage'
import { useCatalogItems } from '@/features/master-catalog/use-catalog-items'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'

vi.mock('@/features/master-catalog/use-catalog-items', () => ({ useCatalogItems: vi.fn() }))
vi.mock('@/features/master-catalog/use-master-catalog-access', () => ({ useMasterCatalogAccess: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

const mockedItems = vi.mocked(useCatalogItems)
const mockedAccess = vi.mocked(useMasterCatalogAccess)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/organizations/org-1/master-catalog/items']}>
      <Routes>
        <Route path="/organizations/:orgId/master-catalog/items" element={<CatalogItemsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CatalogItemsPage', () => {
  beforeEach(() => {
    mockedItems.mockReturnValue({
      items: [
        {
          id: 'item-1',
          sku: '000123',
          name: 'Jarabe de agave',
          kind: 'RETAIL_PRODUCT',
          status: 'ACTIVE',
          revision: 3,
          bindingSummary: { total: 2 },
        },
      ],
      nextCursor: 'item-1',
      isLoading: false,
      isFetching: false,
      error: null,
      status: 'ACTIVE',
      setStatus: vi.fn(),
      loadNext: vi.fn(),
      loadPrevious: vi.fn(),
      canGoBack: true,
      refresh: vi.fn(),
    } as never)
    mockedAccess.mockReturnValue({ canRead: true, canMutateContent: true } as never)
  })

  it('renders the tenant page as an accessible paginated table and preserves leading-zero SKU text', () => {
    renderPage()

    expect(screen.getByRole('table')).toHaveAccessibleName('Artículos corporativos')
    expect(screen.getByText('000123')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Jarabe de agave/i })).toHaveAttribute(
      'href',
      '/organizations/org-1/master-catalog/items/item-1',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente página' }))
    expect(mockedItems.mock.results[0]?.value.loadNext).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(mockedItems.mock.results[0]?.value.loadPrevious).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recargar artículos' }))
    expect(mockedItems.mock.results[0]?.value.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps mutation affordances hidden for a VIEWER', () => {
    mockedAccess.mockReturnValue({ canRead: true, canMutateContent: false } as never)
    renderPage()

    expect(screen.queryByRole('link', { name: 'Crear artículo' })).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
