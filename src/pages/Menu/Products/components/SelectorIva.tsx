/* eslint-disable react-refresh/only-export-components -- el selector, su aviso y sus ayudantes (tipo, 409, consulta) viajan juntos */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getIvaPorProducto, IVA_QUERY_KEY, type BloqueoIva } from '@/services/menu.service'

export type TratamientoElegible = 'IVA_16' | 'IVA_0' | 'EXENTO'
const OPCIONES: TratamientoElegible[] = ['IVA_16', 'IVA_0', 'EXENTO'] // sin 8 % (spec §3)
const esElegible = (v: unknown): v is TratamientoElegible => OPCIONES.includes(v as TratamientoElegible)

/** Los bloqueos del 409 IVA_ENCENDIDO_BLOQUEADO (Tarea 6 del servidor); cualquier otro error ⇒ undefined. */
export function bloqueosDelError(error: unknown): BloqueoIva[] | undefined {
  const data = (error as { response?: { data?: { code?: string; details?: { bloqueos?: BloqueoIva[] } } } })?.response?.data
  return data?.code === 'IVA_ENCENDIDO_BLOQUEADO' ? data.details?.bloqueos : undefined
}

/** 409 IVA_ENCENDIDO_OCUPADO (revisión final del 6b, I-1): hay facturas o ventas en proceso; es una espera, no una falla (nunca en rojo). */
export function esperaDelIva(error: unknown): boolean {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code === 'IVA_ENCENDIDO_OCUPADO'
}

/** El estado del IVA por producto del negocio: UNA sola consulta (misma clave) para el selector y para el aviso del primer encendido. */
export function useEstadoIva(venueId: string | null | undefined) {
  return useQuery({
    queryKey: IVA_QUERY_KEY(venueId!),
    queryFn: () => getIvaPorProducto(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
  })
}

/**
 * IVA por producto (plan 6b, spec D1): junto al precio, todos los planes. El precio no cambia. Deshabilitado con su motivo si el producto
 * tuvo un ajuste de Uber (regla C) o la organización lleva contabilidad. Un producto BLOQUEADO se muestra «Por revisar».
 */
export function SelectorIva(props: {
  venueId: string
  actual: string | null | undefined
  ajusteDeliveryAlgunaVez?: boolean
  value: TratamientoElegible | undefined
  onChange: (v: TratamientoElegible) => void
  bloqueos?: BloqueoIva[]
  /** Del contenedor (por defecto `max-w-96`) y del selector (por defecto `h-9`): el asistente los iguala a los campos de su formulario. */
  className?: string
  triggerClassName?: string
  /** Bloquea el selector desde fuera (un `<fieldset disabled>` no bloquea el Select de Radix, radix-ui/primitives#2417). */
  disabled?: boolean
}) {
  const { t } = useTranslation('menu')
  const estado = useEstadoIva(props.venueId)
  const motivo = props.ajusteDeliveryAlgunaVez
    ? t('iva.deshabilitado.delivery')
    : estado.data?.contabilidad
      ? t('iva.deshabilitado.contabilidad')
      : null
  const elegido = props.value ?? (esElegible(props.actual) ? props.actual : undefined)
  return (
    <div className={cn('max-w-96 space-y-2', props.className)}>
      <Label htmlFor="iva-del-producto">{t('iva.label')}</Label>
      {/* value '' (no undefined): el Select no cambia de no controlado a controlado y muestra «Por revisar». */}
      <Select value={elegido ?? ''} onValueChange={v => props.onChange(v as TratamientoElegible)} disabled={!!motivo || !!props.disabled}>
        <SelectTrigger id="iva-del-producto" aria-label={t('iva.label')} className={props.triggerClassName}>
          <SelectValue placeholder={t('iva.porRevisar')} />
        </SelectTrigger>
        <SelectContent>
          {OPCIONES.map(o => (
            <SelectItem key={o} value={o}>
              {t(`iva.opciones.${o}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{motivo ?? t('iva.ayuda')}</p>
      {props.bloqueos?.length ? (
        // Ámbar, nunca rojo: no es una falla, es lo que falta resolver para poder encender.
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <p className="font-medium">{t('iva.bloqueos.titulo')}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {props.bloqueos.map((b, i) => (
              <li key={`${b.codigo}-${i}`}>
                {b.mensaje}. <span className="opacity-80">{b.comoArreglar}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Aviso del PRIMER encendido (decisión del founder, 12-oct): sólo «Continuar» deja que el guardado siga. */
export function ConfirmarEncendidoIva(props: { open: boolean; onContinuar: () => void; onCancelar: () => void }) {
  const { t } = useTranslation('menu')
  return (
    <AlertDialog open={props.open} onOpenChange={open => !open && props.onCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('iva.confirmar.titulo')}</AlertDialogTitle>
          <AlertDialogDescription>{t('iva.confirmar.cuerpo')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('iva.confirmar.cancelar')}</AlertDialogCancel>
          <AlertDialogAction onClick={props.onContinuar}>{t('iva.confirmar.continuar')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
