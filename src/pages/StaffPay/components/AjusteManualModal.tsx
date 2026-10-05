import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useAddAdjustment, useStaffPayReport } from '@/hooks/useStaffPay'
import { teamService } from '@/services/team.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import { useNombreSede } from '../useNombreSede'
import { hoyEnSede } from '../hoyEnSede'
import { useNombrePeriodo } from '../useNombrePeriodo'
import { useAccionDelModal } from '../accionDelModal'
import { useFocoDeVuelta } from '../foco'
import { A_MEDIO_ESCRIBIR, MESES_AJUSTE_ATRAS, MONTO_MAXIMO, MONTO_VALIDO, mensajeLegible, sumarMeses } from '../rangos'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sedes del periodo destino. Sin ellas (desde un periodo cerrado) se leen del periodo abierto de la fecha destino. */
  sedes?: string[]
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
  // Sin `sedes` (desde un periodo cerrado) el modal no sabe a qué periodo va ni dónde cabe el ajuste: lo lee del periodo
  // abierto que contiene la fecha destino —la MISMA que se manda—, así el nombre no la contradice y se ofrecen todas sus
  // sedes, no las del periodo cerrado (QA defecto 7).
  const destinoLeido = useStaffPayReport({ offset: 0, limit: 1, fecha: fechaDestino }, open && !sedes)
  const leido = destinoLeido.data
  const nombrePeriodo = useNombrePeriodo()
  const sedesDestino = useMemo(() => sedes ?? leido?.venueIds ?? [], [sedes, leido])
  // La sede que se está viendo siempre es una opción (al inicio del mes puede no tener dinero todavía).
  const listaSedes = useMemo(() => (venueId && !sedesDestino.includes(venueId) ? [venueId, ...sedesDestino] : sedesDestino), [sedesDestino, venueId])
  const [sede, setSedeElegida] = useState(venueId ?? sedes?.[0] ?? '')
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
  // El monto como se escribe: se valida igual que el server (> 0, ≤ $1,000,000, máximo 2 decimales) ANTES de la vista
  // previa. Antes 10.005 decía «Se suman $10.01» y 1e12 «$1,000,000,000,000.00», con «Guardar» encendido (full-testing A12).
  const [montoTexto, setMontoTexto] = useState('')
  const montoValido = MONTO_VALIDO.test(montoTexto) && Number(montoTexto) > 0 && Number(montoTexto) <= MONTO_MAXIMO
  const monto = montoValido ? Number(montoTexto) : undefined
  // El aviso no parpadea mientras se teclea «0» o «0.»: sale al dejar el campo o con un valor que ya no está a medias.
  const [montoTocado, setMontoTocado] = useState(false)
  const avisoMonto = montoTexto !== '' && !montoValido && (montoTocado || !A_MEDIO_ESCRIBIR.test(montoTexto))
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Candado síncrono (full-testing C6): el estado no alcanza a cerrarse entre dos clics seguidos.
  const enVuelo = useRef(false)
  // Un 400 del server (validación o fecha fuera de rango), dicho en línea y legible; se borra al cambiar algo.
  const [errorServer, setErrorServer] = useState<string | null>(null)
  // El server sólo acepta ajustes de los últimos 12 meses (hasta el fin del periodo de hoy): se dice antes de guardar.
  const desdeAjuste = sumarMeses(hoyEnSede(venueTimezone), -MESES_AJUSTE_ATRAS)
  const fueraDeRango = fechaDestino < desdeAjuste
  const listo = !!persona && !!sede && monto !== undefined && motivo.trim().length >= MIN_MOTIVO && !fueraDeRango

  const elegirPersona = (item: SearchComboboxItem) => {
    setErrorServer(null)
    setPersona({ staffId: item.id, nombre: item.label, email: item.description })
    setBusqueda('')
  }
  const cambiarSede = (v: string) => {
    setSedeElegida(v)
    setPersona(null)
  }

  const guardar = async () => {
    if (!listo || guardando || enVuelo.current) return
    enVuelo.current = true
    setGuardando(true)
    setErrorServer(null)
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
      const status = (err as { response?: { status?: number } } | null)?.response?.status
      // Un 400 (monto, motivo, FECHA_FUERA_DE_RANGO…) se dice junto al formulario; lo demás, en un aviso.
      if (status === 400) setErrorServer(mensajeLegible(err) ?? t('errors.generic'))
      else toast({ title: mensajeLegible(err) ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  const pildora = (v: 'bono' | 'descuento') =>
    cn(
      'cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors',
      tipo === v ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted',
    )
  // Sin etiqueta, el nombre del periodo leído para la fecha destino; mientras llega (o si falla), la fecha exacta.
  const foco = useFocoDeVuelta()
  const accion = useAccionDelModal(
    <Button className="cursor-pointer" disabled={!listo || guardando} onClick={guardar} data-tour="staffpay-adjust-save">
      {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('manualAdjust.save')}
    </Button>,
  )
  const destino =
    etiqueta ??
    (leido ? nombrePeriodo(leido.periodo, leido.periodo.periodicidad) : t('manualAdjust.periodWithDate', { fecha: formatCalendarDate(fechaDestino) }))

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('manualAdjust.title')}
      contentClassName="bg-muted/30"
      actions={accion.actions}
      onOpenAutoFocus={foco.onOpenAutoFocusPantallaCompleta}
      onCloseAutoFocus={foco.onCloseAutoFocus}
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
              value={montoTexto}
              onChange={e => {
                setErrorServer(null)
                setMontoTexto(e.target.value)
                // Volvió a quedar a medias: el aviso espera al siguiente blur.
                if (A_MEDIO_ESCRIBIR.test(e.target.value)) setMontoTocado(false)
              }}
              onBlur={() => setMontoTocado(true)}
              aria-invalid={avisoMonto}
              data-tour="staffpay-adjust-amount"
            />
            {avisoMonto && <p className="text-xs text-destructive">{t('manualAdjust.amountInvalid')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffpay-ajuste-motivo">{t('manualAdjust.reason')}</Label>
            <Input
              id="staffpay-ajuste-motivo"
              className="h-12 text-base"
              maxLength={300}
              value={motivo}
              onChange={e => {
                setErrorServer(null)
                setMotivo(e.target.value)
              }}
              placeholder={t('manualAdjust.reasonPlaceholder')}
              data-tour="staffpay-adjust-reason"
            />
            <p className="text-xs text-muted-foreground">{t('manualAdjust.reasonHint', { min: MIN_MOTIVO })}</p>
          </div>
        </section>
        {(fueraDeRango || errorServer) && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-card p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{errorServer ?? t('manualAdjust.outOfRange', { desde: formatCalendarDate(desdeAjuste) })}</span>
          </div>
        )}
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
      {accion.abajo}
    </FullScreenModal>
  )
}
