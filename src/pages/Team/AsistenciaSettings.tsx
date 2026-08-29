import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
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

  const guardar = useMutation({
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

      toast({
        title:
          requested.rotatingShiftsEnabled !== undefined
            ? requested.rotatingShiftsEnabled
              ? t('venue:rotatingShifts.toastEnabled')
              : t('venue:rotatingShifts.toastDisabled')
            : requested.attendanceEnabled === undefined
              ? t('venue:attendance.toastGraceSaved')
              : requested.attendanceEnabled
                ? t('venue:attendance.toastEnabled')
                : t('venue:attendance.toastDisabled'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: () => {
      // 🔴 Se revierte a lo que había: dejar el switch en la posición pedida haría creer que se
      // guardó algo que el servidor rechazó (auditoría Codex fase 2).
      setChecador(settings?.attendanceEnabled ?? true)
      setTolerancia(settings?.attendanceGraceMinutes ?? 10)
      setAviso(settings?.attendanceLateAlertEnabled ?? false)
      setTurnosRotativos(settings?.rotatingShiftsEnabled ?? false)
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
                  type="number"
                  min={0}
                  max={120}
                  className="h-9 w-20 text-right"
                  value={tolerancia}
                  onChange={e => setTolerancia(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={() => {
                    if (tolerancia !== '' && tolerancia !== (settings?.attendanceGraceMinutes ?? 10)) {
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
                  checked={aviso}
                  onCheckedChange={checked => {
                    setAviso(checked)
                    guardar.mutate({ attendanceLateAlertEnabled: checked })
                  }}
                  disabled={!canEdit || ocupado}
                />
              </div>
            </div>
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
