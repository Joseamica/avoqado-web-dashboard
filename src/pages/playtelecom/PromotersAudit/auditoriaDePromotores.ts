/**
 * D6 (Codex r2 de D2 en el SERVIDOR, 1-nov): reglas de la Auditoría de Promotores, fuera del componente para probarlas.
 */

/**
 * Con un filtro de fecha, una fila se queda si tuvo checadas en ese rango o si trae ventas. También negativas: desde el 1-nov el
 * checador cuenta la devolución de hoy de lo que alguien vendió otro día aunque hoy no haya checado; antes esa fila se descartaba aquí
 * y la devolución desaparecía de la pantalla.
 */
export function seQuedaConElFiltro(checadasEnElFiltro: number, ventas: number): boolean {
  return checadasEnElFiltro > 0 || ventas !== 0
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
