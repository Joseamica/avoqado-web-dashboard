import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { getModifierGroups, deleteModifierGroup } from '@/services/menu.service'
import { ModifierGroup } from '@/types'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { CreateModifierGroupWizard } from './components/CreateModifierGroupWizard'
import { ModifiersManagerDialog } from './components/ModifiersManagerDialog'
import { useMenuMakerHeader } from '../MenuMakerLayout'
import { includesNormalized } from '@/lib/utils'

export default function ModifierGroups() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [modifierGroupToDelete, setModifierGroupToDelete] = useState<string | null>(null)

  // Push header into MenuMakerLayout (title + actions appear above tabs)
  const { setHeader } = useMenuMakerHeader()
  useEffect(() => {
    setHeader({
      title: (
        <PageTitleWithInfo
          title={t('modifiers.title')}
          className="text-xl font-semibold"
          tooltip={t('info.modifierGroups', {
            defaultValue: 'Configura grupos de modificadores para personalizar productos (ej. extras o tamanos).',
          })}
        />
      ),
      actions: (
        <PermissionGate permission="menu:create">
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>{t('modifiers.newModifierGroup')}</span>
          </Button>
        </PermissionGate>
      ),
    })
    return () => setHeader({})
  }, [t, setHeader])

  const { data: modifierGroups, isLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: () => getModifierGroups(venueId!),
  })

  // Mutation to delete a modifier group
  const deleteModifierGroupMutation = useMutation({
    mutationFn: async (modifierGroupId: string) => {
      return await deleteModifierGroup(venueId!, modifierGroupId)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.toasts.deleted'),
        description: t('modifiers.toasts.deletedDesc'),
      })
      // Invalidate and refetch data
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
      setDeleteDialogOpen(false)
      setModifierGroupToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.deleteError'),
        description: error.message || t('modifiers.toasts.deleteErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<ModifierGroup, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center cursor-pointer">
          {t('modifiers.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => cell.getValue() as string,
    },
    {
      id: 'modifiers',
      accessorKey: 'modifiers',
      header: t('modifiers.columns.modifiers'),
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
    {
      id: 'actions',
      header: t('modifiers.columns.actions'),
      cell: ({ row }) => {
        return (
          <div className="flex justify-end" onClick={e => e.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 dropdown-menu-trigger">
                  <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
                <DropdownMenuLabel>{t('modifiers.actions.title')}</DropdownMenuLabel>
                <PermissionGate permission="menu:update">
                  <DropdownMenuItem onClick={() => setEditingGroupId(row.original.id)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('modifiers.actions.edit')}
                  </DropdownMenuItem>
                </PermissionGate>
                <DropdownMenuSeparator />
                <PermissionGate permission="menu:delete">
                  <DropdownMenuItem
                    onClick={() => {
                      setModifierGroupToDelete(row.original.id)
                      setDeleteDialogOpen(true)
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('modifiers.actions.delete')}
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, modifierGroups: any[]) => {
    if (!searchTerm) return modifierGroups

    return modifierGroups.filter(modifierGroup => {
      const nameMatches = includesNormalized(modifierGroup.name ?? '', searchTerm)
      const modifiersMatches = modifierGroup.modifiers?.some(menu => includesNormalized(menu.name ?? '', searchTerm)) ?? false
      return nameMatches || modifiersMatches
    })
  }, [])

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  return (
    <div className="p-4">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('modifiers.dialogs.delete.title')}</DialogTitle>
            <DialogDescription>{t('modifiers.dialogs.delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => modifierGroupToDelete && deleteModifierGroupMutation.mutate(modifierGroupToDelete)}
              disabled={deleteModifierGroupMutation.isPending}
            >
              {deleteModifierGroupMutation.isPending ? t('modifiers.dialogs.delete.deleting') : t('modifiers.dialogs.delete.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create wizard — creation only; editing happens in ModifiersManagerDialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('modifiers.createGroup.title')}</DialogTitle>
            <DialogDescription>{t('modifiers.createGroup.basicInfoDesc')}</DialogDescription>
          </DialogHeader>
          <CreateModifierGroupWizard onCancel={() => setCreateDialogOpen(false)} onSuccess={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Consolidated group editor: settings + modifiers + product assignments */}
      <ModifiersManagerDialog venueId={venueId!} modifierGroupId={editingGroupId} onClose={() => setEditingGroupId(null)} />

      <DataTable
        data={modifierGroups || []}
        rowCount={modifierGroups?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('modifiers.searchPlaceholder')}
        onSearch={handleSearch}
        tableId="modifier-groups:list"
        onRowClick={row => setEditingGroupId(row.id)}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}
