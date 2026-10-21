import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useLeaveGuard } from '@/pages/Settings/FloorPlan/editor/useLeaveGuard'
import {
  getCustomerDisplay,
  resetCustomerDisplay,
  saveCustomerDisplay,
  uploadCustomerDisplayLogo,
  type CustomerDisplayDesign,
  type CustomerDisplayView,
} from '@/services/customerDisplay.service'
import type { TpvSettings } from '@/services/tpv-settings.service'
import { BrandFields, PromosTeaser, TextFields } from './EditorFields'
import { claseDeConflicto, mensajeDelServidor, resultadoIncierto, type ClaseDeConflicto } from './errores'
import { enderezarLogo } from './enderezarLogo'
import { LogoField } from './LogoField'
import { medirImagen } from './medirImagen'
import {
  aBorrador,
  aCuerpoDeGuardado,
  colorDelHex,
  esDisenoDeFabrica,
  estaSucio,
  momentosVisibles,
  revisarArchivo,
  revisarMedidas,
  type BorradorDelEditor,
  type Momento,
} from './model'
import { PreviewPane } from './PreviewPane'
import { clavesDeLaPantalla, useFichaPreview } from './queries'

export interface CustomerDisplayEditorProps {
  onClose: () => void
  venueId: string
  terminalId: string
  deviceName: string
  venueName: string
  /** La vista guardada al abrir. El editor se monta SÓLO abierto: su estado nace de aquí y no lo pisa una reconsulta. */
  view: CustomerDisplayView
  pasos: TpvSettings
  /** false = no se pudieron leer los pasos de este dispositivo; la vista previa usa los de siempre y lo dice. */
  pasosConocidos: boolean
}

/**
 * El aviso en línea del editor. `conflicto`/`ocupado` = un 409 CONFIRMADO (el texto es el del server, tal cual);
 * `incierto` = la escritura pudo haberse aplicado y la relectura no lo confirmó (texto propio; el del server, de detalle).
 */
type Aviso = { clase: ClaseDeConflicto | 'incierto'; mensaje: string; detalle?: string }

/**
 * El texto del server acompaña al aviso «no pudimos confirmar» sólo si habla de NUESTRO intento: el de un 409/429 que
 * contestó el reintento automático de `src/api.ts` habla del reintento (diría «alguien más guardó», que no está probado).
 */
function detalleIncierto(error: unknown): string | undefined {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status
  if (status === 409 || status === 429) return undefined
  return mensajeDelServidor(error, '') || undefined
}

/**
 * El editor «A» (aprobado el 14-oct). 🔴 Cuatro reglas: (1) guarda con CAS: `expectedEditToken` es el token de lo que se
 * LEYÓ; (2) un 409 CONFIRMADO enseña el mensaje del server tal cual y nunca se reintenta solo; (3) un resultado INCIERTO
 * (sin respuesta, 5xx, o el 409/429 del reintento automático) no se afirma ni se reenvía: se relee la vista y se decide con
 * lo que el servidor TIENE; (4) nada se pierde: los campos se bloquean mientras se guarda (y se reconcilia), restablece,
 * recarga o sube un logo, y cerrar, Esc, Atrás o recargar la pestaña preguntan.
 */
