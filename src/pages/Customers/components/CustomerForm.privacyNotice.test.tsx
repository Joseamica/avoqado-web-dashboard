import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CustomerForm from './CustomerForm'

// i18n: echo key — convención del repo (ver BancosEmptyState.test.tsx).
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: vi.fn() }),
}))

// El fallback "pídele a un administrador que cree el aviso" no es el sujeto de estos
// tests — se deja sin permiso para que el camino de PermissionGate sea determinista.
vi.mock('@/hooks/use-access', () => ({
	useAccess: () => ({ can: () => false, canAny: () => false, canAll: () => false }),
}))

// El modal completo (con su propia query) no es el sujeto de estos tests.
vi.mock('./PrivacyNoticeModal', () => ({
	PrivacyNoticeModal: () => null,
}))

vi.mock('@/services/customer.service', () => ({
	default: {
		createCustomer: vi.fn(),
		updateCustomer: vi.fn(),
		createCustomerGroup: vi.fn(),
	},
}))

const mockGetPrivacyNotice = vi.fn()
vi.mock('@/services/marketing.service', () => ({
	default: {
		getPrivacyNotice: (...args: unknown[]) => mockGetPrivacyNotice(...args),
		updatePrivacyNotice: vi.fn(),
	},
}))

function renderForm() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CustomerForm venueId="v1" groups={[]} onSuccess={vi.fn()} />
		</QueryClientProvider>,
	)
}

// Hallazgo #2 de la ronda final: HOST/WAITER/CASHIER tienen `customers:create` pero
// podían no tener `marketing:read` (403), y el checkbox lo leía como "no hay aviso" —
// falso cuando el aviso sí existe. Se distinguen TRES estados: cargando · sin aviso ·
// no se pudo verificar (403).
describe('CustomerForm — checkbox de consentimiento y el aviso de privacidad', () => {
	beforeEach(() => {
		mockGetPrivacyNotice.mockReset()
	})

	it('mientras la query carga: NO afirma "no hay aviso" — muestra el estado de verificación', () => {
		mockGetPrivacyNotice.mockReturnValue(new Promise(() => {})) // nunca resuelve
		renderForm()

		expect(screen.getByText('form.consentNoticeChecking')).toBeInTheDocument()
		expect(screen.queryByText('form.consentNeedsNoticeNoPermission')).not.toBeInTheDocument()
		expect(screen.queryByText('form.consentNoticeUnknown')).not.toBeInTheDocument()
	})

	it('403 al pedir el aviso: dice que no se pudo verificar, NUNCA que falte el aviso', async () => {
		mockGetPrivacyNotice.mockRejectedValue({ response: { status: 403 } })
		renderForm()

		await waitFor(() => expect(screen.getByText('form.consentNoticeUnknown')).toBeInTheDocument())
		expect(screen.queryByText('form.consentNeedsNoticeNoPermission')).not.toBeInTheDocument()
		expect(screen.queryByText('form.consentNoticeChecking')).not.toBeInTheDocument()
	})

	it('200 sin aviso: conserva el mensaje "pídele a un administrador que lo cree"', async () => {
		mockGetPrivacyNotice.mockResolvedValue({ notice: null })
		renderForm()

		await waitFor(() => expect(screen.getByText('form.consentNeedsNoticeNoPermission')).toBeInTheDocument())
		expect(screen.queryByText('form.consentNoticeUnknown')).not.toBeInTheDocument()
	})

	it('200 con aviso: el checkbox queda habilitado y sin mensaje de aviso faltante', async () => {
		mockGetPrivacyNotice.mockResolvedValue({
			notice: { id: 'n1', content: 'texto del aviso', contentHash: 'h', language: 'es', createdAt: '2026-01-01' },
		})
		renderForm()

		await waitFor(() => expect(screen.getByRole('checkbox', { name: 'form.fields.marketingConsent' })).not.toBeDisabled())
		expect(screen.queryByText('form.consentNeedsNoticeNoPermission')).not.toBeInTheDocument()
		expect(screen.queryByText('form.consentNoticeUnknown')).not.toBeInTheDocument()
		expect(screen.queryByText('form.consentNoticeChecking')).not.toBeInTheDocument()
	})
})
