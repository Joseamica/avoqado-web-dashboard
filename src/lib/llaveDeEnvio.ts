import { useCallback, useEffect, useRef, useState } from 'react'
import { quedoEnDuda } from '@/pages/Commissions/envioUnico'

/**
 * D1 (12-nov): la llave de un envío que el servidor deduplica (`idempotencyKey`), para un reembolso o un pago manual del panel.
 *
 * El dilema (Codex r1 de D1): si el primer envío quedó EN DUDA (sin respuesta o 5xx), el panel no sabe si se registró.
 * - Si la persona lo vuelve a mandar y es EL MISMO, tiene que ir con la MISMA llave, aunque haya salido de la pantalla o
 *   recargado: si no, se registra dos veces.
 * - Si ya revisó que entró y quiere hacer OTRO igual (otro reembolso de $50 del mismo pago), la llave vieja se lo «comería».
 * Nadie puede adivinarlo, así que se le pregunta, como en las tarjetas de regalo: mientras haya un envío en duda en ese
 * ámbito, la pantalla lo dice («Hay un pago de $100 sin confirmar…») con un botón «Es otro» que lo olvida.
 *
 * - Mismo contenido que el envío en duda ⇒ su MISMA llave (el servidor devuelve lo ya registrado).
 * - Contenido distinto ⇒ llave nueva (con la vieja el servidor contestaría 409 IDEMPOTENCY_KEY_REUSED).
 * - Éxito o rechazo definitivo (4xx) ⇒ se olvida: la siguiente operación estrena llave.
 *
 * El envío en duda vive fuera del componente y en `sessionStorage` (por pestaña, 24 h): sobrevive a cerrar el diálogo, a salir
 * de Pagos y a recargar. Si el navegador no deja guardar, se queda en memoria.
 */

/** UUID v4: 36 caracteres de hex y guiones, dentro de lo que acepta el servidor (`^[A-Za-z0-9_-]{8,64}$`). */
export const llaveNueva = (): string => crypto.randomUUID()

export interface EnvioEnDuda {
  huella: string
  llave: string
  /** Pesos, para decírselo a la persona («Hay un pago de $100 sin confirmar»). */
  monto: number
  /** `Date.now()` del envío que quedó en duda. */
  desde: number
}

const ALMACEN = 'avq-envios-en-duda:v1'
const VIGENCIA_MS = 24 * 60 * 60 * 1000
let enMemoria: Record<string, EnvioEnDuda> | null = null

function leerTodos(): Record<string, EnvioEnDuda> {
  if (enMemoria) return enMemoria
  try {
    const crudo = sessionStorage.getItem(ALMACEN)
    enMemoria = crudo ? (JSON.parse(crudo) as Record<string, EnvioEnDuda>) : {}
  } catch {
    enMemoria = {}
  }
  return enMemoria
}

function escribirTodos(todos: Record<string, EnvioEnDuda>) {
  enMemoria = todos
  try {
    sessionStorage.setItem(ALMACEN, JSON.stringify(todos))
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

export function envioEnDuda(ambito: string, ahora: number = Date.now()): EnvioEnDuda | null {
  const envio = leerTodos()[ambito]
  if (!envio) return null
  if (ahora - envio.desde > VIGENCIA_MS) {
    olvidarEnvioEnDuda(ambito)
    return null
  }
  return envio
}

export function guardarEnvioEnDuda(ambito: string, envio: EnvioEnDuda) {
  escribirTodos({ ...leerTodos(), [ambito]: envio })
}

export function olvidarEnvioEnDuda(ambito: string) {
  const { [ambito]: _olvidado, ...resto } = leerTodos()
  escribirTodos(resto)
}

/** Sólo para las pruebas. */
export function olvidarTodosLosEnviosEnDuda() {
  escribirTodos({})
}

/** La llave para un envío con esta huella: la del envío en duda si es el mismo contenido; si no, una nueva. */
export function llavePara(ambito: string, huella: string, nueva: () => string = llaveNueva): { llave: string; reusada: boolean } {
  const previo = envioEnDuda(ambito)
  return previo && previo.huella === huella ? { llave: previo.llave, reusada: true } : { llave: nueva(), reusada: false }
}

/**
 * El hook de las pantallas: `preparar` antes de mandar (da la llave), `alTerminarBien` / `alFallar` en los callbacks de la
 * mutación, y `esOtro` para el botón del aviso. `enDuda` es lo que la pantalla enseña.
 */
export function useLlaveDeEnvio(ambito: string) {
  const [enDuda, setEnDuda] = useState<EnvioEnDuda | null>(() => envioEnDuda(ambito))
  const actual = useRef<{ huella: string; llave: string; monto: number; reusada: boolean } | null>(null)

  useEffect(() => {
    setEnDuda(envioEnDuda(ambito))
  }, [ambito])

  const preparar = useCallback(
    (huella: string, monto: number) => {
      const { llave, reusada } = llavePara(ambito, huella)
      actual.current = { huella, llave, monto, reusada }
      return { llave, reusada }
    },
    [ambito],
  )

  const alTerminarBien = useCallback(() => {
    const fueReintento = actual.current?.reusada === true
    actual.current = null
    olvidarEnvioEnDuda(ambito)
    setEnDuda(null)
    return { fueReintento }
  }, [ambito])

  const alFallar = useCallback(
    (err: unknown) => {
      const envio = actual.current
      if (!envio) return
      if (quedoEnDuda(err)) {
        const enDudaNuevo = { huella: envio.huella, llave: envio.llave, monto: envio.monto, desde: Date.now() }
        guardarEnvioEnDuda(ambito, enDudaNuevo)
        setEnDuda(enDudaNuevo)
      } else if (envioEnDuda(ambito)?.llave === envio.llave) {
        // Rechazo definitivo: no se registró nada con esa llave.
        olvidarEnvioEnDuda(ambito)
        setEnDuda(null)
      }
    },
    [ambito],
  )

  const esOtro = useCallback(() => {
    olvidarEnvioEnDuda(ambito)
    setEnDuda(null)
  }, [ambito])

  return { enDuda, preparar, alTerminarBien, alFallar, esOtro }
}
