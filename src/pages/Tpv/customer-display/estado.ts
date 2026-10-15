import { DateTime } from 'luxon'
import type { CustomerDisplayView } from '@/services/customerDisplay.service'

/**
 * Qué decir del aparato en la tarjeta (spec §6.1). PURO. 🔴 Histórico y presente van SEPARADOS: el acuse dice lo que la
 * tablet REPORTÓ (con la hora del server, nunca la de la tablet); el latido y la presencia, lo que se sabe AHORA. Y nada se
 * afirma sin su evidencia: «guardado» exige `storedAt`; «mostrado», `shownAt`; un esquema que la app no entiende no es
 * ninguno de los dos (Codex F1 r1 #11).
 */

export interface AcuseDeLaPantalla {
  fingerprint: string
  receivedAt: string
  storedAt: string | null
  shownAt: string | null
  surface: 'presentation' | 'activity' | 'kiosk' | null
  imagesPending: number
  imagesFailed: number
  unsupportedSchema: boolean
}

/** El server guarda el acuse como JSON libre (`unknown`): uno ilegible no puede convertirse en «Mostrado». */
export function leerAcuse(raw: unknown): AcuseDeLaPantalla | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const a = raw as Record<string, unknown>
  if (typeof a.fingerprint !== 'string' || typeof a.receivedAt !== 'string') return null
  const texto = (v: unknown) => (typeof v === 'string' ? v : null)
  const cuenta = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0)
  return {
    fingerprint: a.fingerprint,
    receivedAt: a.receivedAt,
    storedAt: texto(a.storedAt),
    shownAt: texto(a.shownAt),
    surface: a.surface === 'presentation' || a.surface === 'activity' || a.surface === 'kiosk' ? a.surface : null,
    imagesPending: cuenta(a.imagesPending),
    imagesFailed: cuenta(a.imagesFailed),
    unsupportedSchema: a.unsupportedSchema === true,
  }
}

export type Historial =
  | { tipo: 'appSinDisenos' }
  | { tipo: 'sinAcuse' }
  | { tipo: 'pendiente' }
  | { tipo: 'noSoportado' }
  | { tipo: 'recibido' }
  | { tipo: 'kiosco'; fecha: string }
  | { tipo: 'mostrado'; fecha: string }
  | { tipo: 'guardado'; fecha: string }

export type Presencia = { tipo: 'detectada'; fecha: string } | { tipo: 'ausente' } | { tipo: 'desconocida' }

export interface EstadoDeLaPantalla {
  historial: Historial
  imagenesDescargandose: number
  imagenesFallidas: number
  promosPidenActualizar: boolean
  avisoDeInstalaciones: boolean
  latido: string | null
  presencia: Presencia
}

/** La llave de texto de cada estado (`customerDisplay:status.*`). La prueba de paridad la recorre. */
export const CLAVE_DEL_HISTORIAL: Record<Historial['tipo'], string> = {
  appSinDisenos: 'status.appWithoutDesigns',
  sinAcuse: 'status.noAck',
  pendiente: 'status.pending',
  noSoportado: 'status.unsupported',
  recibido: 'status.received',
  kiosco: 'status.kiosk',
  mostrado: 'status.shown',
  guardado: 'status.stored',
}

function historialDe(view: Pick<CustomerDisplayView, 'ficha' | 'device'>): Historial {
  if (view.device.designVersion === null) return { tipo: 'appSinDisenos' }
  const acuse = leerAcuse(view.device.ack)
  if (!acuse) return { tipo: 'sinAcuse' }
  // «Pendiente» se decide AL LEER (spec §5.7.2): el acuse es de otra huella que la ficha de ahora.
  if (acuse.fingerprint !== view.ficha.fingerprint) return { tipo: 'pendiente' }
  if (acuse.unsupportedSchema) return { tipo: 'noSoportado' }
  if (acuse.surface === 'kiosk') return acuse.storedAt ? { tipo: 'kiosco', fecha: acuse.receivedAt } : { tipo: 'recibido' }
  if (acuse.shownAt) return { tipo: 'mostrado', fecha: acuse.receivedAt }
  if (acuse.storedAt) return { tipo: 'guardado', fecha: acuse.receivedAt }
  return { tipo: 'recibido' }
}

export function estadoDeLaPantalla(view: Pick<CustomerDisplayView, 'design' | 'ficha' | 'device'>): EstadoDeLaPantalla {
  const { device } = view
  const acuse = device.designVersion === null ? null : leerAcuse(device.ack)
  const presencia: Presencia =
    device.stale || device.presence === 'UNKNOWN'
      ? { tipo: 'desconocida' }
      : device.presence === 'SUPPORTED'
        ? device.capabilitiesObservedAt
          ? { tipo: 'detectada', fecha: device.capabilitiesObservedAt }
          : { tipo: 'desconocida' }
        : { tipo: 'ausente' }
  return {
    historial: historialDe(view),
    imagenesDescargandose: acuse?.imagesPending ?? 0,
    imagenesFallidas: acuse?.imagesFailed ?? 0,
    promosPidenActualizar: device.designVersion === 1 && (view.design.slides.length > 0 || view.design.showPromotions),
    avisoDeInstalaciones: device.installationWarning,
    latido: device.lastHeartbeat,
    presencia,
  }
}

/** «hace 1 minuto», en el idioma de la app; mismo mecanismo que `TpvId` (Luxon). '' si la fecha no se puede leer. */
export function haceCuanto(iso: string, locale: string, ahora: Date = new Date()): string {
  const fecha = DateTime.fromISO(iso)
  if (!fecha.isValid) return ''
  return fecha.setLocale(locale).toRelative({ base: DateTime.fromJSDate(ahora) }) ?? ''
}

/**
 * ¿Falta el estado FINAL? (Codex #12). Final = la app entiende diseños, el acuse es de la huella vigente, la app la entiende,
 * ya se mostró y no quedan imágenes descargándose. Mientras no, la tarjeta vuelve a preguntar.
 */
export function esperandoALaPantalla(view: Pick<CustomerDisplayView, 'ficha' | 'device'> | undefined): boolean {
  if (!view) return false
  if (view.device.designVersion === null) return true
  const acuse = leerAcuse(view.device.ack)
  if (!acuse || acuse.fingerprint !== view.ficha.fingerprint || acuse.unsupportedSchema) return true
  return !acuse.shownAt || acuse.imagesPending > 0
}

export const REFRESCO_MS = 30_000
export const REFRESCO_MAXIMO_MS = 30 * 60_000

/**
 * El refresco ACOTADO: cada 30 s mientras falte el estado final, y a lo más 30 min desde que se montó la tarjeta. TanStack
 * no corre `refetchInterval` con la pestaña oculta (`refetchIntervalInBackground: false`), así que sólo pregunta mientras
 * alguien mira. Después de los 30 min queda el botón «Actualizar estado».
 */
export function intervaloDeRefresco(
  view: Pick<CustomerDisplayView, 'ficha' | 'device'> | undefined,
  montadaDesde: number,
  ahora: number,
): number | false {
  return esperandoALaPantalla(view) && ahora - montadaDesde < REFRESCO_MAXIMO_MS ? REFRESCO_MS : false
}
