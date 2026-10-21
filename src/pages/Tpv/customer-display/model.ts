import type {
  CustomerDisplayDesign,
  CustomerDisplayDeviceItem,
  CustomerDisplayDeviceList,
  CustomerDisplayDraft,
} from '@/services/customerDisplay.service'
import type { TpvSettingsUpdate } from '@/services/tpv-settings.service'

/**
 * Lógica PURA de la pantalla del cliente en el dashboard (F1). Sin React, sin red, sin reloj: se prueba sola.
 * 🔴 Los números de abajo son ESPEJOS del server (`customerDisplayDesign.validation.ts`, `customerDisplayAsset.service.ts`).
 * El server vuelve a validar todo; aquí sólo sirven para avisar antes y no mandar lo que de seguro rechaza.
 */

/** `FACTORY_DESIGN` del server. */
export const DISENO_DE_FABRICA: CustomerDisplayDesign = {
  theme: 'LIGHT',
  accentColor: null,
  logoAssetId: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  showPromotions: false,
}

export const MAX_TEXTO = 40 // MAX_TEXT_CODE_POINTS
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
export const MAX_DESTINOS = 20 // MAX_COPY_TARGETS
export const PAGINA_DE_DISPOSITIVOS = 50 // DEVICES_PAGE_MAX
export const MAX_BYTES_DE_IMAGEN = 5 * 1024 * 1024
export const LADO_MINIMO = 400
export const LADO_MAXIMO = 4096
export const TIPOS_DE_IMAGEN: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

export type ClaveDeColor = 'deSiempre' | 'verde' | 'azul' | 'morado' | 'rojo'
/** Las muestras del prototipo aprobado (variante A, 14-oct). `null` = sin color propio (los colores de siempre). */
export const MUESTRAS_DE_COLOR: readonly { clave: ClaveDeColor; color: string | null }[] = [
  { clave: 'deSiempre', color: null },
  { clave: 'verde', color: '#0E7C66' },
  { clave: 'azul', color: '#2563EB' },
  { clave: 'morado', color: '#7C3AED' },
  { clave: 'rojo', color: '#C2410C' },
]

/**
 * 🔴 Colores REALES de la tablet (avoqado-android `designsystem/theme/Color.kt`), NO del dashboard: la vista previa pinta
 * el aparato, que tiene su propio tema claro u oscuro, sin importar el del dashboard. Son datos del aparato, como en
 * `WalletCardDesigner`; por eso aquí sí van hex. `fondo` es el contrato `theme-backgrounds.json` del server.
 */
export const PALETA_DE_LA_TABLET = {
  LIGHT: { fondo: '#FFFFFF', texto: '#1C1C1E', secundario: '#6C6C70', linea: '#E5E5EA', acento: '#1C1C1E', sobreAcento: '#FFFFFF' },
  DARK: { fondo: '#1C1C1E', texto: '#FFFFFF', secundario: '#98989D', linea: '#48484A', acento: '#FFFFFF', sobreAcento: '#1C1C1E' },
} as const
/** El marco físico de la tablet en la ilustración: siempre oscuro, como el aparato. */
export const MARCO_DE_LA_TABLET = '#111113'

/** Lo que se edita. Los textos son cadenas (vacío = el texto de siempre); el color, ya validado y en mayúsculas. */
export interface BorradorDelEditor {
  theme: 'LIGHT' | 'DARK'
  accentColor: string | null
  logoAssetId: string | null
  welcomeText: string
  thanksText: string
}

export function aBorrador(d: CustomerDisplayDesign): BorradorDelEditor {
  return {
    theme: d.theme,
    accentColor: d.accentColor ? d.accentColor.toUpperCase() : null,
    logoAssetId: d.logoAssetId,
    welcomeText: d.welcomeText ?? '',
    thanksText: d.thanksText ?? '',
  }
}

/** 🔴 SÓLO los cinco campos de F1. Las imágenes y las promos (F3) nunca salen de este editor. */
export function aCuerpoDeGuardado(b: BorradorDelEditor): CustomerDisplayDraft {
  return { theme: b.theme, accentColor: b.accentColor, logoAssetId: b.logoAssetId, welcomeText: b.welcomeText, thanksText: b.thanksText }
}

