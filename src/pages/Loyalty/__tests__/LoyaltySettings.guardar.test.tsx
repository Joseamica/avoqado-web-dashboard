import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import commonEs from '@/locales/es/common.json'
import loyaltyEs from '@/locales/es/loyalty.json'
import type { LoyaltyConfig } from '@/types/customer'
import LoyaltySettings from '../LoyaltySettings'

/**
 * D29 (25-nov): la tarjeta pegajosa de la vista previa tapaba «Guardar Cambios» al bajar. El botón tiene que vivir DENTRO del mismo
 * bloque pegajoso que la vista previa en pantalla grande (se mueven juntos, nunca se enciman) y en una barra pegada abajo en pantalla
 * chica (siempre a la vista). jsdom no pinta, así que esto fija la estructura; la prueba visual va en el navegador.
 * D27: la sección de expiración dice cómo vence y desde cuándo cuentan los puntos que ya había.
 */
const h = vi.hoisted(() => ({ config: null as unknown, guardados: [] as unknown[] }))

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'cvenue000000000000000000', fullBasePath: '/venues/cafe' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({
	PageTitleWithInfo: ({ title, tooltip }: { title: string; tooltip?: string }) => <h1 title={tooltip}>{title}</h1>,
}))
const zona = vi.hoisted(() => ({ actual: 'America/Mexico_City' }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: zona.actual }) }))
vi.mock('@/services/loyalty.service', () => ({
	default: {
		getConfig: async () => h.config,
		updateConfig: async (_v: string, datos: unknown) => {
			h.guardados.push(datos)
			return h.config
		},
	},
}))

const CONFIG: LoyaltyConfig = {
	id: 'ccfg0000000000000000000000',
	venueId: 'cvenue000000000000000000',
	pointsPerDollar: 1,
	pointsPerVisit: 0,
	redemptionRate: 0.01,
	minPointsRedeem: 100,
	pointsExpireDays: 365,
	pointsExpireSince: '2026-11-26T06:00:00.000Z',
	active: true,
	stampsEnabled: false,
	stampsRequired: 10,
	maxStampsPerDay: 1,
	stampRewardType: 'FREE_PRODUCT',
	stampRewardValue: null,
	stampRewardProductId: null,
	stampRewardLabel: 'Café gratis',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-11-01T00:00:00.000Z',
}

const anchoOriginal = window.innerWidth
const ponerAncho = (ancho: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: ancho })

async function pintar() {
	const i18n = i18next.createInstance()
	await i18n.use(initReactI18next).init({
		lng: 'es',
		ns: ['loyalty', 'common'],
		defaultNS: 'loyalty',
		resources: { es: { loyalty: loyaltyEs, common: commonEs } },
		interpolation: { escapeValue: false },
	})
	render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<LoyaltySettings />
			</QueryClientProvider>
		</I18nextProvider>,
	)
	return screen.findByRole('button', { name: 'Guardar Cambios' })
}

beforeEach(() => {
	h.config = CONFIG
	h.guardados = []
	zona.actual = 'America/Mexico_City'
})
afterEach(() => ponerAncho(anchoOriginal))

describe('LoyaltySettings · «Guardar Cambios» siempre a la vista (D29)', () => {
	it.each([1440, 390])('a %ipx, el botón va en una barra pegada abajo y fuera de la vista previa pegajosa', async ancho => {
		ponerAncho(ancho)
		const boton = await pintar()
		const barra = screen.getByTestId('loyalty-save-bar')
		expect(barra).toContainElement(boton)
		expect(barra.className).toMatch(/(^|\s)sticky(\s|$)/)
		expect(barra.className).toMatch(/(^|\s)bottom-0(\s|$)/)
		// La tarjeta pegajosa de la vista previa ya no lo contiene ni lo tiene debajo en la misma columna.
		const tarjeta = screen.getByTestId('loyalty-preview-card')
		expect(tarjeta).not.toContainElement(boton)
		expect(tarjeta.parentElement).not.toContainElement(boton)
		expect(screen.getAllByRole('button', { name: 'Guardar Cambios' })).toHaveLength(1)
	})
})

