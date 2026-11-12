import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Award, Gift, Plus } from 'lucide-react'

import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import loyaltyService from '@/services/loyalty.service'
import { loyaltyPromotionService } from '@/services/loyaltyPromotion.service'
import type {
  LoyaltyPromotion,
  LoyaltyPromotionEndDatePatch,
  LoyaltyPromotionInput,
  LoyaltyPromotionStatus,
  PaginatedLoyaltyPromotions,
} from '@/types/customer'
import { useVenueDateTime } from '@/utils/datetime'
import { LoyaltyPromotionDialog } from './components/LoyaltyPromotionDialog'
import { describirPromo, type ProgramaPrendido } from './describirPromo'

const ESTADOS: LoyaltyPromotionStatus[] = ['ACTIVE', 'SCHEDULED', 'ENDED']
const POR_PAGINA = 20
/** El mismo tope que el servidor (activas + programadas). */
const MAXIMO_VIVAS = 10

/**
 * «Promociones de lealtad» (spec §4.1): sello doble, puntos dobles. NO es la «Promoción» de combos y 2×1 (`/promotions`).
 * Lista en Activas / Programadas / Terminadas, cada una dicha en palabras; crear y editar en un FullScreenModal; «Terminar ahora»
 * en vez de borrar. Cuelga de `loyalty`: hereda `loyalty:read` y, en el servidor, el candado de plan de `/loyalty/*`.
 */
