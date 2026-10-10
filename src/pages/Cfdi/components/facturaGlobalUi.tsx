/**
 * Lo que comparten las pantallas de la factura global (botón de hoy, panel de periodos, complementaria, lista de facturas):
 * el aviso de cada desenlace del disparo, el texto de cada error y la etiqueta de «Emitir complementaria».
 *
 * Un solo lugar a propósito: el aviso de «Emitir» en un periodo viejo y el de la complementaria tienen que ser «el mismo que el
 * botón de hoy» (plan C1, Tarea 13), y un arreglo en uno no puede quedarse fuera de los otros.
 */
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import type { CorregidasPendientes, GlobalCfdiAlreadyStamped, GlobalCfdiResult, GlobalPeriod } from '@/services/cfdi.service'
import { textoDelServidor } from '@/utils/apiError'
import { getIntlLocale } from '@/utils/i18n-locale'

/** La `t` de i18next, tipada como la usan los demás ayudantes puros del repo (`IvaPorTasa`, `ReferralCard`). */
export type Traducir = (key: string, options?: Record<string, unknown>) => string

/** "06/2026": el periodo que el servidor devuelve en `cfdi.globalPeriod`. */
export function formatGlobalPeriod(period?: GlobalPeriod | null): string {
  if (!period) return ''
  const meses = period.meses ? `${period.meses}/` : ''
  return `${meses}${period.anio ?? ''}`.trim()
}

/**
 * La zona en la que el SERVIDOR corta los periodos de la factura global (`avoqado-server/src/services/fiscal/globalPeriod.ts`: el día 4
 * empieza a las `06:00Z`, medianoche de CDMX). No es la zona del negocio: para un negocio en Tijuana ese mismo instante es el día 3 a las
 * 23:00, y la persona confirmaría el timbrado de «3 oct» cuando el servidor timbra el 4 (T13 ronda 1, I3).
 */
const ZONA_FISCAL = 'America/Mexico_City'

/**
 * Un periodo de la global en palabras de calendario, en la ZONA FISCAL: un día ⇒ ese día; más ⇒ «inicio – último día». `hasta` es
 * EXCLUSIVO (el inicio del siguiente periodo), así que el último día es `hasta − 1 ms`. Sin fechas válidas, el texto tal cual.
 */
export function rangoFiscal(desde: string, hasta: string, idioma?: string): string {
  const locale = getIntlLocale(idioma)
  const inicio = DateTime.fromISO(desde, { zone: 'utc' }).setZone(ZONA_FISCAL).setLocale(locale)
  const fin = DateTime.fromISO(hasta, { zone: 'utc' }).minus({ milliseconds: 1 }).setZone(ZONA_FISCAL).setLocale(locale)
  if (!inicio.isValid) return desde
  const dia = (d: DateTime) => d.toLocaleString(DateTime.DATE_MED)
  if (!fin.isValid || inicio.hasSame(fin, 'day')) return dia(inicio)
  return `${dia(inicio)} – ${dia(fin)}`
}

/**
 * Cuántas ventas quedaron fuera según la respuesta. Los motivos de IVA (`excluidasPorIvaMixto`, el campo viejo) son un subconjunto de
 * `excluidas`, así que el total es el mayor de los dos: una captura v1 manda `excluidas: {}` con el campo viejo > 0 (ronda 1, M2).
 */
export function totalExcluidas(
  r: { excluidas?: Record<string, number> | null; excluidasPorIvaMixto?: number | null } | null | undefined,
): number {
  if (!r) return 0
  const porMotivo = Object.values(r.excluidas ?? {}).reduce((s, n) => s + (Number(n) || 0), 0)
  return Math.max(porMotivo, Number(r.excluidasPorIvaMixto) || 0)
}

/**
 * «cobrada fuera de la terminal (3), producto con IVA por revisar (1)»: cuántas ventas quedaron fuera por cada motivo, en palabras. Un motivo
 * nuevo del servidor que la pantalla todavía no conoce sale como «otro motivo», nunca como clave cruda.
 */
export function listaDeMotivos(t: Traducir, excluidas: Record<string, number> | null | undefined): string {
  return Object.entries(excluidas ?? {})
    .filter(([, n]) => Number(n) > 0)
    .map(([motivo, n]) => {
      const clave = `globalInvoice.excluded.motives.${motivo}`
      const etiqueta = t(clave)
      const label = etiqueta === clave ? t('globalInvoice.excluded.motives.OTRO') : etiqueta
      return t('globalInvoice.excluded.motiveItem', { label, count: n })
    })
    .join(', ')
}

