import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { lista } from '@/pages/StaffPay/cuenta'
import {
  copyCustomerDisplay,
  getCustomerDisplay,
  type CustomerDisplayDesign,
  type CustomerDisplayEntitlements,
  type CustomerDisplayView,
} from '@/services/customerDisplay.service'
import { revisarDestinos, type DestinoReleido, type RevisionDeLaCopia } from './copia'
import { claseDeConflicto, conflictoDelOrigen, destinosEnConflicto, mensajeDelServidor, resultadoIncierto } from './errores'
import { filasDeDestino, MAX_DESTINOS, notasDeDestino } from './model'
import { clavesDeLaPantalla, useCopyTargets } from './queries'

interface DestinoElegido {
  terminalId: string
  editToken: string
  name: string
  /** La fila no tiene todavía la app que muestra diseños (`designVersion === null`, «Aún sin la app…»). */
  sinApp: boolean
}

/** Un aviso rojo: el texto del server tal cual y, si fue un 409 de destinos, a cuáles se quitó de lo elegido. */
interface Aviso {
  mensaje: string
  quitados: string[]
}

/** Tras una respuesta perdida: primero se revisa cada destino, luego se dice qué quedó en cada uno. */
type Reconciliacion = { fase: 'revisando' } | ({ fase: 'revisado' } & RevisionDeLaCopia)

/** Cuántas vistas de destino se releen a la vez al reconciliar (son ≤ 20 por el tope de la copia). */
const LECTURAS_A_LA_VEZ = 5

export interface CopyDesignDialogProps {
  onClose: () => void
  venueId: string
  /**
   * 🔴 La FOTO del origen al abrir (Codex #8): se copia lo que el usuario vio al pulsar «Copiar», con SU token. El diálogo
   * la congela al montarse; si el llamador vuelve a pasar otra, se ignora.
   */
  source: { terminalId: string; editToken: string; name: string; design: CustomerDisplayDesign }
  /** El token del origen que la tarjeta ve AHORA. Si deja de coincidir con la foto, el origen cambió: no se copia sin reabrir. */
  tokenVigente: string
  entitlements: CustomerDisplayEntitlements
}

/**
 * La casilla de cada renglón. 🔴 Dentro de FullScreenModal todo `<button>` lleva esquinas de 0.5rem con `!important`
 * (index.css, `[data-fsm-content] button`) y la casilla de 16 px de `ui/checkbox` saldría como un CÍRCULO, que se lee como
 * «elige sólo uno». El botón de Radix (rol, teclado, `aria-checked`) queda invisible y el cuadro es un `<span>` de adentro,
 * como las muestras de color del editor.
 */
