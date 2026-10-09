import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Power, PowerOff } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import { useUpdateCommissionConfig } from '@/hooks/useCommissions'
import { useToast } from '@/hooks/use-toast'
import type { CommissionConfig } from '@/types/commission'

interface DesactivarEsquemaProps {
  config: Pick<CommissionConfig, 'id' | 'name' | 'active'>
  /** `icono` para la fila de la lista; `boton` para la ficha y el editor. */
  variante?: 'boton' | 'icono'
  /** Al terminar (p. ej. cerrar el editor). */
  onHecho?: () => void
}

/**
 * Desactivar (o reactivar) un esquema, con confirmación (ft-graves, B1). Desactivar es la salida para cambiar la tasa de un
 * esquema que ya calculó comisiones: deja de calcular desde ahora y lo ya calculado se queda igual. Manda sólo `active`.
 */
export default function DesactivarEsquema({ config, variante = 'boton', onHecho }: DesactivarEsquemaProps) {
  const { t } = useTranslation('commissions')
  const { toast } = useToast()
  const actualizar = useUpdateCommissionConfig()
  const [abierto, setAbierto] = useState(false)
  const enVuelo = useRef(false)
  const desactivar = config.active
  const prefijo = desactivar ? 'config.deactivate' : 'config.reactivate'

  const confirmar = async () => {
    if (enVuelo.current) return
    enVuelo.current = true
    try {
      await actualizar.mutateAsync({ configId: config.id, data: { active: !desactivar } })
      toast({ title: t(desactivar ? 'config.deactivated' : 'config.reactivated', { name: config.name }) })
      setAbierto(false)
      onHecho?.()
    } catch (error: any) {
      toast({
        title: t('errors.updateError'),
        description: error?.response?.data?.message || t('config.toggleError'),
        variant: 'destructive',
      })
    } finally {
      enVuelo.current = false
    }
  }

  const Icono = desactivar ? PowerOff : Power
  return (
    // Los clics del diálogo no deben llegar a la tarjeta, que navega a la ficha al hacer clic.
    <span onClick={e => e.stopPropagation()} className="contents">
      <PermissionGate permission="commissions:update">
        {variante === 'icono' ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            aria-label={t(prefijo)}
            title={t(prefijo)}
            onClick={() => setAbierto(true)}
          >
            <Icono className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className="cursor-pointer" onClick={() => setAbierto(true)}>
            <Icono className="mr-2 h-4 w-4" />
            {t(prefijo)}
          </Button>
        )}
      </PermissionGate>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${prefijo}Title`, { name: config.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t(`${prefijo}Desc`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actualizar.isPending}>{t('actions.cancel')}</AlertDialogCancel>
            <Button onClick={confirmar} disabled={actualizar.isPending} variant={desactivar ? 'destructive' : 'default'}>
              {actualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t(`${prefijo}Confirm`)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
