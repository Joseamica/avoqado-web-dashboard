import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import { setOrgSaleVerificationNumbers, type OrgSaleRow, type SetOrgSaleNumbersParams } from '@/services/saleVerification.org.service'

type Field = 'linkingNumber' | 'portedNumber'

const NAMES: Record<Field, string> = { linkingNumber: 'Número de vinculación', portedNumber: 'Número portado' }
const EDIT_LABELS: Record<Field, string> = { linkingNumber: 'Editar número de vinculación', portedNumber: 'Editar número portado' }

// Igual que el SERVIDOR: quita espacios, guiones, puntos y paréntesis; lo demás («+52», letras) no valida.
const normalize = (raw: string) => raw.replace(/[\s\-.()]/g, '')
const isSavable = (digits: string) => /^\d{9,10}$/.test(digits)

/**
 * «Número de vinculación» de una venta (y el portado debajo, en portabilidad). Quien puede editar lo corrige ahí mismo:
 * 10 dígitos se guarda; 9 pide confirmar y se manda con `allowNineDigits`. Cada número se guarda aparte, así guardar el
 * mismo 9 lo confirma sin tocar el otro. El SERVIDOR es quien protege el permiso (`sale-verifications:edit`).
 */
export function LinkingNumberCell({ row, orgId, canEdit }: { row: OrgSaleRow; orgId: string; canEdit: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<{ field: Field; value: string } | null>(null)
  const [nineToConfirm, setNineToConfirm] = useState<{ field: Field; digits: string } | null>(null)
  // Candado síncrono: `isPending` no alcanza a apagar el botón entre dos clics seguidos.
  const sending = useRef(false)
  const save = useMutation({
    mutationFn: ({ field, digits, allowNine }: { field: Field; digits: string; allowNine: boolean }) => {
      const params: SetOrgSaleNumbersParams = field === 'linkingNumber' ? { linkingNumber: digits } : { portedNumber: digits }
      if (allowNine) params.allowNineDigits = true
      return setOrgSaleVerificationNumbers(orgId, row.id, params)
    },
  })

  const send = (field: Field, digits: string, allowNine: boolean) => {
    if (sending.current) return
    sending.current = true
    save.mutate(
      { field, digits, allowNine },
      {
        onSuccess: () => {
          // Sólo cierra SU edición: la de otro número (si hubiera) sigue abierta con lo escrito.
          setEditing(cur => (cur?.field === field ? null : cur))
          toast({ title: 'Número guardado' })
          void queryClient.invalidateQueries({ queryKey: ['org', orgId, 'sale-verifications'] })
        },
        onError: (err: any) =>
          toast({
            title: 'No se pudo guardar el número',
            description: err?.response?.data?.message ?? err?.message ?? 'Intenta de nuevo.',
            variant: 'destructive',
          }),
        onSettled: () => {
          sending.current = false
        },
      },
    )
  }

  const submit = () => {
    if (!editing) return
    const digits = normalize(editing.value)
    if (!isSavable(digits)) return
    if (digits.length === 9) setNineToConfirm({ field: editing.field, digits })
    else send(editing.field, digits, false)
  }

  // Con un guardado en vuelo nada de esta fila se edita: así una corrección no se pierde por otra.
  const busy = save.isPending

  const fields: Field[] = row.isPortabilidad ? ['linkingNumber', 'portedNumber'] : ['linkingNumber']

  return (
    <div className="space-y-1">
      {fields.map(field => {
        const value = row[field] ?? null
        const source = field === 'linkingNumber' ? row.linkingNumberSource : row.portedNumberSource
        if (editing?.field === field) {
          return (
            <form
              key={field}
              className="inline-flex flex-wrap items-center gap-1"
              onSubmit={e => {
                e.preventDefault()
                submit()
              }}
            >
              <Input
                autoFocus
                inputMode="numeric"
                aria-label={NAMES[field]}
                placeholder="10 dígitos"
                className="h-8 w-32 font-mono text-xs"
                value={editing.value}
                disabled={busy}
                onChange={e => setEditing({ field, value: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-8 w-8 cursor-pointer"
                aria-label="Guardar"
                disabled={!isSavable(normalize(editing.value)) || busy}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 cursor-pointer"
                aria-label="Cancelar"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              {editing.value.trim() !== '' && !isSavable(normalize(editing.value)) && (
                <p className="basis-full text-[10px] text-muted-foreground">Sólo 9 o 10 dígitos, sin +52</p>
              )}
            </form>
          )
        }
        return (
          <div key={field}>
            <div className="flex items-center gap-1">
              {field === 'portedNumber' && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Portado</span>}
              <span className="font-mono text-xs">{value ?? '—'}</span>
              {canEdit && row.hasVerification && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 cursor-pointer"
                  aria-label={EDIT_LABELS[field]}
                  disabled={busy}
                  title={EDIT_LABELS[field]}
                  data-tour={`sale-${field === 'linkingNumber' ? 'linking' : 'ported'}-number-edit`}
                  onClick={() => setEditing({ field, value: value ?? '' })}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {value?.length === 9 && source === 'BACKOFFICE' && (
              <p className="text-[10px] text-muted-foreground">9 dígitos · confirmado por el back-office</p>
            )}
          </div>
        )
      })}
      <ConfirmDialog
        open={!!nineToConfirm}
        onOpenChange={open => {
          if (!open) setNineToConfirm(null)
        }}
        title="Tiene 9 dígitos. ¿Guardarlo así?"
        description="Revísalo contra la foto: los números de México tienen 10 dígitos."
        confirmText="Guardar así"
        onConfirm={() => {
          if (nineToConfirm) send(nineToConfirm.field, nineToConfirm.digits, true)
        }}
      />
    </div>
  )
}