function Casilla({ marcada, deshabilitada, nombre, onCambio }: { marcada: boolean; deshabilitada: boolean; nombre: string; onCambio: (v: boolean) => void }) {
  return (
    <CheckboxPrimitive.Root
      checked={marcada}
      disabled={deshabilitada}
      aria-label={nombre}
      onCheckedChange={v => onCambio(v === true)}
      className="group grid h-5 w-5 shrink-0 cursor-pointer place-items-center bg-transparent p-0 outline-none disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid h-4 w-4 place-items-center rounded-sm border border-input shadow-xs ring-offset-background',
          'group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-disabled:opacity-50',
          'group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground',
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="h-3.5 w-3.5" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

/** Relee en tandas pequeñas: nunca 20 lecturas de golpe contra el server; cada una vale por sí sola (una que falla no tumba las demás). */
async function enTandas<T, R>(items: T[], leer: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const resultados: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += LECTURAS_A_LA_VEZ) {
    resultados.push(...(await Promise.allSettled(items.slice(i, i + LECTURAS_A_LA_VEZ).map(leer))))
  }
  return resultados
}

/**
 * «Copiar a otras cajas» (spec §5.6, §6.4). Lista paginada de 50 con su total y «Cargar más», confirmación en un
 * `AlertDialog`, y una sola copia todo-o-nada con el token de cada dispositivo.
 * 🔴 Lo elegido se guarda AL ELEGIRLO, con el token que tenía esa fila (incidente del 7-sep): nunca se re-deriva de la
 * página visible. 🔴 El origen es la foto de cuando se abrió. 🔴 Si el resultado es INCIERTO (sin respuesta, un 5xx, o el
 * 409/429 del reintento automático de `src/api.ts`), la copia pudo aplicarse: se relee la lista y la vista de cada destino,
 * se dice cuáles ya tienen el diseño y cuáles no, y nunca se vuelve a copiar sola: eso lo decide la persona.
 */
export function CopyDesignDialog({ onClose, venueId, source, tokenVigente, entitlements }: CopyDesignDialogProps) {
  const { t, i18n } = useTranslation('customerDisplay')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // 🔴 Codex #8: la foto se congela AL MONTAR. Si el llamador pasara la foto viva, se compararía consigo misma y se
  // copiaría un diseño que la persona nunca vio.
  const [origen] = useState(source)
  const destinos = useCopyTargets(venueId, true)
  const [elegidos, setElegidos] = useState<Map<string, DestinoElegido>>(() => new Map())
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [origenRechazado, setOrigenRechazado] = useState(false)
  const [reconciliacion, setReconciliacion] = useState<Reconciliacion | null>(null)

  const origenCambiado = origenRechazado || tokenVigente !== origen.editToken
  const paginas = destinos.data?.pages
  const filas = useMemo(() => filasDeDestino(paginas ?? [], origen.terminalId), [paginas, origen.terminalId])
  // El total del server incluye al origen (es POS_ANDROID del mismo negocio): se descuenta.
  const total = Math.max(0, (paginas?.[0]?.total ?? 0) - 1)
  const lleno = elegidos.size >= MAX_DESTINOS
  const nombres = (n: string[]) => lista(n, i18n.language)
  const nombresElegidos = nombres([...elegidos.values()].map(e => e.name))
  const etiquetaDeCopiar = elegidos.size === 0 ? t('copy.submitEmpty') : t('copy.submit', { count: elegidos.size })

  const alternar = (destino: DestinoElegido, marcado: boolean) =>
    setElegidos(prev => {
      const siguiente = new Map(prev)
      if (marcado) siguiente.set(destino.terminalId, destino)
      else siguiente.delete(destino.terminalId)
      return siguiente
    })

  /** Relee la vista de un destino. Cancela antes una lectura en camino: pudo salir ANTES de la copia y traer lo de antes. */
  const releerDestino = async (terminalId: string): Promise<CustomerDisplayView> => {
    const clave = clavesDeLaPantalla.vista(venueId, terminalId)
    await queryClient.cancelQueries({ queryKey: clave, exact: true })
    return queryClient.fetchQuery({ queryKey: clave, queryFn: () => getCustomerDisplay(venueId, terminalId), staleTime: 0 })
  }

  /**
   * 🔴 Codex #9 (spec §5.6) y ruling tras B2 r1. No sabemos si la copia se aplicó. Lo elegido se vacía YA (sus tokens pueden
   * ya no valer); la lista se relee (sus filas traen los tokens nuevos, que son los que viajarán si la persona vuelve a
   * elegir) y la vista de cada destino también, para decir cuáles ya tienen el diseño del origen. Mientras tanto la
   * mutación sigue pendiente (TanStack espera este `onError`): nada se puede elegir, copiar ni cerrar.
   */
  const reconciliar = async (enviados: DestinoElegido[]) => {
    setElegidos(new Map())
    setReconciliacion({ fase: 'revisando' })
    try {
      const [, lecturas] = await Promise.all([
        queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.dispositivos(venueId) }),
        enTandas(enviados, d => releerDestino(d.terminalId)),
      ])
      const releidos: DestinoReleido[] = lecturas.map(l =>
        l.status === 'fulfilled' ? { design: l.value.design, conImagenes: l.value.entitlements.slides } : null,
      )
      setReconciliacion({ fase: 'revisado', ...revisarDestinos(enviados, releidos, origen.design) })
    } catch {
      // 🔴 TanStack se traga lo que truena dentro de `onError`: sin esto, «Revisando…» se quedaría para siempre. Si la
      // revisión misma falla (p. ej. una vista con otra forma), nada prueba qué quedó: todos van a «no se pudo revisar».
      setReconciliacion({ fase: 'revisado', conElDiseno: [], sinElDiseno: [], sinRevisar: enviados.map(d => d.name) })
    }
  }

  const copiar = useMutation({
    mutationFn: (destinosElegidos: DestinoElegido[]) =>
      copyCustomerDisplay(
        venueId,
        { terminalId: origen.terminalId, editToken: origen.editToken },
        destinosElegidos.map(d => ({ terminalId: d.terminalId, editToken: d.editToken })),
      ),
    onMutate: () => {
      setAviso(null)
      setReconciliacion(null)
    },
    onSuccess: (r, destinosElegidos) => {
      void queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.dispositivos(venueId) })
      for (const id of r.copied) void queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.vista(venueId, id) })
      const copiados = r.copied.map(id => destinosElegidos.find(d => d.terminalId === id)?.name ?? id)
      const teniaPromos = origen.design.slides.length > 0 || origen.design.showPromotions
      // «Cada una lo mostrará en cuanto se conecte» es falso para una caja sin la app que muestra diseños.
      const algunaSinApp = destinosElegidos.some(d => d.sinApp && r.copied.includes(d.terminalId))
      toast({
        title: t(algunaSinApp ? 'copy.doneNeedsApp' : 'copy.done', { names: nombres(copiados) }),
        description: r.promosOmitted && teniaPromos ? t('copy.promosOmitted') : undefined,
      })
      setConfirmando(false)
      onClose()
    },
    onError: async (error, destinosElegidos) => {
      setConfirmando(false)
      // 🔴 ORDEN (B2 r1): primero lo INCIERTO. Un 409 del reintento automático no prueba que «alguien más» cambió algo:
      // pudo chocar con NUESTRA primera copia, cuya respuesta se perdió.
      if (resultadoIncierto(error)) return reconciliar(destinosElegidos)
      if (claseDeConflicto(error)) {
        const mensaje = mensajeDelServidor(error, t('copy.error'))
        if (conflictoDelOrigen(error)) {
          setAviso({ mensaje, quitados: [] })
          // El origen cambió: la foto ya no vale. Se bloquea «Copiar» y la tarjeta relee su diseño.
          setOrigenRechazado(true)
          void queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.vista(venueId, origen.terminalId) })
          return
        }
        // Todo-o-nada: no se escribió nada. Sólo los destinos que chocaron salen de lo elegido; la lista se relee para
        // que, si la persona los vuelve a elegir, viajen con su token nuevo. Un «ocupado» no trae destinos: se queda todo.
        const enConflicto = destinosEnConflicto(error)
        // Los nombres que se guardaron AL ELEGIR (los de lo que se mandó), no los de la página visible.
        setAviso({ mensaje, quitados: enConflicto.map(id => destinosElegidos.find(d => d.terminalId === id)?.name ?? id) })
        setElegidos(prev => {
          const siguiente = new Map(prev)
          for (const id of enConflicto) siguiente.delete(id)
          return siguiente
        })
        void queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.dispositivos(venueId) })
        return
      }
      // Rechazo CONFIRMADO (400/401/403/404/422/429): nada se escribió; lo elegido se queda para reintentar.
      toast({ variant: 'destructive', title: t('copy.error'), description: mensajeDelServidor(error, '') || undefined })
    },
  })

  const ocupado = copiar.isPending
  const revisado = reconciliacion?.fase === 'revisado' ? reconciliacion : null

  return (
    <>
      <FullScreenModal
        open
        // Mientras se copia (o se revisa lo que quedó) no se cierra: el resultado se perdería sin que nadie lo vea.
        onClose={() => {
          if (!ocupado) onClose()
        }}
        title={t('copy.title')}
        subtitle={origen.name}
        contentClassName="bg-muted/30"
        actions={
          <Button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={elegidos.size === 0 || ocupado || origenCambiado}
            aria-label={etiquetaDeCopiar}
            className="px-3 sm:px-4"
            data-tour="customer-display-copy-submit"
          >
            {/* En el celular, el título CENTRADO del modal choca con «Copiar a 2 cajas» (medido: a 360 px caben ~66 px).
                Ahí se ve sólo el verbo; el nombre accesible sigue siendo la frase completa, que lo contiene. */}
            <span className="sm:hidden">{t('copy.submitEmpty')}</span>
            <span className="hidden sm:inline">{etiquetaDeCopiar}</span>
          </Button>
        }
      >
        <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
          <section className="space-y-2 rounded-2xl border border-border/50 bg-card p-6" data-tour="customer-display-copy-intro">
            <p className="text-sm">{t('copy.intro', { name: origen.name })}</p>
            {!entitlements.slides && <p className="text-xs text-muted-foreground">{t('copy.noProNote')}</p>}
          </section>

          {(aviso || origenCambiado) && (
            <Alert variant="destructive" data-tour="customer-display-copy-notice">
              <AlertCircle aria-hidden="true" />
              <AlertDescription className="space-y-2">
                {aviso && <p>{aviso.mensaje}</p>}
                {aviso && aviso.quitados.length > 0 && <p>{t('copy.conflictRemoved', { names: nombres(aviso.quitados) })}</p>}
                {origenCambiado && (
                  <>
                    {!origenRechazado && <p>{t('copy.originChanged', { name: origen.name })}</p>}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={onClose}
                      disabled={ocupado}
                      data-tour="customer-display-copy-back"
                    >
                      {t('copy.conflictBack')}
                    </Button>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {reconciliacion && (
            <Alert className="border-warning-border bg-warning-muted text-warning-foreground" data-tour="customer-display-copy-result">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="space-y-1 text-warning-foreground">
                <p>{t('copy.uncertain')}</p>
                {reconciliacion.fase === 'revisando' && (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('copy.uncertainChecking')}
                  </p>
                )}
                {revisado && revisado.conElDiseno.length > 0 && (
                  <p>{t('copy.uncertainApplied', { name: origen.name, names: nombres(revisado.conElDiseno) })}</p>
                )}
                {revisado && revisado.sinElDiseno.length > 0 && (
                  <p>{t('copy.uncertainNotApplied', { name: origen.name, names: nombres(revisado.sinElDiseno) })}</p>
                )}
                {revisado && revisado.sinRevisar.length > 0 && <p>{t('copy.uncertainUnchecked', { names: nombres(revisado.sinRevisar) })}</p>}
              </AlertDescription>
            </Alert>
          )}

          <section className="rounded-2xl border border-border/50 bg-card p-3" data-tour="customer-display-copy-list">
            {destinos.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : destinos.isError && filas.length === 0 ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{t('copy.loadError')}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => destinos.refetch()}
                  data-tour="customer-display-copy-retry"
                >
                  {t('copy.retry')}
                </Button>
              </div>
            ) : filas.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t('copy.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {filas.map(f => {
                  const marcado = elegidos.has(f.id)
                  const bloqueado = !marcado && lleno
                  return (
                    <li key={f.id}>
                      {/* El renglón ENTERO es la etiqueta de su casilla: tocar el nombre o la nota también marca. */}
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border border-input px-4 py-3 transition-colors hover:bg-muted/50',
                          marcado && 'bg-muted/40',
                          (bloqueado || ocupado) && 'cursor-not-allowed hover:bg-transparent',
                          bloqueado && 'opacity-60',
                        )}
                        data-tour="customer-display-copy-row"
                      >
                        <Casilla
                          marcada={marcado}
                          deshabilitada={bloqueado || ocupado}
                          nombre={f.name}
                          // 🔴 Se guarda la fila QUE SE TIENE EN LA MANO, con su token de este momento.
                          onCambio={v =>
                            alternar({ terminalId: f.id, editToken: f.editToken, name: f.name, sinApp: f.designVersion === null }, v)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{f.name}</span>
                          <span className="block text-xs text-muted-foreground">{notasDeDestino(f).map(n => t(`copy.${n}`)).join(' · ')}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {!destinos.isLoading && filas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t('copy.counter', { shown: filas.length, total })}</span>
              {destinos.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => destinos.fetchNextPage()}
                  // 🔴 `fetchNextPage` cancela por defecto una relectura en camino (`cancelRefetch: true`) y pega la página 2
                  // a la página 1 VIEJA: tras un 409 o una respuesta perdida, las filas se quedarían con los tokens de antes.
                  // Se bloquea mientras la lista se relee (y mientras se copia o se revisa), en vez de ignorar el toque.
                  disabled={ocupado || destinos.isFetching}
                  data-tour="customer-display-copy-load-more"
                >
                  {destinos.isFetchingNextPage ? t('copy.loadingMore') : t('copy.loadMore')}
                </Button>
              )}
            </div>
          )}
          {/* Una relectura o «Cargar más» que falla con filas ya cargadas no borra la lista (Codex #3): se dice aparte. */}
          {destinos.isError && filas.length > 0 && !destinos.isFetching && (
            <p role="alert" className="text-xs text-destructive">
              {t('copy.listStale')}
            </p>
          )}
          {lleno && <p className="text-xs text-muted-foreground">{t('copy.limit', { max: MAX_DESTINOS })}</p>}
        </div>
      </FullScreenModal>

      <AlertDialog
        open={confirmando}
        onOpenChange={abierto => {
          if (!abierto && !ocupado) setConfirmando(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('copy.confirmTitle', { name: origen.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('copy.confirmBody', { names: nombresElegidos })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado} data-tour="customer-display-copy-cancel">
              {t('copy.confirmCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                if (origenCambiado || ocupado || elegidos.size === 0) return
                copiar.mutate([...elegidos.values()])
              }}
              disabled={ocupado || origenCambiado}
              data-tour="customer-display-copy-confirm"
            >
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('copy.confirmGo')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
