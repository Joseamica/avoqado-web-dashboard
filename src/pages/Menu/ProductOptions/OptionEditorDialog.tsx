import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { limpiarOpciones, validarOpciones } from '@/features/product-variants/combinations'
import { OptionValuesInput } from '@/features/product-variants/components/OptionValuesInput'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useToast } from '@/hooks/use-toast'
import { createLibraryOption, deleteLibraryOption, updateLibraryOption } from '@/services/productGroups.service'
import type { OptionLibraryListItem } from '@/types/productGroup'

interface Props {
  venueId: string
  /** null = opción nueva. */
  option: OptionLibraryListItem | null
  /** `menu:create`: es lo que pide el server para crear, editar y borrar plantillas. */
  puedeEscribir: boolean
  onClose: () => void
}

/**
 * Crear o editar una opción guardada («Talla: S, M, L»). Es sólo una plantilla: no toca ninguna familia ya creada.
 * 🔴 La lista trae máx. 100 valores por opción y el PUT del server REEMPLAZA todos: guardar una opción con más (`valuesTruncated`)
 * borraría en silencio los que no se ven. Esa opción se abre en sólo lectura (se puede borrar, nunca guardar).
 */
export function OptionEditorDialog({ venueId, option, puedeEscribir, onClose }: Props) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const invalidar = useInvalidarCatalogo()
  const [name, setName] = useState(option?.name ?? '')
  const [values, setValues] = useState<string[]>(() => option?.values.map(v => v.value) ?? [])
  const [intento, setIntento] = useState(false)
  const [confirmaBorrar, setConfirmaBorrar] = useState(false)
  // 🔴 «Truncada» también si el total es mayor que lo que trajo la lista, aunque la bandera no venga.
  const truncada = !!option && (option.valuesTruncated || option.valuesTotal > option.values.length)
  const soloLectura = truncada || !puedeEscribir

  const limpia = limpiarOpciones([{ name, values }])[0]
  const problema = validarOpciones([limpia], false)

  // Tras CUALQUIER escritura (también si falla) se vuelve a leer la lista: el primer intento de red pudo haberse aplicado.
  const guardar = useMutation({
    mutationFn: () => {
      const body = { name: limpia.name, values: limpia.values }
      return option ? updateLibraryOption(venueId, option.id, body) : createLibraryOption(venueId, body)
    },
    onSuccess: () => {
      toast({ title: t('biblioteca.guardada') })
      onClose()
    },
    onError: err => toast({ variant: 'destructive', title: t('biblioteca.errorGuardar'), description: mensajeDeVariantes(err, t) }),
    onSettled: () => invalidar(venueId),
  })

  const borrar = useMutation({
    mutationFn: () => deleteLibraryOption(venueId, option!.id),
    onSuccess: () => {
      toast({ title: t('biblioteca.borrada') })
      onClose()
    },
    onError: err => toast({ variant: 'destructive', title: t('biblioteca.errorBorrar'), description: mensajeDeVariantes(err, t) }),
    onSettled: () => invalidar(venueId),
  })

  const ocupado = guardar.isPending || borrar.isPending
  const enviar = () => {
    setIntento(true)
    if (problema || soloLectura) return
    guardar.mutate()
  }

  return (
    <>
      <FullScreenModal
        open
        onClose={onClose}
        title={t(!option ? 'biblioteca.nueva' : soloLectura ? 'biblioteca.ver' : 'biblioteca.editar')}
        contentClassName="bg-muted/30"
        actions={
          soloLectura ? undefined : (
            <Button type="button" className="h-12 px-6" disabled={ocupado} onClick={enviar} data-tour="product-options-save">
              {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('biblioteca.guardar')}
            </Button>
          )
        }
      >
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          <section className="space-y-6 rounded-2xl border border-border/50 bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="biblioteca-nombre">{t('biblioteca.nombre')}</Label>
              <Input
                id="biblioteca-nombre"
                className="h-12 text-base"
                maxLength={40}
                data-tour="product-options-name"
                value={name}
                disabled={soloLectura}
                placeholder={t('opciones.nombreEjemplo')}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2" data-tour="product-options-values">
              <p className="text-sm font-medium leading-none">{t('biblioteca.valores')}</p>
              <OptionValuesInput
                aria-label={t('biblioteca.valores')}
                values={values}
                disabled={soloLectura}
                placeholder={t('opciones.valoresEjemplo')}
                onChange={setValues}
              />
            </div>
            {truncada && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('biblioteca.truncada', { count: option!.valuesTotal })}
              </p>
            )}
            {!puedeEscribir && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('biblioteca.sinPermiso')}
              </p>
            )}
            {intento && problema && !soloLectura && (
              <p role="alert" className="text-sm text-destructive">
                {t(`validacion.${problema.code}`, problema)}
              </p>
            )}
          </section>

          {option && puedeEscribir && (
            <Button
              type="button"
              variant="outline"
              className="h-12 cursor-pointer text-destructive"
              disabled={ocupado}
              onClick={() => setConfirmaBorrar(true)}
              data-tour="product-options-delete"
            >
              {t('biblioteca.borrar')}
            </Button>
          )}
        </div>
      </FullScreenModal>

      <AlertDialog open={confirmaBorrar} onOpenChange={setConfirmaBorrar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('biblioteca.borrarTitulo')}</AlertDialogTitle>
            <AlertDialogDescription>{t('biblioteca.borrarConfirmar', { name: option?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('biblioteca.cancelar')}</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => borrar.mutate()}>{t('biblioteca.borrar')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
