import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { stampCardService, type StampCardStatus } from '@/services/walletCard.service'

/** Lo que el usuario veía al abrir el diálogo: el ajuste se amarra a esto, no a la consulta viva. */
type Foto = Pick<StampCardStatus, 'stampCardId' | 'stampsEarned' | 'stampsRequired' | 'version' | 'rewardLabel'> & { customerId: string }
/** Lo que viaja con cada Guardar: la apertura que lo mandó, su foto y lo que el usuario escribió para ella. */
type Envio = { openingId: number; foto: Foto; stampsEarned: number; reason: string }

/**
 * La cartilla de sellos del cliente y «Ajustar sellos» (a mano, para quien migró de otro sistema).
 * 🔴 La meta y el máximo salen de la CARTILLA (`stampsRequired` de la lectura), no de la configuración,
 * y los `expected*` viajan al servidor: si otro ajuste o una venta cambió los sellos mientras tanto,
 * el servidor contesta 409 y aquí se avisa en vez de pisar.
 * 🔴 Al abrir el diálogo se congela la FOTO (tarjeta + cliente + meta + premio): un refresco de la consulta o
 * cambiar de cliente nunca cambia a quién ni contra qué tarjeta se manda. Sólo el 409 PROPIO la reemplaza
 * entera, con aviso. Cada apertura tiene su número: la respuesta de una apertura anterior nunca toca la actual.
 * 🔴 `enabled` (sellos prendidos) no desmonta la sección: apagarlos en otra pestaña no borra un diálogo abierto,
 * lo explica y deja Guardar en gris.
 */