/**
 * El id que el listado de excluidas acepta como `principalId`: el de la PRINCIPAL. Una complementaria manda el de su principal
 * (`complementariaDe`); con su propio id el servidor responde 400 «no es una factura global principal» (revisión de la T12).
 */
export const principalParaElListado = (g: { cfdiId: string; complementariaDe: string | null }) => g.complementariaDe ?? g.cfdiId

/**
 * La etiqueta de «Emitir complementaria» según lo que el servidor encontró (C1-27, M9): `null` = no hay botón (nada pendiente o
 * sin conteo). Con `completo: false` el número es «al menos n»; con `n: 0` y la revisión incompleta no se sabe cuántas: el botón
 * va sin número y la ayuda lo dice (nunca «200 o más»).
 */
export function botonDeComplementaria(
  t: Traducir,
  cp: CorregidasPendientes | null | undefined,
): { label: string; ayuda: string | null } | null {
  if (!cp) return null
  if (cp.completo) return cp.n > 0 ? { label: t('globalInvoice.periods.complementaryCount', { count: cp.n }), ayuda: null } : null
  if (cp.n > 0) return { label: t('globalInvoice.periods.complementaryAtLeast', { count: cp.n }), ayuda: null }
  return { label: t('globalInvoice.periods.complementary'), ayuda: t('globalInvoice.periods.complementaryUnknown') }
}

// El texto de nuestro servidor (nunca el de axios) vive en `@/utils/apiError` (también lo usa el formulario del emisor); se reexporta aquí.
export { textoDelServidor }

/** El 409 de «se está emitiendo» (otra persona o el job tiene la reserva). El servidor lo dice con su texto, nunca con un código. */
const OCUPADO = /procesando|en proceso|emitiendo/i
/** El 409 del sello digital inactivo. */
const CSD = /sello digital|\bCSD\b/i
/** Estados del proxy o de la plataforma que no traen nuestro cuerpo: la petición pudo llegar o no al servidor. */
const SIN_SABER = [502, 503, 504, 524]

/**
 * El título y la descripción de un error del disparo o de la complementaria (409, 422, 502, 404, 400…). El texto que manda el
 * servidor se muestra tal cual: dice qué pasó y qué hacer. Si NO hay respuesta nuestra (la red se cortó, el proxy cortó a los 100 s,
 * la plataforma contestó con su página), el POST pudo haberse emitido: el aviso lo dice con honestidad (ronda 1, I4) y pide esperar un
 * minuto y volver a abrir la pantalla. No nombra el botón «Actualizar» de los periodos: la complementaria también se emite desde la lista
 * de facturas, donde ese botón no existe (ola final, M3).
 */
export function avisoDeError(t: Traducir, err: any): { title: string; description?: string } {
  const status: number | undefined = err?.response?.status
  const data = err?.response?.data ?? {}
  const delServidor = textoDelServidor(err)
  const error: string | undefined = typeof data?.error === 'string' ? data.error : undefined
  const message: string | undefined = typeof data?.message === 'string' ? data.message : undefined
  const reasons: string[] | undefined = Array.isArray(data?.reasons) ? data.reasons : undefined

  if (!err?.response || (status !== undefined && SIN_SABER.includes(status) && !delServidor)) {
    return { title: t('globalInvoice.toast.uncertainTitle'), description: t('globalInvoice.toast.uncertainDescription') }
  }
  switch (status) {
    case 409:
      if (error && OCUPADO.test(error)) return { title: t('globalInvoice.periods.busy') }
      if (error && CSD.test(error)) return { title: t('globalInvoice.toast.csdInactiveTitle'), description: error }
      return { title: t('globalInvoice.toast.genericTitle'), description: delServidor }
    case 422:
      return { title: error || t('globalInvoice.toast.validationTitle'), description: reasons?.length ? reasons.join(' · ') : message }
    case 502:
      // Ronda QA (hermanos): el servidor marca `timbreEnDuda` cuando el PAC no contestó claro (pudo haberla timbrado): no es un rechazo,
      // y el error crudo («fetch failed») no se enseña.
      if (data?.timbreEnDuda === true)
        return { title: t('globalInvoice.toast.pacNoAnswerTitle'), description: t('globalInvoice.toast.pacNoAnswerDescription') }
      return { title: t('globalInvoice.toast.pacRejectedTitle'), description: message || error }
    case 404:
      return { title: t('globalInvoice.toast.notFoundTitle'), description: error }
    default:
      return { title: t('globalInvoice.toast.genericTitle'), description: delServidor }
  }
}

