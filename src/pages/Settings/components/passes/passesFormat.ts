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
