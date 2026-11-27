import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import api from '@/api'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

/**
 * Ajustes de ASISTENCIA, dentro de Equipo.
 *
 * 🔴 Vivían en Ajustes → Editar negocio, junto a cosas del local (horarios de apertura, imágenes,
 * integraciones). Se movieron aquí porque son ajustes **de la gente**, no del local — y porque es
 * donde los pone el referente: Square los agrupa bajo *Staff & Payroll → Team*, no en la
 * configuración general del negocio. Decisión del founder (28-ago).
 *
 * Se movió el BLOQUE COMPLETO, no un interruptor suelto: partir el checador de su tolerancia entre
 * dos pantallas es peor que cualquiera de las dos ubicaciones.
 *
 * Los tres ajustes se guardan uno por uno al tocarlos (no hay botón de "Guardar"), igual que en su
 * pantalla anterior, y el valor se relee de lo que el servidor GUARDÓ.
 */

interface AjustesDeAsistencia {
  attendanceEnabled?: boolean
  attendanceGraceMinutes?: number
  rotatingShiftsEnabled?: boolean
  attendanceLateAlertEnabled?: boolean
  /** «Foto de entrada»: el POS y la terminal piden una selfie al marcar entrada; se ve en Asistencia. */
  requireClockInPhoto?: boolean
  /** «Salida olvidada»: un turno sin salida se cierra solo al terminar su día. Prendida de fábrica (sin dato = prendida). */
  salidaOlvidadaEnabled?: boolean
  /** Hora de corte de la salida olvidada («HH:mm»); null = la de fábrica (4:00 a. m.). Founder 26-nov: «A», por sucursal. */
  salidaOlvidadaCorte?: string | null
}

interface Props {
  venueId: string
  settings: AjustesDeAsistencia | null | undefined
  canEdit: boolean
}

