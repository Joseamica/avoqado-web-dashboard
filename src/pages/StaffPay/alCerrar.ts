import { useState } from 'react'

/**
 * Lo que pinta un diálogo que se abre con un estado (`open={x !== null}`) mientras se cierra (E6a-fix4 K-n1). Radix deja el
 * contenido montado durante la animación de salida: si el estado ya se vació, el texto cambia en ese rato («¿Apagar…?» tras pedir
 * encender, un título sin nombre). Devuelve el valor actual o, ya vacío, el último que hubo. El patrón de React para guardar algo
 * de una pintada anterior: se actualiza durante la pintada, sin un efecto que llegaría una pintada tarde.
 */
export function useUltimoNoNulo<T>(valor: T | null): T | null {
  const [ultimo, setUltimo] = useState<T | null>(valor)
  if (valor !== null && valor !== ultimo) setUltimo(valor)
  return valor ?? ultimo
}
