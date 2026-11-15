/**
 * Los puntos que da una compra por lo gastado, IGUAL que el SERVIDOR al acreditarlos (`calcularPuntosDeLaVenta`:
 * `Decimal(monto) × puntosPorPeso`, redondeado HACIA ABAJO). La vista previa usaba `Math.round` y prometía de más: con 0.333
 * y $500 decía 167 y el servidor da 166 (encargo 08cc59, 15-nov).
 *
 * En centavos y centésimas enteros para no arrastrar el error de los decimales en binario (0.29 × 100 = 28.999…).
 */
export function puntosPorGasto(monto: number, puntosPorPeso: number): number {
  if (!Number.isFinite(monto) || !Number.isFinite(puntosPorPeso) || monto <= 0 || puntosPorPeso <= 0) return 0
  const centavos = Math.round(monto * 100)
  const centesimas = Math.round(puntosPorPeso * 100)
  return Math.floor((centavos * centesimas) / 10000)
}

/** ¿Cabe en la columna del servidor (dos decimales)? 0.015 se guardaría como 0.02 sin avisar. */
export function tieneHastaDosDecimales(valor: number): boolean {
  return Number.isFinite(valor) && Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6
}
