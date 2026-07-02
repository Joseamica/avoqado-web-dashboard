/**
 * AggregatorDetailSheet — panel lateral que se abre al hacer click en una
 * card de agregador en `/superadmin/aggregators`. Muestra:
 *   - Metadata del agregador (nombre, IVA, status)
 *   - Lista de merchants asignados (con badge de status de revenue-share)
 *   - Botón "Configurar reparto" por merchant → abre RevenueShareEditDialog
 *   - Botón "Editar agregador" → abre el dialog existente (responsabilidad del padre)
 *
 * Sin acciones destructivas — eliminar/toggle quedan en la card original para
 * minimizar superficie. Aquí el foco es VER qué merchants usan este agregador
 * y configurar sus reparts.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Pencil, Settings2, Wallet, Building2, Info, RefreshCw } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { aggregatorAPI, type Aggregator } from '@/services/aggregator.service'
import { merchantRevenueShareAPI } from '@/services/merchantRevenueShare.service'
import type { AccountBalance } from '@/services/financialConnection.service'
import RevenueShareEditDialog from './RevenueShareEditDialog'

/**
 * Saldo bancario del merchant vía su FinancialAccount ligada (financial-connections).
 * Solo-lectura: el ligado lo hace el OWNER del venue al conectar su banco desde
 * Integraciones (self-connect); superadmin aquí sólo consulta el saldo en vivo
 * bajo demanda — cada consulta pega al banco real, por eso no se auto-fetchea.
 */
function MerchantBankBalance({ merchantId, hasLinkedAccount }: { merchantId: string; hasLinkedAccount: boolean }) {
  const { data, isFetching, refetch, isError } = useQuery({
    queryKey: ['superadmin-merchant-balance', merchantId],
    queryFn: async (): Promise<AccountBalance> => {
      const r = await api.get(`/api/v1/dashboard/superadmin/merchant-accounts/${merchantId}/balance`)
      return r.data.data
    },
    enabled: false, // saldo bajo demanda: cada consulta pega al banco real
    retry: false,
  })

  if (!hasLinkedAccount) {
    return <span className="text-xs text-muted-foreground">Sin banco conectado — el dueño lo conecta en Integraciones</span>
  }
  return (
    <div className="flex items-center gap-2">
      {data &&
        (data.state === 'OK' && data.amount != null ? (
          <span className="font-medium tabular-nums">{Currency(data.amount)}</span>
        ) : (
          <Badge variant="destructive">Sin saldo</Badge>
        ))}
      {isError && <Badge variant="destructive">Error</Badge>}
      <Button variant="ghost" size="icon" aria-label="Consultar saldo" disabled={isFetching} onClick={() => refetch()}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}

interface AggregatorDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aggregatorId: string | null
  /** Triggered by the "Editar agregador" button at the bottom of the sheet. */
  onEditAggregator: (agg: Aggregator) => void
}