// hz:be99f328:D42: este interruptor apaga sólo los PUNTOS; los sellos tienen el suyo en la tarjeta digital.
describe('LoyaltySettings · el interruptor es de los puntos (D42)', () => {
	it('dice «Programa de Puntos» y que la tarjeta de sellos se prende aparte', async () => {
		ponerAncho(1440)
		await pintar()
		expect(screen.getByText('Programa de Puntos')).toBeInTheDocument()
		expect(screen.getByText(/La tarjeta de sellos tiene su propio interruptor en Tarjeta digital/)).toBeInTheDocument()
		expect(screen.queryByText('Estado del Programa')).not.toBeInTheDocument()
	})
})

describe('LoyaltySettings · cómo vencen los puntos (D27)', () => {
	it('con la expiración prendida, explica la regla (por inactividad) y desde cuándo cuentan los días', async () => {
		ponerAncho(1440)
		await pintar()
		expect(screen.getByText(/pasa 365 días sin movimientos en sus puntos \(ganar, canjear o un ajuste\), vencen todos sus puntos/i)).toBeInTheDocument()
		expect(screen.getByText(/cuentan, a lo más, desde el 26 de noviembre de 2026/i)).toBeInTheDocument()
	})

	it('una zona vieja del negocio («GMT-6») no tumba la pantalla: la fecha sale en la zona de México', async () => {
		zona.actual = 'GMT-6'
		ponerAncho(1440)
		await pintar()
		expect(screen.getByText(/cuentan, a lo más, desde el 26 de noviembre de 2026/i)).toBeInTheDocument()
	})

	it('sin fecha de arranque (negocio nuevo), no inventa una', async () => {
		h.config = { ...CONFIG, pointsExpireSince: null }
		ponerAncho(1440)
		await pintar()
		expect(screen.getByText(/pasa 365 días sin movimientos en sus puntos/i)).toBeInTheDocument()
		expect(screen.queryByText(/a lo más, desde el/i)).not.toBeInTheDocument()
	})
})

describe('LoyaltySettings · guardar sólo lo que se cambió (D27)', () => {
	it('cambiar los puntos por peso NO vuelve a mandar la expiración (otro administrador pudo apagarla)', async () => {
		ponerAncho(1440)
		const boton = await pintar()
		fireEvent.change(screen.getByTestId('loyalty-points-per-dollar'), { target: { value: '2' } })
		await waitFor(() => expect(boton).not.toBeDisabled())
		fireEvent.click(boton)
		await waitFor(() => expect(h.guardados).toHaveLength(1))
		expect(h.guardados[0]).toEqual({ pointsPerDollar: 2 })
	})
})

describe('LoyaltySettings · 0 días guardados (D27)', () => {
	it('se muestran como expiración apagada y no frenan guardar otra cosa', async () => {
		h.config = { ...CONFIG, pointsExpireDays: 0 }
		ponerAncho(1440)
		const boton = await pintar()
		expect(screen.getByText('Los puntos nunca expiran')).toBeInTheDocument()
		fireEvent.change(screen.getByTestId('loyalty-points-per-dollar'), { target: { value: '3' } })
		await waitFor(() => expect(boton).not.toBeDisabled())
		fireEvent.click(boton)
		await waitFor(() => expect(h.guardados).toHaveLength(1))
		expect(h.guardados[0]).toEqual({ pointsPerDollar: 3 })
	})
})

describe('LoyaltySettings · tasa de canje con 4 decimales (Codex r7 #1)', () => {
	it('una tasa válida del SERVIDOR (0.0125) no frena guardar otra cosa', async () => {
		h.config = { ...CONFIG, redemptionRate: 0.0125 }
		ponerAncho(1440)
		const boton = await pintar()
		fireEvent.change(screen.getByTestId('loyalty-points-per-dollar'), { target: { value: '2' } })
		await waitFor(() => expect(boton).not.toBeDisabled())
		fireEvent.click(boton)
		await waitFor(() => expect(h.guardados).toHaveLength(1))
		expect(h.guardados[0]).toEqual({ pointsPerDollar: 2 })
	})
})

