/** SKU del extra: el código con el que el OTRO POS (caja externa) lo tiene dado de alta. Vacío = sin SKU. */
export function normalizeModifierSku(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
