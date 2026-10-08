import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useSetTips } from '@/hooks/useStaffPay'
import { useFocoDeVuelta } from '../foco'
import { mensajeLegible } from '../rangos'

/**
 * «Pagar las propinas en el recibo» (decisión D2, spec §7.1, §11): apagado de fábrica. Cada cambio se confirma diciendo
 * qué pasa con lo de antes, porque mueve dinero: prender no barre propinas anteriores; apagar no quita las que ya
 * ganaron el derecho a entrar. Sin `staffpay:close` se ve, no se mueve, y dice por qué. El interruptor sólo cambia cuando
 * el servidor contesta (sale de `GET /access`, que la mutación refresca): sin red, no cambia y el aviso lo dice.
 * Es de TODA la organización (E6a-fix2 C2): con el permiso aquí pero no en todas las sedes (`puedeEnLaOrganizacion`, de
 * `GET /access`), tampoco se mueve y dice qué falta; sin el dato (servidor viejo), como antes.
 */
export function InterruptorPropinas({ encendidas, puedeEnLaOrganizacion = true }: { encendidas: boolean; puedeEnLaOrganizacion?: boolean }) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { toast } = useToast()
  const cambiar = useSetTips()
  const foco = useFocoDeVuelta()
  const [pedido, setPedido] = useState<boolean | null>(null)
  // Candado síncrono (E6a-fix F12, hermano de «Activar»): `isPending` no alcanza a cambiar entre dos clics seguidos.
  const enVuelo = useRef(false)
  const aqui = can('staffpay:close')
  const puede = aqui && puedeEnLaOrganizacion

  const confirmar = async () => {
    if (pedido === null || enVuelo.current) return
    enVuelo.current = true
    try {
      const r = await cambiar.mutateAsync(pedido)
      toast({ title: t(r.encendidas ? 'tips.turnedOn' : 'tips.turnedOff') })
    } catch (err) {
      toast({ title: mensajeLegible(err) ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      enVuelo.current = false
      setPedido(null)
    }
  }

  return (
    <div className="w-full space-y-1.5 sm:w-auto sm:max-w-sm" data-tour="staffpay-tips">
      <div className="flex items-center gap-3">
        <Switch
          id="staffpay-propinas"
          checked={encendidas}
          disabled={!puede || cambiar.isPending}
          onCheckedChange={v => setPedido(v)}
          className="cursor-pointer"
        />
        <Label htmlFor="staffpay-propinas" className={puede ? 'cursor-pointer' : undefined}>
          {t('tips.label')}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{puede ? t('tips.help') : aqui ? t('orgPermission') : t('tips.noPermission')}</p>
      <AlertDialog open={pedido !== null} onOpenChange={o => !o && !cambiar.isPending && setPedido(null)}>
        <AlertDialogContent onOpenAutoFocus={foco.onOpenAutoFocus} onCloseAutoFocus={foco.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(pedido ? 'tips.onTitle' : 'tips.offTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t(pedido ? 'tips.onHelp' : 'tips.offHelp')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={cambiar.isPending}>
              {t('closed.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={cambiar.isPending}
              onClick={e => {
                e.preventDefault()
                void confirmar()
              }}
            >
              {cambiar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t(pedido ? 'tips.onConfirm' : 'tips.offConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
