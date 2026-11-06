/**
 * D14 (Codex r4 #3): al editar, un límite de usos vacío se manda como null para que el SERVIDOR lo vuelva ilimitado (antes se
 * omitía y el límite viejo se quedaba). Al crear, vacío se omite.
 */
export const limiteParaGuardar = (valor: number | null | undefined, editando: boolean): number | null | undefined =>
	valor ?? (editando ? null : undefined)