export function StampCardSection({ venueId, customerId, enabled = true }: { venueId: string; customerId: string; enabled?: boolean }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const queryKey = ['stamp-card', venueId, customerId]

  const [foto, setFoto] = useState<Foto | null>(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  // F4: el número de la apertura VIGENTE. Abrir, cancelar, cerrar o cambiar de cliente lo avanza, así que una respuesta
  // que vuelve con un número viejo ya no es de nadie: puede invalidar la caché, pero no toca el formulario.
  const apertura = useRef(0)
  // W1: un segundo envío en el MISMO instante llega antes de que `isPending` cambie; esto lo frena en el acto.
  const enviando = useRef(false)
  const cerrar = () => {
    apertura.current += 1
    setFoto(null)
  }

  // A → B → A no resucita el diálogo de A, aunque falte el `key={customerId}` del padre (que se queda como segunda capa).
  useEffect(() => {
    apertura.current += 1
    setFoto(null)
  }, [customerId])

  // Con los sellos apagados y sin diálogo no se pinta nada: tampoco se pide la cartilla.
  const { data: card } = useQuery({ queryKey, queryFn: () => stampCardService.getStatus(venueId, customerId), enabled })

  const adjust = useMutation({
    mutationFn: ({ foto: f, stampsEarned, reason: motivo }: Envio) =>
      stampCardService.adjust(venueId, f.customerId, {
        stampsEarned,
        expectedStampCardId: f.stampCardId,
        expectedStampsEarned: f.stampsEarned,
        expectedVersion: f.version,
        expectedStampsRequired: f.stampsRequired,
        reason: motivo,
      }),
    onSettled: () => {
      enviando.current = false
    },
    onSuccess: (_r, v) => {
      toast({ title: t('stamps.adjust.success') })
      queryClient.invalidateQueries({ queryKey: ['stamp-card', venueId, v.foto.customerId] })
      if (v.openingId === apertura.current) cerrar()
    },
    onError: (e: any, v) => {
      const data = e?.response?.data
      const cardKey = ['stamp-card', venueId, v.foto.customerId]
      const vigente = v.openingId === apertura.current
      if (data?.code === 'STAMPS_CHANGED') {
        toast({ title: t('stamps.adjust.changed', { n: data.details?.stampsEarned }), variant: 'destructive' })
        // El diálogo se queda abierto con la foto COMPLETA del aviso y el número nuevo en el campo: Guardar espera a que el
        // usuario escriba otro (un segundo clic con lo de antes podría llenar una tarjeta que no vio).
        const d = data.details
        if (d && vigente) {
          setFoto({
            customerId: v.foto.customerId,
            stampCardId: d.stampCardId,
            stampsEarned: d.stampsEarned,
            stampsRequired: d.stampsRequired,
            version: d.version,
            rewardLabel: d.rewardLabel,
          })
          setValue(String(d.stampsEarned))
        }
        queryClient.invalidateQueries({ queryKey: cardKey })
      } else if (data?.code === 'STAMPS_DISABLED') {
        toast({ title: t('stamps.adjust.disabled'), variant: 'destructive' })
        if (vigente) cerrar()
        queryClient.invalidateQueries({ queryKey: cardKey })
        // W2: la sección decide «apagado» con la configuración del padre: sin refrescarla seguía ofreciendo «Ajustar sellos».
        queryClient.invalidateQueries({ queryKey: ['loyalty-config', venueId] })
      } else {
        toast({ title: t('stamps.adjust.error'), description: data?.message, variant: 'destructive' })
      }
    },
  })

  // Sólo la foto de ESTE cliente abre el diálogo (además del `key={customerId}` del padre).
  const abierta = foto?.customerId === customerId ? foto : null
  if (!card || (!enabled && !abierta)) return null

  const target = value.trim() === '' ? NaN : Number(value)
  const valid = !!abierta && Number.isInteger(target) && target >= 0 && target <= abierta.stampsRequired && target !== abierta.stampsEarned
  const trimmedReason = reason.trim()
  const reasonOk = trimmedReason.length >= 5 && trimmedReason.length <= 500

  const openDialog = () => {
    const { stampCardId, stampsEarned, stampsRequired, version, rewardLabel } = card
    apertura.current += 1
    setFoto({ customerId, stampCardId, stampsEarned, stampsRequired, version, rewardLabel })
    setValue(String(stampsEarned))
    setReason('')
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div data-testid="stamps-summary" className="font-medium">
            {t('stamps.summary', { earned: card.stampsEarned, required: card.stampsRequired })}
          </div>
          {card.rewardsToClaim.length > 0 && (
            <div data-testid="stamps-rewards" className="text-sm text-muted-foreground">
              {t('stamps.rewards', { count: card.rewardsToClaim.length })}
            </div>
          )}
        </div>
        <PermissionGate permission="loyalty:adjust">
          <Button variant="outline" size="sm" onClick={openDialog} data-testid="stamps-adjust-open">
            {t('stamps.adjust.button')}
          </Button>
        </PermissionGate>
      </CardContent>

      {abierta && (
        <Dialog open onOpenChange={o => !o && cerrar()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('stamps.adjust.title')}</DialogTitle>
              <DialogDescription>{t('stamps.adjust.description')}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault()
                if (enabled && valid && reasonOk && !adjust.isPending && !enviando.current) {
                  enviando.current = true
                  adjust.mutate({ openingId: apertura.current, foto: abierta, stampsEarned: target, reason: trimmedReason })
                }
              }}
              className="space-y-4"
            >
              {/* «de N»: la foto contra la que se confirma (tras un 409 propio, la nueva). */}
              <div data-testid="stamps-adjust-foto" className="text-sm text-muted-foreground">
                {t('stamps.summary', { earned: abierta.stampsEarned, required: abierta.stampsRequired })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stamps-count">{t('stamps.adjust.fields.stamps')}</Label>
                <Input
                  id="stamps-count"
                  type="number"
                  min={0}
                  max={abierta.stampsRequired}
                  step={1}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stamps-reason">{t('stamps.adjust.fields.reason')}</Label>
                <Textarea
                  id="stamps-reason"
                  rows={3}
                  placeholder={t('stamps.adjust.placeholders.reason')}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
              {valid && (
                <div data-testid="stamps-adjust-preview" className="p-3 bg-muted rounded-lg text-center text-sm">
                  {target === abierta.stampsRequired
                    ? t('stamps.adjust.preview.complete', { rewardLabel: abierta.rewardLabel })
                    : t('stamps.adjust.preview.change', { from: abierta.stampsEarned, to: target })}
                </div>
              )}
              {!enabled && (
                <p data-testid="stamps-adjust-disabled" className="text-sm text-destructive">
                  {t('stamps.adjust.disabled')}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={cerrar}>
                  {t('stamps.adjust.cancel')}
                </Button>
                <Button type="submit" data-testid="stamps-adjust-save" disabled={!enabled || !valid || !reasonOk || adjust.isPending}>
                  {t('stamps.adjust.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

export default StampCardSection
