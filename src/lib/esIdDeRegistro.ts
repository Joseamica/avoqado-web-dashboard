/**
 * ¿Este segmento de la URL es el id de un registro (cuid v1 o uuid)? La miga de pan no lo enseña crudo
 * («Pagos › Cmv8qwa5i0046walcl459zlnb»): si la pantalla no le puso nombre con `setCustomSegment`, dice «Detalle».
 */
export const esIdDeRegistro = (segmento: string): boolean =>
  /^c[a-z0-9]{24}$/.test(segmento) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmento)
