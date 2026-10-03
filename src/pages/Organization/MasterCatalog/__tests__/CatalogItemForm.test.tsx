import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CatalogItemDetail } from '@/features/master-catalog/types'
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

  it('D15: no pide el IVA ni el objeto de impuesto, explica dónde vive y no los manda', () => {
    const onSubmit = vi.fn()
    render(<CatalogItemForm references={references} onSubmit={onSubmit} isSubmitting={false} />)

    expect(screen.queryByLabelText('IVA')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Objeto de impuesto')).not.toBeInTheDocument()
    expect(screen.getByText(/cada negocio lo elige en sus productos/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('SKU corporativo'), { target: { value: '000124' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Café en grano' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Bolsa de 1 kg' } })
    fireEvent.change(screen.getByLabelText('URL de imagen'), { target: { value: 'https://example.com/cafe.png' } })
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: '1 kg' } })
    fireEvent.change(screen.getByLabelText('Precio de venta'), { target: { value: '300.00' } })
    fireEvent.change(screen.getByLabelText('Costo de compra'), { target: { value: '180.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar artículo' }))

    const command = onSubmit.mock.calls[0][0]
    expect(command).not.toHaveProperty('taxRate')
    expect(command).not.toHaveProperty('objetoImp')
  })

  it('D15: editar un artículo cuyo detalle trae IVA no lo vuelve a mandar', () => {
    const onSubmit = vi.fn()
    const initialItem = {
      id: 'item-1',
      organizationId: 'org-1',
      sku: '000123',
      kind: 'RETAIL_PRODUCT',
      status: 'ACTIVE',
      revision: 3,
      bindingSummary: { total: 0 },
      name: 'Café en grano',
      description: 'Bolsa de 1 kg',
      imageUrl: 'https://example.com/cafe.png',
      brandId: 'brand-1',
      manufacturerId: 'manufacturer-1',
      familyId: 'family-1',
      presentationLabel: '1 kg',
      unit: 'UNIT',
      satProductKey: '50201706',
      satUnitKey: 'H87',
      productType: 'REGULAR',
      iepsMode: 'NONE',
      iepsRate: null,
      iepsQuota: null,
      iepsQuotaUnit: null,
      businessTypes: ['RESTAURANT'],
      taxRate: '0.0000',
      objetoImp: '02',
      brand: { id: 'brand-1', name: 'Avoqado', status: 'ACTIVE', revision: 1 },
      manufacturer: { id: 'manufacturer-1', name: 'Fabricante', status: 'ACTIVE', revision: 1 },
      family: {
        id: 'family-1',
        name: 'Jarabes',
        status: 'ACTIVE',
        revision: 1,
        parent: { id: 'root-1', name: 'Bebidas', status: 'ACTIVE', revision: 1 },
      },
      organizationValues: [
        { id: 'sale', kind: 'SALE_PRICE', amount: '300.00', currency: 'MXN', revision: 1, active: true },
        { id: 'cost', kind: 'PURCHASE_COST', amount: '180.00', currency: 'MXN', revision: 1, active: true },
      ],
      createdById: 'staff-1',
      updatedById: 'staff-1',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
      validation: { state: 'READY', summary: null },
    } as unknown as CatalogItemDetail
    render(<CatalogItemForm references={references} initialItem={initialItem} onSubmit={onSubmit} isSubmitting={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar artículo' }))

    const command = onSubmit.mock.calls[0][0]
    expect(command).toMatchObject({ name: 'Café en grano' })
    expect(command).not.toHaveProperty('taxRate')
    expect(command).not.toHaveProperty('objetoImp')
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
