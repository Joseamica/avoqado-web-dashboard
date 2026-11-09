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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { desvincularCelularDeCampo, type FilaDePromotor } from '@/services/celularesDeCampo.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mensajeDelServidor, useUnaALaVez } from '../ayudantes'

interface DesvincularDialogProps {
  orgId: string
  fila: FilaDePromotor | null
  onClose: () => void
}

export function DesvincularDialog({ orgId, fila, onClose }: DesvincularDialogProps) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const unaALaVez = useUnaALaVez()
  const [perdido, setPerdido] = useState(false)

  const mutation = useMutation({
    mutationFn: (celularId: string) => desvincularCelularDeCampo(orgId, celularId, { perdidoORobado: perdido }),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['celulares-de-campo', orgId] })
      toast({
        title: res.yaEstaba
          ? t('celulares.desvincular.yaEstaba', { defaultValue: 'Ese celular ya estaba desvinculado' })
          : t('celulares.desvincular.hecho', { defaultValue: 'Celular desvinculado' }),
      })
      setPerdido(false)
      onClose()
    },
    onError: err => {
      toast({
        variant: 'destructive',
        title: t('celulares.desvincular.error', { defaultValue: 'No se pudo desvincular' }),
        description: mensajeDelServidor(err),
      })
    },
  })

  const celularId = fila?.celular?.id

  return (
    <AlertDialog
      open={!!fila}
      onOpenChange={open => {
        if (open || mutation.isPending) return
        setPerdido(false)
        onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('celulares.desvincular.titulo', { defaultValue: 'Desvincular celular' })}</AlertDialogTitle>
          <AlertDialogDescription>
            {perdido
              ? t('celulares.desvincular.descripcionPerdidoIntro', {
                  nombre: fila?.nombre ?? '',
                  defaultValue: '¿Desvincular el celular de {{nombre}}? El celular deja de vender y checar en este momento.',
                })
              : t('celulares.desvincular.descripcion', {
                  nombre: fila?.nombre ?? '',
                  n: fila?.celular?.porSubir ?? 0,
                  defaultValue:
                    '¿Desvincular el celular de {{nombre}}? El celular deja de vender y checar en este momento. Lo que tenga por subir ({{n}}) se acepta durante 24 horas; lo demás queda en «Por revisar».',
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={perdido} disabled={mutation.isPending} onCheckedChange={v => setPerdido(v === true)} />
          <span>
            {t('celulares.desvincular.perdido', { defaultValue: 'Lo perdió o se lo robaron (no se acepta nada solo)' })}
            {perdido && (
              <span className="mt-1 block text-muted-foreground">
                {t('celulares.desvincular.descripcionPerdido', {
                  defaultValue: 'Todo lo que llegue de ese celular queda en «Por revisar».',
                })}
              </span>
            )}
          </span>
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{t('celulares.cancelar', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!celularId || mutation.isPending}
            onClick={e => {
              // Se cierra al terminar, no al tocar: si falla, la confirmación sigue a la vista.
              e.preventDefault()
              if (celularId) void unaALaVez(() => mutation.mutateAsync(celularId))
            }}
          >
            {t('celulares.acciones.desvincular', { defaultValue: 'Desvincular' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
