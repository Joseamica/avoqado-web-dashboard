import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { PrivacyNoticeModal } from './PrivacyNoticeModal'

// i18n: echo key — convención del repo (ver BancosEmptyState.test.tsx).
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/utils/datetime', () => ({
	useVenueDateTime: () => ({ formatDate: (d: string) => d }),
}))

const mockGetPrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
	default: {
		getPrivacyNotice: (...args: unknown[]) => mockGetPrivacyNotice(...args),
		updatePrivacyNotice: vi.fn(),
	},
}))

function renderModal() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<PrivacyNoticeModal venueId="v1" open onClose={vi.fn()} />
		</QueryClientProvider>,
	)
}

// Hallazgo #4 de la ronda final: el server YA devuelve `content` (T10) — el editor debe
// precargar el textarea con el texto vigente en vez de pedirlo de nuevo desde cero.
describe('PrivacyNoticeModal — precarga del texto vigente (T10)', () => {
	it('precarga el textarea con `notice.content` cuando el GET trae una versión vigente', async () => {
		mockGetPrivacyNotice.mockResolvedValue({
			notice: { id: 'n1', content: 'Texto vigente del aviso', contentHash: 'h', language: 'es', createdAt: '2026-01-01' },
		})
		renderModal()

		await waitFor(() => expect(screen.getByTestId('privacy-notice-textarea')).toHaveValue('Texto vigente del aviso'))
	})

	it('sin versión vigente: el textarea arranca vacío (no revienta con `notice` null)', async () => {
		mockGetPrivacyNotice.mockResolvedValue({ notice: null })
		renderModal()

		await waitFor(() => expect(screen.getByTestId('privacy-notice-current-version')).toBeInTheDocument())
		expect(screen.getByTestId('privacy-notice-textarea')).toHaveValue('')
	})
})
