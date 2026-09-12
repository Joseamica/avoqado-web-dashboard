import { useState } from 'react'
import { Receipt, RotateCcw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useReceiptLayout, useReceiptPreview, useResetReceiptLayout, useReceiptTemplates } from '@/hooks/useReceiptLayout'
import { useReceiptLayoutTour } from '@/hooks/useReceiptLayoutTour'
import { cn } from '@/lib/utils'
import { useVenueDateTime } from '@/utils/datetime'
import type { ReceiptBlock, TemplateId } from '@/services/receiptLayout.service'
import { AvisosHonestos } from './components/receipt-layout/AvisosHonestos'
import { ReceiptDesignerModal } from './components/receipt-layout/ReceiptDesignerModal'
import { ReceiptPaper } from './components/receipt-layout/ReceiptPaper'

/**
 * Diseño del ticket — Ajustes → Negocio, junto a «Estaciones de impresión».
 *
 * Es la PUERTA de entrada: enseña el ticket que sale hoy, los dos avisos honestos y tres
 * acciones. El diseñador vive en su propio FullScreenModal.
 *
 * Core / GRATIS por decisión del founder: sin `FeatureGate` y sin interruptor de activación.
 * El único candado es el permiso `receipt-layout:read` / `:manage`.
 */
export default function ReceiptLayoutPage() {
  const { t } = useTranslation('receiptLayout')
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const canManage = can('receipt-layout:manage')
  // La fecha en la zona del NEGOCIO: con la del navegador, un dueño de viaje ve otro día.
  const { formatDate } = useVenueDateTime()
  // Registra el tour para que la lista de tareas o el tour de bienvenida puedan lanzarlo.
  // No arranca solo: nadie quiere un tour encima al entrar a una pantalla.
  useReceiptLayoutTour()

  const [disenando, setDisenando] = useState(false)
  /**
   * Los bloques con los que ABRE el diseñador. Normalmente son los guardados; si el dueño
   * eligió una plantilla, son los de ella.
   *
   * 🔴 Elegir plantilla NO guarda: abre el diseñador con ella puesta para que la VEA en el
   * papel antes de decidir. Reemplazar el ticket de un negocio con un clic, sin verlo, sería
   * irreversible para quien no sabe que existe «Restablecer».
   */
  const [bloquesDeArranque, setBloquesDeArranque] = useState<ReceiptBlock[] | null>(null)
  const [verPlantillas, setVerPlantillas] = useState(false)
  const [confirmarReset, setConfirmarReset] = useState(false)

  const layout = useReceiptLayout(venueId ?? '')
  const reset = useResetReceiptLayout(venueId ?? '')
  const plantillas = useReceiptTemplates(venueId ?? '', verPlantillas)

  const blocks = layout.data?.blocks ?? []
  const preview = useReceiptPreview(venueId ?? '', blocks, 80, 'retail')

  if (!venueId) return null

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Receipt aria-hidden className="h-6 w-6" /> {t('page.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      {/* 🔴 Un error del servidor NUNCA se disfraza de «no hay nada»: es el defecto que la
          auditoría del checador ya cazó una vez en este mismo repo. */}
      {layout.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{t('page.loadErrorTitle')}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {t('page.loadErrorBody')}
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => layout.refetch()}>
              {t('page.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : layout.isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-card" aria-busy />
      ) : (
        <>
          <section className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {/* La diferencia entre propio y de fábrica se dice con TEXTO, no con un tono. */}
                  {layout.data?.source === 'custom' ? t('page.sourceCustom') : t('page.sourceDefault')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {layout.data?.source === 'custom' && layout.data.updatedAt
                    ? t('page.editedOn', { date: formatDate(layout.data.updatedAt) })
                    : t('page.neverEdited')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  data-tour="receipt-layout-design"
                  data-testid="receipt-layout-design"
                  className="cursor-pointer"
                  onClick={() => {
                    setBloquesDeArranque(null)
                    setDisenando(true)
                  }}
                >
                  {canManage ? t('page.design') : t('page.view')}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      data-tour="receipt-layout-templates"
                      data-testid="receipt-layout-templates"
                      className="cursor-pointer"
                      onClick={() => setVerPlantillas(true)}
                    >
                      <Sparkles aria-hidden className="mr-1.5 h-4 w-4" />
                      {t('page.templates')}
                    </Button>
                    <Button
                      variant="outline"
                      data-tour="receipt-layout-reset"
                      data-testid="receipt-layout-reset"
                      className="cursor-pointer"
                      disabled={layout.data?.source !== 'custom' || reset.isPending}
                      onClick={() => setConfirmarReset(true)}
                    >
                      <RotateCcw aria-hidden className="mr-1.5 h-4 w-4" />
                      {t('page.reset')}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {!canManage && (
              <p className="mt-4 border-t border-border/50 pt-4 text-xs text-muted-foreground" data-testid="receipt-layout-read-only">
                {t('page.readOnly')}
              </p>
            )}
          </section>

          {layout.data && (
            <AvisosHonestos readiness={layout.data.readiness} devices={layout.data.devices} fiscalHref={`${fullBasePath}/facturacion`} />
          )}

          {/* El estado vacío ENSEÑA: un negocio que nunca editó ve su ticket ya armado y una
              etiqueta que dice que eso es lo que sale hoy — no un lienzo en blanco. */}
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('page.thisIsWhatPrints')}</p>
            {preview.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('preview.errorTitle')}
              </p>
            ) : (
              <ReceiptPaper lines={preview.data?.lines ?? []} width={48} stale={preview.isFetching} className="max-w-full" />
            )}
          </section>
        </>
      )}

      {disenando && layout.data && (
        <ReceiptDesignerModal
          open
          onClose={() => {
            setDisenando(false)
            setBloquesDeArranque(null)
          }}
          venueId={venueId}
          venueName={venue?.name}
          blocks={bloquesDeArranque ?? layout.data.blocks}
          revision={layout.data.revision}
          readiness={layout.data.readiness}
          devices={layout.data.devices}
          canManage={canManage}
          fiscalHref={`${fullBasePath}/facturacion`}
        />
      )}

      {/* Restablecer manda `expectedRevision`: si alguien guardó mientras el diálogo estaba
          abierto, el servidor responde 409 y el hook avisa en vez de pisar su trabajo. */}
      <AlertDialog open={confirmarReset} onOpenChange={setConfirmarReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('page.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('page.resetBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="receipt-layout-reset-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                reset.mutate(layout.data?.revision ?? 0)
                setConfirmarReset(false)
              }}
            >
              {t('page.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlantillasDialog
        open={verPlantillas}
        onClose={() => setVerPlantillas(false)}
        cargando={plantillas.isLoading}
        error={plantillas.isError}
        plantillas={plantillas.data ?? []}
        onElegir={id => {
          const elegida = (plantillas.data ?? []).find(p => p.id === id)
          if (!elegida) return
          setBloquesDeArranque(elegida.blocks)
          setVerPlantillas(false)
          setDisenando(true)
        }}
      />
    </div>
  )
}

function PlantillasDialog({
  open,
  onClose,
  cargando,
  error,
  plantillas,
  onElegir,
}: {
  open: boolean
  onClose: () => void
  cargando: boolean
  error: boolean
  plantillas: Array<{ id: TemplateId; name: string; description: string; blocks: ReceiptBlock[] }>
  onElegir: (id: TemplateId) => void
}) {
  const { t } = useTranslation('receiptLayout')

  return (
    <AlertDialog open={open} onOpenChange={o => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('templates.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('templates.description')}</AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t('templates.error')}
          </p>
        ) : cargando ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" aria-busy />
        ) : (
          <ul className="space-y-2">
            {plantillas.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`receipt-layout-template-${p.id}`}
                  onClick={() => onElegir(p.id)}
                  className={cn(
                    'w-full cursor-pointer rounded-xl border border-border/60 p-3 text-left transition-colors hover:bg-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('templates.blockCount', { count: p.blocks.length })}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('page.cancel')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
