import { describe, it, expect } from 'vitest'
import { resolveSuggestionPreview, chosenPreviewModifiers } from './preview'

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

})

// ═══════════════════════════════════════════════════════════════════════════
// chosenPreviewModifiers — "el llamador filtra los pendientes"
//
// 🔴 P2 (2026-08-17): esto antes se afirmaba con un test que era copia byte a
// byte del de arriba ("un modificador agrega su precio...") — mismo input,
// mismo expected, cero cobertura real del caso "2 obligatorios, sólo 1
// elegido" que su propia descripción prometía. La lógica vivía inline en
// `Upsell.tsx` (`CreateRuleDialog`, ~línea 304) sin ningún test que la
// ejercitara; se extrajo a `chosenPreviewModifiers` (`preview.ts`)
// específicamente para poder probar ESTO.
// ═══════════════════════════════════════════════════════════════════════════

describe('chosenPreviewModifiers — se actualiza en vivo con sólo lo YA elegido', () => {
	const grupo = (groupId: string, modifiers: Array<{ id: string; name: string; price: number }>) => ({
		group: { id: groupId, modifiers },
	})

	it('sin grupos obligatorios → nada que elegir', () => {
		expect(chosenPreviewModifiers([], {})).toEqual([])
	})

	it('un grupo obligatorio, todavía SIN elegir → se excluye, no aparece como undefined', () => {
		const grupos = [grupo('g_tam', [{ id: 'm_ch', name: 'Chico', price: 0 }])]
		expect(chosenPreviewModifiers(grupos, {})).toEqual([])
	})

	// 🔴 El caso que el test viejo prometía probar y no probaba: 2 obligatorios
	// (Tamaño, Sabor), el dueño sólo eligió Tamaño. La vista previa debe
	// mostrar SÓLO "Grande" — Sabor pendiente no debe colarse ni tronar.
	it('🔴 DOS grupos obligatorios, sólo UNO elegido → sólo ese llega, el pendiente se excluye', () => {
		const grupos = [
			grupo('g_tam', [{ id: 'm_gr', name: 'Grande', price: 15 }]),
			grupo('g_sabor', [{ id: 'm_van', name: 'Vainilla', price: 5 }]),
		]
		const elegidos = chosenPreviewModifiers(grupos, { g_tam: 'm_gr' }) // g_sabor: pendiente

		expect(elegidos).toEqual([{ id: 'm_gr', name: 'Grande', price: 15 }])

		// Y la vista previa que arma con esto refleja SÓLO lo elegido — el caso
		// real que motiva la función: no espera a que Sabor también se elija.
		expect(resolveSuggestionPreview({ name: 'Agua Mineral 1L', price: 35 }, elegidos)).toEqual({
			name: 'Agua Mineral 1L (Grande)',
			finalPrice: 50,
		})
	})

	it('DOS grupos obligatorios, AMBOS elegidos → los dos llegan, en el orden de los grupos', () => {
		const grupos = [
			grupo('g_tam', [{ id: 'm_gr', name: 'Grande', price: 15 }]),
			grupo('g_sabor', [{ id: 'm_van', name: 'Vainilla', price: 5 }]),
		]
		const elegidos = chosenPreviewModifiers(grupos, { g_tam: 'm_gr', g_sabor: 'm_van' })

		expect(elegidos).toEqual([
			{ id: 'm_gr', name: 'Grande', price: 15 },
			{ id: 'm_van', name: 'Vainilla', price: 5 },
		])
	})

	it('un pick que no corresponde a ningún modificador del grupo (dato viejo/huérfano) se excluye', () => {
		const grupos = [grupo('g_tam', [{ id: 'm_gr', name: 'Grande', price: 15 }])]
		expect(chosenPreviewModifiers(grupos, { g_tam: 'm_ya_no_existe' })).toEqual([])
	})
})
