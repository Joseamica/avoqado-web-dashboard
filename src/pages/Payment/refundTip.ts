/**
 * La casilla «Incluir propina» del reembolso POR ARTÍCULOS (29-sep-2026).
 * Arranca marcada cuando se devuelve toda la venta que queda (devolver todo = todo el dinero,
 * como Square) y desmarcada en un reembolso parcial; el cajero decide.
 */
export interface RefundLike {
  status?: string | null
  saleAmount?: number | string | null
  tipAmount?: number | string | null
}

const aCentavos = (pesos: number) => Math.round(pesos * 100)

/**
 * ¿`importe` cabe en `tope`? Compara CENTAVOS enteros: en dobles `0.33 <= 1 - 0.67` es falso
 * (`1 - 0.67` da 0.32999999999999996) y bloqueaba una devolución válida.
 */
export const cabeEnCentavos = (importe: number, tope: number) => aCentavos(importe) <= aCentavos(tope)

/** Venta y propina ya devueltas, en centavos. Sólo cuentan los reembolsos COMPLETED, como el servidor. */
function devueltoPorComponente(refunds: RefundLike[]) {
  const hechos = refunds.filter(r => r.status === 'COMPLETED')
  return {
    venta: hechos.reduce((s, r) => s + Math.abs(aCentavos(Number(r.saleAmount) || 0)), 0),
    propina: hechos.reduce((s, r) => s + Math.abs(aCentavos(Number(r.tipAmount) || 0)), 0),
  }
}

/**
 * Lo devuelto según el ACUMULADO histórico del cobro (`processorData.refundedAmountCents`, o `refundedAmount` en
 * pesos en las filas viejas), en centavos. Espejo de `centavosDevueltosDeclarados` del servidor, con una sola
 * diferencia: un valor ilegible o negativo vale 0 en vez de reventar — aquí sólo se muestra un tope, y el servidor
 * (que sí revienta) es quien autoriza.
 */
function centavosDeclarados(processorData: unknown): number {
  if (!processorData || typeof processorData !== 'object' || Array.isArray(processorData)) return 0
  const pd = processorData as Record<string, unknown>
  const enCentavos = pd.refundedAmountCents
  const crudo = enCentavos !== undefined && enCentavos !== null ? Number(enCentavos) : Number(pd.refundedAmount ?? 0) * 100
  return Number.isFinite(crudo) ? Math.max(0, Math.round(crudo)) : 0
}

/**
 * Lo que queda por devolver del cobro, contado EXACTAMENTE como `issueRefund` (`centavosYaDevueltos`): sólo los
 * reembolsos COMPLETED, y de lo ya devuelto gana el MÁXIMO entre las filas y el acumulado histórico. Un reembolso
 * FAILED no movió dinero (bloqueaba un reintento válido) y un acumulado sin filas sí baja el tope (ofrecía de más).
 * `refunds` son los de `GET …/payments/:id/refunds`: hay que leer `saleAmount` + `tipAmount`, no su `amount` total.
 */
export function restanteTotal(total: number, refunds: RefundLike[], processorData: unknown): number {
  const { venta, propina } = devueltoPorComponente(refunds)
  const yaDevuelto = Math.max(centavosDeclarados(processorData), venta + propina)
  return Math.max(0, aCentavos(total) - yaDevuelto) / 100
}

/**
 * Venta y propina que quedan por devolver. Cada componente se topa con `restante` (lo que queda del TOTAL, ver
 * `restanteTotal`): un acumulado histórico sin filas baja el total pero no dice de qué componente salió.
 */
export function saldosPorDevolver(venta: number, propina: number, refunds: RefundLike[], restante = Infinity) {
  const devuelto = devueltoPorComponente(refunds)
  const tope = aCentavos(restante)
  return {
    venta: Math.min(tope, Math.max(0, aCentavos(venta) - devuelto.venta)) / 100,
    propina: Math.min(tope, Math.max(0, aCentavos(propina) - devuelto.propina)) / 100,
  }
}

/**
 * La propina que se puede sumar a un reembolso por artículos: la que queda, sin pasar de lo que queda del TOTAL
 * una vez descontados los artículos. Con un acumulado histórico sin filas, venta + propina puede sumar más de lo
 * que el servidor deja salir.
 */
export function propinaQueCabe(propinaRestante: number, restanteTotalPesos: number, importeArticulos: number): number {
  return Math.max(0, Math.min(aCentavos(propinaRestante), aCentavos(restanteTotalPesos) - aCentavos(importeArticulos))) / 100
}

/**
 * Marcada sola cuando los artículos cubren toda la venta que queda. Compara CENTAVOS ENTEROS con 2 de
 * tolerancia por el reparto de unidades (en dobles, 144.98 vs 145 da 0.02000000000001 y fallaba).
 */
export function propinaMarcadaPorDefecto(importeArticulos: number, ventaRestante: number): boolean {
  return importeArticulos > 0 && Math.abs(aCentavos(importeArticulos) - aCentavos(ventaRestante)) <= 2
}
