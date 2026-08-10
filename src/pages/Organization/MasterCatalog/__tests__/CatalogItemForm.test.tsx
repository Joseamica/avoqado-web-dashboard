import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CatalogItemForm from '../components/CatalogItemForm'
import CatalogValidationSummary from '../components/CatalogValidationSummary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

const references = {
  brands: [{ id: 'brand-1', name: 'Avoqado' }],
  manufacturers: [{ id: 'manufacturer-1', name: 'Fabricante' }],
  families: [{ id: 'family-1', name: 'Jarabes' }],
}

describe('CatalogItemForm', () => {
  it('submits an exact catalog item command with visible required fields', () => {
    const onSubmit = vi.fn()
    render(<CatalogItemForm references={references} onSubmit={onSubmit} isSubmitting={false} />)

    fireEvent.change(screen.getByLabelText('SKU corporativo'), { target: { value: '000123' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Jarabe de agave' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Botella de 1 litro' } })
    fireEvent.change(screen.getByLabelText('URL de imagen'), { target: { value: 'https://example.com/agave.png' } })
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: '1 L' } })
    fireEvent.change(screen.getByLabelText('Tipo de artículo'), { target: { value: 'PREPARED_DISH' } })
    fireEvent.change(screen.getByLabelText('Precio de venta'), { target: { value: '120.00' } })
    fireEvent.change(screen.getByLabelText('Costo de compra'), { target: { value: '80.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar artículo' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: '000123',
        name: 'Jarabe de agave',
        description: 'Botella de 1 litro',
        kind: 'PREPARED_DISH',
        productType: 'FOOD_AND_BEV',
        organizationValues: expect.arrayContaining([
          expect.objectContaining({ kind: 'SALE_PRICE', amount: '120.00' }),
          expect.objectContaining({ kind: 'PURCHASE_COST', amount: '80.00' }),
        ]),
      }),
    )
    expect(screen.getByLabelText('Tipo de producto')).toHaveValue('FOOD_AND_BEV')
  })

  it('announces invalid and stale states and never labels them confirmable', () => {
    render(
      <CatalogValidationSummary
        findings={[
          { code: 'CATALOG_FIELD_REQUIRED', message: 'Falta unidad', severity: 'ERROR' },
          { code: 'CATALOG_PREVIEW_STALE', message: 'El preview cambió', severity: 'STALE' },
        ]}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Falta unidad')
    expect(screen.getByRole('status')).toHaveTextContent('El preview cambió')
    expect(screen.queryByText('Listo para confirmar')).not.toBeInTheDocument()
  })

  it('connects validation errors to the invalid field for assistive technology', () => {
    render(<CatalogItemForm references={references} onSubmit={vi.fn()} isSubmitting={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar artículo' }))

    expect(screen.getByLabelText('SKU corporativo')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('SKU corporativo')).toHaveAccessibleDescription()
  })
})
