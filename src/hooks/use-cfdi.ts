/**
 * TanStack Query hooks for Facturación (CFDI).
 *
 * Query keys:
 *   ['fiscal-config', venueId]        — emisores + merchant configs
 *   ['cfdis', venueId, filters]       — issued invoices list
 *
 * Mutations toast on success/error (i18n) and invalidate the relevant keys.
 */
import { useEffect, useRef } from 'react'
import {
  hashKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { reintentarReporte, repetirAlVolver } from '@/components/accounting/errorDelReporte'
import { apiErrorDescription, textoDelServidor } from '@/utils/apiError'
import { triggerDownload } from '@/utils/export'
import { useCurrentVenue } from './use-current-venue'
import { useToast } from './use-toast'
import cfdiService, {
  type CancelCfdiRequest,
  type CfdiListFilters,
  type CfdiReceptor,
  type FiscalConfig,
  type GlobalCfdiResult,
  type GlobalExcluidasPage,
  type IssueCfdiResponse,
  type MerchantConfig,
  type UpsertEmisorRequest,
  type UpsertMerchantConfigRequest,
  type UploadCsdRequest,
} from '@/services/cfdi.service'

export const fiscalConfigQueryKey = (venueId: string | null) => ['fiscal-config', venueId]
export const cfdisQueryKey = (venueId: string | null, filters: CfdiListFilters) => ['cfdis', venueId, filters]
export const emisorProviderStatusQueryKey = (venueId: string | null, emisorId: string | null) => [
  'emisor-provider-status',
  venueId,
  emisorId,
]

/**
 * Onboarding status of an emisor at the PAC (Carta Manifiesto pendiente, etc.).
 * Only queried for provisioned emisores — pass `enabled: false` otherwise.
 */
export function useEmisorProviderStatus(emisorId: string | null, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: emisorProviderStatusQueryKey(venueId, emisorId),
    queryFn: () => cfdiService.getEmisorProviderStatus(venueId!, emisorId!),
    enabled: !!venueId && !!emisorId && enabled,
    staleTime: 60 * 1000,
  })
}

/**
 * Emisores + merchant configs for the active venue.
 *
 * Pass `enabled: false` to skip the request entirely — used by the visible
 * teaser (paywall) so we don't hit the feature-gated backend when the venue
 * lacks the CFDI feature.
 */
export function useFiscalConfig(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: fiscalConfigQueryKey(venueId),
    queryFn: () => cfdiService.getFiscalConfig(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 60 * 1000,
  })
}

/** Create or update an emisor. Pass `emisorId` to update, omit to create. */
export function useUpsertEmisor() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ emisorId, data }: { emisorId?: string; data: UpsertEmisorRequest }) =>
      emisorId ? cfdiService.updateEmisor(venueId!, emisorId, data) : cfdiService.createEmisor(venueId!, data),
    onSuccess: (_emisor, { emisorId }) => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      // C1 (T13 ronda 1, M3): cambiar la periodicidad cambia los periodos recientes de ESE emisor; sin esto el panel enseñaría ≤60 s
      // periodos de la periodicidad vieja, y «Emitir» en uno de ellos daría un 400 confuso. Ola final (M2): el interruptor de ventas fuera
      // de la terminal y el de efectivo cambian también sus excluidas y su complementaria. Un RFC NUEVO cambia las de todo el negocio: con
      // dos RFC, las ventas fuera de la terminal ya no entran a ninguna global.
      invalidarLaGlobal(queryClient, venueId, emisorId)
      toast({ title: t('toast.emisorSaved') })
    },
    onError: (err: any) => {
      // Ronda 2 (residual de la re-revisión): sólo el texto de NUESTRO servidor, nunca el «Request failed…» de axios.
      toast({ title: t('toast.emisorSaveError'), description: textoDelServidor(err), variant: 'destructive' })
    },
  })
}

