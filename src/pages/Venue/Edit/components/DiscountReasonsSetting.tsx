import api from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Mismos topes que el SERVIDOR (`motivoDelDescuento.ts`); él es quien decide, esto sólo evita mandar lo que va a rechazar. */
const MAX_MOTIVO = 60
const MAX_MOTIVOS = 30

interface DiscountReasonsSettingProps {
  venueId: string
  storedRequired: boolean
  storedReasons: string[]
}

type Cambio = { discountReasonRequired?: boolean; discountReasons?: string[] }

const limpiar = (texto: string) => texto.replace(/\s+/g, ' ').trim()

/**
 * «Pedir motivo en los descuentos» (encargo f998c8, founder «A» 15-nov, como Toast «Discount reason required»).
 *
 * Con esto prendido, en el POS quien pone un descuento a mano o un «Ajuste de precio» elige un motivo de esta lista (y puede escribir
 * un comentario). El motivo sale en Reportes → Descuentos.
 *
 * 🔴 Switch CANÓNICO del venue: escribe `VenueSettings.discountReasonRequired` + `discountReasons`; el POS sólo los lee. Core, todos
 * los planes, nace APAGADO. No se prende con la lista vacía y, prendido, no se quita el último motivo (lo valida el SERVIDOR).
 */
export function DiscountReasonsSetting({ venueId, storedRequired, storedReasons }: DiscountReasonsSettingProps) {
  const { t } = useTranslation('venue')
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [required, setRequired] = useState(storedRequired)
  const [reasons, setReasons] = useState<string[]>(storedReasons)
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<{ index: number; texto: string } | null>(null)

  useEffect(() => setRequired(storedRequired), [storedRequired])
  // Comparar por contenido: un arreglo nuevo con lo mismo no debe tirar lo que la persona está escribiendo.
  const guardadas = JSON.stringify(storedReasons)
  useEffect(() => setReasons(JSON.parse(guardadas)), [guardadas])

  const canUpdate = can('venues:update')

  const guardar = useMutation({
    mutationFn: async (cambio: Cambio & { anterior: { required: boolean; reasons: string[] } }) => {
      const { anterior: _anterior, ...cuerpo } = cambio
      await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, cuerpo)
      return cuerpo
    },
    onSuccess: cuerpo => {
      if (cuerpo.discountReasonRequired !== undefined) {
        toast({
          title: t(cuerpo.discountReasonRequired ? 'edit.discountReasons.enabledTitle' : 'edit.discountReasons.disabledTitle'),
          description: t('edit.discountReasons.saved'),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any, variables) => {
      // Vuelve a lo que estaba: nunca se queda pintado algo que el SERVIDOR no guardó.
      setRequired(variables.anterior.required)
      setReasons(variables.anterior.reasons)
      const status = error?.response?.status
      toast({
        title: t('edit.discountReasons.errorTitle'),
        description:
          error?.response?.data?.message ||
          (status === 403 ? t('edit.discountReasons.permissionError') : t('edit.discountReasons.saveError')),
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
  })

  const bloqueado = !canUpdate || guardar.isPending
  const anterior = () => ({ required, reasons })

  const cambiarSwitch = (next: boolean) => {
    if (bloqueado) return
    const antes = anterior()
    setRequired(next)
    guardar.mutate({ discountReasonRequired: next, anterior: antes })
  }

  const guardarLista = (lista: string[]) => {
    const antes = anterior()
    setReasons(lista)
    guardar.mutate({ discountReasons: lista, anterior: antes })
  }

  const textoNuevo = limpiar(nuevo)
  const repetido = (texto: string, salvo?: number) =>
    reasons.some((r, i) => i !== salvo && r.toLocaleLowerCase('es-MX') === texto.toLocaleLowerCase('es-MX'))
  const errorNuevo = !textoNuevo
    ? null
    : textoNuevo.length > MAX_MOTIVO
      ? t('edit.discountReasons.tooLong', { max: MAX_MOTIVO })
      : repetido(textoNuevo)
        ? t('edit.discountReasons.duplicate')
        : reasons.length >= MAX_MOTIVOS
          ? t('edit.discountReasons.tooMany', { max: MAX_MOTIVOS })
          : null

  const agregar = () => {
    if (bloqueado || !textoNuevo || errorNuevo) return
    guardarLista([...reasons, textoNuevo])
    setNuevo('')
  }

  const textoEditado = editando ? limpiar(editando.texto) : ''
  const errorEditado =
    editando && textoEditado
      ? textoEditado.length > MAX_MOTIVO
        ? t('edit.discountReasons.tooLong', { max: MAX_MOTIVO })
        : repetido(textoEditado, editando.index)
          ? t('edit.discountReasons.duplicate')
          : null
      : null

  const renombrar = () => {
    if (!editando || bloqueado || !textoEditado || errorEditado) return
    if (textoEditado !== reasons[editando.index]) guardarLista(reasons.map((r, i) => (i === editando.index ? textoEditado : r)))
    setEditando(null)
  }

  const quitar = (index: number) => {
    if (bloqueado) return
    guardarLista(reasons.filter((_, i) => i !== index))
  }

  const ultimoConSwitch = required && reasons.length === 1

  return (
    <div data-tour="discount-reasons-setting" className="rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-medium text-foreground">{t('edit.discountReasons.title')}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{t('edit.discountReasons.description')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {guardar.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            data-tour="discount-reasons-switch"
            checked={required}
            onCheckedChange={cambiarSwitch}
            disabled={bloqueado || (!required && reasons.length === 0)}
            aria-label={t('edit.discountReasons.switchLabel')}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
        <p className="text-sm font-medium">{t('edit.discountReasons.listTitle')}</p>
        {reasons.length === 0 && <p className="text-sm text-muted-foreground">{t('edit.discountReasons.empty')}</p>}

        <ul className="space-y-1.5">
          {reasons.map((r, i) => (
            <li key={`${i}-${r}`} className="flex items-center gap-2 rounded-lg border border-input px-3 py-1.5">
              {editando?.index === i ? (
                <>
                  <Input
                    autoFocus
                    value={editando.texto}
                    maxLength={MAX_MOTIVO + 10}
                    onChange={e => setEditando({ index: i, texto: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renombrar()
                      if (e.key === 'Escape') setEditando(null)
                    }}
                    aria-label={t('edit.discountReasons.renameLabel')}
                    className="h-8"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 cursor-pointer"
                    onClick={renombrar}
                    disabled={!textoEditado || !!errorEditado || bloqueado}
                    aria-label={t('edit.discountReasons.saveRename')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => setEditando(null)}
                    aria-label={t('edit.discountReasons.cancelRename')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{r}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => setEditando({ index: i, texto: r })}
                    disabled={bloqueado}
                    aria-label={t('edit.discountReasons.rename', { reason: r })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => quitar(i)}
                    disabled={bloqueado || ultimoConSwitch}
                    title={ultimoConSwitch ? t('edit.discountReasons.lastOneHint') : undefined}
                    aria-label={t('edit.discountReasons.remove', { reason: r })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        {errorEditado && <p className="text-xs text-destructive">{errorEditado}</p>}
        {ultimoConSwitch && <p className="text-xs text-muted-foreground">{t('edit.discountReasons.lastOneHint')}</p>}

        {canUpdate && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              data-tour="discount-reasons-new"
              value={nuevo}
              placeholder={t('edit.discountReasons.newPlaceholder')}
              onChange={e => setNuevo(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') agregar()
              }}
              aria-label={t('edit.discountReasons.newPlaceholder')}
              className="h-9"
            />
            <Button
              data-tour="discount-reasons-add"
              onClick={agregar}
              disabled={bloqueado || !textoNuevo || !!errorNuevo}
              className="cursor-pointer"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t('edit.discountReasons.add')}
            </Button>
          </div>
        )}
        {errorNuevo && <p className="text-xs text-destructive">{errorNuevo}</p>}
        {!required && reasons.length === 0 && canUpdate && (
          <p className="text-xs text-muted-foreground">{t('edit.discountReasons.needsOne')}</p>
        )}
      </div>

      {!canUpdate && (
        <p className="mx-4 mb-4 border-t border-border pt-3 text-xs text-muted-foreground">{t('edit.discountReasons.readOnly')}</p>
      )}
    </div>
  )
}
