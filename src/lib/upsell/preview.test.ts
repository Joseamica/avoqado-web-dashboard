import { describe, it, expect } from 'vitest'
import { resolveSuggestionPreview } from './preview'

describe('resolveSuggestionPreview — spec §4.2 (nombre resuelto + precio final)', () => {
	it('sin producto elegido → null', () => {
		expect(resolveSuggestionPreview(null, [])).toBeNull()
		expect(resolveSuggestionPreview(undefined, [])).toBeNull()
	})

	it('producto sin modificadores → nombre y precio de lista, sin paréntesis', () => {
		expect(resolveSuggestionPreview({ name: 'Coca-Cola', price: 25 }, [])).toEqual({ name: 'Coca-Cola', finalPrice: 25 })
	})

	// 🔴 El caso del founder: elige "Grande" y la tarjeta va a decir $50.00, no $35.00.
	it('🔴 un modificador agrega su precio y su nombre entre paréntesis', () => {
		expect(resolveSuggestionPreview({ name: 'Agua Mineral 1L', price: 35 }, [{ name: 'Grande', price: 15 }])).toEqual({
			name: 'Agua Mineral 1L (Grande)',
			finalPrice: 50,
		})
	})

	it('varios modificadores se unen con ", " — mismo formato que arma el POS', () => {
		const preview = resolveSuggestionPreview({ name: 'Café', price: 30 }, [
			{ name: 'Grande', price: 10 },
			{ name: 'Deslactosada', price: 5 },
		])
		expect(preview).toEqual({ name: 'Café (Grande, Deslactosada)', finalPrice: 45 })
	})

	it('un modificador sin costo extra (gratis) no suma nada, pero SÍ se nombra', () => {
		expect(resolveSuggestionPreview({ name: 'Café', price: 30 }, [{ name: 'Chico', price: 0 }])).toEqual({
			name: 'Café (Chico)',
			finalPrice: 30,
		})
	})

	it('se actualiza en vivo con sólo los modificadores YA elegidos (el llamador filtra los pendientes)', () => {
		// Producto con 2 obligatorios, sólo 1 elegido todavía: la vista previa no
		// espera a que estén completos para mostrar algo honesto de lo que hay.
		expect(resolveSuggestionPreview({ name: 'Agua Mineral 1L', price: 35 }, [{ name: 'Grande', price: 15 }])).toEqual({
			name: 'Agua Mineral 1L (Grande)',
			finalPrice: 50,
		})
	})
})
