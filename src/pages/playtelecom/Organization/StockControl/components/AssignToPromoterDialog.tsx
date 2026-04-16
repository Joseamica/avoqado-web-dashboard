/**
 * AssignToPromoterDialog — inline action the Supervisor uses to push a SIM
 * (or batch of SIMs already in SUPERVISOR_HELD) down to a Promoter (plan §2.3).
 *
 * Contract: the backend validates ownership, so we just need to gather the
 * target promoter + confirm. Bulk selection flows pass multiple serialNumbers.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from '@/hooks/use-toast'
import { useOrgStaffByRole } from '@/hooks/use-org-staff-by-role'
import { assignSimsToPromoter, type BulkResponse } from '@/services/simCustody.service'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  serialNumbers: string[]
}

export function AssignToPromoterDialog({ open, onOpenChange, orgId, serialNumbers }: Props) {
  const [promoterStaffId, setPromoterStaffId] = useState<string>('')
  const promoters = useOrgStaffByRole(orgId, 'WAITER')
  const queryClient = useQueryClient()

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
      setPromoterStaffId('')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
    },
    onError: err => toast({ title: err.message ?? 'No se pudo asignar', variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar a Promotor</DialogTitle>
          <DialogDescription>
            {serialNumbers.length === 1
              ? `ICCID ${serialNumbers[0]}`
              : `${serialNumbers.length} SIMs serán asignados`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm font-medium">Promotor</label>
          <SearchableSelect
            value={promoterStaffId}
            onValueChange={setPromoterStaffId}
            options={(promoters.data ?? []).map(p => ({
              value: p.id,
              label: `${p.fullName} · ${p.email}`,
            }))}
            placeholder={promoters.isLoading ? 'Cargando promotores…' : 'Selecciona un Promotor'}
            searchPlaceholder="Buscar por nombre o email…"
            emptyMessage="No hay Promotores en esta organización"
            disabled={promoters.isLoading}
            searchThreshold={0}
            className="w-full"
          />
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
