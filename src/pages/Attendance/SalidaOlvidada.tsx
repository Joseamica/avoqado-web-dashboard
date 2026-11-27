import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { attendanceService, type TimeEntry } from '@/services/attendance.service'

/**
 * «Salida olvidada · revisar» (hz:f0a89d19:D3). La persona no marcó salida y el sistema cerró su turno al terminar el día:
 * con la salida de su horario o en 0 horas. Aquí se ve y, con `attendance:manage`, se corrige con la hora real. Es la única
 * corrección de Asistencia (que sigue siendo de lectura): sin ella, «revisar» no tendría salida.
 */
export function SalidaOlvidadaBadge() {
  const { t } = useTranslation('attendance')
  return (
    <Badge variant="outline" className="gap-1 rounded-full border-amber-500/50 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3" />
      {t('forgotten.badge')}
    </Badge>
  )
}

interface Props {
  // También la usa la bitácora de los gerentes de marca blanca (hz:0433f0cb:D3), que no trae la checada entera.
  entry: Pick<TimeEntry, 'id' | 'clockInTime'>
  venueId: string
  venueTimezone: string
  staffName: string
}

export function CorregirSalidaOlvidada({ entry, venueId, venueTimezone, staffName }: Props) {
  const { t } = useTranslation('attendance')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  // Hora de pared del NEGOCIO, no la del navegador: por defecto, la de la entrada.
  const [valor, setValor] = useState('')
  // Dos clics en el mismo instante mandaban dos correcciones (r3 H-2): el estado del envío todavía no se pintaba.
  const enviando = useRef(false)

  const abrir = () => {
    setValor(DateTime.fromISO(entry.clockInTime, { zone: venueTimezone }).toFormat("yyyy-MM-dd'T'HH:mm"))
    setAbierto(true)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const salida = DateTime.fromISO(valor, { zone: venueTimezone })
      if (!salida.isValid) throw new Error(t('forgotten.invalid'))
      return attendanceService.corregirSalidaOlvidada(venueId, entry.id, salida.toUTC().toISO()!)
    },
    onSuccess: () => {
      toast({ title: t('forgotten.saved', { name: staffName }) })
      setAbierto(false)
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis'] })
    },
    onError: (error: any) => {
      // Ya no está como «Salida olvidada»: otro guardado ganó, o se perdió la respuesta del nuestro y el reintento automático
      // llegó después (Codex D3 r1 #5). No es un error: se dice, se cierra y se relee para ver la hora que quedó. ponytail: si
      // en ese mismo segundo llegó la salida tardía del celular, el reintento vuelve a quitar su marca (queda la nota).
      if (error?.response?.data?.code === 'NO_ES_SALIDA_OLVIDADA') {
        toast({ title: t('forgotten.alreadyFixed') })
        setAbierto(false)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
        queryClient.invalidateQueries({ queryKey: ['stores-analysis'] })
        return
      }
      toast({ title: error?.response?.data?.message ?? error?.message ?? t('forgotten.error'), variant: 'destructive' })
    },
    onSettled: () => {
      enviando.current = false
    },
  })
  const mandar = () => {
    if (enviando.current) return
    enviando.current = true
    guardar.mutate()
  }

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" data-tour="attendance-fix-forgotten-clock-out" onClick={abrir}>
        {t('forgotten.fix')}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('forgotten.dialogTitle', { name: staffName })}</DialogTitle>
            <DialogDescription>{t('forgotten.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`salida-${entry.id}`}>{t('forgotten.label')}</Label>
            <Input
              id={`salida-${entry.id}`}
              type="datetime-local"
              className="h-12 text-base"
              value={valor}
              onChange={e => setValor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={guardar.isPending}>
              {t('forgotten.cancel')}
            </Button>
            <Button onClick={mandar} disabled={!valor || guardar.isPending}>
              {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('forgotten.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
