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
 * «Cambia el pago de 12 clases de septiembre de 2026 y 3 de octubre de 2026.» + «Los meses ya cerrados no cambian.» (dos
 * frases). Antes decía «de este periodo. Las anteriores se quedan como estaban», falso a inicio de mes: también cambian
 * las clases de los meses anteriores que siguen abiertos (revisión final I-2).
 */
function useTextoDelEfecto() {
  const { t } = useTranslation('staffPay')
  const nombrePeriodo = useNombrePeriodo()
  const unir = (partes: string[]) =>
    partes.length === 1 ? partes[0] : t('vigencia.list', { inicio: partes.slice(0, -1).join(', '), ultimo: partes[partes.length - 1] })
  return (e: SimulacionVigenciaDto): { frase: string; cerrados: string | null } => {
    const periodos = (e.porPeriodo ?? []).filter(p => p.clases > 0)
    const mensual = periodicidadDe((e.porPeriodo ?? [])[0] ?? { start: '2026-01-01', end: '2026-01-31' }) === 'MONTHLY'
    const cerrados = t(mensual ? 'vigencia.closedUnchanged' : 'vigencia.closedUnchangedPeriods')
    const sinContar = e.periodosSinContar ?? 0
    // Server previo: sólo el total.
    if (!e.porPeriodo) {
      return e.clasesQueCambian === 0
        ? { frase: t('vigencia.effectNone'), cerrados: null }
        : { frase: t('vigencia.effectTotal', { count: e.clasesQueCambian }), cerrados }
    }
    if (periodos.length === 0 && sinContar === 0) return { frase: t('vigencia.effectNone'), cerrados }
    const partes = periodos.map((p, i) =>
      t(i === 0 ? 'vigencia.part' : 'vigencia.partMore', { count: p.clases, periodo: nombrePeriodo(p, periodicidadDe(p)) }),
    )
    const lista = partes.length ? unir(partes) : ''
    const anteriores = sinContar > 0 ? t(mensual ? 'vigencia.olderMonths' : 'vigencia.olderPeriods', { count: sinContar }) : null
    const frase = !partes.length
      ? t('vigencia.effectOnlyOlder', { anteriores })
      : anteriores
        ? t('vigencia.effectWithOlder', { lista, anteriores })
        : t('vigencia.effect', { lista })
    return { frase, cerrados }
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
  const texto = useTextoDelEfecto()
  const { fecha, setFecha, efecto, calculando, error, minimo } = vigencia
  const efectoTexto = efecto ? texto(efecto) : null
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
          onChange={e => setFecha(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      {error ? (
        // El mensaje del server en línea (no un aviso genérico) y la salida en un clic.
        <div role="alert" className="space-y-2 rounded-lg border border-amber-500/40 p-3 text-sm">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{error}</span>
          </p>
          {minimo && (
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setFecha(minimo)}>
              {t('vigencia.useDate', { fecha: formatCalendarDate(minimo) })}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {calculando ? (
            textoCalculando
          ) : efectoTexto ? (
            <>
              <span>{efectoTexto.frase}</span>
              {efectoTexto.cerrados && <span> {efectoTexto.cerrados}</span>}
            </>
          ) : null}
        </p>
      )}
    </>
  )
}
