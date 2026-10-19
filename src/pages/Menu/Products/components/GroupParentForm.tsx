import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper from 'react-easy-crop'
import { useTranslation } from 'react-i18next'
import { PrintStationField } from '@/components/PrintStationField'
import { SatKeyPicker } from '@/components/SatKeyPicker'
import { SearchCombobox } from '@/components/search-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { mensajeDeVariantes } from '@/features/product-variants/errors'
import { cambiosDelPadre, estadoDelPadre, type EstadoPadre } from '@/features/product-variants/familyEdits'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useMasterCatalogError } from '@/features/master-catalog/use-master-catalog-error'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import { ConfirmarEncendidoIva, SelectorIva, bloqueosDelError, esperaDelIva, useEstadoIva } from '@/pages/Menu/Products/components/SelectorIva'
import { getMenuCategories, getModifierGroups, IVA_QUERY_KEY, type BloqueoIva } from '@/services/menu.service'
import { updateProductGroup } from '@/services/productGroups.service'
import type { ProductGroupDetail } from '@/types/productGroup'

/** Error ≠ vacío: una lista que no cargó lo dice y deja reintentar (regla de datos acotados). */
function ErrorDeLista({ texto, reintentar }: { texto: string; reintentar: () => void }) {
  const { t } = useTranslation('variants')
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input p-3">
      <p className="text-sm text-destructive">{texto}</p>
      <Button type="button" variant="outline" size="sm" onClick={reintentar}>
        {t('familia.reintentar')}
      </Button>
    </div>
  )
}

/**
 * Los datos compartidos de la familia: lo que se cambie aquí, el server lo copia a TODAS las variantes. `onCambios` avisa al diálogo si
 * queda algo sin guardar (para preguntar antes de cerrar). Una familia archivada se ve sin botones: es de sólo lectura.
 */