/** Connect an emisor to the PAC (facturapi org). */
export function useProvisionEmisor() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (emisorId: string) => cfdiService.provisionEmisor(venueId!, emisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.provisioned') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.provisionError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/** Sube el logo del venue a la org del PAC (lo que imprime en el PDF de cada factura). */
export function useSyncEmisorLogo() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (emisorId: string) => cfdiService.syncEmisorLogo(venueId!, emisorId),
    onSuccess: result => {
      if (result.synced === true) toast({ title: t('toast.logoSynced'), description: t('toast.logoSyncedDetail') })
      else toast({ title: t(`toast.logo.${result.reason}`), variant: 'destructive' })
    },
    onError: (err: any) => {
      toast({ title: t('toast.logoError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/** Descarga el PDF/XML de un CFDI como archivo (Descargas), no en una pestaña. */
export function useDownloadCfdiFile() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: async ({ cfdiId, type }: { cfdiId: string; type: 'pdf' | 'xml' }) => {
      const { blob, filename } = await cfdiService.downloadCfdiFile(venueId!, cfdiId, type)
      triggerDownload(blob, filename)
    },
    onError: (err: any) => {
      toast({ title: t('toast.downloadError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/** Upload the CSD (.cer + .key + password) for an emisor. */
export function useUploadCsd() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ emisorId, data }: { emisorId: string; data: UploadCsdRequest }) => cfdiService.uploadCsd(venueId!, emisorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.csdUploaded') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.csdError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/** Save the facturación toggles + emisor link for a merchant. */
export function useUpsertMerchantConfig() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation<MerchantConfig, any, UpsertMerchantConfigRequest, { emisorAnterior: string | null }>({
    mutationFn: data => cfdiService.upsertMerchantConfig(venueId!, data),
    // Ola final (punto 6): el RFC al que pertenecía el comercio ANTES de guardar, leído antes de que nada refresque la configuración.
    onMutate: data => ({ emisorAnterior: emisorDelComercio(queryClient.getQueryData<FiscalConfig>(fiscalConfigQueryKey(venueId)), data) }),
    onSuccess: (_config, data, previo) => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      // Ola final (punto 6): «Facturación activa», «Incluir en global» y el RFC del comercio deciden qué ventas entran a la global de su RFC
      // y si está apagada (`globalApagada`). Sin esto, el panel seguiría diciendo «apagada» después de prenderla aquí mismo. Sólo los RFC
      // que cambian: el de ahora y, si se movió, el de antes.
      for (const emisorId of new Set([data.fiscalEmisorId, previo?.emisorAnterior]))
        if (emisorId) invalidarLaGlobal(queryClient, venueId, emisorId)
      toast({ title: t('toast.merchantSaved') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.merchantSaveError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/**
 * Paginated + filtered list of issued CFDIs.
 *
 * Pass `enabled: false` to skip the request — used by the visible teaser so we
 * don't hit the feature-gated backend when the venue lacks the CFDI feature.
 */
export function useCfdis(filters: CfdiListFilters, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: cfdisQueryKey(venueId, filters),
    queryFn: () => cfdiService.getCfdis(venueId!, filters),
    enabled: !!venueId && enabled,
    placeholderData: prev => prev,
  })
}

/**
 * Emit a CFDI for an order — Flow B "Facturar una cuenta".
 *
 * On success (201) we toast the serie-folio + UUID and invalidate the CFDI list
 * so the new invoice shows up. We deliberately do NOT toast on error here: the
 * caller (IssueCfdiDialog) branches on `err.response.status` to render the 422
 * `reasons[]` inline and surface 502/409/403/404 with the right message, since
 * each status needs distinct UX (keep modal open vs. close).
 */
export function useIssueCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation<IssueCfdiResponse, any, { orderId: string; receptor: CfdiReceptor }>({
    mutationFn: ({ orderId, receptor }) => cfdiService.issueCfdiForOrder(venueId!, orderId, receptor),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      const cfdi = data?.cfdi
      const folio = cfdi ? `${cfdi.serie}-${cfdi.folio}` : ''
      toast({
        title: t('issueDialog.toast.success'),
        description: cfdi ? t('issueDialog.toast.successDetail', { folio, uuid: cfdi.uuid }) : undefined,
      })
    },
    // Error handling is intentionally left to the caller (status-specific UX).
  })
}

/**
 * Confirma que una venta vieja se cobró con el IVA YA incluido (el 422 de «Facturar» trae la vista previa
 * en `priceContract`). Sólo corrige el dato de la venta; el diálogo vuelve a mandar «Facturar» al terminar.
 *
 * Sin toast de error aquí: el diálogo pinta el texto del servidor (409 `CAMBIO_DESDE_LA_VISTA` pide volver
 * a facturar para ver la venta actualizada; 409 `NO_CONFIRMABLE` / 404 dicen por qué no).
 */
export function useConfirmPriceContract() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation<{ ok: true }, any, { orderId: string; version: number; huella: string }>({
    mutationFn: ({ orderId, version, huella }) => cfdiService.confirmPriceContract(venueId!, orderId, version, huella),
    onSuccess: () => {
      toast({ title: t('issueDialog.priceContract.confirmed') })
    },
  })
}

/**
 * Flow C — manually stamp the period's global CFDI for an emisor.
 *
 * On success we invalidate the CFDI list so a freshly stamped global invoice
 * shows up in the Facturas screen. We deliberately do NOT toast here: the
 * trigger has SIX distinct outcomes (201 stamped, 200 NOTHING_TO_INVOICE, plus
 * 409 CSD inactivo / 409 en proceso / 422 / 502 / 404 errors) that each need
 * different toast styling and copy, so the caller (CfdiConfiguracion) branches
 * on the result / `err.response.status`. Errors re-throw to the caller.
 */
export function useTriggerGlobalCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  // C1 (Tarea 8): con `desde`, un periodo reciente a mano (el panel de periodos); sin él, el último cerrado (el botón de siempre).
  return useMutation<GlobalCfdiResult, any, { emisorId: string; desde?: string }>({
    mutationFn: ({ emisorId, desde }) => cfdiService.triggerGlobalCfdi(venueId!, emisorId, desde),
    // Al terminar —bien o mal—, el estado de los periodos de ESE emisor pudo cambiar (reservada, timbrada, detenida con su motivo).
    // Sólo los suyos (ronda 1, I1): son consultas pesadas y los demás emisores no cambiaron.
    onSettled: (_r, _e, { emisorId }) => {
      queryClient.invalidateQueries({ queryKey: globalPeriodosQueryKey(venueId, emisorId) })
      queryClient.invalidateQueries({ queryKey: ['global-excluidas', venueId, emisorId] })
    },
    onSuccess: () => {
      // A new global CFDI (when stamped) must appear in the Facturas list.
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
    },
    // Status-specific UX is intentionally left to the caller.
  })
}

export const globalPeriodosQueryKey = (venueId: string | null, emisorId: string | null) => ['global-periodos', venueId, emisorId]

/**
 * Ola final (M2 y punto 6): las tres consultas de la factura global que LEEN la configuración fiscal de un RFC (los periodos con su
 * `globalApagada`, las ventas que no entraron y la vista previa de la complementaria). Sin `emisorId`, las de todo el negocio.
 */
function invalidarLaGlobal(queryClient: QueryClient, venueId: string | null, emisorId?: string) {
  for (const raiz of ['global-periodos', 'global-excluidas', 'global-complementaria'])
    queryClient.invalidateQueries({ queryKey: emisorId ? [raiz, venueId, emisorId] : [raiz, venueId] })
}

/** El RFC que la configuración en caché le da al comercio que se va a guardar (por su cuenta o su canal en línea); `null` si es nuevo. */
function emisorDelComercio(config: FiscalConfig | undefined, data: UpsertMerchantConfigRequest): string | null {
  const actual = config?.merchantConfigs?.find(c =>
    data.merchantAccountId
      ? c.merchantAccountId === data.merchantAccountId
      : !!data.ecommerceMerchantId && c.ecommerceMerchantId === data.ecommerceMerchantId,
  )
  return actual?.fiscalEmisorId ?? null
}

/**
 * C1 (T13 ronda 1, I1): la política de la casa para las tres consultas pesadas de la factura global (periodos, ventas que no
 * entraron, vista previa de la complementaria; `.claude/rules/bounded-data-and-query-load.md`), local a cada consulta:
 * - `staleTime` de un minuto y sin recarga al volver a la ventana: cada una revisa hasta cientos de ventas en el servidor, y el listado
 *   por páginas recargaría TODAS las páginas ya abiertas;
 * - un reintento como mucho, y ninguno ante un 4xx (no se arregla repitiendo) ni ante el corte del proxy (504/524), con el mismo
 *   criterio de los reportes de B4b (`reintentarReporte`); y una consulta que el proxy cortó no se relanza sola al reconectar.
 */
const CONSULTA_PESADA_DE_LA_GLOBAL = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: repetirAlVolver,
  retry: (fallas: number, err: unknown) => {
    const status = (err as { response?: { status?: unknown } } | null)?.response?.status
    if (typeof status === 'number' && status < 500) return false
    return reintentarReporte(1)(fallas, err)
  },
} as const

/**
 * C1 (Tarea 8, C1-P16 = B): los periodos cerrados RECIENTES del emisor con el estado de su global. Sin paginación hacia atrás:
 * un periodo más viejo se pide a soporte.
 */
export function useGlobalPeriodos(emisorId: string | null, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: globalPeriodosQueryKey(venueId, emisorId),
    queryFn: () => cfdiService.getGlobalPeriodos(venueId!, emisorId!),
    enabled: !!venueId && !!emisorId && enabled,
    ...CONSULTA_PESADA_DE_LA_GLOBAL,
  })
}

/**
 * C1 (Tarea 12): las ventas que no entraron a la global de un periodo, por páginas. Los totales vienen SÓLO en la primera página
 * (`data.pages[0]`); «Cargar más» pide la siguiente con su cursor.
 */
export function useGlobalExcluidas(
  emisorId: string | null,
  query: { principalId?: string; desde?: string },
  options?: { enabled?: boolean },
) {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true
  const principalId = query.principalId ?? null
  const desde = query.desde ?? null
  const activa = !!venueId && !!emisorId && enabled
  const resultado = useInfiniteQuery({
    queryKey: ['global-excluidas', venueId, emisorId, principalId, desde],
    queryFn: ({ pageParam }) =>
      cfdiService.getGlobalExcluidas(venueId!, emisorId!, {
        ...(query.principalId && { principalId: query.principalId }),
        ...(query.desde && { desde: query.desde }),
        ...(pageParam && { cursor: pageParam }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: GlobalExcluidasPage) => last.siguiente ?? undefined,
    enabled: activa,
    // Un 400 («pídelo a soporte») o un 404 no se arreglan reintentando; el corte del proxy tampoco.
    ...CONSULTA_PESADA_DE_LA_GLOBAL,
    // N3: reconectar con páginas viejas las volvería a pedir TODAS en cadena; el listado se refresca al reabrirlo.
    refetchOnReconnect: false,
  })
  // Ola final (I1 de la re-revisión 2): la llave que estaba ABIERTA. Cuando se deja de ver —el diálogo se cierra, cambia de periodo o el
  // componente se desmonta— ESA llave se recorta a su primera página: al reabrir se pide una, no todas. Se recuerda la anterior porque el
  // panel y Configuración limpian `principalId`/`desde`/`emisorId` en el MISMO render en que cierran, y va DESPUÉS de `useInfiniteQuery` para
  // que el observador ya esté apagado (con la llave estable del sub-diálogo, un `resetQueries` aquí lo encontraba activo y recargaba).
  const abierta = useRef<QueryKey | null>(null)
  useEffect(() => {
    const ahora: QueryKey | null = activa ? ['global-excluidas', venueId, emisorId, principalId, desde] : null
    const anterior = abierta.current
    if (anterior && (!ahora || hashKey(anterior) !== hashKey(ahora))) recortarALaPrimeraPagina(queryClient, anterior)
    abierta.current = ahora
  }, [activa, queryClient, venueId, emisorId, principalId, desde])
  useEffect(
    () => () => {
      if (abierta.current) recortarALaPrimeraPagina(queryClient, abierta.current)
    },
    [queryClient],
  )
  return resultado
}

/**
 * Ola final (I1): deja el listado de una llave con su PRIMERA página. Con más de una en caché, reabrirlo con los datos viejos haría que
 * react-query volviera a pedir TODAS en cadena (cada una revisa hasta 200 ventas en el servidor).
 * - `setQueryData` no pide nada y se le pasa la fecha de los datos: recortar no los rejuvenece; una llave invalidada sigue invalidada.
 * - Si «Cargar más» iba en vuelo, se cancela (react-query vuelve al estado recortado); si no, la página llegaría después y se pegaría a
 *   las demás. Como no se sabe qué traía, la llave queda vieja y al reabrir se pide la primera página.
 */
function recortarALaPrimeraPagina(queryClient: QueryClient, llave: QueryKey) {
  const estado = queryClient.getQueryState<InfiniteData<GlobalExcluidasPage, string | undefined>>(llave)
  const datos = estado?.data
  if (!estado || !datos) return
  const enVuelo = estado.fetchStatus === 'fetching'
  if (datos.pages.length <= 1 && !enVuelo) return
  queryClient.setQueryData<InfiniteData<GlobalExcluidasPage, string | undefined>>(
    llave,
    { pages: datos.pages.slice(0, 1), pageParams: datos.pageParams.slice(0, 1) },
    { updatedAt: estado.dataUpdatedAt },
  )
  const envejecer = () => queryClient.invalidateQueries({ queryKey: llave, exact: true, refetchType: 'none' })
  if (enVuelo) void queryClient.cancelQueries({ queryKey: llave, exact: true }).then(envejecer)
  else if (estado.isInvalidated) void envejecer()
}

/** C1 (Tarea 11): la vista previa de la complementaria de una principal. Un 400 (no es principal, sin timbrar) no se reintenta. */
export function useGlobalComplementariaPreview(emisorId: string | null, principalId: string | null) {
  const { venueId } = useCurrentVenue()
  return useQuery({
    queryKey: ['global-complementaria', venueId, emisorId, principalId],
    queryFn: () => cfdiService.getGlobalComplementariaPreview(venueId!, emisorId!, principalId!),
    enabled: !!venueId && !!emisorId && !!principalId,
    ...CONSULTA_PESADA_DE_LA_GLOBAL,
  })
}

/**
 * C1 (Tarea 11): emite (o retoma) la global complementaria de una principal. Como el disparo, sin toast aquí: el diálogo decide el
 * aviso por cada desenlace. Al terminar refresca periodos, listado de excluidas, vista previa y la lista de facturas.
 */
export function useEmitGlobalComplementaria() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  return useMutation<GlobalCfdiResult, any, { emisorId: string; principalId: string }>({
    mutationFn: ({ emisorId, principalId }) => cfdiService.emitGlobalComplementaria(venueId!, emisorId, principalId),
    // Sólo lo de ESE emisor (ronda 1, I1); la lista de facturas, porque la complementaria aparece ahí.
    onSettled: (_r, _e, { emisorId }) => {
      queryClient.invalidateQueries({ queryKey: globalPeriodosQueryKey(venueId, emisorId) })
      queryClient.invalidateQueries({ queryKey: ['global-excluidas', venueId, emisorId] })
      queryClient.invalidateQueries({ queryKey: ['global-complementaria', venueId, emisorId] })
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
    },
  })
}

export const refundCreditNoteQueryKey = (venueId: string | null, refundId: string) => ['refund-credit-note', venueId, refundId]

/**
 * Estado de la nota de crédito (CFDI de Egreso) de un reembolso.
 *
 * Un 403 significa que el local NO tiene la feature CFDI: NO es un error que haya que
 * reintentar ni gritar — el panel lo pinta como "apagado" con su explicación. Por eso
 * no reintentamos en 403/404 y dejamos el error disponible para el componente.
 */
export function useRefundCreditNote(refundId: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: refundCreditNoteQueryKey(venueId, refundId),
    queryFn: () => cfdiService.getRefundCreditNote(venueId!, refundId),
    enabled: !!venueId && !!refundId && enabled,
    retry: (failureCount, err: any) => {
      const status = err?.response?.status
      if (status === 403 || status === 404) return false
      return failureCount < 1
    },
    staleTime: 30 * 1000,
  })
}

/**
 * Timbra la nota de crédito de un reembolso.
 *
 * 🔴 Irreversible (documento fiscal real): el caller confirma antes. No se hace toast de
 * error aquí — cada status necesita su propio texto (409 regla de negocio, 422 validación,
 * 502 PAC), así que el componente ramifica sobre `err.response`.
 */
export function useEmitRefundCreditNote() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (refundId: string) => cfdiService.emitRefundCreditNote(venueId!, refundId),
    onSuccess: (data, refundId) => {
      queryClient.invalidateQueries({ queryKey: refundCreditNoteQueryKey(venueId, refundId) })
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      const cn = data?.creditNote
      const folio = cn ? `${cn.serie ?? ''}${cn.folio ?? ''}` : ''
      toast({
        title: t('creditNote.toast.success', { defaultValue: 'Nota de crédito emitida' }),
        description: cn?.uuid
          ? t('creditNote.toast.successDetail', { folio, uuid: cn.uuid, defaultValue: `${folio} · ${cn.uuid}` })
          : undefined,
      })
    },
    // Error handling intencionalmente en el caller (texto por status).
  })
}

