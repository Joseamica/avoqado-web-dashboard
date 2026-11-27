/** Pesos «$999» sin decimales si el monto es redondo, y «$799.50» (dos decimales) sólo si trae centavos: un precio del editor nunca se corta a «$799.5». */
export function fmtPesos(n: number): string {
  const conCentavos = Math.round(n * 100) % 100 !== 0
  return `$${n.toLocaleString('es-MX', conCentavos ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined)}`
}