export default function LoyaltyPromotions() {
  const { venueId, fullBasePath } = useCurrentVenue()
  const { venueTimezone, formatDate } = useVenueDateTime()
  const { t } = useTranslation('loyalty')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // `hoy` se fija al abrir: un redibujo después de la medianoche no le cambia el día al borrador abierto.
  const [dialogo, setDialogo] = useState<{ promo: LoyaltyPromotion | null; hoy: string } | null>(null)
  const abrir = (promo: LoyaltyPromotion | null) => setDialogo({ promo, hoy: DateTime.now().setZone(venueTimezone).toISODate() ?? '' })
  const [porTerminar, setPorTerminar] = useState<LoyaltyPromotion | null>(null)
  const [paginas, setPaginas] = useState<Record<LoyaltyPromotionStatus, number>>({ ACTIVE: 1, SCHEDULED: 1, ENDED: 1 })
  const cambiarPagina = useCallback((status: LoyaltyPromotionStatus, page: number) => setPaginas(p => ({ ...p, [status]: page })), [])

  const configQuery = useQuery({
    queryKey: ['loyalty-config', venueId],
    queryFn: () => loyaltyService.getConfig(venueId),
    enabled: !!venueId,
  })
  const config = configQuery.data
  // Lo mismo que mira el servidor para dar sellos (programa activo + sellos) y puntos (programa activo con algo que dar).
  const programa = useMemo<ProgramaPrendido>(
    () => ({
      sellos: !!config?.active && !!config.stampsEnabled,
      puntos: !!config?.active && (config.pointsPerDollar > 0 || config.pointsPerVisit > 0),
    }),
    [config],
  )
  const sinPrograma = !!config && !programa.sellos && !programa.puntos

  const consultas = useQueries({
    queries: ESTADOS.map(status => ({
      queryKey: ['loyalty-promotions', venueId, status, paginas[status]],
      queryFn: () => loyaltyPromotionService.list(venueId, { status, page: paginas[status], pageSize: POR_PAGINA }),
      enabled: !!venueId,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  })
  const porEstado = Object.fromEntries(ESTADOS.map((s, i) => [s, consultas[i]])) as Record<
    LoyaltyPromotionStatus,
    UseQueryResult<PaginatedLoyaltyPromotions>
  >
  const vivas = (porEstado.ACTIVE.data?.total ?? 0) + (porEstado.SCHEDULED.data?.total ?? 0)
  const lleno = vivas >= MAXIMO_VIVAS
  const todoVacio = consultas.every(q => q.isSuccess && q.data.total === 0)

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['loyalty-promotions', venueId] })
  const avisarError = (titulo: string, error: any) =>
    toast({ variant: 'destructive', title: titulo, description: error?.response?.data?.message })

  const guardar = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: LoyaltyPromotionInput | LoyaltyPromotionEndDatePatch }) =>
      id ? loyaltyPromotionService.update(venueId, id, body) : loyaltyPromotionService.create(venueId, body as LoyaltyPromotionInput),
    onSuccess: (_data, { id }) => {
      toast({ title: t(id ? 'promotions.toasts.updated' : 'promotions.toasts.created') })
      setDialogo(null)
      refrescar()
    },
    // El diálogo sigue abierto con lo escrito. Se refresca la lista: un 409 suele ser que la promo cambió de estado (empezó).
    onError: error => {
      avisarError(t('promotions.toasts.error'), error)
      refrescar()
    },
  })

  const terminar = useMutation({
    mutationFn: (id: string) => loyaltyPromotionService.end(venueId, id),
    onSuccess: () => {
      toast({ title: t('promotions.toasts.ended') })
      refrescar()
    },
    onError: error => {
      avisarError(t('promotions.toasts.endError'), error)
      refrescar()
    },
  })
  // Candado: el «Terminar ahora» de la confirmación sigue vivo hasta el redibujo; dos clics del mismo instante mandarían dos.
  const terminando = useRef(false)
  const confirmarTerminar = () => {
    if (!porTerminar || terminando.current) return
    terminando.current = true
    terminar
      .mutateAsync(porTerminar.id)
      .catch(() => undefined)
      .finally(() => {
        terminando.current = false
      })
  }
  // Con el programa entero apagado, los dos botones van a Lealtad, donde está su interruptor; los sellos se prenden en la tarjeta.
  const rutaSellos = config?.active ? `${fullBasePath}/loyalty/card` : `${fullBasePath}/loyalty`

  return (
    <FeatureGate feature="LOYALTY_PROGRAM">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <PageTitleWithInfo title={t('promotions.title')} tooltip={t('promotions.info')} />
            <p className="mt-1 text-sm text-muted-foreground">{t('promotions.subtitle')}</p>
          </div>
          {config && !sinPrograma && (
            <PermissionGate permission="loyalty:update">
              <Button onClick={() => abrir(null)} disabled={lleno} className="cursor-pointer" data-tour="loyalty-promo-new-btn">
                <Plus className="mr-2 h-4 w-4" />
                {t('promotions.new')}
              </Button>
            </PermissionGate>
          )}
        </div>

        <AvisoDeCarga query={configQuery} hayDatos={!!config} />

        {lleno && !sinPrograma && <p className="rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm">{t('promotions.cap')}</p>}

        {sinPrograma && (
          <div className="rounded-2xl border border-input bg-card p-6" data-testid="loyalty-promo-program-off">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">{t('promotions.programOff.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('promotions.programOff.description')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={rutaSellos}>{t('promotions.programOff.stamps')}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`${fullBasePath}/loyalty`}>{t('promotions.programOff.points')}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {todoVacio && !sinPrograma && (
          <div className="rounded-2xl border border-dashed border-input p-10 text-center">
            <Gift className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-semibold">{t('promotions.empty.title')}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              <PermissionGate permission="loyalty:update" fallback={t('promotions.empty.readOnly')}>
                {t('promotions.empty.description')}
              </PermissionGate>
            </p>
          </div>
        )}

        {ESTADOS.map(status => (
          <Grupo
            key={status}
            status={status}
            query={porEstado[status]}
            page={paginas[status]}
            onPage={cambiarPagina}
            programa={programa}
            formatDate={formatDate}
            onEdit={abrir}
            onEnd={setPorTerminar}
            terminando={terminar.isPending}
          />
        ))}
      </div>

      {dialogo && (
        <LoyaltyPromotionDialog
          open
          onClose={() => setDialogo(null)}
          promo={dialogo.promo}
          programa={programa}
          hoy={dialogo.hoy}
          venueId={venueId}
          saving={guardar.isPending}
          onSave={body => guardar.mutateAsync({ id: dialogo.promo?.id ?? null, body }).catch(() => undefined)}
        />
      )}

      <ConfirmDialog
        open={!!porTerminar}
        onOpenChange={abierto => !abierto && setPorTerminar(null)}
        title={t('promotions.confirmEnd.title', { name: porTerminar?.name ?? '' })}
        description={porTerminar?.status === 'SCHEDULED' ? t('promotions.confirmEnd.SCHEDULED') : t('promotions.confirmEnd.ACTIVE')}
        confirmText={t('promotions.confirmEnd.confirm')}
        cancelText={t('promotions.confirmEnd.cancel')}
        variant="destructive"
        onConfirm={confirmarTerminar}
      />
    </FeatureGate>
  )
}

