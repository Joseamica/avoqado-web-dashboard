import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useAddAdjustment } from '@/hooks/useStaffPay'
import { teamService } from '@/services/team.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import { useNombreSede } from '../useNombreSede'
import { hoyEnSede } from '../hoyEnSede'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sedes: string[]
  /** Un día dentro del periodo abierto destino. Sin ella, HOY en la sede, fijado al abrir (nunca el reloj del server). */
  fecha?: string
  /** «octubre 2026»: a qué periodo va, dicho antes de guardar. */
  etiqueta?: string
}

const MIN_MOTIVO = 3
type Persona = { staffId: string; nombre: string; email?: string }

/**
 * Bono o descuento a mano para una persona, en un periodo ABIERTO. El monto se escribe positivo y el signo lo pone la
 * elección; antes de guardar dice a quién, cuánto y a qué periodo va. Una clave por apertura: un doble clic no crea dos.
 */
export function AjusteManualModal({ open, onOpenChange, sedes, fecha, etiqueta }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { formatCalendarDate, venueTimezone } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const agregar = useAddAdjustment()
  // El padre monta el modal sólo cuando está abierto: una clave por apertura.
  const [clientKey] = useState(() => crypto.randomUUID())
  // 🔴 Codex bloque A #1: el destino se fija AL ABRIR y viaja con la clave. Si el server usara el día en que recibe, un
  // reintento tras medianoche de cambio de periodo daría CLAVE_REUTILIZADA y la recaptura duplicaría el bono.
  const [fechaDestino] = useState(() => fecha ?? hoyEnSede(venueTimezone))
  // La sede que se está viendo siempre es una opción (al inicio del mes puede no tener dinero todavía).
  const listaSedes = useMemo(() => (venueId && !sedes.includes(venueId) ? [venueId, ...sedes] : sedes), [sedes, venueId])
  const [sede, setSedeElegida] = useState(venueId ?? sedes[0] ?? '')
  const [busqueda, setBusqueda] = useState('')
  const buscar = useDebounce(busqueda.trim(), 300)
  // La lista sale de la SEDE ELEGIDA y con búsqueda en el servidor (Codex R1-22): desde PN también se encuentra a quien
  // sólo trabaja en BSF, y a la persona 101. Sin «Cargar más»: la pista dice cuántas hay y pide escribir el nombre.
  const equipo = useQuery({
    queryKey: ['team', sede, 'buscar', buscar],
    queryFn: () => teamService.getTeamMembers(sede, 1, 50, buscar || undefined),
    enabled: open && !!sede,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  // Lo elegido se guarda AL elegir (con su nombre y correo): si la búsqueda cambia y ya no la trae, sigue elegida.
  const [persona, setPersona] = useState<Persona | null>(null)
  // El correo como descripción distingue a dos personas con el mismo nombre.
  const opciones = useMemo<SearchComboboxItem[]>(
    () =>
      (equipo.data?.data ?? []).map((p: { staffId: string; firstName: string; lastName: string; email?: string }) => ({
        id: p.staffId,
        label: `${p.firstName} ${p.lastName}`.trim(),
        description: p.email || undefined,
      })),
    [equipo.data],
  )
  const hayMas = equipo.data?.meta?.hasNextPage ?? false
  const totalEquipo = equipo.data?.meta?.totalCount ?? opciones.length

  const [tipo, setTipo] = useState<'bono' | 'descuento'>('bono')
  const [monto, setMonto] = useState<number | undefined>(undefined)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const listo = !!persona && !!sede && monto !== undefined && monto > 0 && motivo.trim().length >= MIN_MOTIVO

  const elegirPersona = (item: SearchComboboxItem) => {
    setPersona({ staffId: item.id, nombre: item.label, email: item.description })
    setBusqueda('')
  }
  const cambiarSede = (v: string) => {
    setSedeElegida(v)
    setPersona(null)
  }

  const guardar = async () => {
    if (!listo || guardando) return
    setGuardando(true)
    try {
      const r = await agregar.mutateAsync({
        staffId: persona!.staffId,
        sede,
        amount: tipo === 'descuento' ? -monto! : monto!,
        reason: motivo.trim(),
        fecha: fechaDestino,
        clientKey,
      })
      toast({ title: t('manualAdjust.saved', { start: formatCalendarDate(r.periodo.start), end: formatCalendarDate(r.periodo.end) }) })
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const pildora = (v: 'bono' | 'descuento') =>
    cn(
      'cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors',
      tipo === v ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted',
    )
  // Sin etiqueta (desde un periodo cerrado) se nombra por la fecha exacta que se manda: el texto no puede contradecirla.
  const destino = etiqueta ?? t('manualAdjust.periodWithDate', { fecha: formatCalendarDate(fechaDestino) })

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('manualAdjust.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" disabled={!listo || guardando} onClick={guardar} data-tour="staffpay-adjust-save">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('manualAdjust.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          {listaSedes.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="staffpay-ajuste-sede">{t('manualAdjust.venue')}</Label>
              <Select value={sede} onValueChange={cambiarSede}>
                <SelectTrigger id="staffpay-ajuste-sede" className="h-12 cursor-pointer text-base" data-tour="staffpay-adjust-venue">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listaSedes.map(s => (
                    <SelectItem key={s} value={s} className="cursor-pointer">
                      {nombreSede(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="staffpay-ajuste-persona">{t('manualAdjust.person')}</Label>
            <div data-tour="staffpay-adjust-person">
              <SearchCombobox
                inputId="staffpay-ajuste-persona"
                placeholder={t('manualAdjust.search')}
                items={opciones}
                isLoading={equipo.isFetching}
                value={busqueda}
                onChange={setBusqueda}
                onSelect={elegirPersona}
              />
            </div>
            {persona && (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{t('manualAdjust.selected', { persona: persona.email ? `${persona.nombre} (${persona.email})` : persona.nombre })}</span>
              </p>
            )}
            {equipo.isError ? (
              <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
                {t('manualAdjust.teamError')}
                <Button variant="link" size="sm" className="h-auto cursor-pointer p-0 text-xs" onClick={() => equipo.refetch()}>
                  {t('period.retry')}
                </Button>
              </p>
            ) : equipo.data && opciones.length === 0 ? (
              <p className="text-xs text-muted-foreground">{buscar ? t('manualAdjust.noMatches', { busqueda: buscar }) : t('manualAdjust.noTeam')}</p>
            ) : hayMas ? (
              <p className="text-xs text-muted-foreground">{t('manualAdjust.moreResults', { n: opciones.length, total: totalEquipo })}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('manualAdjust.kind')}</p>
            <div className="flex gap-2" role="group" aria-label={t('manualAdjust.kind')}>
              <button type="button" aria-pressed={tipo === 'bono'} className={pildora('bono')} onClick={() => setTipo('bono')} data-tour="staffpay-adjust-bonus">
                {t('manualAdjust.bonus')}
              </button>
              <button
                type="button"
                aria-pressed={tipo === 'descuento'}
                className={pildora('descuento')}
                onClick={() => setTipo('descuento')}
                data-tour="staffpay-adjust-deduction"
              >
                {t('manualAdjust.deduction')}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffpay-ajuste-monto">{t('manualAdjust.amount')}</Label>
            <Input
              id="staffpay-ajuste-monto"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="h-12 text-base"
              placeholder="0.00"
              value={monto ?? ''}
              onChange={e => {
                const raw = e.target.value
                const n = parseFloat(raw)
                setMonto(raw === '' || Number.isNaN(n) ? undefined : Math.abs(n))
              }}
              data-tour="staffpay-adjust-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffpay-ajuste-motivo">{t('manualAdjust.reason')}</Label>
            <Input
              id="staffpay-ajuste-motivo"
              className="h-12 text-base"
              maxLength={300}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={t('manualAdjust.reasonPlaceholder')}
              data-tour="staffpay-adjust-reason"
            />
            <p className="text-xs text-muted-foreground">{t('manualAdjust.reasonHint', { min: MIN_MOTIVO })}</p>
          </div>
        </section>
        <section className="rounded-2xl border border-border/50 bg-card p-6 text-sm" aria-live="polite">
          {persona && monto !== undefined && monto > 0 ? (
            <p className="font-medium">
              {t(tipo === 'descuento' ? 'manualAdjust.summaryDeduction' : 'manualAdjust.summaryBonus', {
                monto: Currency(monto),
                persona: persona.nombre,
                periodo: destino,
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t('manualAdjust.summaryEmpty')}</p>
          )}
          <p className="mt-1 text-muted-foreground">{t('manualAdjust.goesTo')}</p>
        </section>
      </div>
    </FullScreenModal>
  )
}