export function CustomerDisplayEditor({
  onClose,
  venueId,
  terminalId,
  deviceName,
  venueName,
  view,
  pasos,
  pasosConocidos,
}: CustomerDisplayEditorProps) {
  const { t } = useTranslation('customerDisplay')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const claveDeLaVista = clavesDeLaPantalla.vista(venueId, terminalId)

  const [base, setBase] = useState<{ editToken: string; design: CustomerDisplayDesign }>({ editToken: view.editToken, design: view.design })
  const [borrador, setBorrador] = useState<BorradorDelEditor>(() => aBorrador(view.design))
  const [hex, setHex] = useState(view.design.accentColor ?? '')
  const [modoDeLogo, setModoDeLogo] = useState<'negocio' | 'propio'>(view.design.logoAssetId ? 'propio' : 'negocio')
  const [ultimoLogoPropio, setUltimoLogoPropio] = useState<string | null>(view.design.logoAssetId)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [errorDeLogo, setErrorDeLogo] = useState<string | null>(null)
  const [momento, setMomento] = useState<Momento>('espera')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [preguntandoSalida, setPreguntandoSalida] = useState(false)
  const [preguntandoFabrica, setPreguntandoFabrica] = useState(false)
  // Cada subida lleva su número; cambiar de logo o tomar otra base lo invalida (defensa extra: la UI ya bloquea, Codex #6).
  // 🔴 El número manda sobre el RESULTADO y sobre el INDICADOR «subiendo»: una subida descartada no toca ni uno ni otro.
  const subidaVigente = useRef(0)

  const cambiar = (parcial: Partial<BorradorDelEditor>) => setBorrador(b => ({ ...b, ...parcial }))
  /** Descarta la subida en vuelo (si hay): su resultado ya no aplica y, como su `finally` tampoco apagará el indicador, se apaga aquí. */
  const descartarSubida = () => {
    subidaVigente.current += 1
    setSubiendoLogo(false)
  }
  const cuerpo = useMemo(() => aCuerpoDeGuardado(borrador), [borrador])
  const vista = useFichaPreview({ venueId, terminalId, cuerpo, fichaInicial: view.ficha, assetRejectedInicial: view.assetRejected })
  const momentos = momentosVisibles(pasos)
  const momentoVisible = momentos.includes(momento) ? momento : 'espera'
  const hexInvalido = hex.trim() !== '' && colorDelHex(hex) === null
  const logoRechazado = borrador.logoAssetId !== null && vista.assetRejected.includes(borrador.logoAssetId)
  const sucio = estaSucio(borrador, base.design)

  /** Lo nuevo se ve en la tarjeta SIN recargar (setQueryData) y se relee del server (invalidate); también la lista de copia. */
  const publicar = (cambio: Partial<CustomerDisplayView>) => {
    queryClient.setQueryData<CustomerDisplayView>(claveDeLaVista, v => (v ? { ...v, ...cambio } : v))
    void queryClient.invalidateQueries({ queryKey: claveDeLaVista })
    void queryClient.invalidateQueries({ queryKey: clavesDeLaPantalla.dispositivos(venueId) })
  }
  const tomarBase = (design: CustomerDisplayDesign, editToken: string) => {
    descartarSubida()
    setBase({ editToken, design })
    setBorrador(aBorrador(design))
    setHex(design.accentColor ?? '')
    setModoDeLogo(design.logoAssetId ? 'propio' : 'negocio')
    setUltimoLogoPropio(design.logoAssetId)
  }
  const alConflicto = (error: unknown): boolean => {
    const clase = claseDeConflicto(error)
    if (!clase) return false
    setAviso({ clase, mensaje: mensajeDelServidor(error, t('editor.conflictFallback')) })
    return true
  }
  /** Un aviso que no es un conflicto confirmado se va al volver a intentar: el siguiente resultado dirá lo suyo. */
  const limpiarAvisoPasajero = () => setAviso(a => (a && a.clase !== 'conflicto' ? null : a))

  /**
   * Relee lo guardado. Primero cancela una lectura que ya iba en camino (la de la tarjeta pudo salir ANTES de nuestra
   * escritura): sin eso, `fetchQuery` la reutilizaría y se decidiría con datos viejos.
   */
  const releerLaVista = async () => {
    await queryClient.cancelQueries({ queryKey: claveDeLaVista, exact: true })
    return queryClient.fetchQuery({ queryKey: claveDeLaVista, queryFn: () => getCustomerDisplay(venueId, terminalId), staleTime: 0 })
  }

  /**
   * 🔴 Resultado INCIERTO (ruling tras B2 r1): el server pudo haberlo aplicado sin que lo sepamos. NUNCA se reenvía solo: se
   * relee la vista y, si el servidor YA tiene lo que mandamos, se da por hecho. Si no lo tiene —o si la relectura también
   * falla—, el borrador se queda tal cual, con el aviso «No pudimos confirmar…» y «Recargar lo guardado» a la mano; la base
   * (y su token) NO cambia, así que reintentar sigue protegido por el CAS. Mientras relee, la mutación sigue pendiente
   * (TanStack espera el `onError`): los campos siguen bloqueados y una navegación espera.
   */
  const reconciliar = async (error: unknown, yaQuedo: (v: CustomerDisplayView) => boolean, alQuedar: (v: CustomerDisplayView) => void) => {
    let enElServidor: CustomerDisplayView | null = null
    try {
      enElServidor = await releerLaVista()
    } catch {
      enElServidor = null // la relectura también falló: nada prueba que se aplicó
    }
    if (enElServidor && yaQuedo(enElServidor)) {
      alQuedar(enElServidor)
      return
    }
    setAviso({ clase: 'incierto', mensaje: t('editor.saveUncertain'), detalle: detalleIncierto(error) })
  }

  const confirmarGuardado = (r: Pick<CustomerDisplayView, 'editToken' | 'design' | 'ficha' | 'assetRejected'>) => {
    publicar({ editToken: r.editToken, design: r.design, ficha: r.ficha, assetRejected: r.assetRejected })
    tomarBase(r.design, r.editToken)
    setAviso(null)
    toast({ title: t(view.device.designVersion === null ? 'editor.savedNeedsApp' : 'editor.saved', { name: deviceName }) })
    // 🔴 Una navegación detenida mientras se guardaba sigue AHORA: cerrar desmonta el editor (la tarjeta lo monta con
    // `{editando && …}`) y con él su `useBlocker`, así que la navegación retenida se perdería sin avisar.
    // Se lee la salida VIGENTE: tras un resultado incierto, este cierre corre desde un callback creado antes de que se
    // detuviera la navegación (la relectura tardó), y su `salida` diría que no hay nada retenido.
    const ahora = salidaVigente.current
    if (ahora.held) ahora.leave()
    onClose()
  }
  const confirmarFabrica = (r: Pick<CustomerDisplayView, 'editToken' | 'design' | 'ficha'>) => {
    publicar({ editToken: r.editToken, design: r.design, ficha: r.ficha, assetRejected: [] })
    tomarBase(r.design, r.editToken)
    setAviso(null)
    setPreguntandoFabrica(false)
    toast({ title: t('editor.factoryDone', { name: deviceName }) })
  }

  const guardar = useMutation({
    // La variable es el borrador TAL COMO SE MANDÓ: con él se decide un resultado incierto (los campos ya están bloqueados).
    mutationFn: (enviado: BorradorDelEditor) => saveCustomerDisplay(venueId, terminalId, base.editToken, aCuerpoDeGuardado(enviado)),
    // Un «ocupado» o un «no pudimos confirmar» anterior se limpia al reintentar; un conflicto real sólo se limpia recargando.
    onMutate: limpiarAvisoPasajero,
    onSuccess: r => confirmarGuardado(r),
    onError: (error, enviado) => {
      // 🔴 ORDEN (B2 r1): primero lo INCIERTO. Un 409 del reintento automático no prueba que «alguien más» guardó.
      if (resultadoIncierto(error)) return reconciliar(error, v => !estaSucio(enviado, v.design), confirmarGuardado)
      if (alConflicto(error)) return
      toast({ variant: 'destructive', title: t('editor.saveError'), description: mensajeDelServidor(error, '') || undefined })
    },
  })

  const recargar = useMutation({
    mutationFn: releerLaVista,
    onSuccess: v => {
      tomarBase(v.design, v.editToken)
      setAviso(null)
    },
    onError: error =>
      toast({ variant: 'destructive', title: t('editor.reloadError'), description: mensajeDelServidor(error, '') || undefined }),
  })

  const fabrica = useMutation({
    mutationFn: () => resetCustomerDisplay(venueId, terminalId, base.editToken),
    onMutate: limpiarAvisoPasajero,
    onSuccess: r => confirmarFabrica(r),
    onError: async error => {
      // 🔴 Mismo orden que guardar. «Quedó» = el servidor ya está de fábrica.
      if (resultadoIncierto(error)) {
        await reconciliar(error, v => esDisenoDeFabrica(v.design), confirmarFabrica)
        setPreguntandoFabrica(false)
        return
      }
      setPreguntandoFabrica(false)
      if (alConflicto(error)) return
      toast({ variant: 'destructive', title: t('editor.factoryError'), description: mensajeDelServidor(error, '') || undefined })
    },
  })

  const bloqueado = guardar.isPending || fabrica.isPending || recargar.isPending
  // 🔴 Semántica REAL de useLeaveGuard (Codex #7): `conflict` significa «hay un DIÁLOGO de conflicto abierto» y cancela la
  // navegación; aquí el 409 es un aviso en línea, así que va en false y Atrás/enlaces SIEMPRE preguntan con cambios.
  // `saving` hace ESPERAR la navegación mientras se guarda (o se reconcilia), restablece o recarga; si al terminar no quedan
  // cambios, sigue sola.
  const salida = useLeaveGuard({ dirty: sucio, saving: bloqueado, conflict: false })
  const salidaVigente = useRef(salida)
  useEffect(() => {
    salidaVigente.current = salida
  })

  const pedirCierre = () => {
    if (bloqueado) return
    if (sucio) setPreguntandoSalida(true)
    else onClose()
  }
  const salirSinGuardar = () => {
    setPreguntandoSalida(false)
    if (salida.asking) salida.leave()
    else onClose()
  }
  const seguirEditando = () => {
    setPreguntandoSalida(false)
    if (salida.asking) salida.stay()
  }

  /** Como en el prototipo aprobado: lo que se escribe se ve en SU momento (el de llegada en «En espera», el otro en «Gracias»). */
  const alCambiarTexto = (parcial: Partial<BorradorDelEditor>) => {
    cambiar(parcial)
    if ('thanksText' in parcial) setMomento('gracias')
    else if ('welcomeText' in parcial) setMomento('espera')
  }
  const alEscribirHex = (texto: string) => {
    setHex(texto)
    if (texto.trim() === '') cambiar({ accentColor: null })
    else {
      const color = colorDelHex(texto)
      if (color) cambiar({ accentColor: color })
    }
  }
  const alElegirMuestra = (color: string | null) => {
    setHex(color ?? '')
    cambiar({ accentColor: color })
  }
  const alCambiarModoDeLogo = (modo: 'negocio' | 'propio') => {
    descartarSubida()
    setModoDeLogo(modo)
    setErrorDeLogo(null)
    cambiar({ logoAssetId: modo === 'negocio' ? null : ultimoLogoPropio })
  }
  const subirLogo = async (archivo: File) => {
    setErrorDeLogo(null)
    const porArchivo = revisarArchivo(archivo)
    if (porArchivo) {
      setErrorDeLogo(t(`editor.logoErrors.${porArchivo}`))
      return
    }
    const mia = ++subidaVigente.current
    setSubiendoLogo(true)
    try {
      // Un JPEG girado por EXIF se re-codifica derecho (Codex F2 bloque 3 #2); peso y medidas se revisan en lo que SE SUBE.
      const aSubir = await enderezarLogo(archivo)
      const porPeso = revisarArchivo(aSubir)
      const medidas = porPeso ? null : await medirImagen(aSubir)
      const motivo = porPeso ?? (medidas ? revisarMedidas(medidas.ancho, medidas.alto) : 'tipo')
      if (motivo) {
        setErrorDeLogo(t(`editor.logoErrors.${motivo}`))
        return
      }
      const subido = await uploadCustomerDisplayLogo(venueId, terminalId, aSubir)
      if (mia !== subidaVigente.current) return // la selección cambió mientras subía: este resultado ya no aplica
      setUltimoLogoPropio(subido.assetId)
      cambiar({ logoAssetId: subido.assetId })
    } catch (error) {
      if (mia === subidaVigente.current) setErrorDeLogo(mensajeDelServidor(error, t('editor.logoUploadError')))
    } finally {
      // Sólo la subida vigente apaga el indicador: la que perdió contra una más nueva lo apagaría (y habilitaría «Guardar»)
      // con la nueva todavía en vuelo. Si la descartó «Recargar lo guardado», ya lo apagó `descartarSubida`.
      if (mia === subidaVigente.current) setSubiendoLogo(false)
    }
  }

  const puedeGuardar = sucio && !hexInvalido && !subiendoLogo && aviso?.clase !== 'conflicto' && !bloqueado
  const avisoIncierto = aviso?.clase === 'incierto'

  return (
    <>
      <FullScreenModal
        open
        onClose={pedirCierre}
        title={t('editor.title', { name: deviceName })}
        contentClassName="bg-muted/30"
        closeButtonTestId="customer-display-editor-close"
        // El foco entra al contenedor del modal (sin enfocar un campo ni abrir el teclado). Pasar `onOpenAutoFocus` también le
        // quita el contorno: sin él, cuando la vista previa del montaje quita «Actualizando…», Radix enfoca el contenedor y lo
        // enmarcaba en azul. Mismo patrón que `src/pages/StaffPay/foco.ts` y `FloorPlanEditor.tsx`.
        onOpenAutoFocus={e => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
        }}
        actions={
          <Button type="button" onClick={() => guardar.mutate(borrador)} disabled={!puedeGuardar} data-tour="customer-display-editor-save">
            {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {guardar.isPending ? t('editor.saving') : t('editor.save')}
          </Button>
        }
      >
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          {/* El aviso va ARRIBA de las dos columnas: en el celular la tablet sale primero y un aviso dentro del formulario
              quedaría debajo de ella, fuera de la vista. */}
          {aviso && (
            <Alert
              variant={avisoIncierto ? 'default' : 'destructive'}
              className={cn(avisoIncierto && 'border-warning-border bg-warning-muted text-warning-foreground')}
              data-tour="customer-display-editor-notice"
            >
              {avisoIncierto ? <AlertTriangle aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
              <AlertDescription className={cn('gap-3', avisoIncierto && 'text-warning-foreground')}>
                <div className="space-y-1">
                  <p>{aviso.mensaje}</p>
                  {aviso.detalle && <p className="text-xs opacity-80">{aviso.detalle}</p>}
                </div>
                {(aviso.clase === 'conflicto' || avisoIncierto) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => recargar.mutate()}
                    disabled={bloqueado}
                    data-tour="customer-display-editor-reload"
                  >
                    {recargar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t('editor.reload')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div className="order-2 space-y-6 lg:order-1">
              <BrandFields
                borrador={borrador}
                onCambio={cambiar}
                bloqueado={bloqueado}
                hex={hex}
                onHex={alEscribirHex}
                hexInvalido={hexInvalido}
                onMuestra={alElegirMuestra}
                logo={
                  <LogoField
                    modo={modoDeLogo}
                    onModo={alCambiarModoDeLogo}
                    hayLogoPropio={borrador.logoAssetId !== null}
                    subiendo={subiendoLogo}
                    bloqueado={bloqueado}
                    error={errorDeLogo}
                    rechazado={logoRechazado}
                    onArchivo={archivo => void subirLogo(archivo)}
                  />
                }
              />
              <TextFields borrador={borrador} onCambio={alCambiarTexto} bloqueado={bloqueado} />
              <PromosTeaser incluidas={view.entitlements.slides} />
              {!esDisenoDeFabrica(base.design) && (
                <Button
                  type="button"
                  variant="link"
                  className="cursor-pointer px-0 text-muted-foreground"
                  onClick={() => setPreguntandoFabrica(true)}
                  disabled={bloqueado || subiendoLogo}
                  data-tour="customer-display-editor-factory"
                >
                  {t('editor.factory')}
                </Button>
              )}
            </div>
            <div className="order-1 lg:sticky lg:top-4 lg:order-2 lg:self-start">
              <PreviewPane
                ficha={vista.ficha}
                momento={momentoVisible}
                momentos={momentos}
                onMomento={setMomento}
                nombreDelNegocio={venueName}
                pasos={pasos}
                pasosConocidos={pasosConocidos}
                cargando={vista.cargando}
                error={vista.error}
              />
            </div>
          </div>
        </div>
      </FullScreenModal>

      {/* onOpenChange sólo baja la bandera: si llamara a seguirEditando, «Salir sin guardar» (que también cierra el diálogo)
          cancelaría con `stay()` la navegación que `leave()` acababa de dejar pasar. */}
      <AlertDialog
        open={preguntandoSalida || salida.asking}
        onOpenChange={abierto => {
          if (!abierto) setPreguntandoSalida(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.leaveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('editor.leaveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={seguirEditando}>{t('editor.leaveStay')}</AlertDialogCancel>
            <AlertDialogAction onClick={salirSinGuardar} data-tour="customer-display-editor-leave-confirm">
              {t('editor.leaveGo')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={preguntandoFabrica} onOpenChange={abierto => !abierto && !fabrica.isPending && setPreguntandoFabrica(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.factoryTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('editor.factoryBody', { name: deviceName })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fabrica.isPending}>{t('editor.factoryCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                fabrica.mutate()
              }}
              disabled={fabrica.isPending}
              data-tour="customer-display-editor-factory-confirm"
            >
              {fabrica.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('editor.factoryConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
