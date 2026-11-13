import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreatePaymentLinkDialog from '../CreatePaymentLinkDialog'
import PaymentLinks from '../PaymentLinks'
import { PaymentLinkDetailSheet } from '../PaymentLinkDetailSheet'
import { ItemFormSection, type BundleItem } from '../components/ItemFormSection'
import type { PaymentLink } from '@/services/paymentLink.service'

// Liga por prenda (IQ): la clienta elige la talla al pagar. Contrato del SERVIDOR: `productGroupId` + purpose ITEM, sin items ni
// descuento, `amountType: 'FIXED'` aunque no haya monto, reutilizable forzado; 403 sin Pro; sólo Stripe.
const state = vi.hoisted(() => ({ hasAccess: true, merchants: [] as unknown[], stub: false }))
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  navigate: vi.fn(),
  groups: vi.fn(),
  products: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-a', venue: { name: 'IQ' }, fullBasePath: '/venues/iq' }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: state.hasAccess, requiredTier: 'PRO', isLoading: false, isResolved: true }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: () => '', formatDateTime: (iso: string) => iso }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ search: '', pathname: '/', hash: '' }),
}))
vi.mock('@/services/productGroups.service', () => ({ listProductGroups: mocks.groups }))
vi.mock('@/services/menu.service', () => ({ getProducts: mocks.products }))
vi.mock('@/services/customer.service', () => ({ default: { getCustomers: async () => ({ data: [], meta: {} }) } }))
vi.mock('@/services/team.service', () => ({ default: { getTeamMembers: async () => ({ data: [] }) } }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => state.merchants } }))
vi.mock('@/services/paymentLink.service', () => ({
  default: {
    createPaymentLink: mocks.create,
    getSettings: async () => ({}),
    getPaymentLinks: async () => ({
      total: 1,
      paymentLinks: [
        {
          id: 'l1',
          shortCode: 'P',
          title: 'Vestido lino',
          amountType: 'FIXED',
          currency: 'MXN',
          status: 'ACTIVE',
          isReusable: true,
          paymentCount: 0,
          totalCollected: 0,
          purpose: 'ITEM',
          productGroup: { id: 'g1', name: 'Vestido lino' },
        },
      ],
    }),
  },
}))
vi.mock('@/components/data-table', () => ({
  default: ({
    columns,
    data,
  }: {
    columns: Array<{ accessorKey?: string; cell?: (c: unknown) => unknown }>
    data: Array<{ id: string }>
  }) => (
    <div>
      {data.map(row => (
        <div key={row.id} data-testid={`fila-${row.id}`}>
          {columns.find(c => c.accessorKey === 'title')?.cell?.({ row: { original: row } }) as never}
        </div>
      ))}
    </div>
  ),
}))
// El buscador real vive en un popover de Radix; aquí basta con ver sus renglones y poder elegirlos.
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({
    items,
    onSelect,
  }: {
    items: Array<{ id: string; label: string; endLabel?: string }>
    onSelect: (i: { id: string }) => void
  }) => (
    <ul>
      {items.map(i => (
        <li key={i.id}>
          <button type="button" onClick={() => onSelect(i)}>
            {i.label}|{i.endLabel}
          </button>
        </li>
      ))}
    </ul>
  ),
}))
vi.mock('../components/PaymentLinkPreview', () => ({ PaymentLinkPreview: () => null }))
vi.mock('../components/DonationPreview', () => ({ DonationPreview: () => null }))
vi.mock('../components/ItemPreview', () => ({ ItemPreview: () => null }))
vi.mock('../components/ShareActions', () => ({ ShareActions: () => null }))

const stripe = { id: 'm-stripe', chargesEnabled: true, provider: { code: 'STRIPE_CONNECT', name: 'Stripe' } }
const blumon = { id: 'm-blumon', provider: { code: 'BLUMON', name: 'Blumon' } }
const vestido = { id: 'g1', name: 'Vestido lino', imageUrl: null, categoryId: 'c', variantCount: 4, minPrice: 900, maxPrice: 900 }
const playera = { id: 'p1', name: 'Playera', price: 100, modifierGroups: [] }

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>
)

function Harness(p: { needStripe?: boolean; initialGroup?: { id: string; name: string } | null; onGroup?: (g: unknown) => void }) {
  const [items, setItems] = useState<BundleItem[]>([])
  const [group, setGroup] = useState<{ id: string; name: string } | null>(p.initialGroup ?? null)
  return wrap(
    <ItemFormSection
      selectedItems={items}
      onItemsChange={setItems}
      customFields={[]}
      onCustomFieldsChange={vi.fn()}
      customFieldsEnabled={false}
      onCustomFieldsEnabledChange={vi.fn()}
      tippingConfig={null}
      onTippingConfigChange={vi.fn()}
      redirectUrl=""
      onRedirectUrlChange={vi.fn()}
      redirectEnabled={false}
      onRedirectEnabledChange={vi.fn()}
      selectedGroup={group}
      onGroupChange={g => {
        p.onGroup?.(g)
        setGroup(g)
      }}
      groupsNeedStripe={p.needStripe}
    />,
  )
}

