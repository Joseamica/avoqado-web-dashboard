import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SimulacionVigenciaDto } from '@/types/staffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { periodicidadDe, useNombrePeriodo } from '../useNombrePeriodo'
import type { useVigenciaSimulada } from '../useVigenciaSimulada'

/**
 * «Cambia el pago de 12 clases en septiembre de 2026 y 3 en octubre de 2026.» + (si el server no los recorrió) «No se
 * contaron 2 meses anteriores que siguen abiertos; también pueden cambiar.» + «Los meses ya cerrados no cambian.» Antes
 * decía «de este periodo. Las anteriores se quedan como estaban», falso a inicio de mes (revisión final I-2).
 */
function useTextoDelEfecto(periodicidadDeLista: 'MONTHLY' | 'SEMIMONTHLY' | null) {
  const { t } = useTranslation('staffPay')
  const nombrePeriodo = useNombrePeriodo()
  const unir = (partes: string[]) =>
    partes.length === 1 ? partes[0] : t('vigencia.list', { inicio: partes.slice(0, -1).join(', '), ultimo: partes[partes.length - 1] })
  return (e: SimulacionVigenciaDto): string[] => {
    const periodos = (e.porPeriodo ?? []).filter(p => p.clases > 0)
    const primero = (e.porPeriodo ?? [])[0]
    const mensual = (periodicidadDeLista ?? (primero ? periodicidadDe(primero) : 'MONTHLY')) === 'MONTHLY'
    const cerrados = t(mensual ? 'vigencia.closedUnchanged' : 'vigencia.closedUnchangedPeriods')
    const sinContar = e.periodosSinContar ?? 0
    // Server previo: sólo el total.
    if (!e.porPeriodo) {
      return e.clasesQueCambian === 0 ? [t('vigencia.effectNone')] : [t('vigencia.effectTotal', { count: e.clasesQueCambian }), cerrados]
    }
    // «en», no «de»: «3 de octubre» se lee como una fecha; y una quincena se nombra como quincena.
    const partes = periodos.map((p, i) => {
      const quincena = periodicidadDe(p) === 'SEMIMONTHLY'
      const llave = i === 0 ? (quincena ? 'vigencia.partSemi' : 'vigencia.part') : quincena ? 'vigencia.partMoreSemi' : 'vigencia.partMore'
      return t(llave, { count: p.clases, periodo: nombrePeriodo(p, periodicidadDe(p)) })
    })
    const frases = [
      partes.length ? t('vigencia.effect', { lista: unir(partes) }) : t(sinContar ? 'vigencia.effectNoneCounted' : 'vigencia.effectNone'),
    ]
    // Los que el server no recorrió no se afirman: pueden cambiar.
    if (sinContar > 0) frases.push(t(mensual ? 'vigencia.notCountedMonths' : 'vigencia.notCountedPeriods', { count: sinContar }))
    frases.push(cerrados)
    return frases
  }
}

/** El campo de la fecha con su mínimo, el efecto de la simulación y, si cae en un periodo cerrado, el porqué y el atajo. */
export function CampoVigencia({
  id,
  label,
  textoCalculando,
  vigencia,
}: {
  id: string
  label: string
  textoCalculando: string
  vigencia: ReturnType<typeof useVigenciaSimulada>
}) {
  const { t } = useTranslation('staffPay')
  const { formatCalendarDate } = useVenueDateTime()
  const nombrePeriodo = useNombrePeriodo()
  const { fecha, setFecha, efecto, calculando, error, cerradoDeLista, fueraDeRango, minimo, maximo, atajo, periodicidad } = vigencia
  const texto = useTextoDelEfecto(periodicidad)
  const frases = efecto ? texto(efecto) : null
  // El 400 del server manda; si no ha contestado, la lista en caché ya sabe que la fecha cae en un periodo cerrado.
  const porQue =
    error ??
    (fueraDeRango
      ? t('vigencia.outOfRange', { desde: formatCalendarDate(fueraDeRango.desde), hasta: formatCalendarDate(fueraDeRango.hasta) })
      : null) ??
    (cerradoDeLista
      ? t('vigencia.closedLocal', {
          periodo: nombrePeriodo(cerradoDeLista, periodicidad ?? periodicidadDe(cerradoDeLista)),
          fecha: formatCalendarDate(cerradoDeLista.primera),
        })
      : null)
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="date"
          className="h-12 text-base"
          value={fecha}
          min={minimo ?? undefined}
          max={maximo}
          onChange={e => setFecha(e.target.value)}
          aria-invalid={!!porQue}
        />
      </div>
      {porQue ? (
        // El porqué en línea (no un aviso genérico) y la salida en un clic.
        <div role="alert" className="space-y-2 rounded-lg border border-amber-500/40 p-3 text-sm">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{porQue}</span>
          </p>
          {atajo && (
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setFecha(atajo)}>
              {t('vigencia.useDate', { fecha: formatCalendarDate(atajo) })}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {calculando
            ? textoCalculando
            : frases?.map((f, i) => (
                <span key={i}>
                  {i > 0 && ' '}
                  {f}
                </span>
              ))}
        </p>
      )}
    </>
  )
}