export function GroupParentForm({
  venueId,
  familia,
  disabled,
  onCambios,
}: {
  venueId: string
  familia: ProductGroupDetail
  disabled: boolean
  onCambios?: (sucio: boolean) => void
}) {
  const { t } = useTranslation('variants')
  const { t: tInv } = useTranslation('inventory')
  const { t: tCfdi } = useTranslation('cfdi')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { venue, venueSlug } = useCurrentVenue()
  const handleMasterCatalogError = useMasterCatalogError(venue?.organizationId)
  const invalidar = useInvalidarCatalogo()
  const { hasAccess: hasCfdi } = useTierFeatureAccess('CFDI')
  const queryClient = useQueryClient()
  const [e, setE] = useState<EstadoPadre>(() => estadoDelPadre(familia))
  const [tocados, setTocados] = useState<Set<keyof EstadoPadre>>(() => new Set())
  const [avisoIva, setAvisoIva] = useState(false)
  const [bloqueosIva, setBloqueosIva] = useState<BloqueoIva[] | undefined>()
  const [buscaCategoria, setBuscaCategoria] = useState('')
  const [buscaExtra, setBuscaExtra] = useState('')
  const estadoIva = useEstadoIva(venueId)
  // Codex N1: un detalle nuevo (socket, otra persona, el propio guardado) actualiza los campos que el dueño NO tocó y conserva los que sí.
  // Así un cambio ajeno nunca se toma por edición propia ni se revierte al guardar.
  useEffect(() => {
    const nuevo = estadoDelPadre(familia)
    setE(prev => {
      const r: EstadoPadre = { ...nuevo }
      for (const k of tocados) Object.assign(r, { [k]: prev[k] })
      return r
    })
  }, [familia, tocados])
  const poner = useCallback(<K extends keyof EstadoPadre>(k: K, v: EstadoPadre[K]) => {
    setTocados(prev => (prev.has(k) ? prev : new Set(prev).add(k)))
    setE(prev => ({ ...prev, [k]: v }))
  }, [])
  const cambios = useMemo(() => cambiosDelPadre(familia, e, hasCfdi), [familia, e, hasCfdi])
  const hayCambios = Object.keys(cambios).length > 0
  useEffect(() => {
    onCambios?.(hayCambios)
    return () => onCambios?.(false)
  }, [hayCambios, onCambios])
  // 6b (Codex A2): pasar a 0 % o exento con el IVA por producto todavía apagado pide el mismo aviso que el asistente.
  const pideAvisoIva = !!cambios.ivaTratamiento && cambios.ivaTratamiento !== 'IVA_16' && estadoIva.data?.encendido !== true
  const categorias = useQuery({ queryKey: ['menu-categories', venueId], queryFn: () => getMenuCategories(venueId), staleTime: 30_000 })
  const extras = useQuery({ queryKey: ['modifier-groups', venueId], queryFn: () => getModifierGroups(venueId), staleTime: 30_000 })

  // Foto: el mismo cargador (recorte + Firebase) y la misma carpeta que el asistente de producto.
  const subida = useImageUploader(`venues/${venueSlug}/productos`, e.name.trim() || familia.name, { minWidth: 320, minHeight: 320 })
  useEffect(() => {
    if (subida.imageUrl) poner('imageUrl', subida.imageUrl)
  }, [subida.imageUrl, poner])
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

  const guardar = useMutation({
    mutationFn: () => updateProductGroup(venueId, familia.id, cambios),
    onSuccess: async () => {
      setBloqueosIva(undefined)
      await Promise.all([invalidar(venueId), queryClient.invalidateQueries({ queryKey: IVA_QUERY_KEY(venueId) })])
      setTocados(new Set()) // DESPUÉS del refetch: el formulario adopta el detalle ya guardado, sin parpadeo al valor viejo
      toast({ title: t('padre.guardado', { count: familia.variants.length }) })
    },
    onError: error => {
      void invalidar(venueId)
      if (handleMasterCatalogError(error)) return
      // Igual que la ficha de producto (6b): los bloqueos del IVA se listan junto al selector y no van en rojo; una espera tampoco.
      const bloqueos = bloqueosDelError(error)
      setBloqueosIva(bloqueos)
      toast({
        variant: bloqueos || esperaDelIva(error) ? 'default' : 'destructive',
        title: t('padre.noGuardado'),
        description: bloqueos ? t('menu:iva.bloqueos.toast') : mensajeDeVariantes(error, t),
      })
    },
  })
  const pedirGuardar = () => (pideAvisoIva ? setAvisoIva(true) : guardar.mutate())
  const bloqueado = disabled || guardar.isPending // Codex R2: nada se teclea mientras se guarda
  const subiendoFoto = subida.uploading || !!subida.imageForCrop

  const opcionesCategoria = useMemo(
    () =>
      (categorias.data ?? [])
        .filter(c => !buscaCategoria.trim() || includesNormalized(c.name ?? '', buscaCategoria))
        .map(c => ({ id: c.id, label: c.name })),
    [categorias.data, buscaCategoria],
  )
  const nombreCategoria = categorias.data?.find(c => c.id === e.categoryId)?.name ?? ''
  const opcionesExtras = useMemo(
    () =>
      (extras.data ?? [])
        .filter(g => !e.modifierGroupIds.includes(g.id))
        .filter(g => !buscaExtra.trim() || includesNormalized(g.name ?? '', buscaExtra))
        .map(g => ({ id: g.id, label: g.name })),
    [extras.data, e.modifierGroupIds, buscaExtra],
  )

  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6" data-tour="product-group-parent">
      <ConfirmarEncendidoIva
        open={avisoIva}
        onCancelar={() => setAvisoIva(false)}
        onContinuar={() => {
          setAvisoIva(false)
          guardar.mutate()
        }}
      />
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{t('padre.titulo')}</h3>
        {!familia.archived && <p className="text-sm text-muted-foreground">{t('padre.ayuda', { count: familia.variants.length })}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="familia-nombre">{t('padre.nombre')}</Label>
            <Input
              id="familia-nombre"
              data-tour="product-group-name"
              className="h-12 bg-transparent text-base"
              maxLength={120}
              value={e.name}
              disabled={bloqueado}
              onChange={ev => poner('name', ev.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="familia-descripcion">{t('padre.descripcion')}</Label>
            <Textarea
              id="familia-descripcion"
              data-tour="product-group-description"
              className="bg-transparent text-base"
              maxLength={2000}
              value={e.description}
              disabled={bloqueado}
              onChange={ev => poner('description', ev.target.value)}
            />
          </div>

          {/* Foto (copiada del asistente). «Quitar» sólo la suelta: NO se borra del almacenamiento, porque puede ser la que ya
              usan las variantes guardadas (y «Descartar» la devuelve). */}
          <div className="space-y-2" data-tour="product-group-image">
            <Label>{tInv('wizard.step1.imageUrl')}</Label>
            {subida.imageForCrop ? (
              <div className="space-y-4">
                <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted">
                  <Cropper
                    image={subida.imageForCrop}
                    crop={subida.crop}
                    zoom={subida.zoom}
                    maxZoom={2}
                    aspect={4 / 3}
                    onCropChange={subida.setCrop}
                    onZoomChange={subida.setZoom}
                    onCropComplete={subida.onCropComplete}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" type="button" onClick={() => subida.setImageForCrop(null)} disabled={subida.uploading}>
                    {tCommon('cancel')}
                  </Button>
                  <Button type="button" onClick={() => void subida.handleCropConfirm()} disabled={subida.uploading}>
                    {subida.uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tInv('wizard.step1.confirm')}
                  </Button>
                </div>
              </div>
            ) : e.imageUrl ? (
              <div className="space-y-2">
                <div className="aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl border border-border/50 bg-muted">
                  <img src={e.imageUrl} alt={tInv('wizard.step1.imageUrl')} className="h-full w-full object-cover" />
                </div>
                {!bloqueado && (
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" size="sm" onClick={elegirFoto}>
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {tInv('wizard.step1.replace')}
                    </Button>
                    <Button variant="ghost" type="button" size="sm" onClick={() => poner('imageUrl', null)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {tInv('wizard.step1.delete')}
                    </Button>
                  </div>
                )}
              </div>
            ) : bloqueado ? (
              <p className="text-sm text-muted-foreground">{t('padre.sinFoto')}</p>
            ) : (
              <button
                type="button"
                onClick={elegirFoto}
                className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50"
              >
                <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{tInv('wizard.step1.dropImage')}</span>
                <span className="mt-1 text-xs text-primary">{tInv('wizard.step1.browseFile')}</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2" data-tour="product-group-category">
            <Label htmlFor="familia-categoria">{tInv('wizard.step1.category')}</Label>
            {categorias.isError && !categorias.data ? (
              <ErrorDeLista texto={t('padre.errorCategorias')} reintentar={() => void categorias.refetch()} />
            ) : (
              /* La categoría se cambia, nunca se vacía: borrar el texto sólo vuelve a mostrar la elegida. */
              <SearchCombobox
                inputId="familia-categoria"
                items={opcionesCategoria}
                value={buscaCategoria || nombreCategoria}
                onChange={setBuscaCategoria}
                onSelect={item => {
                  poner('categoryId', item.id)
                  setBuscaCategoria('')
                }}
                placeholder={tInv('wizard.step1.categoryPlaceholder')}
                isLoading={categorias.isLoading}
                disabled={bloqueado}
              />
            )}
          </div>

          <div className="space-y-2" data-tour="product-group-modifiers">
            <Label htmlFor="familia-extras">{tInv('wizard.step1.modifierGroups')}</Label>
            {extras.isError && !extras.data ? (
              <ErrorDeLista texto={t('padre.errorExtras')} reintentar={() => void extras.refetch()} />
            ) : extras.isLoading || (extras.data ?? []).length > 0 ? (
              <SearchCombobox
                inputId="familia-extras"
                items={opcionesExtras}
                value={buscaExtra}
                onChange={setBuscaExtra}
                onSelect={item => {
                  poner('modifierGroupIds', [...e.modifierGroupIds, item.id])
                  setBuscaExtra('')
                }}
                placeholder={tInv('wizard.step1.selectModifierGroups')}
                isLoading={extras.isLoading}
                disabled={bloqueado}
              />
            ) : (
              <p className="text-xs italic text-muted-foreground">{t('padre.sinExtras')}</p>
            )}
            {e.modifierGroupIds.length > 0 && (
              <div className="space-y-2">
                {e.modifierGroupIds.map(id => {
                  const nombre = extras.data?.find(g => g.id === id)?.name ?? id
                  return (
                    <div key={id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                      <span className="text-sm font-medium">{nombre}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                        aria-label={t('padre.quitarExtra', { name: nombre })}
                        disabled={bloqueado}
                        onClick={() =>
                          poner(
                            'modifierGroupIds',
                            e.modifierGroupIds.filter(x => x !== id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Se oculta sola si el negocio no tiene impresoras activas. */}
          <PrintStationField
            venueId={venueId}
            namespace="inventory"
            value={e.printStationId}
            onChange={v => poner('printStationId', v)}
            disabled={bloqueado}
          />

          {hasCfdi && (
            <div className="space-y-4" data-tour="product-group-sat-keys">
              <p className="text-sm font-medium">{tCfdi('satKeys.sectionTitle')}</p>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{tCfdi('satKeys.productKey')}</Label>
                <SatKeyPicker
                  type="product"
                  venueId={venueId}
                  value={e.satProductKey || null}
                  onChange={k => poner('satProductKey', k ?? '')}
                  disabled={bloqueado}
                />
                <p className="text-xs text-muted-foreground">{tCfdi('satKeys.productKeyHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{tCfdi('satKeys.unitKey')}</Label>
                <SatKeyPicker type="unit" venueId={venueId} value={e.satUnitKey || null} onChange={k => poner('satUnitKey', k ?? '')} disabled={bloqueado} />
              </div>
            </div>
          )}

          <SelectorIva
            venueId={venueId}
            actual={familia.ivaTratamiento}
            value={e.ivaTratamiento}
            bloqueos={bloqueosIva}
            disabled={bloqueado}
            className="max-w-none"
            triggerClassName="h-12 text-base"
            onChange={v => {
              setBloqueosIva(undefined) // como la ficha de producto: elegir otro IVA quita la lista vieja
              poner('ivaTratamiento', v)
            }}
          />
        </div>
      </div>

      {!familia.archived && (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={!hayCambios || guardar.isPending}
            onClick={() => {
              setTocados(new Set())
              setBloqueosIva(undefined)
              setBuscaCategoria('')
              setBuscaExtra('')
            }}
            data-tour="product-group-parent-discard"
          >
            {t('padre.descartar')}
          </Button>
          <Button
            disabled={disabled || !hayCambios || !e.name.trim() || subiendoFoto || guardar.isPending}
            onClick={pedirGuardar}
            data-tour="product-group-parent-save"
          >
            {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('padre.guardar')}
          </Button>
        </div>
      )}
    </section>
  )
}
