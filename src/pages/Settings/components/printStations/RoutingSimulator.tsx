import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, PlayCircle, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTerminology } from '@/hooks/use-terminology'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { getRouting, previewRouting, type PreviewResult, type PrintStation } from '@/services/printStations.service'
import { destinoDelPlan } from './kitchenDisplay'

const apiError = (e: any, fallback: string): string => e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

/**
 * Simulador «¿a dónde va este pedido?» (servidor: `previewRouting`). Lo usan la pestaña «Ruteo» y el botón «Probar» de
 * las estaciones (diseño A: «botón Probar con el simulador existente»). Cada estación del resultado dice si su comanda
 * sale en papel, en la pantalla o en las dos.
 */
export function RoutingSimulator({
  venueId,
  products,
  stations,
}: {
  venueId: string
  products: { id: string; name: string }[]
  stations: PrintStation[]
}) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const { hasAccess: tieneAccesoPro } = useTierFeatureAccess('KITCHEN_DISPLAY')
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([])
  const [result, setResult] = useState<PreviewResult | null>(null)

  const simMut = useMutation({
    mutationFn: () => previewRouting(venueId, { items }),
    onSuccess: setResult,
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1 }])
  const canRun = items.length > 0 && items.every(i => i.productId && (i.quantity ?? 0) >= 1)

  return (
    <Card className="border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlayCircle className="h-5 w-5" /> {t('routing.simulator.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('routing.simulator.description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select
                value={item.productId}
                onValueChange={v => setItems(prev => prev.map((x, j) => (j === i ? { ...x, productId: v } : x)))}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t('routing.simulator.selectProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                className="w-24"
                aria-label={t('routing.simulator.quantity')}
                value={item.quantity ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  setItems(prev =>
                    prev.map((x, j) => (j === i ? { ...x, quantity: raw === '' ? (undefined as unknown as number) : parseInt(raw, 10) } : x)),
                  )
                }}
              />
              <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {t('routing.simulator.addItem')}
          </Button>
        </div>

        <Button onClick={() => simMut.mutate()} disabled={!canRun || simMut.isPending}>
          {simMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {t('routing.simulator.run')}
        </Button>

        {items.length === 0 && <p className="text-xs text-muted-foreground">{t('routing.simulator.noItems')}</p>}

        {result && (
          <div className="space-y-3">
            {result.unrouted && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('routing.simulator.unroutedNote')}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {result.plans.map((plan, i) => {
                const destino = destinoDelPlan(plan, stations, tieneAccesoPro)
                return (
                  <div key={plan.stationId ?? `unrouted-${i}`} className="rounded-lg border border-input p-4">
                    <p className="mb-2 flex flex-wrap items-center gap-2 font-medium">
                      {plan.unrouted ? (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                          {t('routing.simulator.unroutedStation')}
                        </Badge>
                      ) : (
                        <span>{plan.stationName}</span>
                      )}
                      {destino && <Badge variant="secondary">{t(`destino.${destino}`)}</Badge>}
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {plan.lines.map((line, j) => (
                        <li key={j}>{t('routing.simulator.lineFormat', { quantity: line.quantity, name: line.productName })}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * El botón «Probar» de las estaciones: el mismo simulador, sin salir de la pestaña. Los productos salen de la misma
 * consulta que usa «Ruteo» (`['printRouting', venueId]`), así que no se piden dos veces.
 */
export function ProbarRuteoModal({ venueId, stations, onClose }: { venueId: string; stations: PrintStation[]; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  const { term } = useTerminology()
  const { data, isLoading } = useQuery({
    queryKey: ['printRouting', venueId],
    queryFn: () => getRouting(venueId),
    enabled: !!venueId,
  })

  return (
    <FullScreenModal open onClose={onClose} title={t('stations.testTitle')} contentClassName="bg-muted/30">
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
          </div>
        ) : !data || data.products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('routing.empty', { menu: term('menu') })}</p>
        ) : (
          <RoutingSimulator venueId={venueId} products={data.products} stations={stations} />
        )}
      </div>
    </FullScreenModal>
  )
}
