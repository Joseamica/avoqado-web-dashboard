import { useMutation } from '@tanstack/react-query'
import { Archive, ImageOff, ImagePlus, Loader2, MoreHorizontal, Unlink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useErrorDeEscritura } from '@/features/product-variants/useErrorDeEscritura'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { deleteProduct } from '@/services/menu.service'
import { detachVariant, setVariantImage } from '@/services/productGroups.service'
import type { ProductGroupDetail, ProductGroupVariant } from '@/types/productGroup'
import { ConfirmarAccion } from './FamilyActions'

type Accion = { tipo: 'separar' } | { tipo: 'archivar' } | { tipo: 'foto'; url: string | null }
type Confirmable = 'separar' | 'archivar'

interface Props {
  venueId: string
  familia: ProductGroupDetail
  variante: ProductGroupVariant
  disabled: boolean
}

/**
 * El «⋯» de cada variante. Foto propia: menu:update + plan. Separar: menu:update; archivar: menu:delete (el DELETE de producto de
 * siempre); ninguna de las dos lleva candado. Sin «Ajustar existencias» (P15: el ajuste de hoy no resiste el reintento de api.ts).
 * Si era la última viva, el server archiva la familia: la invalidación relee el detalle y el diálogo pasa a «archivado».
 * ponytail: cada renglón trae sus hooks (mutación, cargador, permisos); con el tope de 250 vivas es barato. Si la tabla crece o se
 * siente lenta, subir mutación + aviso + recorte a la tabla y dejar aquí sólo el menú.
 */
export function VariantRowActions({ venueId, familia, variante, disabled }: Props) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const { venueSlug } = useCurrentVenue()
  const { can } = useAccess()
  const acceso = useTierFeatureAccess('PRODUCT_VARIANTS')
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const [pedido, setPedido] = useState<Confirmable>('separar')
  const [abierto, setAbierto] = useState(false)
  const enviando = useRef(false)
  const conPlan = acceso.hasAccess && acceso.isResolved
  const puedeEditar = can('menu:update')
  const puedeArchivar = can('menu:delete')
  // El mismo cargador (recorte + Firebase), la misma carpeta y los mismos mínimos que el asistente y el padre.
  const subida = useImageUploader(`venues/${venueSlug}/productos`, variante.name, { minWidth: 320, minHeight: 320 })

  const accion = useMutation({
    mutationFn: async (a: Accion) => {
      if (a.tipo === 'separar') await detachVariant(venueId, familia.id, variante.id)
      else if (a.tipo === 'archivar') await deleteProduct(venueId, variante.id)
      else await setVariantImage(venueId, familia.id, variante.id, a.url)
    },
    onSuccess: async () => {
      await invalidar(venueId)
      toast({ title: t('accionesVariante.hecho') })
    },
    onError: alFallar(t('accionesVariante.noHecho')),
    onSettled: () => {
      enviando.current = false
    },
  })
  const { mutate } = accion
  const hacer = (a: Accion) => {
    if (enviando.current) return
    enviando.current = true
    mutate(a)
  }
  // La foto recién subida se guarda como foto propia de la variante (la URL cambia en cada subida: corre una vez por foto).
  useEffect(() => {
    if (!subida.imageUrl) return
    enviando.current = true
    mutate({ tipo: 'foto', url: subida.imageUrl })
  }, [subida.imageUrl, mutate])

  const elegirFoto = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) subida.handleFileUpload(file)
    }
    input.click()
  }
  const pedir = (a: Confirmable) => {
    setPedido(a)
    setAbierto(true)
  }

  if (!puedeEditar && !puedeArchivar) return null
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            aria-label={t('accionesVariante.abrir', { name: variante.name })}
            disabled={disabled || accion.isPending || subida.uploading}
            data-tour="product-group-variant-actions"
          >
            {accion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {puedeEditar && (
            <>
              <DropdownMenuItem className="cursor-pointer" disabled={!conPlan} onClick={elegirFoto} data-tour="product-group-variant-photo">
                <ImagePlus className="mr-2 h-4 w-4" />
                {t('accionesVariante.foto')}
              </DropdownMenuItem>
              {variante.variantImageUrl && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={!conPlan}
                  onClick={() => hacer({ tipo: 'foto', url: null })}
                  data-tour="product-group-variant-remove-photo"
                >
                  <ImageOff className="mr-2 h-4 w-4" />
                  {t('accionesVariante.quitarFoto')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="cursor-pointer" onClick={() => pedir('separar')} data-tour="product-group-variant-detach">
                <Unlink className="mr-2 h-4 w-4" />
                {t('accionesVariante.separar')}
              </DropdownMenuItem>
            </>
          )}
          {puedeArchivar && (
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => pedir('archivar')}
              data-tour="product-group-variant-archive"
            >
              <Archive className="mr-2 h-4 w-4" />
              {t('accionesVariante.archivar')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmarAccion
        open={abierto}
        onOpenChange={setAbierto}
        titulo={t(`accionesVariante.${pedido}`)}
        texto={t(`accionesVariante.${pedido}Confirmar`, { name: variante.name })}
        destructiva={pedido === 'archivar'}
        tour="product-group-variant-action"
        onConfirmar={() => hacer({ tipo: pedido })}
      />

      {/* Recorte de la foto: mientras sube, no se cierra (la subida terminaría y se guardaría igual). */}
      <FullScreenModal
        open={!!subida.imageForCrop}
        onClose={() => {
          if (!subida.uploading) subida.setImageForCrop(null)
        }}
        title={t('accionesVariante.fotoTitulo', { name: variante.name })}
        contentClassName="bg-muted/30"
        actions={
          <Button onClick={() => void subida.handleCropConfirm()} disabled={subida.uploading} data-tour="product-group-variant-photo-confirm">
            {subida.uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('accionesVariante.confirmar')}
          </Button>
        }
      >
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <div className="relative h-96 w-full overflow-hidden rounded-2xl bg-muted">
            <Cropper
              image={subida.imageForCrop ?? undefined}
              crop={subida.crop}
              zoom={subida.zoom}
              maxZoom={2}
              aspect={4 / 3}
              onCropChange={subida.setCrop}
              onZoomChange={subida.setZoom}
              onCropComplete={subida.onCropComplete}
            />
          </div>
        </div>
      </FullScreenModal>
    </>
  )
}
