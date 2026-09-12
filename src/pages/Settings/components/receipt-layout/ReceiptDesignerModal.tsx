import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  leerConflicto,
  useReceiptPreview,
  usePreviewIsStale,
  useReloadReceiptLayout,
  useSaveReceiptLayout,
  type ConflictoDeRevision,
} from '@/hooks/useReceiptLayout'
import { cn } from '@/lib/utils'
import type { PaperMm, ReceiptBlock, ReceiptDevices, ReceiptReadiness, SampleSale } from '@/services/receiptLayout.service'
import { AvisosHonestos } from './AvisosHonestos'
import { BlockEditor } from './BlockEditor'
import { BlockList } from './BlockList'
import { BLOCK_CATALOG, BLOCK_DEFAULTS } from './blockCatalog'
import { ReceiptPaper } from './ReceiptPaper'

interface ReceiptDesignerModalProps {
  open: boolean
  onClose: () => void
  venueId: string
  venueName?: string
  blocks: ReceiptBlock[]
  revision: number
  readiness: ReceiptReadiness
  devices: ReceiptDevices
  canManage: boolean
  /** Para que el enlace de «configura tu emisor» lleve a la ruta correcta del venue. */
  fiscalHref?: string
}

const ANCHOS: Array<{ mm: PaperMm; cols: 48 | 32 }> = [
  { mm: 80, cols: 48 },
  { mm: 58, cols: 32 },
]

/**
 * El diseñador del ticket.
 *
 * 🔴 `contentClassName` mata el scroll del `<main>` del FullScreenModal a propósito: ese `<main>`
 * es `overflow-y-auto`, así que sin esto la pantalla ENTERA scrollea y el papel se va de la vista
 * justo cuando lo estás mirando. Cada panel lleva su propio overflow.
 *
 * El modal es una excepción declarada a `impeccable` («los modales son perezosos»): `ui-patterns.md`
 * lo declara OBLIGATORIO para todo flujo de editar, y aquí además está justificado — el diseñador
 * necesita el viewport entero para poner la lista y el papel lado a lado.
 */
