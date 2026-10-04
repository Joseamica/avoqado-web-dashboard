import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDifferences } from '@/hooks/useStaffPay'
import type { FilaDiferenciaDto, MotivoExcepcion, PaginaDiferenciasDto } from '@/types/staffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { conSigno } from '../conSigno'
import { useNombreSede } from '../useNombreSede'
import { EstadoLista } from './ListasDelPeriodo'
import { ID_DIFERENCIAS, LiquidarDialog, MotivoPorResolver } from './LiquidarDialog'

interface ClaseConDiferencia {
  id: string
  venueId: string
  productName: string
  startsAt: string
  filas: FilaDiferenciaDto[]
  bloqueada: boolean
  motivo: MotivoExcepcion | null
}

const porFecha = (a: FilaDiferenciaDto, b: FilaDiferenciaDto) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
  a.classSessionId.localeCompare(b.classSessionId) ||
  (a.persona ?? '').localeCompare(b.persona ?? '')

/**
 * Las filas (una por persona) agrupadas por clase y ordenadas por FECHA de la clase. El server las entrega por id (así
 * pagina rápido); aquí se ordena TODO lo cargado, así que al «Cargar más» las nuevas se acomodan en su fecha. Una clase
 * partida entre dos páginas queda en un solo bloque y una persona repetida no se pinta dos veces.
 */
function agrupar(paginas: PaginaDiferenciasDto[] | undefined): ClaseConDiferencia[] {
  const unicas = new Map<string, FilaDiferenciaDto>()
  for (const p of paginas ?? []) {
    for (const f of p.items) {
      const llave = `${f.classSessionId}:${f.persona ?? ''}`
      if (!unicas.has(llave)) unicas.set(llave, f)
    }
  }
  const clases = new Map<string, ClaseConDiferencia>()
  for (const f of [...unicas.values()].sort(porFecha)) {
    let c = clases.get(f.classSessionId)
    if (!c) {
      c = {
        id: f.classSessionId,
        venueId: f.venueId,
        productName: f.productName,
        startsAt: f.startsAt,
        filas: [],
        bloqueada: false,
        motivo: null,
      }
      clases.set(f.classSessionId, c)
    }
    c.filas.push(f)
    if (f.pendiente === null) {
      c.bloqueada = true
      c.motivo ??= f.motivo
    }
  }
  return [...clases.values()]
}

/**
 * «Diferencias pendientes» de un periodo CERRADO (spec §7.2-7.3): lo que cambió después del cierre, por clase y persona.
 * Se paga UNA vez en el periodo abierto con «Liquidar»; el recibo cerrado no cambia. Sólo aparece si hay algo.
 */
export function DiferenciasSection({ periodId, etiquetaAbierto }: { periodId: string; etiquetaAbierto?: string }) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const q = useDifferences(periodId, true)
  const clases = useMemo(() => agrupar(q.data?.pages), [q.data])
  const parcial = q.data?.pages.some(p => p.parcial) ?? false
  const [abierta, setAbierta] = useState<ClaseConDiferencia | null>(null)

  // Casi ningún periodo cerrado tiene diferencias: mientras carga no se anuncia una sección que quizá no exista. Un error
  // sí se dice (no es lo mismo que «no hay nada»).
  if (q.isLoading || (!q.isError && clases.length === 0)) return null
  const puedeLiquidar = can('staffpay:close')

  return (
    <section className="space-y-3 rounded-lg border border-input p-4" aria-labelledby={ID_DIFERENCIAS} data-tour="staffpay-differences">
      <div className="flex flex-wrap items-center gap-2">
        {/* Ancla del foco al liquidar: la fila del botón ya no está (Radix lo devolvería al <body>). */}
        <h3 id={ID_DIFERENCIAS} className="font-semibold outline-none" tabIndex={-1}>
          {t('differences.title')}
        </h3>
        {parcial && (
          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t('period.partial')}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t('differences.help')}</p>
      {!puedeLiquidar && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('differences.noPermission')}</span>
        </div>
      )}
      <EstadoLista
        isLoading={false}
        isError={q.isError && clases.length === 0}
        vacio={false}
        textoVacio=""
        onRetry={() => q.refetch()}
        hasNextPage={!!q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        onLoadMore={() => q.fetchNextPage()}
        errorAlCargarMas={q.isFetchNextPageError}
      >
        <ul className="divide-y divide-border/50">
          {clases.map(c => {
            const fecha = formatDateTime(c.startsAt)
            const accion = etiquetaAbierto ? t('differences.settleIn', { periodo: etiquetaAbierto }) : t('differences.settle')
            return (
              <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {/* La sede sólo si no es la del URL: en una sola sede sería ruido. */}
                  <p className="min-w-0 text-sm font-medium">
                    {t(c.venueId !== venueId ? 'differences.classLineVenue' : 'differences.classLine', {
                      clase: c.productName,
                      fecha,
                      sede: nombreSede(c.venueId),
                    })}
                  </p>
                  {puedeLiquidar && !c.bloqueada && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full cursor-pointer sm:w-auto"
                      // WCAG 2.5.3: el nombre accesible EMPIEZA con lo que se lee («Liquidar en octubre de 2026: Reformer del …»).
                      aria-label={t('differences.settleFor', { accion, clase: c.productName, fecha })}
                      onClick={() => setAbierta(c)}
                      data-tour="staffpay-difference-settle"
                    >
                      {accion}
                    </Button>
                  )}
                </div>
                <ul className="space-y-1 text-sm">
                  {c.filas.map(f => (
                    <li key={f.persona ?? ''} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words">{f.personaNombre ?? t('period.noCoach')}</span>
                      {f.pendiente === null ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{t('differences.toResolve')}</span>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{conSigno(f.pendiente)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {c.bloqueada && <MotivoPorResolver motivo={c.motivo} />}
              </li>
            )
          })}
        </ul>
      </EstadoLista>
      {abierta && (
        <LiquidarDialog
          classVenueId={abierta.venueId}
          sessionId={abierta.id}
          clase={{ productName: abierta.productName, startsAt: abierta.startsAt }}
          onClose={() => setAbierta(null)}
        />
      )}
    </section>
  )
}
