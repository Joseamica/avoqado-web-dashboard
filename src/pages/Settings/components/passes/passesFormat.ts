/** Minutos locales desde la medianoche → «HH:mm»; `null` = todo el día. */
export const hhmm = (startMinute: number | null): string | null =>
  startMinute === null ? null : `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`

/** «HH:mm» (lo que da un `<input type="time">`) → minutos locales; vacío o fuera de rango → `null`. */
export const toStartMinute = (time: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m) return null
  const [h, min] = [Number(m[1]), Number(m[2])]
  return h <= 23 && min <= 59 ? h * 60 + min : null
}

/** Lo mismo que valida el server (`MAX_PASS_SPOTS = 500`): entero de 0 a 500. */
export const isValidSpots = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 0 && n <= 500

/**
 * Lo que se teclea en un campo de lugares (R2b-39): sólo cuentan los dígitos. Vacío de verdad → `null` (sin regla); lo que
 * no es dígito («e», «-», «+», «.») no entra al campo, así que lo que se ve es lo que se guarda. Con `type="number"` el
 * navegador entregaba «e» sobre un campo vacío como `''` SIN avisar a React (de `''` a `''` no hay onChange): el borrador se
 * quedaba en «vacío» y Guardar mandaba `maxSpots: null`, que borra la regla.
 */
export const readSpots = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}

/** Atributos del `<input>` de lugares: texto con teclado numérico (nunca `type="number"`, ver `readSpots`); el tope es 500. */
export const SPOTS_INPUT_PROPS = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 3, autoComplete: 'off' } as const
