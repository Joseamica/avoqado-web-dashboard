/**
 * Versión de los documentos legales que este dashboard muestra.
 *
 * 🔴 Hay DOS constantes y se cambian JUNTAS: ésta y `LEGAL_VERSIONS` en
 * `avoqado-server/src/config/legal.ts`. Quien edite `legal.json` actualiza las dos en el MISMO
 * cambio, o el servidor pedirá el consentimiento otra vez (o peor: lo dará por bueno).
 *
 * Antes de esto el asistente mandaba `new Date().toISOString().split('T')[0]` — la FECHA DEL DÍA—
 * como versión: dos personas que aceptaban el mismo texto en días distintos quedaban con versiones
 * distintas, y no había forma de saber qué texto aceptó nadie.
 *
 * 🔴 Y por eso lleva PREFIJO en vez de ser la fecha pelada: el servidor lee una versión con forma
 * `AAAA-MM-DD` como el marcador LEGACY (lo que dejó el asistente viejo con su fecha del día). La
 * constante valía `'2026-09-17'`, que es el día en que se escribió, así que una aceptación real de
 * los términos nuevos se habría guardado indistinguible de un consentimiento legacy: el servidor
 * daría por aceptado un texto que esa persona nunca vio. El prefijo es lo que hace imposible esa
 * confusión, y tiene que seguir sin parecerse a una fecha.
 */
export const LEGAL_DOCS_VERSION = 'v1-2026-09-17'
