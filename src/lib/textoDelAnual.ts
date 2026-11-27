export type TextoDelAnual = { tipo: 'dosMesesGratis' } | { tipo: 'ahorras'; grossCentsAlAnio: number } | null

/** Con IVA (centavos brutos), la misma regla que la vista previa del SUPERADMIN: «2 meses gratis» sólo si el anual es exactamente 10 mensualidades. */
export function textoDelAnual(monthlyGrossCents: number, annualGrossCents: number): TextoDelAnual {
  if (annualGrossCents === monthlyGrossCents * 10) return { tipo: 'dosMesesGratis' }
  const ahorro = monthlyGrossCents * 12 - annualGrossCents
  return ahorro > 0 ? { tipo: 'ahorras', grossCentsAlAnio: ahorro } : null
}
