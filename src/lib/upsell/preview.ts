/**
 * Upsell "¿Algo más?" — vista previa de una regla al crearla.
 *
 * Spec §4.2: "La tarjeta de vista previa muestra el nombre resuelto y el
 * precio final." No existía — el dueño elegía "Grande" y nunca veía, antes de
 * guardar, que la tarjeta iba a decir "Agua Mineral 1L (Grande)" a $50.00 y
 * no los $35.00 de la ficha. En un spec cuya tesis es "que nadie mienta sobre
 * el precio", era el hueco que más se notaba.
 *
 * 🔴 Mismo formato que arma el POS al mostrar la tarjeta al cliente —
 * `UpsellRule.toCard` en `avoqado-android/.../pos/domain/UpsellResolver.kt` y
 * su espejo en `avoqado-ios/.../UpsellResolver.swift` (`resolvedName`)—:
 * paréntesis y ", " como separador entre los nombres de los modificadores
 * elegidos. Ronda final de correcciones (2026-08-17).
 *
 * 🔴 A propósito NO calcula un descuento ligado: eso sólo existe en reglas
 * `PROMOTION`, que nacen del job nocturno a partir de un `Discount` — nunca de
 * este diálogo (`CreateRuleDialog` siempre crea `origin: OWNER`, sin
 * `linkedDiscount`). El día que el dashboard deje crear reglas PROMOTION a
 * mano, este archivo es donde se agrega ese cálculo.
 */

export interface PreviewModifier {
	name: string
	price: number
}

export interface SuggestionPreview {
	/** Nombre resuelto, igual al que arma el POS. */
	name: string
	/** Precio del producto + la suma de los modificadores elegidos. */
	finalPrice: number
}

/**
 * `product` es `null`/`undefined` mientras el dueño no ha elegido el producto
 * a sugerir — en ese caso no hay nada que previsualizar. `chosenModifiers`
 * lleva SÓLO los modificadores YA elegidos (no todo el grupo obligatorio) —
 * el llamador filtra los que aún no tienen selección, así la vista previa se
 * actualiza en vivo conforme el dueño va escogiendo.
 */
export function resolveSuggestionPreview(
	product: { name: string; price: number } | null | undefined,
	chosenModifiers: PreviewModifier[],
): SuggestionPreview | null {
	if (!product) return null

	const name = chosenModifiers.length > 0 ? `${product.name} (${chosenModifiers.map(m => m.name).join(', ')})` : product.name

	const finalPrice = Number(product.price) + chosenModifiers.reduce((sum, m) => sum + Number(m.price ?? 0), 0)

	return { name, finalPrice }
}

export interface RequiredModifierGroup {
	group: {
		id: string
		modifiers?: Array<{ id: string; name: string; price: number }>
	}
}

/**
 * De los grupos OBLIGATORIOS de un producto, cuáles modificadores ya tiene
 * elegidos el dueño (`picks`, groupId -> modifierId). Un grupo todavía
 * PENDIENTE (sin selección en `picks`) se EXCLUYE — nunca se cuela como
 * `undefined` — para que `resolveSuggestionPreview` de arriba reciba sólo lo
 * ya elegido y se actualice en vivo conforme el dueño va escogiendo.
 *
 * 🔴 P2 (2026-08-17): esto vivía inline en `Upsell.tsx` (`CreateRuleDialog`,
 * ~línea 304), sin ningún test que lo ejercitara — el test que decía probarlo
 * en `preview.test.ts` en realidad era una copia byte a byte de otro test, con
 * el mismo input ya "pre-filtrado" a mano. Se extrae aquí para que el caso que
 * motiva su propio nombre ("2 obligatorios, sólo 1 elegido") sí se pruebe.
 */
export function chosenPreviewModifiers(
	requiredGroups: RequiredModifierGroup[],
	picks: Record<string, string | undefined>,
): Array<{ id: string; name: string; price: number }> {
	return requiredGroups
		.map(g => (g.group.modifiers ?? []).find(m => m.id === picks[g.group.id]))
		.filter((m): m is { id: string; name: string; price: number } => m !== undefined)
}