export function ReceiptDesignerModal({
  open,
  onClose,
  venueId,
  venueName,
  blocks: iniciales,
  revision,
  readiness,
  devices,
  canManage,
  fiscalHref,
}: ReceiptDesignerModalProps) {
  const { t } = useTranslation('receiptLayout')
  // 🔴 UN solo árbol, elegido por viewport. Pintar los dos y esconder uno con `lg:hidden`
  // duplicaría el DOM: dos copias de cada `data-tour` (el tour iluminaría la invisible), dos
  // suscripciones de estado y el doble de trabajo en cada tecla.
  const esMovil = useIsMobile()
  const [blocks, setBlocks] = useState<ReceiptBlock[]>(iniciales)
  /**
   * 🔴 Contra QUÉ se edita: los bloques y la revisión tal como estaban al ABRIR. Se fijan aquí y no
   * se leen de los props en cada render, porque tras un 409 la página relee y le pasa al modal la
   * revisión NUEVA: con eso, un segundo «Guardar» mandaba los bloques viejos del usuario con la
   * revisión del otro y pisaba su trabajo sin que nadie se enterara (medido contra el servidor real
   * el 12-sep: rev 5 del admin con dirección → rev 6 del dueño sin ella). La base sólo cambia cuando
   * el dueño ELIGE recargar.
   */
  const [base, setBase] = useState<{ blocks: ReceiptBlock[]; revision: number }>({ blocks: iniciales, revision })
  const [conflicto, setConflicto] = useState<ConflictoDeRevision | null>(null)
  const [recargando, setRecargando] = useState(false)
  const [paperMm, setPaperMm] = useState<PaperMm>(80)
  const [sample, setSample] = useState<SampleSale>('retail')
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const [avisoQuitarQr, setAvisoQuitarQr] = useState<number | null>(null)

  const columnas = ANCHOS.find(a => a.mm === paperMm)?.cols ?? 48
  const guardar = useSaveReceiptLayout(venueId)
  const recargar = useReloadReceiptLayout(venueId)
  const preview = useReceiptPreview(venueId, blocks, paperMm, sample)
  const enCamino = usePreviewIsStale(blocks) || preview.isFetching

  const hayCambios = useMemo(() => JSON.stringify(blocks) !== JSON.stringify(base.blocks), [blocks, base.blocks])

  const pedirCierre = () => (hayCambios ? setConfirmarCierre(true) : onClose())

  const reordenar = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return
    const copia = [...blocks]
    const [movido] = copia.splice(from, 1)
    copia.splice(to, 0, movido)
    setBlocks(copia)
    setSeleccionado(seleccionado === from ? to : seleccionado)
  }

  const quitar = (index: number) => {
    // 🔴 Quitar el QR le cierra al cliente la autofactura y la calificación. Se avisa ANTES,
    // no después: el dueño no tiene forma de saber qué cuelga de ese cuadrito.
    if (blocks[index]?.type === 'qr') {
      setAvisoQuitarQr(index)
      return
    }
    quitarDeVerdad(index)
  }

  const quitarDeVerdad = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index))
    setSeleccionado(null)
    setAvisoQuitarQr(null)
  }

  const agregar = (type: string) => {
    // La firma cierra el ticket: lo nuevo entra ANTES de ella, nunca después.
    const iFirma = blocks.findIndex(b => b.type === 'signature')
    const nuevo = { type, ...BLOCK_DEFAULTS[type] } as ReceiptBlock
    const copia = [...blocks]
    const destino = iFirma >= 0 ? iFirma : copia.length
    copia.splice(destino, 0, nuevo)
    setBlocks(copia)
    setSeleccionado(destino)
    setAgregando(false)
  }

  const disponibles = Object.entries(BLOCK_CATALOG).filter(([type, meta]) => blocks.filter(b => b.type === type).length < meta.max)

  const onGuardar = () =>
    guardar.mutate(
      { blocks, expectedRevision: base.revision },
      {
        onSuccess: () => onClose(),
        // El toast lo pone el hook; aquí se BLOQUEA guardar hasta que el dueño decida qué hacer.
        onError: error => setConflicto(leerConflicto(error)),
      },
    )

  /** La salida del conflicto: ver lo que guardó el otro, y seguir editando SOBRE eso. */
  const onRecargar = async () => {
    setRecargando(true)
    try {
      const guardado = await recargar()
      setBlocks(guardado.blocks)
      setBase({ blocks: guardado.blocks, revision: guardado.revision })
      setSeleccionado(null)
      setConflicto(null)
    } finally {
      setRecargando(false)
    }
  }

  const listaIzquierda = (
    <div className="flex h-full flex-col overflow-y-auto border-border/50 bg-card lg:border-r">
      {conflicto && (
        <div
          role="alert"
          data-testid="receipt-layout-conflict"
          className="m-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-xs"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="font-medium">{t('designer.conflictTitle')}</p>
            <p className="mt-0.5 text-muted-foreground">
              {conflicto.quien ? t('designer.conflictByName', { name: conflicto.quien }) : t('designer.conflictAnonymous')}
            </p>
            <Button
              size="sm"
              variant="outline"
              data-testid="receipt-layout-reload"
              className="mt-2 cursor-pointer"
              disabled={recargando}
              onClick={onRecargar}
            >
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              {t('designer.reloadSaved')}
            </Button>
          </div>
        </div>
      )}
      <AvisosHonestos readiness={readiness} devices={devices} fiscalHref={fiscalHref} className="border-b border-border/50 p-3" />

      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('designer.blocksTitle')}</p>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            data-tour="receipt-layout-add-block"
            data-testid="receipt-layout-add-block"
            className="cursor-pointer"
            onClick={() => setAgregando(v => !v)}
          >
            <Plus aria-hidden className="mr-1 h-4 w-4" />
            {t('designer.addBlock')}
          </Button>
        )}
      </div>

      {agregando && (
        <div className="flex flex-wrap gap-1.5 border-y border-border/50 bg-muted/30 p-3" data-testid="receipt-layout-add-menu">
          {disponibles.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('designer.nothingToAdd')}</p>
          ) : (
            disponibles.map(([type, meta]) => (
              <button
                key={type}
                type="button"
                data-testid={`receipt-layout-add-${type}`}
                onClick={() => agregar(type)}
                className="cursor-pointer rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {t(meta.labelKey)}
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex-1">
        <BlockList
          blocks={blocks}
          selectedIndex={seleccionado}
          readOnly={!canManage}
          onReorder={reordenar}
          onRemove={quitar}
          onSelect={i => setSeleccionado(prev => (prev === i ? null : i))}
        />
        {seleccionado !== null && blocks[seleccionado] && (
          <BlockEditor
            block={blocks[seleccionado]}
            readOnly={!canManage}
            onChange={b => setBlocks(blocks.map((x, i) => (i === seleccionado ? b : x)))}
          />
        )}
      </div>
    </div>
  )

  const papel = (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto p-6">
      <SelectorDeVenta value={sample} onChange={setSample} />

      {preview.isError ? (
        <div role="alert" className="max-w-sm rounded-2xl border border-destructive/40 bg-card p-4 text-sm">
          <p className="font-medium text-destructive">{t('preview.errorTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('preview.errorBody')}</p>
        </div>
      ) : (
        <>
          {/* 🔴 Los problemas van SOBRE el papel, no en un rincón: son lo que explica por qué
              este ticket todavía no se puede guardar. */}
          {(preview.data?.problems?.length ?? 0) > 0 && (
            <ul
              role="alert"
              data-testid="receipt-layout-problems"
              className="w-full max-w-sm space-y-1 rounded-2xl border border-destructive/40 bg-card p-3 text-xs"
            >
              {preview.data?.problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-destructive">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{p.message}</span>
                </li>
              ))}
            </ul>
          )}

          <ReceiptPaper lines={preview.data?.lines ?? []} width={columnas} stale={enCamino} tourId="receipt-layout-paper" />

          {(preview.data?.dropped ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="receipt-layout-dropped">
              {t('preview.dropped', { count: preview.data?.dropped })}
            </p>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={pedirCierre}
        title={t('designer.title')}
        subtitle={venueName}
        contentClassName="overflow-hidden bg-muted/30"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-border/60 p-0.5" role="group" aria-label={t('designer.paperWidth')}>
              {ANCHOS.map(a => (
                <button
                  key={a.mm}
                  type="button"
                  data-testid={`receipt-layout-width-${a.mm}`}
                  data-tour={`receipt-layout-width-${a.mm}`}
                  aria-pressed={paperMm === a.mm}
                  onClick={() => setPaperMm(a.mm)}
                  className={cn(
                    'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    paperMm === a.mm ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t('designer.mm', { mm: a.mm })}
                </button>
              ))}
            </div>

            {canManage ? (
              <Button
                data-tour="receipt-layout-save"
                data-testid="receipt-layout-save"
                className="cursor-pointer"
                // 🔴 Con un conflicto abierto no se guarda: primero hay que ver lo que guardó el otro.
                disabled={!hayCambios || guardar.isPending || Boolean(conflicto)}
                onClick={onGuardar}
              >
                {guardar.isPending ? t('designer.saving') : t('designer.save')}
              </Button>
            ) : (
              <p className="max-w-[14rem] text-xs text-muted-foreground" data-testid="receipt-layout-no-permission">
                {t('designer.askYourAdmin')}
              </p>
            )}
          </div>
        }
      >
        {esMovil ? (
          /* Teléfono: el papel pasa a una pestaña. Se ADAPTA, no se amputa. */
          <Tabs defaultValue="bloques" className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-auto self-start rounded-full">
              <TabsTrigger value="bloques" className="rounded-full">
                {t('designer.blocksTitle')}
              </TabsTrigger>
              <TabsTrigger value="papel" className="rounded-full">
                {t('designer.paperTab')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="bloques" className="mt-2 min-h-0 flex-1">
              {listaIzquierda}
            </TabsContent>
            <TabsContent value="papel" className="mt-2 min-h-0 flex-1">
              {papel}
            </TabsContent>
          </Tabs>
        ) : (
          /* Escritorio: lista y papel lado a lado, cada uno con SU scroll. */
          <div className="grid h-full grid-cols-[minmax(320px,380px)_1fr]">
            {listaIzquierda}
            {papel}
          </div>
        )}
      </FullScreenModal>

      {/* 🔴 Cerrar con cambios sin guardar PREGUNTA. Perder el trabajo por un clic de más en la
          ✕ es el defecto más fácil de cometer y el más molesto de sufrir. */}
      <AlertDialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('designer.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('designer.discardBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="receipt-layout-keep-editing">{t('designer.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="receipt-layout-discard"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmarCierre(false)
                onClose()
              }}
            >
              {t('designer.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={avisoQuitarQr !== null} onOpenChange={() => setAvisoQuitarQr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('designer.removeQrTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('designer.removeQrBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('designer.keepQr')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="receipt-layout-remove-qr-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => avisoQuitarQr !== null && quitarDeVerdad(avisoQuitarQr)}
            >
              {t('designer.removeQr')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SelectorDeVenta({ value, onChange }: { value: SampleSale; onChange: (v: SampleSale) => void }) {
  const { t } = useTranslation('receiptLayout')
  const ventas: SampleSale[] = ['retail', 'restaurant', 'appointments']

  return (
    <div className="flex rounded-full border border-border/60 p-0.5" role="group" aria-label={t('designer.sample')}>
      {ventas.map(v => (
        <button
          key={v}
          type="button"
          data-testid={`receipt-layout-sample-${v}`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
            value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {t(`samples.${v}`)}
        </button>
      ))}
    </div>
  )
}
