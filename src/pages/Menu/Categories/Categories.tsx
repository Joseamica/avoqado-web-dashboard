import { getMenuCategories, updateMenuCategory } from '@/services/menu.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Link, useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { MenuCategory } from '@/types'
import { PermissionGate } from '@/components/PermissionGate'

export default function Categories() {
  const { t, i18n } = useTranslation('menu')
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ categoryId, status }: { categoryId: string; status: boolean }) => {
      await updateMenuCategory(venueId!, categoryId, { active: status })
      return { categoryId, status }
    },
    onMutate: async ({ categoryId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['categories', venueId] })

      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<MenuCategory[]>(['categories', venueId])

      // Optimistically update the cache
      queryClient.setQueryData<MenuCategory[]>(['categories', venueId], old => {
        if (!old) return old
        return old.map(category => (category.id === categoryId ? { ...category, active: status } : category))
      })

      // Return a context object with the snapshotted value
      return { previousCategories }
    },
    onError: (_, __, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories', venueId], context.previousCategories)
      }
    },
    onSuccess: data => {
      toast({
        title: data.status ? t('categories.toasts.activated') : t('categories.toasts.deactivated'),
        description: t('categories.toasts.saved'),
      })
    },
  })

  const columns: ColumnDef<MenuCategory, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('categories.columns.name') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('categories.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        return cell.getValue() as string
      },
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      meta: { label: t('categories.columns.lastModification') },
      header: t('categories.columns.lastModification'),
      enableColumnFilter: false,
      cell: ({ cell }) => {
        const updatedAt = cell.getValue() as string
        return (
          <span>
            {new Date(updatedAt).toLocaleDateString(getIntlLocale(i18n.language), {
              day: 'numeric',
              month: 'numeric',
            })}
          </span>
        )
      },
    },
    {
      id: 'active',
      accessorKey: 'active',
      header: '',
      enableColumnFilter: false,
      cell: ({ row, cell }) => {
        const categoryId = row.original.id as string
        const active = cell.getValue() as boolean

        return (
          <Switch
            id={`active-switch-${categoryId}`}
            checked={active}
            onCheckedChange={() => toggleActive.mutate({ categoryId, status: !active })}
            onClick={e => e.stopPropagation()} // Prevent row click when switch is clicked
            disabled={toggleActive.isPending}
          />
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, categories: any[]) => {
    if (!searchTerm) return categories

    const lowerSearchTerm = searchTerm.toLowerCase()

    return categories.filter(category => {
      const nameMatches = category.name.toLowerCase().includes(lowerSearchTerm)
      const menuMatches = category.menus?.some(menuAssignment => menuAssignment.menu?.name.toLowerCase().includes(lowerSearchTerm)) || false
      return nameMatches || menuMatches
    })
  }, [])

  // if (isLoading) return <LoadingScreen message="Partiendo la cuenta y el aguacate…" />

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">{t('categories.title')}</h1>
        <PermissionGate permission="menu:create">
          <Button asChild>
            <Link
              to={`create`}
              state={{
                from: location.pathname,
              }}
              className="flex items-center space-x-2"
            >
              <span>{t('categories.newCategory')}</span>
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        data={categories || []}
        rowCount={categories?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('categories.searchPlaceholder')}
        onSearch={handleSearch}
        tableId="menu:categories"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