export default function AsistenciaSettings({ venueId, settings, canEdit }: Props) {
  const { t } = useTranslation(['venue'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [checador, setChecador] = useState(settings?.attendanceEnabled ?? true)
  const [tolerancia, setTolerancia] = useState<number | ''>(settings?.attendanceGraceMinutes ?? 10)
  const [aviso, setAviso] = useState(settings?.attendanceLateAlertEnabled ?? false)
  const [turnosRotativos, setTurnosRotativos] = useState(settings?.rotatingShiftsEnabled ?? false)
  const [foto, setFoto] = useState(settings?.requireClockInPhoto ?? false)
  const [salidaOlvidada, setSalidaOlvidada] = useState(settings?.salidaOlvidadaEnabled ?? true)
  const [corte, setCorte] = useState(settings?.salidaOlvidadaCorte ?? '')
  /**
   * Lo último que el SERVIDOR guardó de la hora de corte. Se compara contra esto, no contra [settings], que llega tarde tras
   * guardar: un segundo cambio rápido (22:00 → 23:00 → 22:00) se perdía al compararse contra el valor viejo (Codex r1 #4).
   */
  const corteGuardado = useRef<string | null>(settings?.salidaOlvidadaCorte ?? null)
  /** Mientras la persona escribe la hora, ni la recarga ni la respuesta de un guardado le pisan el texto (Codex r2 #5). */
  const editandoCorte = useRef(false)

  /**
   * 🔴 El estado local es una CAPA OPTIMISTA sobre los ajustes, no una copia que se saca una vez.
   *
   * P2 #1 de Codex (29-ago): `useState(settings?...)` sólo lee al montar. Con la red lenta, abrir
   * la pestaña antes de que termine el GET dejaba los valores por DEFECTO (checador on, tolerancia
   * 10) fijos para siempre — y bastaba enfocar y desenfocar ese 10 para **guardarlo encima de la
   * tolerancia real**, que podía ser 20. Pérdida de dato silenciosa, no sólo un valor mal pintado.
   * Cambiar de sucursal con la pestaña montada tenía el mismo problema: conservaba lo del venue
   * anterior.
   *
   * No se sincroniza mientras hay un guardado EN VUELO: ahí el valor bueno es el que el usuario
   * acaba de tocar, no el que todavía devuelve la caché.
   */
  const guardadoEnVuelo = useRef(false)
  useEffect(() => {
    if (guardadoEnVuelo.current) return
    setChecador(settings?.attendanceEnabled ?? true)
    setTolerancia(settings?.attendanceGraceMinutes ?? 10)
    setAviso(settings?.attendanceLateAlertEnabled ?? false)
    setTurnosRotativos(settings?.rotatingShiftsEnabled ?? false)
    setFoto(settings?.requireClockInPhoto ?? false)
    setSalidaOlvidada(settings?.salidaOlvidadaEnabled ?? true)
    corteGuardado.current = settings?.salidaOlvidadaCorte ?? null
    if (!editandoCorte.current) setCorte(settings?.salidaOlvidadaCorte ?? '')
  }, [venueId, settings])

  const guardar = useMutation({
    onMutate: () => {
      guardadoEnVuelo.current = true
    },
    onSettled: () => {
      guardadoEnVuelo.current = false
    },
    mutationFn: async (data: AjustesDeAsistencia) => {
      // 🔴 Se devuelve lo que el servidor GUARDÓ, no lo que se pidió: un venue sin fila de
      // settings podía responder con otros valores (auditoría Codex fase 2, P2-1).
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, data)
      const saved = (response.data?.data ?? response.data) as AjustesDeAsistencia
      return { requested: data, saved }
    },
    onSuccess: ({ requested, saved }) => {
      if (requested.attendanceEnabled !== undefined) setChecador(saved.attendanceEnabled ?? requested.attendanceEnabled)
      if (requested.attendanceGraceMinutes !== undefined) setTolerancia(saved.attendanceGraceMinutes ?? requested.attendanceGraceMinutes)
      if (requested.attendanceLateAlertEnabled !== undefined)
        setAviso(saved.attendanceLateAlertEnabled ?? requested.attendanceLateAlertEnabled)
      if (requested.rotatingShiftsEnabled !== undefined) setTurnosRotativos(saved.rotatingShiftsEnabled ?? requested.rotatingShiftsEnabled)
      if (requested.requireClockInPhoto !== undefined) setFoto(saved.requireClockInPhoto ?? requested.requireClockInPhoto)
      if (requested.salidaOlvidadaEnabled !== undefined) setSalidaOlvidada(saved.salidaOlvidadaEnabled ?? requested.salidaOlvidadaEnabled)
      if (requested.salidaOlvidadaCorte !== undefined) {
        corteGuardado.current = saved.salidaOlvidadaCorte ?? null
        if (!editandoCorte.current) setCorte(saved.salidaOlvidadaCorte ?? '')
      }

      toast({
        title:
          requested.salidaOlvidadaCorte !== undefined
            ? requested.salidaOlvidadaCorte
              ? t('venue:attendance.forgottenCutoffToast', { hora: requested.salidaOlvidadaCorte })
              : t('venue:attendance.forgottenCutoffToastDefault')
            : requested.salidaOlvidadaEnabled !== undefined
              ? requested.salidaOlvidadaEnabled
                ? t('venue:attendance.forgottenToastEnabled')
                : t('venue:attendance.forgottenToastDisabled')
              : requested.requireClockInPhoto !== undefined
                ? requested.requireClockInPhoto
                  ? t('venue:attendance.photoToastEnabled')
                  : t('venue:attendance.photoToastDisabled')
                : requested.rotatingShiftsEnabled !== undefined
                  ? requested.rotatingShiftsEnabled
                    ? t('venue:rotatingShifts.toastEnabled')
                    : t('venue:rotatingShifts.toastDisabled')
                  : requested.attendanceLateAlertEnabled !== undefined
                    ? requested.attendanceLateAlertEnabled
                      ? t('venue:attendance.lateAlertToastEnabled')
                      : t('venue:attendance.lateAlertToastDisabled')
                    : requested.attendanceEnabled === undefined
                      ? t('venue:attendance.toastGraceSaved')
                      : requested.attendanceEnabled
                        ? t('venue:attendance.toastEnabled')
                        : t('venue:attendance.toastDisabled'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      // Asistencia lee los ajustes de la sesión (auth/status): sin esto, «Sin foto» y el aviso de checador apagado no
      // cambiaban hasta recargar la página.
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: () => {
      // 🔴 Se revierte a lo que había: dejar el switch en la posición pedida haría creer que se
      // guardó algo que el servidor rechazó (auditoría Codex fase 2).
      setChecador(settings?.attendanceEnabled ?? true)
      setTolerancia(settings?.attendanceGraceMinutes ?? 10)
      setAviso(settings?.attendanceLateAlertEnabled ?? false)
      setTurnosRotativos(settings?.rotatingShiftsEnabled ?? false)
      setFoto(settings?.requireClockInPhoto ?? false)
      setSalidaOlvidada(settings?.salidaOlvidadaEnabled ?? true)
      setCorte(corteGuardado.current ?? '')
      toast({ title: t('venue:attendance.toastError'), variant: 'destructive' })
    },
  })

  const ocupado = guardar.isPending

  return (
    <div className="space-y-4">
      {/* ── Checador ── */}
      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="flex flex-row items-center justify-between p-4">
          <div className="space-y-0.5">
            <p className="text-base font-medium">{t('venue:attendance.title')}</p>
            <p className="text-sm text-muted-foreground">{t('venue:attendance.description')}</p>
          </div>
          <div className="flex items-center gap-2">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              aria-label={t('venue:attendance.title')}
              checked={checador}
              onCheckedChange={checked => {
                setChecador(checked)
                guardar.mutate({ attendanceEnabled: checked })
              }}
              disabled={!canEdit || ocupado}
            />
          </div>
        </div>

        {checador ? (
          <div className="px-4 pb-4">
            {/* Tolerancia */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('venue:attendance.graceTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('venue:attendance.graceDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={t('venue:attendance.graceTitle')}
                  type="number"
                  min={0}
                  max={120}
                  className="h-9 w-20 text-right"
                  value={tolerancia}
                  onChange={e => setTolerancia(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={() => {
                    // 🔴 `settings` sin cargar (undefined) NO se compara contra el default: sin
                    // esta guarda, enfocar y desenfocar el 10 provisional guardaba ese 10 encima
                    // del valor real del negocio (P2 #1 de Codex).
                    if (!settings) return
                    if (tolerancia !== '' && tolerancia !== (settings.attendanceGraceMinutes ?? 10)) {
                      guardar.mutate({ attendanceGraceMinutes: tolerancia })
                    }
                  }}
                  disabled={!canEdit || ocupado}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>

            {/* Aviso EN VIVO de retardo. Va DENTRO del checador porque sin checador no hay nada
                que avisar, y nace APAGADO porque manda correos. */}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border/50 pt-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('venue:attendance.lateAlertTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('venue:attendance.lateAlertDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  aria-label={t('venue:attendance.lateAlertTitle')}
                  checked={aviso}
                  onCheckedChange={checked => {
                    setAviso(checked)
                    guardar.mutate({ attendanceLateAlertEnabled: checked })
                  }}
                  disabled={!canEdit || ocupado}
                />
              </div>
            </div>

            {/* Foto de entrada (antifraude): un PIN se presta; una selfie guardada deja huella. Se guarda, no se
                compara (comparar caras es dato biométrico). Apagada de fábrica (founder, 29-ago). */}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border/50 pt-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('venue:attendance.photoTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('venue:attendance.photoDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  aria-label={t('venue:attendance.photoTitle')}
                  data-tour="attendance-clock-in-photo"
                  checked={foto}
                  onCheckedChange={checked => {
                    setFoto(checked)
                    guardar.mutate({ requireClockInPhoto: checked })
                  }}
                  disabled={!canEdit || ocupado}
                />
              </div>
            </div>

            {/* «Salida olvidada» (hz:f0a89d19:D3): un turno sin salida se cierra solo al terminar su día, con la salida de
                su horario o en 0 horas, y queda «revisar» en Asistencia. Prendida de fábrica, como Toast y Square. */}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border/50 pt-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('venue:attendance.forgottenTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('venue:attendance.forgottenDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  aria-label={t('venue:attendance.forgottenTitle')}
                  data-tour="attendance-forgotten-clock-out"
                  checked={salidaOlvidada}
                  onCheckedChange={checked => {
                    setSalidaOlvidada(checked)
                    guardar.mutate({ salidaOlvidadaEnabled: checked })
                  }}
                  disabled={!canEdit || ocupado}
                />
              </div>
            </div>

            {/* Su hora de corte (founder 26-nov: «A», como Toast y Square): después de esta hora el turno sin salida queda como
                olvidado. Vacía = la de fábrica, 4:00 a. m. Se guarda al salir del campo, como la tolerancia. */}
            {salidaOlvidada && (
              <div className="mt-3 flex items-center justify-between gap-4 pl-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t('venue:attendance.forgottenCutoffTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('venue:attendance.forgottenCutoffDesc')}</p>
                </div>
                <Input
                  aria-label={t('venue:attendance.forgottenCutoffTitle')}
                  type="time"
                  step={60}
                  className="h-9 w-28"
                  value={corte}
                  onFocus={() => (editandoCorte.current = true)}
                  onChange={e => setCorte(e.target.value)}
                  onBlur={() => {
                    editandoCorte.current = false
                    // Sólo se salta con los ajustes SIN CARGAR (undefined): una sucursal sin fila de ajustes llega con null y su
                    // primer corte sí se guarda (Codex r1 #3).
                    if (settings === undefined) return
                    const nuevo = corte === '' ? null : corte
                    if (nuevo !== corteGuardado.current) guardar.mutate({ salidaOlvidadaCorte: nuevo })
                  }}
                  // Sin los ajustes cargados no se escribe: no habría contra qué guardar (Codex r3 #10).
                  disabled={!canEdit || ocupado || settings === undefined}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="px-4 pb-4 text-xs text-muted-foreground">{t('venue:attendance.disabledHint')}</p>
        )}
      </div>

      {/* ── Turnos rotativos: capa opcional sobre la jornada fija ── */}
      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="flex flex-row items-center justify-between p-4">
          <div className="space-y-0.5">
            <p className="text-base font-medium">{t('venue:rotatingShifts.title')}</p>
            <p className="text-sm text-muted-foreground">{t('venue:rotatingShifts.description')}</p>
          </div>
          <div className="flex items-center gap-2">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              aria-label={t('venue:rotatingShifts.title')}
              checked={turnosRotativos}
              onCheckedChange={checked => {
                setTurnosRotativos(checked)
                guardar.mutate({ rotatingShiftsEnabled: checked })
              }}
              // Sin checador no hay contra qué comparar un turno: se deshabilita, no se esconde,
              // para que se vea que existe y por qué no se puede tocar.
              disabled={!canEdit || ocupado || !checador}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
