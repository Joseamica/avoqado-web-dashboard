import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  type RawMaterialPresentationInput,
  getRawMaterialPresentations,
  setRawMaterialPresentations,
} from '@/services/inventory.service'

/** Espejo exacto del regex del backend (`SetRawMaterialPresentationsSchema`). */
const NAME_PATTERN = /^[\p{L}\p{N} .,'/()-]+$/u

interface PresentationRow {
  name: string
  /** Clearable: vacío mientras el usuario escribe (regla de inputs numéricos). */
  factorToBase: number | undefined
}

interface Props {
  venueId: string
  rawMaterialId: string
  /** Unidad base del insumo (KILOGRAM, PIECE…) — todo se contabiliza aquí. */
  baseUnit: string
  canEdit: boolean
}

/**
 * Presentaciones de compra/salida de un insumo (CEDIS): "compro en caja, uso en
 * pieza". Cada renglón declara cuántas unidades BASE trae una presentación, así
 * que el factor puede cruzar dimensiones ("1 kilo = 18.18 huevos") — algo que la
 * conversión genérica de unidades no puede adivinar.
 *
 * Guarda el conjunto COMPLETO (replace-all), igual que el endpoint.
 */
export function RawMaterialPresentationsSection({ venueId, rawMaterialId, baseUnit, canEdit }: Props) {
  const { t } = useTranslation('inventory')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [rows, setRows] = useState<PresentationRow[]>([])

  const { data: saved, isLoading } = useQuery({
    queryKey: ['raw-material-presentations', venueId, rawMaterialId],
    queryFn: () => getRawMaterialPresentations(venueId, rawMaterialId),
    enabled: Boolean(venueId && rawMaterialId),
  })

  useEffect(() => {
    if (saved) setRows(saved.map(p => ({ name: p.name, factorToBase: Number(p.factorToBase) })))
  }, [saved])

  const mutation = useMutation({
    mutationFn: (presentations: RawMaterialPresentationInput[]) => setRawMaterialPresentations(venueId, rawMaterialId, presentations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-presentations', venueId, rawMaterialId] })
      toast({ title: t('presentations.saved'), variant: 'default' })
    },
    onError: (error: any) => {
      toast({
        title: t('presentations.saveError'),
        description: error?.response?.data?.error || error?.message,
        variant: 'destructive',
      })
    },
  })

  const unitLabel = useMemo(() => t(`units.${baseUnit}`, { defaultValue: baseUnit }), [baseUnit, t])

  const isDirty = useMemo(() => {
    const current = rows.map(r => `${r.name.trim()}:${r.factorToBase ?? ''}`).join('|')
    const original = (saved ?? []).map(p => `${p.name}:${Number(p.factorToBase)}`).join('|')
    return current !== original
  }, [rows, saved])

  const invalidReason = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const name = row.name.trim()
      if (!name) return t('presentations.errorNameRequired')
      // Espeja el regex del backend para que el error salga al escribir, no al
      // guardar. El nombre se imprime después en la orden de compra.
      if (!NAME_PATTERN.test(name)) return t('presentations.errorNameChars', { name })
      if (names.has(name)) return t('presentations.errorDuplicate', { name })
      names.add(name)
      if (row.factorToBase === undefined || !Number.isFinite(row.factorToBase) || row.factorToBase <= 0) {
        return t('presentations.errorFactor', { name })
      }
    }
    return null
  }, [rows, t])

  const updateRow = (index: number, patch: Partial<PresentationRow>) =>
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const handleSave = () => {
    if (invalidReason) return
    mutation.mutate(rows.map(row => ({ name: row.name.trim(), factorToBase: row.factorToBase as number })))
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-6" data-tour="raw-material-presentations">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{t('presentations.title')}</h3>
        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => setRows(prev => [...prev, { name: '', factorToBase: undefined }])}>
            <Plus className="mr-1 h-4 w-4" />
            {t('presentations.add')}
          </Button>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('presentations.description', { unit: unitLabel })}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('presentations.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('presentations.empty', { unit: unitLabel })}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="flex-1">
                {index === 0 && <Label className="mb-1 block text-xs text-muted-foreground">{t('presentations.nameLabel')}</Label>}
                <Input
                  value={row.name}
                  onChange={e => updateRow(index, { name: e.target.value })}
                  placeholder={t('presentations.namePlaceholder')}
                  disabled={!canEdit}
                  className="h-11"
                />
              </div>
              <div className="w-44">
                {index === 0 && (
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    {t('presentations.factorLabel', { unit: unitLabel })}
                  </Label>
                )}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.factorToBase ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    updateRow(index, { factorToBase: raw === '' ? undefined : parseFloat(raw) })
                  }}
                  placeholder="0"
                  disabled={!canEdit}
                  className="h-11"
                />
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() => setRows(prev => prev.filter((_, i) => i !== index))}
                  aria-label={t('presentations.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{invalidReason ?? (isDirty ? t('presentations.unsaved') : '')}</p>
          <Button type="button" onClick={handleSave} disabled={!isDirty || Boolean(invalidReason) || mutation.isPending}>
            {mutation.isPending ? t('presentations.saving') : t('presentations.save')}
          </Button>
        </div>
      )}
    </div>
  )
}
