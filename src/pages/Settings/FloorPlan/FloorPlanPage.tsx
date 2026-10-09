import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight, Inbox, LayoutGrid, Pencil, RotateCcw } from 'lucide-react'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { getFloorPlan } from '@/services/floorPlan.service'
import { FloorPlanEditor } from './FloorPlanEditor'
import { FloorDrawing } from './editor/FloorDrawing'
import { gridOf } from './model/floorGeometry'
import { dtoToDoc } from './model/planMapping'
import type { EditorDoc } from './model/types'

/** El editor necesita pantalla de computadora; en el celular el plano sólo se ve. */
function useWideScreen() {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setWide(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return wide
}

/**
 * Configuración → Mesas y plano. Enseña cada área con su miniatura y abre el editor.
 * El plano está acotado por el servidor (`limits`; `overLimit` si un plano viejo los rebasa), así que se pide entero.
 * Candados: ver = `tables:read` (ruta); editar = `tables:configure` + Servicio de mesas (PRO) + pantalla ancha.
 */
export default function FloorPlanSettings() {
  const { t } = useTranslation('floorPlan')
  const { venueId, venue } = useCurrentVenue()
  const { can } = useAccess()
  const { hasFeatureAccess } = useVenueTier()
  const wide = useWideScreen()
  // `false` = cerrado; `true` = abre en la primera área; un id = abre en esa área (la tarjeta que se tocó).
  const [editing, setEditing] = useState<boolean | string>(false)
  const query = useQuery({
    queryKey: ['floor-plan', venueId],
    queryFn: () => getFloorPlan(venueId as string),
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    // Sin red se INTENTA y falla con «No pudimos cargar el plano · Reintentar». Con el modo por defecto TanStack la
    // dejaba en pausa: la página se quedaba cargando para siempre, igual que pasaba con Guardar (prueba real 9-oct).
    networkMode: 'always',
  })
  const doc = useMemo(() => (query.data ? dtoToDoc(query.data) : null), [query.data])
  if (!venueId) return null

  const canConfigure = can('tables:configure')
  const canEdit = canConfigure && hasFeatureAccess('TABLE_SERVICE') && wide && !!query.data && !query.data.overLimit
  const isEmpty = !!doc && doc.areas.length === 0 && doc.tables.length === 0
  // Un refresco fallido con el plano ya en pantalla no lo tapa: el error sólo se enseña si no hay nada que mostrar.
  const failed = query.isError && !query.data

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8" data-tour="floor-plan-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        {canEdit && !isEmpty && (
          <Button className="cursor-pointer" onClick={() => setEditing(true)} data-testid="floor-plan-edit-btn" data-tour="floor-plan-edit-btn">
            <Pencil className="mr-2 h-4 w-4" />
            {t('page.edit')}
          </Button>
        )}
      </header>

      {!canConfigure && (
        <p className="text-sm text-muted-foreground" data-testid="floor-plan-no-permission">
          {t('page.noPermission')}
        </p>
      )}
      {canConfigure && !wide && (
        <p className="text-sm text-muted-foreground" data-testid="floor-plan-narrow">
          {t('page.narrow')}
        </p>
      )}
      {query.data?.overLimit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('page.overLimit')}</AlertDescription>
        </Alert>
      )}

      <FeatureGate feature="TABLE_SERVICE" requiredTier="PRO">
        {query.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="floor-plan-loading">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : failed ? (
          <Alert variant="destructive" data-testid="floor-plan-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              {t('page.loadError')}
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void query.refetch()} data-testid="floor-plan-retry">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('page.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-input bg-card px-6 py-14 text-center" data-testid="floor-plan-empty">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <LayoutGrid className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t('page.emptyTitle')}</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('page.emptyBody')}</p>
            </div>
            {canEdit && (
              <Button size="lg" className="cursor-pointer" onClick={() => setEditing(true)} data-testid="floor-plan-start" data-tour="floor-plan-start-btn">
                {t('page.start')}
              </Button>
            )}
          </div>
        ) : (
          doc && <AreaCards doc={doc} onOpen={canEdit ? key => setEditing(key ?? true) : undefined} />
        )}
      </FeatureGate>

      {editing && query.data && (
        <FloorPlanEditor
          plan={query.data}
          venueId={venueId}
          venueName={venue?.name}
          initialAreaKey={typeof editing === 'string' ? editing : null}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

const AREA_SURFACE = { '--floor-area-surface': 'var(--card)' } as CSSProperties

/** Cada área con su miniatura. Si se puede editar, la tarjeta entera abre el editor EN esa área. */
function AreaCards({ doc, onOpen }: { doc: EditorDoc; onOpen?: (areaKey: string | null) => void }) {
  const { t } = useTranslation('floorPlan')
  const unplaced = doc.tables.filter(x => x.areaKey === null).length
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {doc.areas.map(a => {
          const tables = doc.tables.filter(x => x.areaKey === a.key)
          const seats = tables.reduce((s, x) => s + x.capacity, 0)
          const { cols, rows } = gridOf(a.floorShape)
          const body = (
            <>
              <div className="rounded-xl bg-muted/40 p-2">
                <svg viewBox={`-1 -1 ${cols + 2} ${rows + 2}`} preserveAspectRatio="xMidYMid meet" className="h-40 w-full" role="img" aria-label={a.name}>
                  <FloorDrawing area={a} tables={tables} elements={doc.elements.filter(e => e.areaKey === a.key)} showGrid={false} />
                </svg>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('page.areaSummary', { tables: t('page.tables', { count: tables.length }), seats: t('page.seats', { count: seats }) })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.external && <Badge variant="outline">{t('page.fromPos')}</Badge>}
                  {onOpen && (
                    <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden>
                      {t('page.editArea')}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </span>
                  )}
                </div>
              </div>
            </>
          )
          // Sin ninguna clase que contenga «card»: `.dark [class*='card']` (src/theme.css:78, global y sin capa) se come en
          // oscuro el fondo, el borde y el hover. El color de tarjeta llega por una variable propia.
          const cardClass = 'space-y-3 rounded-2xl border border-input bg-(--floor-area-surface) p-4 text-left'
          return onOpen ? (
            <button
              key={a.key}
              type="button"
              onClick={() => onOpen(a.key)}
              aria-label={t('page.editAreaLabel', { name: a.name })}
              style={AREA_SURFACE}
              className={cn(
                cardClass,
                'group w-full cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
              data-testid={`floor-plan-area-${a.name}`}
              data-tour="floor-plan-area-card"
            >
              {body}
            </button>
          ) : (
            <div key={a.key} style={AREA_SURFACE} className={cardClass} data-testid={`floor-plan-area-${a.name}`}>
              {body}
            </div>
          )
        })}
      </div>
      {unplaced > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-input px-4 py-3" data-testid="floor-plan-unplaced-note">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('page.unplaced', { count: unplaced })}</p>
            <p className="text-sm text-muted-foreground">{t('page.unplacedHint', { count: unplaced })}</p>
          </div>
          {onOpen && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => onOpen(null)} data-tour="floor-plan-unplaced-place">
              {t('page.unplacedAction', { count: unplaced })}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
