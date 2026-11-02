import { DateTime } from 'luxon'

/**
 * D6 (Codex r2 de D2 en el SERVIDOR, 1-nov): reglas de la Auditoría de Promotores, fuera del componente para probarlas.
 */

/**
 * Con un filtro de fecha, una fila se queda si tuvo checadas en ese rango o si trae ventas DEL RANGO. También negativas: desde el 1-nov
 * el checador cuenta la devolución de hoy de lo que alguien vendió otro día aunque hoy no haya checado; antes esa fila se descartaba aquí
 * y la devolución desaparecía. Codex D6 r1: sólo cuando las ventas son del periodo (`ventasSonDelFiltro`): con «antes de» / «después
 * de» el servidor responde con el día de hoy, y esas ventas no son del filtro.
 */
export function seQuedaConElFiltro(checadasEnElFiltro: number, ventas: number, ventasDelFiltro: boolean): boolean {
  return checadasEnElFiltro > 0 || (ventasDelFiltro && ventas !== 0)
}

/**
 * ¿Las ventas que manda el servidor son exactamente las del filtro? Sólo con «el día» y «entre»: el servidor acota por días completos.
 * Con «antes de» / «después de» recibe una sola fecha y responde con hoy (Codex D6 r1), y con «últimos N» recibe días completos aunque el
 * filtro sea de horas o empiece a media jornada (Codex D6 r2): esas ventas no son del filtro.
 */
export function ventasSonDelFiltro(operador: string | null | undefined): boolean {
  return operador === 'on' || operador === 'between'
}

/** Día civil (`YYYY-MM-DD`) de un instante en la zona del negocio; `null` si no se entiende. */
export function diaDelNegocio(instante: string, zona: string): string | null {
  const fecha = DateTime.fromISO(instante, { zone: 'utc' })
  return fecha.isValid ? fecha.setZone(zona).toISODate() : null
}

/**
 * ¿Ese día del negocio cae en el filtro? «El día», «entre», «antes de» y «después de» comparan días del negocio. Codex D6 r1: antes se
 * comparaba contra `new Date('YYYY-MM-DD')`, que es medianoche UTC (las 18:00 del día anterior en México) y descartaba checadas reales.
 * «Últimos N» compara instantes y no pasa por aquí.
 */
export function diaEnElFiltro(
  dia: string,
  filtro: { operator: string; value?: string | number | null; value2?: string | number | null },
): boolean {
  const desde = String(filtro.value ?? '')
  const hasta = String(filtro.value2 ?? '')
  switch (filtro.operator) {
    case 'on':
      return dia === desde
    case 'between':
      return dia >= desde && dia <= hasta
    case 'before':
      return dia < desde
    case 'after':
      return dia > desde
    default:
      return true
  }
}

/**
 * El depósito que se espera de la persona es el EFECTIVO que cobró (`cashSales`), no todas sus ventas (la tarjeta no se deposita), con la
 * foto real del comprobante que subió al checar salida. Antes la pantalla usaba las ventas y una foto de muestra.
 */
export function depositoEsperado(p: { cashSales?: number | null; depositPhotoUrl?: string | null }): {
  esperado: number
  comprobante: string | undefined
} {
  return { esperado: p.cashSales ?? 0, comprobante: p.depositPhotoUrl ?? undefined }
}
