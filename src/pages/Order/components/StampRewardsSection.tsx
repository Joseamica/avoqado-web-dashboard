import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Gift, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { stampCardService } from '@/services/walletCard.service'
import { Currency } from '@/utils/currency'
import type { Order } from '@/types'

/**
 * Los premios de cartilla que este cliente ya ganó y todavía no cobra.
 *
 * 🔴 La sección sólo aparece cuando de verdad se puede canjear: cuenta con cliente,
 * sin pagar, y con al menos un premio. Enseñar un botón que el servidor va a rechazar
 * —porque la cuenta ya se cobró, por ejemplo— es peor que no enseñarlo: el cajero lo
 * intenta delante del cliente y queda explicando un error.
 */

interface Props {
  order: Order
}

export function StampRewardsSection({ order }: Props) {
  const { t } = useTranslation('loyalty')
  const { venueId } = useCurrentVenue()
  // Fecha en la zona del NEGOCIO, nunca la del navegador (regla del repo).
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const customerId = order.orderCustomers?.find(oc => oc.isPrimary)?.customerId ?? order.orderCustomers?.[0]?.customerId
  // Una cuenta ya cobrada no se puede modificar: el servidor lo rechaza y la pantalla
  // no debe prometer lo contrario.
  const cuentaAbierta = order.paymentStatus === 'PENDING'

  const { data, isLoading } = useQuery({
    queryKey: ['stamp-card', venueId, customerId],
    queryFn: () => stampCardService.getStatus(venueId!, customerId!),
    enabled: Boolean(venueId && customerId && cuentaAbierta),
  })

  const canjear = useMutation({
    mutationFn: (rewardId: string) => stampCardService.redeem(venueId!, rewardId, order.id),
    onSuccess: result => {
      // 🔴 La clave tiene que ser EXACTA: `['order', venueId, orderId]`, la misma que
      // usa `OrderDrawerContent`. Invalidar una clave que no existe NO da error, no
      // avisa, simplemente no hace nada — y el resultado es el peor posible: el
      // descuento se aplicó en el servidor pero el cajero sigue viendo el total
      // anterior y cobra de más. Se probó tocando el botón, no leyendo el código.
      queryClient.invalidateQueries({ queryKey: ['order', venueId, order.id] })
      queryClient.invalidateQueries({ queryKey: ['stamp-card', venueId, customerId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({
        title: t('card.redeem.done'),
        description: t('card.redeem.applied', { reward: result.rewardLabel, amount: Currency(result.discountAmount) }),
      })
    },
    onError: (error: any) => {
      // El mensaje del servidor es específico y está escrito para el mostrador
      // ("ya fue canjeado", "ya venció"): se muestra tal cual en vez de un genérico.
      toast({ variant: 'destructive', title: t('card.redeem.failed'), description: error?.response?.data?.message })
    },
  })

  const premios = data?.rewardsToClaim ?? []
  if (!customerId || !cuentaAbierta || isLoading || premios.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t('card.redeem.title', { count: premios.length })}</h2>
      </div>

      <div className="space-y-2">
        {premios.map(premio => (
          <div key={premio.id} className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{premio.rewardLabel}</p>
              {/*
                🔴 Se muestra CUÁNDO lo ganó, no de cuántos sellos era su cartilla. El
                número que trae el estado es el de la cartilla EN CURSO, no el de la
                que generó este premio — y decían cosas distintas: un premio ganado con
                una cartilla de 7 salía como "de 10 sellos" en cuanto el negocio cambió
                la regla. La fecha siempre es cierta, y además es lo que un cajero
                necesita para juzgar un premio muy viejo.
              */}
              <p className="mt-0.5 text-xs text-muted-foreground">{t('card.redeem.earnedOn', { date: formatDate(premio.createdAt) })}</p>
            </div>

            <PermissionGate permission="loyalty:redeem">
              <Button
                size="sm"
                className="shrink-0 cursor-pointer"
                disabled={canjear.isPending}
                onClick={() => canjear.mutate(premio.id)}
                data-tour="stamp-reward-redeem"
              >
                {canjear.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {t('card.redeem.action')}
              </Button>
            </PermissionGate>
          </div>
        ))}
      </div>
    </section>
  )
}