/** La misma limpieza que hace el server (`cleanText`) para decidir si algo cambió de verdad. */
const normalizarTexto = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()

export function estaSucio(b: BorradorDelEditor, guardado: CustomerDisplayDesign): boolean {
  return (
    b.theme !== guardado.theme ||
    (b.accentColor ?? '').toUpperCase() !== (guardado.accentColor ?? '').toUpperCase() ||
    b.logoAssetId !== guardado.logoAssetId ||
    normalizarTexto(b.welcomeText) !== normalizarTexto(guardado.welcomeText) ||
    normalizarTexto(b.thanksText) !== normalizarTexto(guardado.thanksText)
  )
}

export function esDisenoDeFabrica(d: CustomerDisplayDesign): boolean {
  return (
    d.theme === 'LIGHT' &&
    d.accentColor === null &&
    d.logoAssetId === null &&
    d.welcomeText === null &&
    d.thanksText === null &&
    d.slides.length === 0 &&
    d.slideSeconds === 8 &&
    !d.showPromotions
  )
}

/** Code points, no unidades UTF-16: un emoji es UN carácter para quien escribe (igual que el server). */
export const contarCaracteres = (s: string) => [...s].length
export const limitarTexto = (s: string) => [...s].slice(0, MAX_TEXTO).join('')

/** El color si el texto es `#RRGGBB` (acepta minúsculas y espacios alrededor); si no, null: nunca viaja uno a medias. */
export function colorDelHex(texto: string): string | null {
  const limpio = texto.trim()
  return HEX_COLOR.test(limpio) ? limpio.toUpperCase() : null
}

export type MotivoDeImagenInvalida = 'tipo' | 'peso' | 'medidas'
export const MOTIVOS_DE_IMAGEN: readonly MotivoDeImagenInvalida[] = ['tipo', 'peso', 'medidas']

export function revisarArchivo(archivo: { type: string; size: number }): MotivoDeImagenInvalida | null {
  if (!TIPOS_DE_IMAGEN.includes(archivo.type)) return 'tipo'
  if (archivo.size > MAX_BYTES_DE_IMAGEN) return 'peso'
  return null
}

export function revisarMedidas(ancho: number, alto: number): MotivoDeImagenInvalida | null {
  return [ancho, alto].every(lado => Number.isFinite(lado) && lado >= LADO_MINIMO && lado <= LADO_MAXIMO) ? null : 'medidas'
}

/**
 * El `previewSeq` del editor (spec §6.3). 🔴 Sólo vale la ÚLTIMA solicitud emitida (Codex #10): una anterior que llega
 * tarde —con éxito o con error— se descarta, y una respuesta vieja nunca borra el error de la vigente.
 */
export function crearSecuencia() {
  let emitida = 0
  return {
    siguiente: () => ++emitida,
    esLaVigente: (seq: number) => seq === emitida,
  }
}

export type Momento = 'espera' | 'carrito' | 'propina' | 'calificar' | 'gracias'
export const MOMENTOS: readonly Momento[] = ['espera', 'carrito', 'propina', 'calificar', 'gracias']

/** Si un paso del cobro está apagado, su momento no se ofrece en la vista previa (igual que en el prototipo). */
export function momentosVisibles(p: { showTipScreen: boolean; showReviewScreen: boolean }): Momento[] {
  return MOMENTOS.filter(m => (m !== 'propina' || p.showTipScreen) && (m !== 'calificar' || p.showReviewScreen))
}

export type PasoConInterruptor = 'showTipScreen' | 'showReviewScreen' | 'showReceiptScreen'
export const PASOS_CON_INTERRUPTOR: readonly PasoConInterruptor[] = ['showTipScreen', 'showReviewScreen', 'showReceiptScreen']

/** Un interruptor manda SÓLO su llave: lo que no se toca se queda heredado de la organización (catch-up §M9). */
export function cambioDePaso(clave: PasoConInterruptor, valor: boolean): TpvSettingsUpdate {
  return { [clave]: valor } as TpvSettingsUpdate
}

