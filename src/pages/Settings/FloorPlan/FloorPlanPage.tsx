import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, LayoutGrid, Pencil, RotateCcw } from 'lucide-react'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  const [editing, setEditing] = useState(false)
  const query = useQuery({
    queryKey: ['floor-plan', venueId],
    queryFn: () => getFloorPlan(venueId as string),
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
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
        {query.isLoading ? (
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
          doc && <AreaCards doc={doc} />
        )}
      </FeatureGate>

      {editing && query.data && <FloorPlanEditor plan={query.data} venueId={venueId} venueName={venue?.name} onClose={() => setEditing(false)} />}
    </div>
  )
}

function AreaCards({ doc }: { doc: EditorDoc }) {
  const { t } = useTranslation('floorPlan')
  const unplaced = doc.tables.filter(x => x.areaKey === null).length
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {doc.areas.map(a => {
          const tables = doc.tables.filter(x => x.areaKey === a.key)
          const { cols, rows } = gridOf(a.floorShape)
          return (
            <div key={a.key} className="space-y-3 rounded-2xl border border-input bg-card p-4" data-testid={`floor-plan-area-${a.name}`}>
              <div className="rounded-xl bg-muted/40 p-2">
                <svg viewBox={`-1 -1 ${cols + 2} ${rows + 2}`} preserveAspectRatio="xMidYMid meet" className="h-40 w-full" role="img" aria-label={a.name}>
                  <FloorDrawing area={a} tables={tables} elements={doc.elements.filter(e => e.areaKey === a.key)} showGrid={false} />
                </svg>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{t('page.areaSummary', { tables: tables.length, seats: tables.reduce((s, x) => s + x.capacity, 0) })}</p>
                </div>
                {a.external && <Badge variant="outline">{t('page.fromPos')}</Badge>}
              </div>
            </div>
          )
        })}
      </div>
      {unplaced > 0 && <p className="text-sm text-muted-foreground">{t('page.unplaced', { count: unplaced })}</p>}
    </div>
  )
}