beforeEach(() => {
  state.hasAccess = true
  state.merchants = [stripe]
  mocks.groups.mockResolvedValue({ items: [vestido], total: 1, page: 1, pageSize: 20 })
  mocks.products.mockResolvedValue([playera])
  mocks.create.mockResolvedValue({ success: true, data: { id: 'l1', title: 'Vestido lino' } })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('buscador de «Vender un producto»', () => {
  it('ofrece también las prendas, con la etiqueta «La clienta elige talla»', async () => {
    render(<Harness />)
    expect(await screen.findByText('Vestido lino|itemForm.sizeChoice')).toBeVisible()
    expect(screen.getByText(/^Playera\|/)).toBeVisible()
    expect(mocks.groups).toHaveBeenCalledWith('venue-a', expect.objectContaining({ page: 1, search: undefined }))
  })

  it('al elegir una prenda: avisa, esconde los productos y deja «Reutilizable» prendido y bloqueado', async () => {
    const onGroup = vi.fn()
    render(<Harness onGroup={onGroup} />)
    fireEvent.click(await screen.findByText('Vestido lino|itemForm.sizeChoice'))
    expect(onGroup).toHaveBeenCalledWith({ id: 'g1', name: 'Vestido lino' })
    expect(await screen.findByText('itemForm.groupNote')).toBeVisible()
    expect(screen.queryByText(/^Playera\|/)).toBeNull()
    const reutilizable = screen.getByRole('switch', { name: 'itemForm.groupReusable' })
    expect(reutilizable).toBeChecked()
    expect(reutilizable).toBeDisabled()
  })

  it('sin PRODUCT_VARIANTS la opción se ve con candado y lleva al plan; no pide las familias', async () => {
    state.hasAccess = false
    render(<Harness />)
    const candado = await screen.findByRole('button', { name: /itemForm\.groupLocked/ })
    expect(mocks.groups).not.toHaveBeenCalled()
    fireEvent.click(candado)
    expect(mocks.navigate).toHaveBeenCalledWith('/venues/iq/settings/billing')
  })

  it('con un comercio que no es Stripe se ve en gris con la razón y no ofrece prendas', async () => {
    render(<Harness needStripe />)
    expect(await screen.findByText('itemForm.groupNeedsStripe')).toBeVisible()
    expect(screen.queryByText(/Vestido lino/)).toBeNull()
  })
})

describe('crear la liga por prenda', () => {
  async function abrirYElegirPrenda() {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })
    fireEvent.click(screen.getByText('wizard.itemTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    fireEvent.click(await screen.findByText('Vestido lino|itemForm.sizeChoice'))
  }

  it('manda productGroupId, FIXED, reutilizable, sin items ni descuento', async () => {
    await abrirYElegirPrenda()
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    const body = mocks.create.mock.calls[0][1]
    expect(body).toMatchObject({ purpose: 'ITEM', productGroupId: 'g1', amountType: 'FIXED', isReusable: true, title: 'Vestido lino' })
    expect(body).not.toHaveProperty('items')
    expect(body).not.toHaveProperty('discount')
    expect(body).not.toHaveProperty('amount')
    expect(screen.queryByText('discount.title')).toBeNull()
  })

  it('con un comercio que no es Stripe no ofrece prendas', async () => {
    state.merchants = [blumon]
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })
    fireEvent.click(screen.getByText('wizard.itemTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    expect(await screen.findByText('itemForm.groupNeedsStripe')).toBeVisible()
    expect(screen.queryByText(/Vestido lino/)).toBeNull()
  })

  it('regresión: la liga de varios productos sigue igual (items, sin productGroupId)', async () => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })
    fireEvent.click(screen.getByText('wizard.itemTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    fireEvent.click(await screen.findByText(/^Playera\|/))
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    const body = mocks.create.mock.calls[0][1]
    expect(body).toMatchObject({ purpose: 'ITEM', amountType: 'FIXED', amount: 100, isReusable: false })
    expect(body.items).toEqual([{ productId: 'p1', quantity: 1, modifiers: [] }])
    expect(body).not.toHaveProperty('productGroupId')
  })
})

describe('lista y detalle', () => {
  it('la lista dice «Prenda: <nombre> · la clienta elige talla»', async () => {
    render(wrap(<PaymentLinks />))
    expect(await screen.findByText(/list\.garment/)).toHaveTextContent('Vestido lino')
  })

  it('el detalle también', async () => {
    const link = { id: 'l1', shortCode: 'P', title: 'Vestido lino', amountType: 'FIXED', currency: 'MXN', status: 'ACTIVE', isReusable: true, paymentCount: 0, totalCollected: 0, productGroup: { id: 'g1', name: 'Vestido lino' } } as PaymentLink
    render(wrap(<PaymentLinkDetailSheet link={link} open onOpenChange={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} />))
    expect((await screen.findAllByText(/list\.garment/))[0]).toHaveTextContent('Vestido lino')
  })
})
