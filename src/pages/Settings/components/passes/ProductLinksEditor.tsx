import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
    onSuccess: () => {
      setSaveError(null)
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

  return (
    <div className="space-y-3" data-tour="passes-product-links">
      <div>
        <p className="text-sm font-medium text-foreground">{t('products.title')}</p>
        <p className="text-xs text-muted-foreground">{t('products.description')}</p>
      </div>

      {plans.length === 0 ? (
        <Alert className="border-input bg-muted/40">
          <AlertDescription className="text-sm text-muted-foreground">{t('products.noPlans')}</AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
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
                {rows.map(row => (
                  <TableRow key={row.id} className="border-input">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Select
                        value={draft[row.id] || NONE}
                        disabled={disabled}
                        onValueChange={value => setDraft(d => ({ ...d, [row.id]: value === NONE ? '' : value }))}
                      >
                        <SelectTrigger aria-label={row.name} className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t('products.none')}</SelectItem>
                          {plans.map(plan => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name ?? plan.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
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
