/**
 * D15 (grabando los tutoriales, 5-nov-2026): dar de alta un cliente sólo con teléfono fallaba con «Invalid email format»
 * y un aviso titulado «common.error». El formulario mandaba el correo vacío ("") y el SERVIDOR lo leía como un correo mal
 * escrito. Lo mismo al editar a un cliente que sólo tiene teléfono. Un campo vacío no se manda.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CustomerForm from './CustomerForm'
import type { Customer } from '@/types/customer'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/use-access', () => ({
	useAccess: () => ({ can: () => false, canAny: () => false, canAll: () => false }),
}))

vi.mock('./PrivacyNoticeModal', () => ({
	PrivacyNoticeModal: () => null,
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/services/customer.service', () => ({
	default: {
		createCustomer: (...a: unknown[]) => mockCreate(...a),
		updateCustomer: (...a: unknown[]) => mockUpdate(...a),
		createCustomerGroup: vi.fn(),
	},
}))

vi.mock('@/services/marketing.service', () => ({
	default: { getPrivacyNotice: () => Promise.resolve({ notice: null }), updatePrivacyNotice: vi.fn() },
}))

function pintar(customer?: Customer) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CustomerForm venueId="v1" customer={customer} groups={[]} onSuccess={vi.fn()} />
		</QueryClientProvider>,
	)
}

const escribir = (id: string, valor: string) => {
	const input = document.getElementById(id) as HTMLInputElement
	fireEvent.change(input, { target: { value: valor } })
	fireEvent.blur(input)
}
const enviar = () => fireEvent.submit(document.querySelector('form')!)

const clienteSoloTelefono = {
	id: 'c1',
	firstName: 'Rosa',
	lastName: 'Lirio',
	email: null,
	phone: '5544102263',
	marketingConsent: false,
} as unknown as Customer

describe('D15 · cliente con un dato de contacto vacío', () => {
	beforeEach(() => {
		mockCreate.mockReset().mockResolvedValue({ customer: { id: 'nuevo' } })
		mockUpdate.mockReset().mockResolvedValue({ customer: { id: 'c1' } })
		mockToast.mockReset()
	})

	it('🔴 alta sólo con teléfono: NO manda el correo vacío', async () => {
		pintar()
		escribir('firstName', 'Rosa')
		escribir('lastName', 'Lirio')
		escribir('phone', '5544102263')
		enviar()

		await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
		const enviado = mockCreate.mock.calls[0][1]
		expect('email' in enviado && enviado.email !== undefined).toBe(false)
		expect(enviado.phone).toBe('5544102263')
	})

	it('alta sólo con correo: NO manda el teléfono vacío', async () => {
		pintar()
		escribir('firstName', 'Rosa')
		escribir('lastName', 'Lirio')
		escribir('email', 'rosa@ejemplo.mx')
		enviar()

		await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
		expect(mockCreate.mock.calls[0][1].phone).toBeUndefined()
	})

	it('🔴 editar a una clienta que sólo tiene teléfono: NO manda el correo vacío', async () => {
		pintar(clienteSoloTelefono)
		escribir('lastName', 'Lirio Pérez')
		enviar()

		await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
		const enviado = mockUpdate.mock.calls[0][2]
		expect(enviado.email).toBeUndefined()
		expect(enviado.lastName).toBe('Lirio Pérez')
	})

	it('editar: borrar el correo que el cliente SÍ tenía no se guarda en silencio — se explica en el campo', async () => {
		pintar({ ...clienteSoloTelefono, email: 'rosa@ejemplo.mx' } as Customer)
		escribir('email', '')
		enviar()

		expect(await screen.findByText('form.validation.emailCannotBeCleared')).toBeInTheDocument()
		expect(mockUpdate).not.toHaveBeenCalled()
	})

	it('editar: borrar el teléfono que el cliente SÍ tenía, igual', async () => {
		pintar({ ...clienteSoloTelefono, email: 'rosa@ejemplo.mx' } as Customer)
		escribir('phone', '')
		enviar()

		expect(await screen.findByText('form.validation.phoneCannotBeCleared')).toBeInTheDocument()
		expect(mockUpdate).not.toHaveBeenCalled()
	})
})
