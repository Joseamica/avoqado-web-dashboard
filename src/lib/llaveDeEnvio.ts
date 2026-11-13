import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'

/**
 * D1 (12-nov): la llave de un envío que el servidor deduplica (`idempotencyKey`), para un reembolso o un pago manual del panel.
 *
 * El dilema: si un envío quedó EN DUDA (sin respuesta o 5xx), el panel no sabe si se registró.
 * - Si la persona lo vuelve a mandar y es EL MISMO, tiene que ir con la MISMA llave (aunque haya salido de la pantalla,
 *   recargado o abierto otra pestaña): si no, se registra dos veces.
 * - Si ya revisó que entró y quiere hacer OTRO igual (otro reembolso de $50 del mismo pago), la llave vieja se lo «comería».
 * Nadie lo puede adivinar, así que se le pregunta (como en las tarjetas de regalo): mientras haya un envío sin confirmar, la
 * pantalla lo dice («Hay un pago de $100 sin confirmar…») con «Es otro», que lo olvida.
 *
 * Diseño (r2 de Codex, «anotar antes de mandar»):
 * - Cada envío se ANOTA antes de salir (`reservar`), por ámbito (`reembolso:<venue>:<pago>`, `pago-manual:<venue>`) y por
 *   huella (el contenido). Recargar, salir de Pagos o cerrar el diálogo a media petición no lo pierde.
 * - Mismo ámbito y misma huella ⇒ MISMA llave. Otro contenido ⇒ su propia anotación y su propia llave: nunca borra la de otro.
 * - Sólo la respuesta DEFINITIVA de ese envío lo borra (`resolver`): éxito o rechazo 4xx. En duda se queda.
 * - Vive en `localStorage` (todas las pestañas lo ven, y se enteran por el evento `storage`), 24 h. Si el navegador no deja
 *   guardar, queda en memoria.
 * - El aviso no enseña lo que ESTA pestaña tiene en vuelo (no es una duda todavía); en otra pestaña sí se ve.
 * - El doble clic del mismo instante lo frena un candado síncrono en la pantalla (`useCandado`), no esto.
 */

/** UUID v4: 36 caracteres de hex y guiones, dentro de lo que acepta el servidor (`^[A-Za-z0-9_-]{8,64}$`). */
export const llaveNueva = (): string => crypto.randomUUID()

export interface EnvioSinConfirmar {
  huella: string
  llave: string
  /** Pesos, para decírselo a la persona («Hay un pago de $100 sin confirmar»). */
  monto: number
  /** `Date.now()` del primer envío. */
  desde: number
}

type Almacen = Record<string, Record<string, Omit<EnvioSinConfirmar, 'huella'>>>

const CLAVE = 'avq-envios-sin-confirmar:v2'
const VIGENCIA_MS = 24 * 60 * 60 * 1000
const TOPE_POR_AMBITO = 20

let cache: Almacen | null = null
const enVuelo = new Set<string>() // `${ambito}␟${huella}` de ESTA pestaña
const oyentes = new Set<() => void>()
let version = 0

const id = (ambito: string, huella: string) => `${ambito}␟${huella}`

function avisar() {
  version += 1
  oyentes.forEach(oyente => oyente())
}

function leer(): Almacen {
  if (cache) return cache
  try {
    const crudo = localStorage.getItem(CLAVE)
    cache = crudo ? (JSON.parse(crudo) as Almacen) : {}
  } catch {
    cache = {}
  }
  return cache
}

function escribir(almacen: Almacen) {
  cache = almacen
  try {
    localStorage.setItem(CLAVE, JSON.stringify(almacen))
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
  avisar()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', evento => {
    if (evento.key !== CLAVE && evento.key !== null) return
    cache = null // otra pestaña cambió algo: se vuelve a leer
    avisar()
  })
}

function vigentes(ambito: string, ahora: number): EnvioSinConfirmar[] {
  return Object.entries(leer()[ambito] ?? {})
    .filter(([, envio]) => ahora - envio.desde <= VIGENCIA_MS)
    .map(([huella, envio]) => ({ huella, ...envio }))
    .sort((a, b) => a.desde - b.desde)
}

/** Los envíos sin confirmar de un ámbito (los vencidos no cuentan). */
export function enviosSinConfirmar(ambito: string, ahora: number = Date.now()): EnvioSinConfirmar[] {
  return vigentes(ambito, ahora)
}

/**
 * Anota el envío ANTES de mandarlo y da su llave: la de la anotación si ya había una con esa huella (es un reintento), o una
 * nueva. Marca el envío en vuelo en esta pestaña hasta `resolver` / `quedoSinConfirmar`.
 */
export function reservar(
  ambito: string,
  huella: string,
  monto: number,
  nueva: () => string = llaveNueva,
  ahora: number = Date.now(),
): { llave: string; reusada: boolean } {
  const almacen = leer()
  const delAmbito = { ...(almacen[ambito] ?? {}) }
  const previo = delAmbito[huella]
  enVuelo.add(id(ambito, huella))
  if (previo && ahora - previo.desde <= VIGENCIA_MS) {
    avisar()
    return { llave: previo.llave, reusada: true }
  }
  const llave = nueva()
  delAmbito[huella] = { llave, monto, desde: ahora }
  const ordenadas = Object.entries(delAmbito).sort(([, a], [, b]) => b.desde - a.desde).slice(0, TOPE_POR_AMBITO)
  escribir({ ...almacen, [ambito]: Object.fromEntries(ordenadas) })
  return { llave, reusada: false }
}

/** Respuesta definitiva (éxito o 4xx) de ESE envío: se borra su anotación, sólo la suya. */
export function resolver(ambito: string, huella: string) {
  enVuelo.delete(id(ambito, huella))
  const almacen = leer()
  if (!almacen[ambito]?.[huella]) return avisar()
  const { [huella]: _resuelto, ...resto } = almacen[ambito]
  escribir({ ...almacen, [ambito]: resto })
}

/** Quedó en duda: la anotación se queda (y ahora sí se enseña en esta pestaña). */
export function quedoSinConfirmar(ambito: string, huella: string) {
  enVuelo.delete(id(ambito, huella))
  avisar()
}

/** «Es otro»: la persona dice que esa anotación ya no es un reintento; la siguiente vez estrena llave. */
export const olvidar = resolver

/** Sólo para las pruebas. */
export function olvidarTodo() {
  enVuelo.clear()
  escribir({})
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Los envíos sin confirmar que la pantalla debe enseñar: los del ámbito que NO están en vuelo en esta pestaña. */
export function useEnviosSinConfirmar(ambito: string): EnvioSinConfirmar[] {
  const v = useSyncExternalStore(suscribir, () => version)
  return useMemo(
    () => enviosSinConfirmar(ambito).filter(e => !enVuelo.has(id(ambito, e.huella))),
    // `v` cambia con cada aviso del almacén.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ambito, v],
  )
}

/** Candado síncrono contra el doble clic del mismo instante: `isPending` de TanStack Query llega tarde. */
export function useCandado() {
  const ocupado = useRef(false)
  return useCallback(async <T,>(trabajo: () => Promise<T>): Promise<T | undefined> => {
    if (ocupado.current) return undefined
    ocupado.current = true
    try {
      return await trabajo()
    } finally {
      ocupado.current = false
    }
  }, [])
}

/** Atajo de las pantallas: el aviso, y «Es otro» por huella. */
export function useLlaveDeEnvio(ambito: string) {
  const sinConfirmar = useEnviosSinConfirmar(ambito)
  const esOtro = useCallback((huella: string) => olvidar(ambito, huella), [ambito])
  return { sinConfirmar, esOtro }
}
