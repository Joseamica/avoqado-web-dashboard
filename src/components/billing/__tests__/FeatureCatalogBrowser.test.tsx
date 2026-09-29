import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureCatalog, type FeatureCatalogPage } from '@/services/featureCatalog.service'
import { FeatureCatalogBrowser } from '../FeatureCatalogBrowser'

vi.mock('@/services/featureCatalog.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/featureCatalog.service')>()),
  getFeatureCatalog: vi.fn(),
}))
vi.mock('react-i18next', async () => {
  const { default: dictionary } = await import('@/locales/en/billing.json')
  return {
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: (key: string, params: Record<string, unknown> = {}) => {
        const value = key.split('.').reduce((entry: any, part) => entry?.[part], dictionary) ?? key
        return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name]))
      },
    }),
  }
})

const entry = (id: string) => ({
  id,
  featureCode: id,
  name: id,
  names: { es: id, en: id, fr: id },
  category: 'sell' as const,
  minimumTier: 'PRO' as const,
  offering: 'CONFIGURABLE' as const,
})
const page = (index: number): FeatureCatalogPage => ({
  catalogVersion: 'v1',
  items: [entry(`Feature page ${index}`)],
  page: index,
  pageSize: 12,
  total: 39,
  totalPages: 4,
})
function mount(props: Parameters<typeof FeatureCatalogBrowser>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <FeatureCatalogBrowser {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getFeatureCatalog).mockImplementation(async params => page(params.page))
})

describe('FeatureCatalogBrowser', () => {
  it('shows the offer choices first, without paging the catalog, and keeps included features outside the count', async () => {
    const onChange = vi.fn()
    mount({
      selection: { eligibleCodes: ['CFDI', 'LOYALTY_PROGRAM', 'CHATBOT'], selectedCodes: [], includedCodes: ['CHATBOT'], choiceCount: 2, onChange },
    })
    expect(getFeatureCatalog).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Chatbot' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'CFDI invoicing' }))
    expect(onChange).toHaveBeenCalledWith(['CFDI'])
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
  it('explains when the features already owned leave too few to complete the offer', () => {
    mount({
      selection: {
        eligibleCodes: ['CFDI', 'LOYALTY_PROGRAM', 'RESERVATIONS'],
        selectedCodes: [],
        includedCodes: ['CFDI', 'LOYALTY_PROGRAM'],
        choiceCount: 2,
        onChange: vi.fn(),
      },
    })
    expect(screen.getByRole('note')).toHaveTextContent('New features left to choose: 1 of 2 needed')
  })
  it('keeps the catalog as read-only exploration while choosing, so no control is duplicated', async () => {
    const user = userEvent.setup()
    vi.mocked(getFeatureCatalog).mockResolvedValue({ ...page(1), items: [entry('CFDI')] })
    mount({ selection: { eligibleCodes: ['CFDI'], selectedCodes: [], includedCodes: [], choiceCount: 1, onChange: vi.fn() } })
    await user.click(screen.getByRole('button', { name: /Explore all features/ }))
    expect(await screen.findByRole('heading', { name: 'CFDI' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })
  it('does not load the catalog until opened, then pages on the server', async () => {
    const user = userEvent.setup()
    mount()
    expect(getFeatureCatalog).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Explore all features/ }))
    expect(await screen.findByText('Feature page 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(await screen.findByText('Feature page 2')).toBeInTheDocument()
    expect(getFeatureCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 12 }), expect.any(AbortSignal))
  })

  it('resets the page and debounces server-side search without discarding matching pages', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /Explore all features/ }))
    await screen.findByText('Feature page 1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Feature page 2')
    await user.type(screen.getByRole('textbox', { name: 'Search for a feature' }), 'invoicing')
    await waitFor(() =>
      expect(getFeatureCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: 'invoicing' }), expect.any(AbortSignal)),
    )
    expect(getFeatureCatalog).toHaveBeenCalledTimes(3)
  })

  it('shows an error and can retry; a failed request does not look like an empty catalog', async () => {
    vi.mocked(getFeatureCatalog).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /Explore all features/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not load')
    vi.mocked(getFeatureCatalog).mockResolvedValue(page(1))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Feature page 1')).toBeInTheDocument()
  })
})