function Grupo({
  status,
  query,
  page,
  onPage,
  programa,
  formatDate,
  onEdit,
  onEnd,
  terminando,
}: {
  status: LoyaltyPromotionStatus
  query: UseQueryResult<PaginatedLoyaltyPromotions>
  page: number
  onPage: (status: LoyaltyPromotionStatus, page: number) => void
  programa: ProgramaPrendido
  formatDate: (d: string) => string
  onEdit: (p: LoyaltyPromotion) => void
  onEnd: (p: LoyaltyPromotion) => void
  terminando: boolean
}) {
  const { t } = useTranslation('loyalty')
  const datos = query.data
  // Terminar la única de la última página la deja vacía: se regresa una, en vez de enseñar «21–20 de 20».
  const paginaVacia = !!datos && page > 1 && datos.items.length === 0 && !query.isPlaceholderData
  useEffect(() => {
    if (paginaVacia) onPage(status, page - 1)
  }, [paginaVacia, status, page, onPage])
  if (!query.isLoading && !query.isError && (datos?.total ?? 0) === 0) return null

  const desde = datos ? (datos.page - 1) * datos.pageSize + 1 : 0
  const hasta = datos ? desde + datos.items.length - 1 : 0

  return (
    <section className="space-y-3" data-testid={`loyalty-promo-group-${status}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t(`promotions.groups.${status}`)}
        {datos && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{datos.total}</span>}
      </h2>

      <AvisoDeCarga query={query} hayDatos={!!datos} volverAlInicio={page > 1 ? () => onPage(status, 1) : undefined} />

      {query.isLoading && <div className="h-20 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label={t('promotions.loading')} />}

      {datos?.items.map(p => (
        <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-input bg-card p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">
              {describirPromo(
                { ...p, productNames: p.products.map(x => x.name), categoryNames: p.categories.map(x => x.name) },
                programa,
                t,
              )}
            </p>
            {p.endedAt && (!p.endsAt || p.endedAt < p.endsAt) && (
              <p className="text-xs text-muted-foreground">{t('promotions.endedEarly', { date: formatDate(p.endedAt) })}</p>
            )}
          </div>
          {status !== 'ENDED' && (
            <PermissionGate permission="loyalty:update">
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => onEdit(p)}>
                  {t('promotions.actions.edit')}
                </Button>
                <Button variant="outline" size="sm" className="cursor-pointer" disabled={terminando} onClick={() => onEnd(p)}>
                  {t('promotions.actions.end')}
                </Button>
              </div>
            </PermissionGate>
          )}
        </div>
      ))}

      {datos && datos.total > datos.pageSize && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span>{t('promotions.pagination.range', { from: desde, to: hasta, total: datos.total })}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(status, page - 1)}>
            {t('promotions.pagination.previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={hasta >= datos.total} onClick={() => onPage(status, page + 1)}>
            {t('promotions.pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}