describe('LoyaltySettings · el texto dice lo que el servidor hará al guardar (Codex r8 #2)', () => {
	const regla = () => screen.getByTestId('loyalty-expiration-rule')

	it('programa apagado con días guardados: «no vence nada» y sin fecha', async () => {
		h.config = { ...CONFIG, active: false, pointsExpireDays: 30 }
		ponerAncho(1440)
		await pintar()
		expect(regla()).toHaveTextContent('Con el programa apagado, no vence nada.')
		expect(regla()).not.toHaveTextContent(/vencen todos/)
		expect(regla()).not.toHaveTextContent(/a lo más, desde el/)
	})

	it('prender el programa con días guardados: los días empiezan a contar al guardar, sin la fecha vieja', async () => {
		h.config = { ...CONFIG, active: false, pointsExpireDays: 30 }
		ponerAncho(1440)
		await pintar()
		fireEvent.click(screen.getAllByRole('switch')[0])
		await waitFor(() => expect(regla()).toHaveTextContent(/vencen todos sus puntos/))
		expect(regla()).toHaveTextContent('Al guardar, los días sin movimientos empiezan a contar desde hoy')
		expect(regla()).not.toHaveTextContent(/a lo más, desde el/)
	})

	it('acortar los días: avisa que empiezan a contar al guardar y quita la fecha vieja', async () => {
		ponerAncho(1440)
		await pintar()
		expect(regla()).toHaveTextContent(/a lo más, desde el 26 de noviembre de 2026/)
		fireEvent.change(screen.getByDisplayValue('365'), { target: { value: '30' } })
		await waitFor(() => expect(regla()).toHaveTextContent('Al guardar, los días sin movimientos empiezan a contar desde hoy'))
		expect(regla()).not.toHaveTextContent(/a lo más, desde el/)
	})

	it('alargar los días: sigue contando desde la fecha guardada', async () => {
		ponerAncho(1440)
		await pintar()
		fireEvent.change(screen.getByDisplayValue('365'), { target: { value: '400' } })
		await waitFor(() => expect(regla()).toHaveTextContent(/pasa 400 días/))
		expect(regla()).toHaveTextContent(/a lo más, desde el 26 de noviembre de 2026/)
		expect(regla()).not.toHaveTextContent('Al guardar')
	})
})

describe('LoyaltySettings · una configuración migrada (vencimiento apagado, D27)', () => {
	it('abre APAGADA y, al prenderla, avisa que los días cuentan desde hoy y manda sólo los días', async () => {
		h.config = { ...CONFIG, pointsExpireDays: null, pointsExpireSince: null }
		ponerAncho(1440)
		const boton = await pintar()
		expect(screen.getByText('Los puntos nunca expiran')).toBeInTheDocument()
		const [, interruptorDeExpiracion] = screen.getAllByRole('switch')
		expect(interruptorDeExpiracion).toHaveAttribute('aria-checked', 'false')

		fireEvent.click(interruptorDeExpiracion)
		const regla = await screen.findByTestId('loyalty-expiration-rule')
		expect(regla).toHaveTextContent(/pasa 365 días sin movimientos en sus puntos/)
		expect(regla).toHaveTextContent('Al guardar, los días sin movimientos empiezan a contar desde hoy')
		expect(regla).not.toHaveTextContent(/a lo más, desde el/)

		await waitFor(() => expect(boton).not.toBeDisabled())
		fireEvent.click(boton)
		await waitFor(() => expect(h.guardados).toHaveLength(1))
		expect(h.guardados[0]).toEqual({ pointsExpireDays: 365 })
	})
})

describe('LoyaltySettings · textos (D32)', () => {
	it('la tarjeta de la derecha se llama «Vista previa» y la ayuda del título sale de su llave (no del texto sin acentos)', async () => {
		ponerAncho(1440)
		await pintar()
		expect(screen.getByTestId('loyalty-preview-card').querySelector('h3')).toHaveTextContent('Vista previa')
		expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('title', loyaltyEs.info.loyalty)
		expect(loyaltyEs.info.loyalty).toMatch(/cómo se ganan/)
	})
})
