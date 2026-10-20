import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const mockUpdatePrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
	default: {
		getPrivacyNotice: (...args: unknown[]) => mockGetPrivacyNotice(...args),
		updatePrivacyNotice: (...args: unknown[]) => mockUpdatePrivacyNotice(...args),
	},
}))

function renderModal(props: { onClose?: () => void; onSaved?: () => void } = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<PrivacyNoticeModal venueId="v1" open onClose={props.onClose ?? vi.fn()} onSaved={props.onSaved} />
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

// Pedidos en línea pasa `onSaved` para cerrar el editor al publicar; Clientes y la pestaña del negocio no lo pasan y el editor se
// queda abierto mostrando la versión vigente, como siempre.
describe('PrivacyNoticeModal — qué pasa al guardar', () => {
	const plantilla = { id: null, content: null, draftContent: 'Propuesta del aviso', contentHash: null, language: 'es', createdAt: null, esPlantilla: true }
	const guardar = async () => {
		await waitFor(() => expect(screen.getByTestId('privacy-notice-textarea')).toHaveValue('Propuesta del aviso'))
		await userEvent.click(screen.getByTestId('privacy-notice-save'))
		await waitFor(() => expect(mockUpdatePrivacyNotice).toHaveBeenCalledWith('v1', { content: 'Propuesta del aviso', language: 'es' }))
	}

	it('con onSaved, lo llama una vez después de guardar con éxito (y no llama onClose por su cuenta)', async () => {
		mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
		mockUpdatePrivacyNotice.mockResolvedValue({ notice: { ...plantilla, id: 'n1', content: 'Propuesta del aviso', esPlantilla: false } })
		const onSaved = vi.fn()
		const onClose = vi.fn()
		renderModal({ onSaved, onClose })
		await guardar()
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
		expect(onClose).not.toHaveBeenCalled()
	})

	it('sin onSaved, el editor sigue abierto tras guardar (Clientes y la pestaña del negocio, como hoy)', async () => {
		mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
		mockUpdatePrivacyNotice.mockResolvedValue({ notice: { ...plantilla, id: 'n1', content: 'Propuesta del aviso', esPlantilla: false } })
		const onClose = vi.fn()
		renderModal({ onClose })
		await guardar()
		await new Promise(r => setTimeout(r, 30))
		expect(screen.getByTestId('privacy-notice-save')).toBeInTheDocument()
		expect(onClose).not.toHaveBeenCalled()
	})

	it('si guardar falla, no llama onSaved: el editor se queda abierto con el texto para reintentar', async () => {
		mockGetPrivacyNotice.mockResolvedValue({ notice: plantilla })
		mockUpdatePrivacyNotice.mockRejectedValue({ response: { data: { message: 'Sin conexión' } } })
		const onSaved = vi.fn()
		renderModal({ onSaved })
		await guardar()
		await new Promise(r => setTimeout(r, 30))
		expect(onSaved).not.toHaveBeenCalled()
		expect(screen.getByTestId('privacy-notice-textarea')).toHaveValue('Propuesta del aviso')
	})
})
