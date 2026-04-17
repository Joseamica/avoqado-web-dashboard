/**
 * AssignToPromoterDialog — inline action the Supervisor uses to push a SIM
 * (or batch of SIMs already in SUPERVISOR_HELD) down to a Promoter (plan §2.3).
 *
 * Contract: the backend validates ownership, so we just need to gather the
 * target promoter + confirm. Bulk selection flows pass multiple serialNumbers.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { toast } from '@/hooks/use-toast'
import { useOrgPromoters } from '@/hooks/use-org-staff-by-role'
import { assignSimsToPromoter, type BulkResponse } from '@/services/simCustody.service'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  serialNumbers: string[]
}

export function AssignToPromoterDialog({ open, onOpenChange, orgId, serialNumbers }: Props) {
  const [promoterStaffId, setPromoterStaffId] = useState<string>('')
  const [selectedName, setSelectedName] = useState<string>('')
  const [search, setSearch] = useState('')
  const promoters = useOrgPromoters(orgId)
  const queryClient = useQueryClient()

  // Build items for SearchCombobox. `label` = clean person name. `description`
  // = email only when it's a real email (TPV-only accounts get auto-generated
  // `tpv-...@internal.avoqado.io` strings which are noise). Client-side
  // filtering by name/email so the list stays snappy for ~30 promoters.
  const items = useMemo<SearchComboboxItem[]>(() => {
    const all = promoters.data ?? []
    const term = search.trim().toLowerCase()
    const isInternalEmail = (email: string) => /@internal\.avoqado\.io$/i.test(email)
    const filtered = term
      ? all.filter(
          p => p.fullName.toLowerCase().includes(term) || (!isInternalEmail(p.email) && p.email.toLowerCase().includes(term)),
        )
      : all
    return filtered.map(p => ({
      id: p.id,
      label: p.fullName,
      description: isInternalEmail(p.email) ? undefined : p.email,
    }))
  }, [promoters.data, search])

  const clearSelection = () => {
    setPromoterStaffId('')
    setSelectedName('')
    setSearch('')
  }

  const mutation = useMutation<BulkResponse, Error, void>({
    mutationFn: async () => {
      if (!promoterStaffId) throw new Error('Selecciona un Promotor')
      return assignSimsToPromoter(orgId, { promoterStaffId, serialNumbers })
    },
    onSuccess: result => {
      const { succeeded, failed } = result.summary
      if (failed === 0) {
        toast({ title: `${succeeded} SIM${succeeded === 1 ? '' : 's'} asignado${succeeded === 1 ? '' : 's'} al Promotor` })
      } else {
        toast({
          title: `${succeeded} asignados, ${failed} con error — revisa los detalles`,
          variant: 'destructive',
        })
      }
      clearSelection()
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
    },
    onError: err => toast({ title: err.message ?? 'No se pudo asignar', variant: 'destructive' }),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next)
        if (!next) clearSelection()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar a Promotor</DialogTitle>
          <DialogDescription>
            {serialNumbers.length === 1
              ? `ICCID ${serialNumbers[0]}`
              : `${serialNumbers.length} SIMs serán asignados`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">Promotor</label>
          {promoterStaffId ? (
            // Selected state — compact chip with the picked promoter and a
            // "Cambiar" button to re-open the search.
            <div className="flex items-center gap-3 h-12 px-4 rounded-lg border border-input bg-background">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">{selectedName}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearSelection}>
                Cambiar
              </Button>
            </div>
          ) : (
            <SearchCombobox
              placeholder={promoters.isLoading ? 'Cargando promotores…' : 'Buscar por nombre o email…'}
              items={items}
              isLoading={promoters.isLoading}
              value={search}
              onChange={setSearch}
              onSelect={item => {
                setPromoterStaffId(item.id)
                setSelectedName(item.label)
                setSearch('')
              }}
              autoFocus
            />
          )}
          {!promoterStaffId && !promoters.isLoading && (promoters.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No hay Promotores en esta organización</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!promoterStaffId || mutation.isPending}>
            {mutation.isPending ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
