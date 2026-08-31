import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { attendanceService, type PayrollSummaryRow } from '@/services/attendance.service'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * Autorizar horas extra, día por día.
 *
 * Decisión del founder (29-ago-2026): las horas extra no se pagan por el solo hecho de que el
 * reloj las midiera. Este panel es donde alguien las firma.
 *
 * 🔴 Es día por día A PROPÓSITO, sin botón de "autorizar todo el periodo". Un botón así
 * convierte la autorización en un trámite de un clic y deja de ser un control — que es
 * exactamente lo que se quiso evitar al pedirla.
 */

interface Props {
  venueId: string
  startDate: string
  endDate: string
  persona: PayrollSummaryRow | null
  onClose: () => void
}

/** 150 → "2h 30m". */
function hm(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function OvertimeApprovalDialog({ venueId, startDate, endDate, persona, onClose }: Props) {
  const { t } = useTranslation('attendance')
  const { formatCalendarDate } = useVenueDateTime()
  const queryClient = useQueryClient()

  // Lo que el gerente teclea en cada día, mientras no lo guarde.
  const [borrador, setBorrador] = useState<Record<string, string>>({})
  const [errorDe, setErrorDe] = useState<Record<string, string>>({})

  // Misma clave que usa el reporte de puntualidad: si ya se cargó, esto no pide nada.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', 'report', venueId, startDate, endDate],
    queryFn: () => attendanceService.getReport(venueId, startDate, endDate),
    enabled: !!persona,
  })

  // Al cambiar de persona se limpia el borrador: si no, los minutos tecleados para uno
  // aparecerían prellenados en el siguiente.
  useEffect(() => {
    setBorrador({})
    setErrorDe({})
  }, [persona?.staffVenueId])

  const dias = (data?.rows ?? [])
    .filter(r => r.staffVenueId === persona?.staffVenueId && r.overtimeMinutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const autorizar = useMutation({
    mutationFn: ({
      date,
      minutes,
      revision,
      huella,
    }: {
      date: string
      minutes: number
      revision: string | null
      huella: string | null
    }) =>
      attendanceService.approveOvertime(venueId, persona!.staffVenueId, {
        date,
        minutesApproved: minutes,
        // 🔴 La revisión que se tenía ENFRENTE. Sin ella el servidor rechaza corregir una
        // autorización que ya existe, para que dos gerentes no se pisen en silencio.
        ...(revision ? { expectedUpdatedAt: revision } : {}),
        // 🔴 Y la JORNADA que se tenía enfrente. Son dos carreras distintas: aquélla protege
        // de otro gerente firmando a la vez; ésta, de que alguien edite la CHECADA entre que
        // se abre este panel y se toca «Autorizar». Sin ella la firma se estampaba sobre las
        // horas nuevas y nacía «vigente» sin que nadie las hubiera mirado.
        ...(huella ? { expectedSourceFingerprint: huella } : {}),
      }),
    onSuccess: () => {
      // El reporte y la nómina leen lo mismo: los dos tienen que refrescarse, o la tabla de
      // atrás seguiría mostrando el total viejo.
      queryClient.invalidateQueries({ queryKey: ['attendance', 'report', venueId, startDate, endDate] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'payroll', venueId, startDate, endDate] })
    },
  })

  function guardar(date: string, medidos: number, revision: string | null, huella: string | null) {
    const crudo = borrador[date]
    const minutes = crudo === undefined || crudo === '' ? medidos : Number(crudo)
    if (!Number.isInteger(minutes) || minutes < 0) {
      setErrorDe(e => ({ ...e, [date]: t('payroll.overtime.approve.invalid') }))
      return
    }
    if (minutes > medidos) {
      // Se avisa ANTES de mandar: el servidor también lo rechaza, pero hacer el viaje para
      // enseñar un error que ya se sabía es peor experiencia.
      setErrorDe(e => ({ ...e, [date]: t('payroll.overtime.approve.tooMuch', { max: medidos }) }))
      return
    }
    setErrorDe(e => ({ ...e, [date]: '' }))
    autorizar.mutate({ date, minutes, revision, huella })
  }

  return (
    <Dialog open={!!persona} onOpenChange={abierto => !abierto && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('payroll.overtime.approve.title', { name: persona?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('payroll.overtime.approve.help')}</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

        {isError && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{t('loadError.title')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('loadError.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !isError && dias.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('payroll.overtime.approve.empty')}</p>
        )}

        {!isLoading && !isError && dias.length > 0 && (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {dias.map(dia => {
              const autorizados = dia.overtimeApprovedMinutes
              const sinRevisar = autorizados === null
              return (
                <div key={dia.date} className="rounded-md border border-input p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{formatCalendarDate(dia.date)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('payroll.overtime.approve.measured', { amount: hm(dia.overtimeMinutes) })}
                        {/* 🔴 «autorizadas 0m» se lee raro para un día NEGADO — se vio mirando la
                            pantalla, no en una prueba. Un cero tiene su propia frase. */}
                        {!sinRevisar &&
                          ` · ${
                            autorizados === 0
                              ? t('payroll.overtime.approve.denied')
                              : t('payroll.overtime.approve.current', { amount: hm(autorizados) })
                          }`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={dia.overtimeMinutes}
                        className="h-8 w-24"
                        aria-label={t('payroll.overtime.approve.minutesLabel')}
                        // Prellenado con lo MEDIDO cuando nadie lo ha revisado: el caso normal
                        // es autorizar lo que se trabajó, y obligarlo a teclearlo cada vez
                        // empuja a aprobar sin mirar.
                        value={borrador[dia.date] ?? String(sinRevisar ? dia.overtimeMinutes : autorizados)}
                        onChange={e => setBorrador(b => ({ ...b, [dia.date]: e.target.value }))}
                      />
                      {/* 🔴 La unidad, visible. Sin esto el renglón dice «El reloj marcó 3h» a la
                          izquierda y «180» a la derecha: dos unidades distintas en la misma línea,
                          y el gerente tiene que adivinar cuál es cuál. Se vio MIRANDO la pantalla. */}
                      <span className="text-xs text-muted-foreground">{t('payroll.overtime.approve.minutesUnit')}</span>
                      <Button
                        size="sm"
                        className="cursor-pointer"
                        disabled={autorizar.isPending}
                        onClick={() =>
                          guardar(dia.date, dia.overtimeMinutes, dia.overtimeApprovedUpdatedAt, dia.overtimeFingerprint)
                        }
                      >
                        {sinRevisar ? t('payroll.overtime.approve.action') : t('payroll.overtime.approve.change')}
                      </Button>
                    </div>
                  </div>
                  {errorDe[dia.date] && <p className="mt-1.5 text-xs text-destructive">{errorDe[dia.date]}</p>}
                </div>
              )
            })}
          </div>
        )}

        {autorizar.isError && (
          <p role="alert" className="text-sm text-destructive">
            {/* 🔴 Un 409 no es "falló, reintenta": es "alguien más lo cambió y tu pantalla está
                vieja". Decir lo genérico invitaría a apretar otra vez y volver a perder. */}
            {(autorizar.error as any)?.response?.status === 409
              ? t('payroll.overtime.approve.conflict')
              : t('payroll.overtime.approve.failed')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
