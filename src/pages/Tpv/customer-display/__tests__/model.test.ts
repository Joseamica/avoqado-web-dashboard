import { describe, expect, it } from 'vitest'
import type { CustomerDisplayDeviceItem, CustomerDisplayDeviceList } from '@/services/customerDisplay.service'
import {
  aBorrador,
  aCuerpoDeGuardado,
  agregarPorcentaje,
  cambioDePaso,
  CHECKOUT_RECEIPT_TOGGLE_MIN_POS_ANDROID,
  colorDelHex,
  contarCaracteres,
  crearSecuencia,
  DISENO_DE_FABRICA,
  esDisenoDeFabrica,
  estaSucio,
  filasDeDestino,
  limitarTexto,
  MAX_PORCENTAJES_DE_PROPINA,
  momentosVisibles,
  notasDeDestino,
  PALETA_DE_LA_TABLET,
  quitarPorcentaje,
  reciboNecesitaActualizar,
  revisarArchivo,
  revisarMedidas,
  superficieDeLaPantalla,
} from '../model'

describe('valores esperados del contrato de F0-A (NO es verificación cruzada con el server)', () => {
  // Codex F1 r1 (tabla de pruebas, P3): aquí no se lee nada del worktree del server. Si el server cambia estos valores,
  // esta prueba NO lo detecta: lo detectan la QA real (B6.4) y la auditoría del código.
  it('la fábrica es FACTORY_DESIGN', () => {
    expect(DISENO_DE_FABRICA).toEqual({
      theme: 'LIGHT',
      accentColor: null,
      logoAssetId: null,
      welcomeText: null,
      thanksText: null,
      slides: [],
      slideSeconds: 8,
      showPromotions: false,
    })
  })
  it('los fondos de la tablet son los de theme-backgrounds.json de F0-A (contrato compartido con Android)', () => {
    expect({ LIGHT: PALETA_DE_LA_TABLET.LIGHT.fondo, DARK: PALETA_DE_LA_TABLET.DARK.fondo }).toEqual({ LIGHT: '#FFFFFF', DARK: '#1C1C1E' })
  })
})

describe('borrador', () => {
  const guardado = { ...DISENO_DE_FABRICA, theme: 'DARK' as const, accentColor: '#0e7c66', welcomeText: 'Hola' }
  it('aBorrador: textos null ⇒ vacíos; color en mayúsculas', () => {
    expect(aBorrador(guardado)).toEqual({ theme: 'DARK', accentColor: '#0E7C66', logoAssetId: null, welcomeText: 'Hola', thanksText: '' })
  })
  it('🔴 el cuerpo lleva SÓLO los cinco campos de F1 (nunca imágenes ni promos)', () => {
    const cuerpo = aCuerpoDeGuardado(aBorrador({ ...guardado, slides: [{ assetId: 'a1' }], showPromotions: true }))
    expect(Object.keys(cuerpo).sort()).toEqual(['accentColor', 'logoAssetId', 'thanksText', 'theme', 'welcomeText'])
  })
  it('estaSucio: espacios de más o el color en minúsculas no cuentan como cambio; un texto distinto sí', () => {
    const b = aBorrador(guardado)
    expect(estaSucio({ ...b, welcomeText: '  Hola  ', accentColor: '#0e7c66' }, guardado)).toBe(false)
    expect(estaSucio({ ...b, welcomeText: 'Hola!' }, guardado)).toBe(true)
    expect(estaSucio({ ...b, theme: 'LIGHT' }, guardado)).toBe(true)
    expect(estaSucio({ ...b, logoAssetId: 'a9' }, guardado)).toBe(true)
  })
  it('esDisenoDeFabrica', () => {
    expect(esDisenoDeFabrica(DISENO_DE_FABRICA)).toBe(true)
    expect(esDisenoDeFabrica({ ...DISENO_DE_FABRICA, welcomeText: 'Hola' })).toBe(false)
    expect(esDisenoDeFabrica({ ...DISENO_DE_FABRICA, showPromotions: true })).toBe(false)
  })
})

describe('textos (Review Focus 2)', () => {
  it('cuenta lo que ve la persona: un emoji es UN carácter', () => {
    expect(contarCaracteres('😀😀')).toBe(2)
    expect(contarCaracteres('Café')).toBe(4)
  })
  it('🔴 limitarTexto corta en 40 code points sin partir un emoji', () => {
    const largo = '😀'.repeat(41)
    expect(contarCaracteres(limitarTexto(largo))).toBe(40)
    expect(limitarTexto(largo)).toBe('😀'.repeat(40))
    expect(limitarTexto('¡Bienvenido!')).toBe('¡Bienvenido!')
  })
})

describe('color (Review Focus 3)', () => {
  it('acepta #RRGGBB en minúsculas o con espacios y lo devuelve en mayúsculas', () => {
    expect(colorDelHex(' #0e7c66 ')).toBe('#0E7C66')
  })
  it('rechaza lo que está a medio escribir', () => {
    for (const malo of ['', '#12', '0E7C66', '#0E7C6G', '#0E7C667', 'verde']) expect(colorDelHex(malo), malo).toBeNull()
  })
})

