/** Estimado del diálogo Exportar: el total del servidor (toda la lista filtrada), no las filas ya cargadas de la página. */
export const conteoParaExportar = (cargadas: number, totalServidor: number): number => totalServidor || cargadas
