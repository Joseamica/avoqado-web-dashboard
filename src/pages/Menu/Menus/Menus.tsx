import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { getMenus } from '@/services/menu.service'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Menu } from '@/types'
import { formatDateInTimeZone } from '@/utils/luxon'

export default function Menus() {
  const { t } = useTranslation('menu')
  const { venueId } = useCurrentVenue()

  const location = useLocation()


  const { data, isLoading } = useQuery({
    queryKey: ['menus', venueId],
    queryFn: () => getMenus(venueId),
  })
  const columns: ColumnDef<Menu, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('menus.columns.name') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('menus.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        return cell.getValue() as string
      },
    },
    {
      id: 'timeRange',
      meta: { label: t('menus.columns.schedules') },
      header: t('menus.columns.schedules'),
      // No accessorKey since we're accessing multiple fields
      cell: ({ row }) => {
        const { availableFrom, availableUntil } = row.original

        if (!availableFrom || !availableUntil) {
          return <span>{t('menus.columns.alwaysAvailable')}</span>
        }

        const formattedStart = formatDateInTimeZone(availableFrom, 'America/Mexico_City')
        const formattedEnd = formatDateInTimeZone(availableUntil, 'America/Mexico_City')

        return (
          <span>
            {formattedStart} - {formattedEnd}
          </span>
        )
      },
    },
    {
      id: 'categories',
      accessorFn: (menu) =>
        (menu.categories || [])
          .map(assignment => assignment.category)
          .filter((category): category is { id: string; name: string } => Boolean(category?.name)),
      meta: { label: t('menus.columns.categories') },
      header: t('menus.columns.categories'),
      enableColumnFilter: false,
      cell: ({ cell }) => <ItemsCell cell={cell} max_visible_items={2} />,
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, menus: any[]) => {
    if (!searchTerm) return menus

    const lowerSearchTerm = searchTerm.toLowerCase()

    return menus.filter(menu => {
      const nameMatches = menu.name.toLowerCase().includes(lowerSearchTerm)
      const categoryMatches = menu.categories?.some(category => category.category.name.toLowerCase().includes(lowerSearchTerm))
      return nameMatches || categoryMatches
    })
  }, [])

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <PageTitleWithInfo
          title={t('menus.title')}
          className="text-xl font-semibold"
          tooltip={t('info.menus', {
            defaultValue: 'Gestiona los menus del venue, horarios y categorias asignadas.',
          })}
        />
        <Button asChild>
          <Link
            to={`create`}
            state={{
              from: location.pathname,
            }}
            className="flex items-center space-x-2"
          >
            <span>{t('menus.newMenu')}</span>
          </Link>
        </Button>
      </div>

      <DataTable
        data={data || []}
        rowCount={data?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('menus.searchPlaceholder')}
        onSearch={handleSearch}
        tableId="menu:menus"
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />
    </div>
  )
}