/**
 * Sustituir una factura equivocada. Devuelve el resultado COMPLETO al caller (no sólo un toast)
 * porque lo que importa —si la original quedó cancelada o sigue vigente— cambia el texto que ve
 * el negocio, y darlo por hecho sería mentirle.
 */
export function useReplaceCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cfdiId }: { cfdiId: string }) => cfdiService.replaceCfdi(venueId!, cfdiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
    },
    // Sin toast ni manejo de error aquí: el diálogo los pinta con el detalle del desenlace.
  })
}

/** Reenvía por correo una factura timbrada (PDF + XML). Sin correo, al del receptor registrado al facturar. */
export function useSendCfdiEmail() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ cfdiId, email }: { cfdiId: string; email?: string }) => cfdiService.sendCfdiEmail(venueId!, cfdiId, email),
    onSuccess: data => {
      // Sin destino = el correo que el cliente dio al facturar y que no conocemos aquí (facturas viejas).
      toast({ title: data.destination ? t('toast.emailSent', { destination: data.destination }) : t('toast.emailSentRegistered') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.emailError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}

/** Cancel an issued CFDI with a SAT motivo (01-04). */
export function useCancelCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ cfdiId, data }: { cfdiId: string; data: CancelCfdiRequest }) => cfdiService.cancelCfdi(venueId!, cfdiId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      toast({ title: t('toast.cancelRequested') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.cancelError'), description: apiErrorDescription(err), variant: 'destructive' })
    },
  })
}
