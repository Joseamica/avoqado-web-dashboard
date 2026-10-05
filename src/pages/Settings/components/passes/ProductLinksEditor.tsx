import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvalidatePasses } from '@/hooks/use-passes'
import { useToast } from '@/hooks/use-toast'
import { setPassProductLinks } from '@/services/passes.service'
import { apiErrorDescription } from '@/utils/apiError'
import type { PassIntegrationsOverview, PassPlan, PassProductLink, PassProvider } from '@/types/passes'

/** Radix Select no admite '' como valor de un item: «Sin ligar» viaja con este centinela y se traduce a «sin liga». */
const NONE = '__none__'

interface ProductLinksEditorProps {
  venueId: string
  provider: PassProvider
  plans: PassPlan[]
  productLinks: PassProductLink[]
  classProducts: PassIntegrationsOverview['classProducts']
  canManage: boolean
}

/**
 * Clase de Avoqado ↔ plan del proveedor. Se guarda TODO JUNTO con `PUT /:provider/products` (la lista completa de
 * ligas; lo que no venga se desliga), así que el botón manda el borrador entero y no cada cambio.
 */
export function ProductLinksEditor({ venueId, provider, plans, productLinks, classProducts, canManage }: ProductLinksEditorProps) {
  const { t } = useTranslation('passes')
  const { toast } = useToast()
  const invalidate = useInvalidatePasses()

  // Las clases del server vienen acotadas (take 200); una ya ligada que no entró en esa página igual se muestra: si no,
  // Guardar la desligaría sin que el dueño la viera.
  const rows = useMemo(() => {
    const byId = new Map(classProducts.items.map(p => [p.id, p.name]))
    for (const link of productLinks) if (!byId.has(link.productId)) byId.set(link.productId, link.productName)
    return [...byId].map(([id, name]) => ({ id, name }))
  }, [classProducts.items, productLinks])

  // D3 (C9 del server): archivada o ya no es clase. Su plan no se puede cambiar: sólo conservarla tal cual o quitarla.
  const archived = useMemo(() => new Set(productLinks.filter(l => l.productArchived).map(l => l.productId)), [productLinks])

  const serverDraft = useMemo(
    () => Object.fromEntries(productLinks.map(l => [l.productId, l.externalPlanId])) as Record<string, string>,
    [productLinks],
  )
  const [draft, setDraft] = useState<Record<string, string>>(serverDraft)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Llegaron ligas nuevas del server (tras guardar, u otra sesión): el borrador vuelve a lo guardado. Un refetch sin
  // cambios conserva la misma referencia (structural sharing), así que no borra el error de un intento fallido.
  useEffect(() => {
    setDraft(serverDraft)
    setSaveError(null)
  }, [serverDraft])

  const dirty = rows.some(r => (draft[r.id] ?? '') !== (serverDraft[r.id] ?? ''))

  // Cada callback DEVUELVE la invalidación: isPending dura hasta que el overview nuevo llegó (P2-8). onError también
  // recarga (R2b-17): aunque el PUT falle, el server pudo haber cambiado (p. ej. la conexión dejó de estar activa).
  const save = useMutation({
    mutationFn: () =>
      setPassProductLinks(venueId, provider, rows.filter(r => draft[r.id]).map(r => ({ productId: r.id, externalPlanId: draft[r.id] }))),
    // El error del intento anterior se va en cuanto sale la petición nueva (H3).
    onMutate: () => setSaveError(null),
    onSuccess: () => {
      toast({ title: t('products.saved') })
      return invalidate(venueId, 'connection')
    },
    // El 409 («Yoga» tiene 2 reservas próximas…) se queda a la vista, con el borrador, hasta que el dueño decida qué hacer.
    onError: (error: unknown) => {
      setSaveError(apiErrorDescription(error) || t('errors.generic'))
      return invalidate(venueId, 'connection')
    },
  })
  const disabled = !canManage || save.isPending
  const knownPlans = useMemo(() => new Set(plans.map(p => p.id)), [plans])
  // Sin planes en TotalPass no hay nada nuevo que ligar, pero las ligas que hay se tienen que poder quitar (o conservar): se
  // ven sólo ésas, con el aviso (autorización P2-10).
  const noPlans = plans.length === 0
  const visibleRows = noPlans ? rows.filter(r => serverDraft[r.id]) : rows
  const noPlansAlert = (
    <Alert className="border-input bg-muted/40">
      <AlertDescription className="text-sm text-muted-foreground">{t('products.noPlans')}</AlertDescription>
    </Alert>
  )

  return (
    <div className="space-y-3" data-tour="passes-product-links">
      <div>
        <p className="text-sm font-medium text-foreground">{t('products.title')}</p>
        <p className="text-xs text-muted-foreground">{t('products.description')}</p>
      </div>

      {noPlans && noPlansAlert}
      {noPlans && productLinks.length === 0 ? null : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('products.noClasses')}</p>
      ) : (
        <>
          <div className="rounded-lg border border-input">
            <Table>
              <TableHeader>
                <TableRow className="border-input">
                  <TableHead>{t('products.class')}</TableHead>
                  <TableHead>{t('products.plan')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(row => {
                  const value = draft[row.id] || NONE
                  const saved = serverDraft[row.id]
                  // H2: ligada a un plan que TotalPass ya no tiene: se dice, no se deja el selector en blanco, y se puede volver a
                  // dejarla tal cual después de elegir «Sin ligar» (también archivada o sin ningún plan, autorización P2-10).
                  const keepMissing = !!saved && !knownPlans.has(saved)
                  const isArchived = archived.has(row.id)
                  const options = isArchived ? plans.filter(p => p.id === saved) : plans
                  return (
                    <TableRow key={row.id} className="border-input">
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          {isArchived && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                              {t('products.archived')}
                            </Badge>
                          )}
                        </div>
                        {isArchived && <p className="text-xs text-muted-foreground">{t('products.archivedHint')}</p>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={value}
                          disabled={disabled}
                          onValueChange={next => setDraft(d => ({ ...d, [row.id]: next === NONE ? '' : next }))}
                        >
                          <SelectTrigger aria-label={row.name} className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t('products.none')}</SelectItem>
                            {keepMissing && <SelectItem value={saved}>{t('products.missingPlan')}</SelectItem>}
                            {options.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name ?? plan.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {/* P2-10: el server acota a 200 clases y NO se pagina (R32: ningún negocio llega). Si pasa, se dice a la vista. */}
          {classProducts.total > classProducts.items.length && (
            <Alert className="border-input bg-muted/40">
              <AlertDescription className="text-sm">
                {t('products.showing', { shown: classProducts.items.length, total: classProducts.total })}
              </AlertDescription>
            </Alert>
          )}
          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <Button type="button" size="sm" disabled={disabled || !dirty} onClick={() => save.mutate()} data-tour="passes-product-links-save">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('products.save')}
          </Button>
        </>
      )}
    </div>
  )
}
