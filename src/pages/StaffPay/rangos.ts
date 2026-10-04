/** Rangos de fechas del contrato del server (full-testing A6/A11): fuera de ellos responde 400 FECHA_FUERA_DE_RANGO. */
export const MESES_VIGENCIA = 24
export const MESES_AJUSTE_ATRAS = 12
/** Tope de un monto (ajuste manual y «Ajustar monto»): el del schema del server. */
export const MONTO_MAXIMO = 1_000_000
/** Monto positivo con hasta 2 decimales, como lo acepta el server (sin exponentes, sin signos). «.5» = 0.50 también vale. */
export const MONTO_VALIDO = /^(\d+(\.\d{1,2})?|\.\d{1,2})$/
/** Sólo ceros con o sin punto («0», «00», «0.», «.0», «0.00», «.») o «12.»: todavía se está escribiendo (camino de
 *  «0.05»); el aviso de monto inválido espera a salir del campo. «» no cuenta. */
export const A_MEDIO_ESCRIBIR = /^(0+\.?0*|0*\.0*|\d+\.)$/

/** `YYYY-MM-DD` más (o menos) N meses; un día que no existe en el mes destino cae en su último día (31 → 30, 29 feb → 28). */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const total = y * 12 + (m - 1) + meses
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/**
 * El mensaje del server, legible: sin «Error de validación: » ni el nombre del campo («amount: »). Sin respuesta (red caída
 * o respuesta perdida) devuelve null.
 */
export function mensajeLegible(err: unknown): string | null {
  const msg = (err as { response?: { data?: { message?: string } } } | null)?.response?.data?.message
  if (!msg) return null
  // Sólo un 400 del validador lleva «campo: » delante de cada error; los mensajes del negocio se dejan tal cual.
  if (!/^Error de validación:\s*/.test(msg)) return msg
  return msg.replace(/^Error de validación:\s*/, '').replace(/(^|,\s*)[A-Za-z_][\w.]*:\s+/g, '$1')
}

/** El error no trajo respuesta: la petición pudo haberse aplicado (respuesta perdida, red caída). */
export const sinRespuesta = (err: unknown) => !(err as { response?: unknown } | null)?.response
