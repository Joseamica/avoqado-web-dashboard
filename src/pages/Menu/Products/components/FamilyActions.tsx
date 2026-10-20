import { useMutation } from '@tanstack/react-query'
import { Archive, MoreHorizontal, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useErrorDeEscritura } from '@/features/product-variants/useErrorDeEscritura'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { archiveProductGroup, ungroupProductGroup } from '@/services/productGroups.service'
import type { ProductGroupDetail } from '@/types/productGroup'

/** La confirmación de una acción que reduce (familia o variante). El texto no cambia mientras el aviso se cierra. */
export function ConfirmarAccion(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  texto: string
  destructiva?: boolean
  onConfirmar: () => void
  /** Prefijo de `data-tour` de sus dos botones (`-cancel` / `-confirm`). */
  tour: string
}) {
  const { t } = useTranslation('variants')
  return (
    <AlertDialog open={p.open} onOpenChange={p.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{p.texto}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-tour={`${p.tour}-cancel`}>{t('accionesVariante.cancelar')}</AlertDialogCancel>
          <AlertDialogAction
            className={p.destructiva ? buttonVariants({ variant: 'destructive' }) : undefined}
            onClick={p.onConfirmar}
            data-tour={`${p.tour}-confirm`}
          >
            {t('accionesVariante.confirmar')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type AccionDeFamilia = 'deshacer' | 'archivar'

/**
 * «Más acciones» del encabezado: deshacer la familia (menu:update) o archivarla completa (menu:delete). Reducir no lleva candado de
 * plan: un negocio que bajó a Gratis siempre puede limpiar. Al terminar cierra el diálogo (`onDone`).
 */
export function FamilyActions({ venueId, familia, onDone }: { venueId: string; familia: ProductGroupDetail; onDone: () => void }) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const { can } = useAccess()
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const [pedido, setPedido] = useState<AccionDeFamilia>('deshacer')
  const [abierto, setAbierto] = useState(false)
  const enviando = useRef(false)
  const puedeDeshacer = can('menu:update')
  const puedeArchivar = can('menu:delete')

  const accion = useMutation({
    mutationFn: (a: AccionDeFamilia) => (a === 'deshacer' ? ungroupProductGroup(venueId, familia.id) : archiveProductGroup(venueId, familia.id)),
    onSuccess: async () => {
      await invalidar(venueId)
      toast({ title: t('accionesFamilia.hecho') })
      onDone()
    },
    onError: alFallar(t('accionesFamilia.noHecho')),
    onSettled: () => {
      enviando.current = false
    },
  })
  const pedir = (a: AccionDeFamilia) => {
    setPedido(a)
    setAbierto(true)
  }

  if (!puedeDeshacer && !puedeArchivar) return null
  const datos = { count: familia.variants.length, name: familia.name }
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {/* En un celular sólo el ícono: con el texto tapaba el final del título (QA BAJO-1). */}
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={accion.isPending}
            aria-label={t('accionesFamilia.mas')}
            data-tour="product-group-more-actions"
          >
            <MoreHorizontal className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('accionesFamilia.mas')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {puedeDeshacer && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => pedir('deshacer')} data-tour="product-group-ungroup">
              <Undo2 className="mr-2 h-4 w-4" />
              {t('accionesFamilia.deshacer')}
            </DropdownMenuItem>
          )}
          {puedeArchivar && (
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => pedir('archivar')} data-tour="product-group-archive">
              <Archive className="mr-2 h-4 w-4" />
              {t('accionesFamilia.archivar')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmarAccion
        open={abierto}
        onOpenChange={setAbierto}
        titulo={t(`accionesFamilia.${pedido}`)}
        texto={t(`accionesFamilia.${pedido}Confirmar`, datos)}
        destructiva={pedido === 'archivar'}
        tour="product-group-family-action"
        onConfirmar={() => {
          if (enviando.current) return
          enviando.current = true
          accion.mutate(pedido)
        }}
      />
    </>
  )
}