/**
 * 🔴 Tope de porcentajes de propina: el MISMO del POS (`tpvSettings.mobile.schema.ts`, `.max(6)`) y de superadmin. El PUT
 * del dashboard no valida nada; si escribiera 7, el POS ya no podría guardar ningún cambio de propina.
 */
export const MAX_PORCENTAJES_DE_PROPINA = 6

export function agregarPorcentaje(lista: number[], texto: string): number[] | null {
  if (lista.length >= MAX_PORCENTAJES_DE_PROPINA) return null
  const limpio = texto.trim()
  if (!/^\d{1,3}$/.test(limpio)) return null
  const n = Number(limpio)
  if (n < 1 || n > 100 || lista.includes(n)) return null
  return [...lista, n].sort((a, b) => a - b)
}

export function quitarPorcentaje(lista: number[], porcentaje: number): number[] | null {
  const resto = lista.filter(p => p !== porcentaje)
  return resto.length === 0 || resto.length === lista.length ? null : resto
}

/** Las filas de la lista paginada, sin el origen ni repetidos entre páginas (dedupe por id, regla de datos acotados). */
export function filasDeDestino(paginas: CustomerDisplayDeviceList[], origenId: string): CustomerDisplayDeviceItem[] {
  const vistos = new Set<string>([origenId])
  const filas: CustomerDisplayDeviceItem[] = []
  for (const pagina of paginas) {
    for (const d of pagina.devices) {
      if (vistos.has(d.id)) continue
      vistos.add(d.id)
      filas.push(d)
    }
  }
  return filas
}

export type NotaDeDestino = 'rowFactory' | 'rowReplace' | 'rowNoApp' | 'rowNoDisplay'
export const NOTAS_DE_DESTINO: readonly NotaDeDestino[] = ['rowFactory', 'rowReplace', 'rowNoApp', 'rowNoDisplay']

export function notasDeDestino(d: Pick<CustomerDisplayDeviceItem, 'editToken' | 'designVersion' | 'presence' | 'stale'>): NotaDeDestino[] {
  const notas: NotaDeDestino[] = [d.editToken === 'factory' ? 'rowFactory' : 'rowReplace']
  if (d.designVersion === null) notas.push('rowNoApp')
  // Una presencia vieja (stale) no afirma nada: «desconocida» no se dice como «ausente».
  if (!d.stale && d.presence === 'UNSUPPORTED') notas.push('rowNoDisplay')
  return notas
}

export type SuperficieDeLaPantalla = 'diseno' | 'soloPasos' | 'ninguna'

/** Spec §6.1: sólo POS_ANDROID tiene pantalla del cliente; el iPad sólo configura los pasos del cobro. */
export function superficieDeLaPantalla(type: string | null | undefined): SuperficieDeLaPantalla {
  if (type === 'POS_ANDROID') return 'diseno'
  if (type === 'POS_IOS') return 'soloPasos'
  return 'ninguna'
}

/**
 * Spec §6.2: «Ofrecer recibo» sólo tiene efecto desde la versión de la app que lo obedece (F2). Arrancan en
 * MAX_SAFE_INTEGER y se bajan EN EL MISMO CAMBIO en que se publica cada app.
 */
export const CHECKOUT_RECEIPT_TOGGLE_MIN_POS_ANDROID = Number.MAX_SAFE_INTEGER
export const CHECKOUT_RECEIPT_TOGGLE_MIN_POS_IOS = Number.MAX_SAFE_INTEGER

export function reciboNecesitaActualizar(type: string | null | undefined, versionCode: number | null | undefined): boolean {
  const minimo =
    type === 'POS_ANDROID' ? CHECKOUT_RECEIPT_TOGGLE_MIN_POS_ANDROID : type === 'POS_IOS' ? CHECKOUT_RECEIPT_TOGGLE_MIN_POS_IOS : null
  if (minimo === null) return false
  return typeof versionCode !== 'number' || versionCode < minimo
}