export default function AggregatorDetailSheet({
  open,
  onOpenChange,
  aggregatorId,
  onEditAggregator,
}: AggregatorDetailSheetProps) {
  // Cargamos detalle completo del agregador (incluye lista de merchants y
  // venueCommissions). Solo fetcheamos cuando el sheet está abierto + hay id.
  const { data: aggregator, isLoading } = useQuery({
    queryKey: ['aggregator-detail', aggregatorId],
    queryFn: () => aggregatorAPI.getById(aggregatorId!),
    enabled: !!aggregatorId && open,
    staleTime: 30_000,
  })

  // Cargamos en bloque todos los revenue-shares activos para poder pintar el
  // badge de status por merchant sin N requests. Si hay muchos merchants
  // sería ideal un endpoint dedicado, pero por ahora N=3 a 10, está OK.
  const { data: allShares } = useQuery({
    queryKey: ['merchant-revenue-shares-all'],
    queryFn: () => merchantRevenueShareAPI.getAll(),
    enabled: open,
    staleTime: 30_000,
  })
  const shareByMerchant = new Map((allShares ?? []).map(s => [s.merchantAccountId, s]))

  // Click en un merchant del sheet → abre el dialog de edit de revenue-share.
  // Sheet se mantiene abierto detrás del dialog (overlay layering vía Radix).
  const [editingShare, setEditingShare] = useState<{
    merchantAccountId: string
    merchantLabel: string
  } | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="space-y-1.5">
          <SheetTitle className="text-xl">
            {isLoading ? <span className="text-muted-foreground">Cargando…</span> : aggregator?.name}
          </SheetTitle>
          <SheetDescription>
            Detalle del agregador y sus merchants asignados.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !aggregator ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No se encontró el agregador.</p>
        ) : (
          <div className="space-y-5 py-4">
            {/* Metadata block */}
            <div className="rounded-lg border border-input p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={aggregator.active ? 'default' : 'secondary'} className="text-[10px]">
                  {aggregator.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span className="font-mono">{(parseFloat(aggregator.ivaRate) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Merchants asignados</span>
                <span className="font-mono font-semibold">
                  {aggregator._count?.merchants ?? aggregator.merchants?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Comisiones por venue</span>
                <span className="font-mono">
                  {aggregator._count?.venueCommissions ?? aggregator.venueCommissions?.length ?? 0}
                </span>
              </div>
            </div>

            {/* Merchants list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Merchants asignados</h3>
              </div>
              {!aggregator.merchants || aggregator.merchants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
                  <Building2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>Aún no hay merchants asignados a este agregador.</p>
                  <p className="text-[11px] mt-1">
                    Asígnalo a un merchant desde el <strong>wizard de AngelPay (paso 6)</strong> o desde el
                    reporte de revenue-share en esta página.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {aggregator.merchants.map(m => {
                    const share = shareByMerchant.get(m.id)
                    return (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-input p-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {m.displayName || m.externalMerchantId}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              variant={m.active ? 'secondary' : 'outline'}
                              className="text-[10px]"
                            >
                              {m.active ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {share ? (
                              <Badge variant="default" className="text-[10px]">
                                {share.aggregatorPrice ? 'vía agregador' : 'directo'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]" title="Sin reparto configurado — 100% Avoqado">
                                sin reparto
                              </Badge>
                            )}
                          </div>
                          {m.financialAccount && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {m.financialAccount.connection.provider.name} · último saldo conocido:{' '}
                              <span className="tabular-nums">
                                {m.financialAccount.lastBalance != null ? Currency(m.financialAccount.lastBalance) : '—'}
                              </span>
                            </p>
                          )}
                          <div className="mt-1.5">
                            <MerchantBankBalance merchantId={m.id} hasLinkedAccount={!!m.financialAccount} />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-8"
                          onClick={() =>
                            setEditingShare({
                              merchantAccountId: m.id,
                              merchantLabel: m.displayName || m.externalMerchantId,
                            })
                          }
                        >
                          <Settings2 className="w-3.5 h-3.5 mr-1" />
                          {share ? 'Editar reparto' : 'Configurar'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tip — sólo cuando hay 0 merchants asignados (caso post-create). */}
            {(aggregator.merchants ?? []).length === 0 && (
              <div className="rounded-lg border border-input bg-muted/30 p-3 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 inline mr-1" />
                <strong>¿Cómo asigno este agregador a un merchant?</strong>
                <br />
                Al crear un nuevo merchant (botón <strong>+ Agregar AngelPay</strong> en{' '}
                <code>/superadmin/merchant-accounts</code>), en el <strong>paso 6 (Costo del procesador)</strong>{' '}
                vas a ver el dropdown <em>"Agregador"</em>. Selecciona este. El reparto Avoqado/agregador lo
                puedes capturar en el <strong>paso 9</strong> del mismo wizard, o después aquí mismo dándole
                click a la fila del merchant en el reporte de abajo.
              </div>
            )}

            {/* Footer actions */}
            <div className="flex justify-end pt-2">
              <Button onClick={() => onEditAggregator(aggregator)} variant="outline">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar agregador
              </Button>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Revenue-share edit dialog — se abre sobre el sheet vía portal Radix.
          La key fuerza un remount fresco por merchant para inicialización lazy. */}
      {editingShare && (
        <RevenueShareEditDialog
          key={editingShare.merchantAccountId}
          open
          onOpenChange={o => !o && setEditingShare(null)}
          merchantAccountId={editingShare.merchantAccountId}
          merchantLabel={editingShare.merchantLabel}
        />
      )}
    </Sheet>
  )
}
