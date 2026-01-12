import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Check, ChevronsUpDown, MoreHorizontal, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import customerService from '@/services/customer.service'
import type { Customer, CustomerGroup } from '@/types/customer'
import { cn } from '@/lib/utils'

// Predefined colors for groups
const GROUP_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
]

export default function CustomerGroups() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('customers')
  const { t: tCommon } = useTranslation('common')

  // State
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<CustomerGroup | null>(null)

  // Fetch customer groups
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['customer-groups', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () =>
      customerService.getCustomerGroups(venueId, {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      }),
    refetchOnWindowFocus: true,
  })

  // Delete mutation
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => customerService.deleteCustomerGroup(venueId, groupId),
    onSuccess: () => {
      toast({ title: t('toasts.groupDeleteSuccess') })
      queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
      setDeletingGroup(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Memoized groups list
  const groups = useMemo(() => groupsData?.data || [], [groupsData?.data])

  // Client-side search
  const handleSearch = useCallback((search: string, rows: CustomerGroup[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(g => {
      const name = g.name.toLowerCase()
      const description = (g.description || '').toLowerCase()
      return name.includes(q) || description.includes(q)
    })
  }, [])

  // Column definitions
  const columns: ColumnDef<CustomerGroup>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('groups.columns.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: row.original.color }} />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: t('groups.columns.description'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || '—'}</span>,
      },
      {
        accessorKey: 'customerCount',
        header: t('groups.columns.customers'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.customerCount ?? row.original._count?.customers ?? 0}</span>
          </div>
        ),
      },
      {
        accessorKey: 'active',
        header: t('groups.columns.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'default' : 'secondary'}>
            {row.original.active ? t('groups.status.active') : t('groups.status.inactive')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5} className="w-48">
              <PermissionGate permission="customer-groups:update">
                <DropdownMenuItem onClick={() => setEditingGroup(row.original)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {tCommon('common.edit')}
                </DropdownMenuItem>
              </PermissionGate>
              <DropdownMenuSeparator />
              <PermissionGate permission="customer-groups:delete">
                <DropdownMenuItem onClick={() => setDeletingGroup(row.original)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tCommon('common.delete')}
                </DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, tCommon],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageTitleWithInfo
            title={t('groups.title')}
            className="text-2xl font-bold"
            tooltip={t('info.groups', {
              defaultValue: 'Muestra y administra los grupos de clientes para segmentarlos, por ejemplo Clientes VIP o Frecuentes.',
            })}
          />
          <p className="text-muted-foreground">{t('groups.subtitle')}</p>
        </div>

        <PermissionGate permission="customer-groups:create">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button id="create-group-button">
                <Plus className="h-4 w-4 mr-2" />
                {t('groups.form.createTitle')}
              </Button>
            </DialogTrigger>
            {showCreateDialog && (
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('groups.form.createTitle')}</DialogTitle>
                  <DialogDescription>{t('groups.subtitle')}</DialogDescription>
                </DialogHeader>
                <CustomerGroupForm
                  venueId={venueId}
                  onSuccess={() => {
                    setShowCreateDialog(false)
                    queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
                  }}
                />
              </DialogContent>
            )}
          </Dialog>
        </PermissionGate>
      </div>

      {/* Data Table */}
      <DataTable
        data={groups}
        columns={columns}
        isLoading={isLoading}
        pagination={pagination}
        setPagination={setPagination}
        tableId="customer-groups:list"
        rowCount={groupsData?.meta.totalCount || 0}
        enableSearch={true}
        searchPlaceholder={t('list.searchPlaceholder')}
        onSearch={handleSearch}
      />

      {/* Edit Group Dialog */}
      {editingGroup && (
        <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('groups.form.editTitle')}</DialogTitle>
              <DialogDescription>{editingGroup.name}</DialogDescription>
            </DialogHeader>
            <CustomerGroupForm
              venueId={venueId}
              group={editingGroup}
              onSuccess={() => {
                setEditingGroup(null)
                queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Group Alert */}
      {deletingGroup && (
        <AlertDialog open={!!deletingGroup} onOpenChange={() => setDeletingGroup(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('groups.delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('groups.delete.description', { name: deletingGroup.name })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGroupMutation.mutate(deletingGroup.id)}
                disabled={deleteGroupMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteGroupMutation.isPending ? tCommon('common.deleting') : t('groups.delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// Customer Group Form Component
interface CustomerGroupFormProps {
  venueId: string
  group?: CustomerGroup
  onSuccess: () => void
}

function CustomerGroupForm({ venueId, group, onSuccess }: CustomerGroupFormProps) {
  const { t } = useTranslation('customers')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isEditing = !!group

  // State for customer selection
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])
  const [initialCustomerIds, setInitialCustomerIds] = useState<string[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  // Fetch all customers for selection (max 100 per backend limit)
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-group', venueId],
    queryFn: () => customerService.getCustomers(venueId, { page: 1, pageSize: 100 }),
  })

  // Fetch customers already in this group (when editing)
  const { data: groupCustomersData } = useQuery({
    queryKey: ['group-customers', venueId, group?.id],
    queryFn: () => customerService.getCustomers(venueId, { page: 1, pageSize: 100, customerGroupId: group?.id }),
    enabled: isEditing && !!group?.id,
  })

  // Set initial customers when editing
  useEffect(() => {
    if (groupCustomersData?.data) {
      setSelectedCustomers(groupCustomersData.data)
      setInitialCustomerIds(groupCustomersData.data.map(c => c.id))
    }
  }, [groupCustomersData])

  const allCustomers = useMemo(() => customersData?.data || [], [customersData?.data])

  // Schema
  const schema = z.object({
    name: z.string().min(1, t('groups.form.validation.nameRequired')),
    description: z.string().optional(),
    color: z.string().min(1, t('groups.form.validation.colorRequired')),
    active: z.boolean(),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      name: group?.name || '',
      description: group?.description || '',
      color: group?.color || GROUP_COLORS[0],
      active: group?.active ?? true,
    },
  })

  const watchedColor = watch('color')
  const watchedActive = watch('active')

  // Assign customers mutation
  const assignCustomersMutation = useMutation({
    mutationFn: ({ groupId, customerIds }: { groupId: string; customerIds: string[] }) =>
      customerService.assignCustomersToGroup(venueId, groupId, { customerIds }),
  })

  // Remove customers mutation
  const removeCustomersMutation = useMutation({
    mutationFn: ({ groupId, customerIds }: { groupId: string; customerIds: string[] }) =>
      customerService.removeCustomersFromGroup(venueId, groupId, { customerIds }),
  })

  // Create mutation - pass customerIds explicitly to avoid stale closure issues
  const createMutation = useMutation({
    mutationFn: async ({ formData, customerIds }: { formData: FormData; customerIds: string[] }) => {
      console.log('🔵 Creating group with data:', formData)
      console.log('🔵 Customer IDs to assign:', customerIds.length, customerIds)

      const newGroup = await customerService.createCustomerGroup(venueId, {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        active: formData.active,
      })

      console.log('🟢 Group created:', newGroup.id, newGroup.name)

      // Assign selected customers to the new group
      if (customerIds.length > 0) {
        console.log('🔵 Assigning customers to group:', newGroup.id)
        const assignResult = await assignCustomersMutation.mutateAsync({
          groupId: newGroup.id,
          customerIds,
        })
        console.log('🟢 Customers assigned:', assignResult)
      } else {
        console.log('⚠️ No customers to assign')
      }
      return newGroup
    },
    onSuccess: () => {
      toast({ title: t('toasts.groupCreateSuccess') })
      queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Update mutation - pass customerIds explicitly to avoid stale closure issues
  const updateMutation = useMutation({
    mutationFn: async ({
      formData,
      currentCustomerIds,
      originalCustomerIds,
    }: {
      formData: FormData
      currentCustomerIds: string[]
      originalCustomerIds: string[]
    }) => {
      console.log('🔵 Updating group with data:', formData)
      console.log('🔵 Current customer IDs:', currentCustomerIds)
      console.log('🔵 Original customer IDs:', originalCustomerIds)

      // Update group info
      await customerService.updateCustomerGroup(venueId, group!.id, {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        active: formData.active,
      })

      // Calculate customers to add and remove
      const toAdd = currentCustomerIds.filter(id => !originalCustomerIds.includes(id))
      const toRemove = originalCustomerIds.filter(id => !currentCustomerIds.includes(id))

      console.log('🔵 Customers to add:', toAdd)
      console.log('🔵 Customers to remove:', toRemove)

      // Assign new customers
      if (toAdd.length > 0) {
        const addResult = await assignCustomersMutation.mutateAsync({
          groupId: group!.id,
          customerIds: toAdd,
        })
        console.log('🟢 Customers added:', addResult)
      }

      // Remove customers
      if (toRemove.length > 0) {
        const removeResult = await removeCustomersMutation.mutateAsync({
          groupId: group!.id,
          customerIds: toRemove,
        })
        console.log('🟢 Customers removed:', removeResult)
      }
    },
    onSuccess: () => {
      toast({ title: t('toasts.groupUpdateSuccess') })
      queryClient.invalidateQueries({ queryKey: ['customer-groups', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: FormData) => {
    // Get current customer IDs at submit time to avoid stale closure issues
    const currentCustomerIds = selectedCustomers.map(c => c.id)
    console.log('🔵 onSubmit - selectedCustomers:', selectedCustomers.length, currentCustomerIds)

    if (isEditing) {
      updateMutation.mutate({
        formData: data,
        currentCustomerIds,
        originalCustomerIds: initialCustomerIds,
      })
    } else {
      createMutation.mutate({ formData: data, customerIds: currentCustomerIds })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // Toggle customer selection
  const toggleCustomer = (customer: Customer) => {
    setSelectedCustomers(prev => {
      const isSelected = prev.some(c => c.id === customer.id)
      if (isSelected) {
        return prev.filter(c => c.id !== customer.id)
      } else {
        return [...prev, customer]
      }
    })
  }

  // Remove customer from selection
  const removeCustomer = (customerId: string) => {
    setSelectedCustomers(prev => prev.filter(c => c.id !== customerId))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('groups.form.fields.name')} *</Label>
        <Input id="name" placeholder={t('groups.form.placeholders.name')} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('groups.form.fields.description')}</Label>
        <Textarea id="description" placeholder={t('groups.form.placeholders.description')} {...register('description')} rows={3} />
      </div>

      <div className="space-y-2">
        <Label>{t('groups.form.fields.color')} *</Label>
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setValue('color', color)}
              className={`w-8 h-8 rounded-full transition-all ${
                watchedColor === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
      </div>

      {/* Customer Selection */}
      <div className="space-y-2">
        <Label>{t('groups.form.fields.customers', { defaultValue: 'Clientes' })}</Label>
        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={customerSearchOpen} className="w-full justify-between" type="button">
              {selectedCustomers.length > 0
                ? t('groups.form.customersSelected', {
                    count: selectedCustomers.length,
                    defaultValue: `${selectedCustomers.length} clientes seleccionados`,
                  })
                : t('groups.form.selectCustomers', { defaultValue: 'Seleccionar clientes...' })}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder={t('groups.form.searchCustomers', { defaultValue: 'Buscar clientes...' })} />
              <CommandList>
                <CommandEmpty>{t('groups.form.noCustomersFound', { defaultValue: 'No se encontraron clientes' })}</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {allCustomers.map(customer => {
                    const isSelected = selectedCustomers.some(c => c.id === customer.id)
                    return (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.firstName} ${customer.lastName} ${customer.email}`}
                        onSelect={() => toggleCustomer(customer)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex flex-col">
                          <span>
                            {customer.firstName} {customer.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected customers badges */}
        {selectedCustomers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedCustomers.map(customer => (
              <Badge key={customer.id} variant="secondary" className="flex items-center gap-1 pr-1">
                {customer.firstName} {customer.lastName}
                <button
                  type="button"
                  onClick={() => removeCustomer(customer.id)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="active">{t('groups.form.fields.active')}</Label>
        <Switch id="active" checked={watchedActive} onCheckedChange={checked => setValue('active', checked)} />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={!isValid || isPending}>
          {isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              {tCommon('common.saving')}
            </>
          ) : isEditing ? (
            t('groups.form.buttons.save')
          ) : (
            t('groups.form.buttons.create')
          )}
        </Button>
      </div>
    </form>
  )
}
