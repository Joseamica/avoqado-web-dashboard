import { useCallback, useRef, useState } from 'react'

/**
 * Guardar UNA sola vez lo que crea algo en Comisiones (ft-graves, D-D1). Un doble clic creaba dos esquemas idénticos que,
 * con filtro de categorías, pagaban doble: el `isPending` de React llega tarde y los dos clics salían antes de apagar el botón.
 *
 * - Candado SÍNCRONO (`useRef`): un segundo clic mientras hay un envío en vuelo no hace nada.
 * - `Idempotency-Key` por paso. La clave es de la OPERACIÓN, no del clic: viaja igual en los reintentos de axios y, si el
 *   intento quedó SIN RESPUESTA (red, tiempo agotado o 5xx) y el cuerpo no cambió, el siguiente intento manda la MISMA clave y
 *   el servidor devuelve lo que ya creó. Una clave nueva sólo va tras una respuesta definitiva (éxito o 4xx) o si el cuerpo cambió.
 * - En una operación de varios pasos (esquema + niveles + excepciones), lo que YA se creó conserva su clave hasta que la
 *   operación entera termina bien: reintentarla no duplica el esquema aunque haya fallado una excepción.
 */

export type Paso = <T>(nombre: string, enviar: (clave: string) => Promise<T>) => Promise<T>

/** ¿El servidor pudo haberlo guardado sin que nos enteráramos? Sin respuesta o 5xx (un proxy puede cortar tras guardar). */
export const quedoEnDuda = (err: unknown): boolean => {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status !== 'number' || status >= 500
}

// Claves de las operaciones que no terminaron, por huella del cuerpo. Vive fuera del componente: cerrar y volver a abrir el
// diálogo con lo mismo no inventa otra operación.
const pendientes = new Map<string, Map<string, string>>()
const TOPE = 50

const clavesDe = (huella: string): Map<string, string> => {
  let claves = pendientes.get(huella)
  if (!claves) {
    claves = new Map()
    pendientes.set(huella, claves)
    if (pendientes.size > TOPE) pendientes.delete(pendientes.keys().next().value as string)
  }
  return claves
}

/** Sólo para las pruebas: olvida las operaciones pendientes. */
export const olvidarPendientes = () => pendientes.clear()

export function useEnvioUnico() {
  const enVuelo = useRef(false)
  const [enviando, setEnviando] = useState(false)

  /** Corre `operacion` si no hay otra en vuelo (si la hay, devuelve `undefined` sin llamar a nada). */
  const enviar = useCallback(async <T,>(huella: string, operacion: (paso: Paso) => Promise<T>): Promise<T | undefined> => {
    if (enVuelo.current) return undefined
    enVuelo.current = true
    setEnviando(true)
    const claves = clavesDe(huella)
    const paso: Paso = async (nombre, enviarPaso) => {
      let clave = claves.get(nombre)
      if (!clave) {
        clave = crypto.randomUUID()
        claves.set(nombre, clave)
      }
      try {
        return await enviarPaso(clave)
      } catch (err) {
        // Un 4xx es definitivo: ese paso no se guardó y el siguiente intento lleva clave nueva.
        if (!quedoEnDuda(err)) claves.delete(nombre)
        throw err
      }
    }
    try {
      const resultado = await operacion(paso)
      pendientes.delete(huella)
      return resultado
    } finally {
      enVuelo.current = false
      setEnviando(false)
    }
  }, [])

  return { enviar, enviando }
}