describe('imagen del logo (cortesía; el server vuelve a medir por los bytes)', () => {
  it('tipo y peso', () => {
    expect(revisarArchivo({ type: 'image/png', size: 1000 })).toBeNull()
    expect(revisarArchivo({ type: 'image/webp', size: 1000 })).toBeNull()
    expect(revisarArchivo({ type: 'image/gif', size: 1000 })).toBe('tipo')
    expect(revisarArchivo({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toBe('peso')
    expect(revisarArchivo({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull()
  })
  it('medidas: de 400 a 4096 por lado, extremos incluidos', () => {
    expect(revisarMedidas(400, 4096)).toBeNull()
    expect(revisarMedidas(399, 800)).toBe('medidas')
    expect(revisarMedidas(800, 4097)).toBe('medidas')
  })
})

describe('crearSecuencia (Review Focus 4, Codex #10)', () => {
  it('sólo la ÚLTIMA solicitud emitida es vigente; una anterior deja de serlo aunque su respuesta llegue después', () => {
    const s = crearSecuencia()
    const uno = s.siguiente()
    expect(s.esLaVigente(uno)).toBe(true)
    const dos = s.siguiente()
    expect(s.esLaVigente(uno)).toBe(false)
    expect(s.esLaVigente(dos)).toBe(true)
  })
})

describe('pasos del cobro', () => {
  it('momentosVisibles: sin propina ni estrellas, esos momentos no se ofrecen', () => {
    expect(momentosVisibles({ showTipScreen: true, showReviewScreen: true })).toEqual([
      'espera',
      'carrito',
      'propina',
      'calificar',
      'gracias',
    ])
    expect(momentosVisibles({ showTipScreen: false, showReviewScreen: false })).toEqual(['espera', 'carrito', 'gracias'])
  })
  it('cambioDePaso manda UNA sola llave', () => {
    expect(cambioDePaso('showReviewScreen', false)).toEqual({ showReviewScreen: false })
  })
  it('agregarPorcentaje: 1 a 100, sin repetidos, ordenado', () => {
    expect(agregarPorcentaje([10, 15, 20], '18')).toEqual([10, 15, 18, 20])
    for (const malo of ['', '0', '101', '15', '12.5', 'diez']) expect(agregarPorcentaje([10, 15, 20], malo), malo).toBeNull()
  })
  it('🔴 agregarPorcentaje: tope de 6, el mismo del POS y de superadmin (con 7 el POS ya no podría guardar propinas)', () => {
    expect(MAX_PORCENTAJES_DE_PROPINA).toBe(6)
    expect(agregarPorcentaje([5, 10, 15, 20, 25], '30')).toEqual([5, 10, 15, 20, 25, 30])
    expect(agregarPorcentaje([5, 10, 15, 20, 25, 30], '35')).toBeNull()
    // Una lista vieja que ya trae de más no crece (quitar sí se puede).
    expect(agregarPorcentaje([1, 2, 3, 4, 5, 6, 7], '8')).toBeNull()
  })
  it('quitarPorcentaje: nunca deja la lista vacía', () => {
    expect(quitarPorcentaje([10, 15], 15)).toEqual([10])
    expect(quitarPorcentaje([10], 10)).toBeNull()
    expect(quitarPorcentaje([10, 15], 30)).toBeNull()
  })
  it('🔴 «Ofrecer recibo» pide actualizar en POS mientras el mínimo siga en MAX_SAFE_INTEGER (F2 lo baja)', () => {
    expect(CHECKOUT_RECEIPT_TOGGLE_MIN_POS_ANDROID).toBe(Number.MAX_SAFE_INTEGER)
    expect(reciboNecesitaActualizar('POS_ANDROID', 240)).toBe(true)
    expect(reciboNecesitaActualizar('POS_IOS', null)).toBe(true)
    expect(reciboNecesitaActualizar('TPV_ANDROID', 76)).toBe(false)
  })
})

describe('destinos de la copia', () => {
  const fila = (id: string, extra: Partial<CustomerDisplayDeviceItem> = {}): CustomerDisplayDeviceItem => ({
    id,
    name: id,
    editToken: 'factory',
    designVersion: 1,
    presence: 'SUPPORTED',
    stale: false,
    capabilitiesObservedAt: null,
    lastHeartbeat: null,
    ...extra,
  })
  const pagina = (devices: CustomerDisplayDeviceItem[]): CustomerDisplayDeviceList => ({ total: 9, nextCursor: null, devices })
  it('filasDeDestino quita el origen y los repetidos entre páginas, conservando el orden', () => {
    expect(filasDeDestino([pagina([fila('a'), fila('origen')]), pagina([fila('a'), fila('b')])], 'origen').map(f => f.id)).toEqual([
      'a',
      'b',
    ])
  })
  it('notasDeDestino dice qué pasa con cada uno', () => {
    expect(notasDeDestino(fila('a'))).toEqual(['rowFactory'])
    expect(notasDeDestino(fila('a', { editToken: 'd1:2', designVersion: null, presence: 'UNSUPPORTED' }))).toEqual([
      'rowReplace',
      'rowNoApp',
      'rowNoDisplay',
    ])
    expect(notasDeDestino(fila('a', { presence: 'UNSUPPORTED', stale: true }))).toEqual(['rowFactory'])
  })
})

describe('superficie por tipo de aparato (spec §6.1)', () => {
  it('POS_ANDROID: diseño; POS_IOS: sólo pasos; el resto: nada', () => {
    expect(superficieDeLaPantalla('POS_ANDROID')).toBe('diseno')
    expect(superficieDeLaPantalla('POS_IOS')).toBe('soloPasos')
    for (const t of ['TPV_ANDROID', 'TPV_IOS', 'POS_DESKTOP', undefined, null]) expect(superficieDeLaPantalla(t)).toBe('ninguna')
  })
})