/** T11 ronda 1 (m4): la llave ya estaba timbrada (`status: 'YA_TIMBRADA'` o `yaTimbrada: true`); trae `cfdi` como una recién timbrada. */
const yaEstabaTimbrada = (r: GlobalCfdiResult): r is GlobalCfdiAlreadyStamped =>
  ('status' in r && r.status === 'YA_TIMBRADA') || (r as { yaTimbrada?: unknown }).yaTimbrada === true

const juntar = (...partes: Array<string | null | undefined>) => partes.filter(Boolean).join(' ') || undefined

/**
 * El aviso de cada desenlace de un disparo (el botón de hoy, «Emitir» de un periodo, la complementaria). `periodo` = el periodo ya
 * escrito (el panel lo manda en la zona fiscal; sin él, el `meses/año` que devuelve el servidor). `nota` se agrega a la descripción
 * (p. ej. «se emitirá tarde»). Si quedaron ventas fuera —también en un 422, que es cuando más hace falta (M8)— y hay a dónde llevar a la
 * persona, un segundo aviso lo dice con «Ver cuáles».
 */
export function useAvisoDeLaGlobal() {
  const { t } = useTranslation('cfdi')
  const { toast } = useToast()

  const avisarExcluidas = (conteos: Parameters<typeof totalExcluidas>[0], onVerExcluidas?: () => void) => {
    const fuera = totalExcluidas(conteos)
    if (fuera <= 0 || !onVerExcluidas) return
    // Ronda 2: el resumen también dice POR QUÉ (p. ej. «cobrada fuera de la terminal (3)», el interruptor del founder de la T10).
    const porQue = listaDeMotivos(t, conteos?.excluidas)
    toast({
      title: t('globalInvoice.excluded.summary', { count: fuera }),
      description: porQue ? t('globalInvoice.excluded.byReason', { list: porQue }) : undefined,
      action: (
        <ToastAction altText={t('globalInvoice.excluded.see')} onClick={onVerExcluidas}>
          {t('globalInvoice.excluded.see')}
        </ToastAction>
      ),
    })
  }

  const avisarResultado = (result: GlobalCfdiResult, opts: { nota?: string; periodo?: string; onVerExcluidas?: () => void } = {}) => {
    const pdf = (pdfUrl: string | null) =>
      pdfUrl ? (
        <ToastAction altText={t('globalInvoice.toast.openPdf')} onClick={() => window.open(pdfUrl, '_blank', 'noopener')}>
          {t('globalInvoice.toast.openPdf')}
        </ToastAction>
      ) : undefined
    // Ronda 2 (T11 m4): una llave YA timbrada (otro clic o el job llegaron antes) trae `cfdi` como la recién timbrada, así que se mira
    // PRIMERO: no se emitió nada ahora, y el aviso lo dice con el texto del servidor.
    if (yaEstabaTimbrada(result)) {
      const { serie, folio, pdfUrl } = result.cfdi
      toast({
        title: t('globalInvoice.toast.alreadyStampedTitle', { folio: `${serie}-${folio}` }),
        description: juntar(result.message),
        action: pdf(pdfUrl),
      })
    } else if ('status' in result && result.status === 'NOTHING_TO_INVOICE') {
      // 200 — nada que facturar. No es un error: aviso normal.
      const periodo = opts.periodo ? t('globalInvoice.toast.stampedDescription', { period: opts.periodo }) : null
      toast({ title: t('globalInvoice.toast.nothingTitle'), description: juntar(result.message, periodo, opts.nota) })
    } else if ('cfdi' in result && result.cfdi) {
      const { serie, folio, pdfUrl, globalPeriod } = result.cfdi
      const period = opts.periodo ?? formatGlobalPeriod(globalPeriod)
      toast({
        title: t('globalInvoice.toast.stampedTitle', { folio: `${serie}-${folio}` }),
        description: juntar(period ? t('globalInvoice.toast.stampedDescription', { period }) : null, opts.nota),
        action: pdf(pdfUrl),
      })
    }
    avisarExcluidas(result, opts.onVerExcluidas)
  }

  const avisarError = (err: any, opts: { onVerExcluidas?: () => void } = {}) => {
    toast({ ...avisoDeError(t, err), variant: 'destructive' })
    // M8: un 422 (VALIDATION_FAILED) también trae los conteos; es cuando más hace falta ver cuáles quedaron fuera.
    const data = err?.response?.data
    if (data && typeof data === 'object') avisarExcluidas(data, opts.onVerExcluidas)
  }

  return { avisarResultado, avisarError }
}
