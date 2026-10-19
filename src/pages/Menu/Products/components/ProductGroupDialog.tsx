import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { VenueTierBadge } from '@/components/venue-tier-badge'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import { useProductGroup } from '@/features/product-variants/hooks'
import { useAccess } from '@/hooks/use-access'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { ArchivedVariantsSection } from './ArchivedVariantsSection'
import { FamilyActions } from './FamilyActions'
import { ConfirmarDescartar } from './GroupExistingDialog'
import { GroupGrowSection, GroupOptionValues } from './GroupGrowSection'
import { GroupParentForm } from './GroupParentForm'
import { GroupVariantsTable } from './GroupVariantsTable'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  groupId: string | null
}

type Seccion = 'padre' | 'variantes' | 'valores' | 'crecer'

/**
 * Esc con texto que todavía no es ficha («XL» sin Enter en «Valores nuevos»): Radix oye Esc en captura, antes de que el campo lo
 * confirme, así que la sección aún no lo cuenta como cambio. Sólo esos campos: el nombre del padre siempre trae texto y ahí Esc sí cierra.
 */
const textoSinConfirmar = (objetivo: EventTarget | null) =>
  objetivo instanceof HTMLInputElement && objetivo.hasAttribute('data-por-confirmar') && objetivo.value.trim() !== ''

/** Editar un producto con variantes («Playera básica»): los datos compartidos del padre y, abajo, cada variante. */
export function ProductGroupDialog({ open, onClose, venueId, groupId }: Props) {
  const { t } = useTranslation('variants')
  const q = useProductGroup(venueId, open ? groupId : null)
  const acceso = useTierFeatureAccess('PRODUCT_VARIANTS')
  const { can } = useAccess()
  const familia = q.data
  const archivada = !!familia?.archived
  const conPlan = acceso.hasAccess && acceso.isResolved
  const puedeEditarPadre = conPlan && can('menu:update') && !archivada
  const puedeEditarVariantes = can('menu:update') && !archivada
  const noExiste = (q.error as { response?: { status?: number } } | null)?.response?.status === 404
  const textoDelError = noExiste ? t('familia.noExiste') : mensajeDeVariantes(q.error, t)

  // QA: cerrar con algo sin guardar (padre, tabla o «Agregar variantes») lo perdía sin aviso. Cada sección avisa si tiene algo; se lee
  // al cerrar (un ref: avisar no vuelve a pintar el diálogo). Igual que «Agrupar productos»: Esc no cierra y la X pregunta.
  const sucias = useRef<Partial<Record<Seccion, boolean>>>({})
  const avisar = useMemo(() => {
    const de = (s: Seccion) => (sucia: boolean) => {
      sucias.current[s] = sucia
    }
    return { padre: de('padre'), variantes: de('variantes'), valores: de('valores'), crecer: de('crecer') }
  }, [])
  const [preguntarCierre, setPreguntarCierre] = useState(false)
  const conCambios = () => Object.values(sucias.current).some(Boolean)
  const pedirCerrar = () => (conCambios() ? setPreguntarCierre(true) : onClose())

  return (
    <FullScreenModal
      open={open}
      onClose={pedirCerrar}
      title={familia?.name ?? t('familia.titulo')}
      subtitle={
        familia
          ? archivada
            ? t('familia.subtituloArchivada', { count: familia.archivedCount })
            : t('familia.subtitulo', { count: familia.variants.length })
          : undefined
      }
      // Un nombre largo se recorta con «…» en vez de encimarse con «Más acciones» (QA BAJO-1, 390 px): deja libres la X y las acciones.
      titleClassName="max-w-[calc(100%-9rem)] *:truncate sm:max-w-[calc(100%-22rem)]"
      contentClassName="bg-muted/30"
      closeButtonTestId="cerrar-familia"
      actions={familia && !archivada ? <FamilyActions venueId={venueId} familia={familia} onDone={onClose} /> : undefined}
      // Con algo sin guardar Esc no cierra; al renombrar un valor sólo cancela ese renombre (ver `data-renombrar-valor`).
      onEscapeKeyDown={e => {
        const renombrando = e.target instanceof Element && !!e.target.closest('[data-renombrar-valor]')
        if (conCambios() || renombrando || textoSinConfirmar(e.target)) e.preventDefault()
      }}
    >
      {/* 6xl: la tabla de variantes (8 columnas) no cabe en 5xl y el «⋯» de cada renglón quedaba fuera (guía de variantes, 19-oct). */}
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6" data-tour="product-group-dialog">
        {q.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : q.isError && !familia ? (
          <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-6">
            {noExiste ? (
              <>
                <p>{t('familia.noExiste')}</p>
                <Button variant="outline" onClick={onClose}>
                  {t('familia.cerrar')}
                </Button>
              </>
            ) : (
              <>
                <p className="text-destructive">{textoDelError}</p>
                <Button variant="outline" onClick={() => q.refetch()}>
                  {t('familia.reintentar')}
                </Button>
              </>
            )}
          </div>
        ) : familia ? (
          <>
            {/* Codex C1: si falla una recarga (p. ej. tras guardar otra sección) los editores siguen montados con lo tecleado. */}
            {q.isError && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-input bg-card p-4 text-sm">
                <p className="flex-1">
                  {t('familia.errorAlReleer')} <span className="text-destructive">{textoDelError}</span>
                </p>
                <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()} data-tour="product-group-refetch">
                  {t('familia.reintentar')}
                </Button>
              </div>
            )}
            {archivada && <p className="rounded-xl border border-input bg-muted p-4 text-sm">{t('familia.archivada')}</p>}
            {!archivada && !conPlan && (
              <p className="flex items-center gap-2 rounded-xl border border-input bg-muted p-4 text-sm">
                <VenueTierBadge tier="PRO" />
                <span>{t('familia.avisoPlan')}</span>
              </p>
            )}
            {/* key: cambiar de familia con el diálogo abierto empieza de cero (nunca lleva lo tecleado de una familia a otra). */}
            <GroupParentForm
              key={`padre-${familia.id}`}
              venueId={venueId}
              familia={familia}
              disabled={!puedeEditarPadre}
              onCambios={avisar.padre}
            />
            {/* Archivada: sus variantes viven abajo, en «Archivadas»; una tabla vacía sólo diría «0 variantes» (QA BAJO-2). */}
            {!(archivada && familia.variants.length === 0) && (
              <GroupVariantsTable
                key={`variantes-${familia.id}`}
                venueId={venueId}
                familia={familia}
                disabled={!puedeEditarVariantes}
                onCambios={avisar.variantes}
              />
            )}
            <GroupOptionValues
              key={`valores-${familia.id}`}
              venueId={venueId}
              familia={familia}
              disabled={!puedeEditarPadre}
              onCambios={avisar.valores}
            />
            {/* Crecer pide menu:create, no menu:update (Codex A5). Una familia archivada no crece: ni se ofrece. */}
            {!archivada && (
              <GroupGrowSection
                key={`crecer-${familia.id}`}
                venueId={venueId}
                familia={familia}
                disabled={!conPlan || !can('menu:create')}
                onCambios={avisar.crecer}
              />
            )}
            {familia.archivedCount > 0 && <ArchivedVariantsSection key={`archivadas-${familia.id}`} venueId={venueId} familia={familia} />}
          </>
        ) : null}
      </div>
      <ConfirmarDescartar
        open={preguntarCierre}
        onOpenChange={setPreguntarCierre}
        onDescartar={() => {
          setPreguntarCierre(false)
          onClose()
        }}
      />
    </FullScreenModal>
  )
}
