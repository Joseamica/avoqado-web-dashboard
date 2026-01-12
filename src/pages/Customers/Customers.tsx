import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Banknote, Clock, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import customerService from '@/services/customer.service'
import type { Customer, CustomerGroup } from '@/types/customer'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useVenueDateTime } from '@/utils/datetime'

import CustomerForm from './components/CustomerForm'

export default function Customers() {
	const { venueId } = useCurrentVenue()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { t, i18n } = useTranslation('customers')
	const { t: tCommon } = useTranslation()
	const { formatDate } = useVenueDateTime()

	// State
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 20,
	})
	const [sortBy, setSortBy] = useState<'createdAt' | 'totalSpent' | 'visitCount' | 'lastVisit'>('createdAt')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [selectedGroupId, setSelectedGroupId] = useState<string>('')
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
	const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
	const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null)
	const [settleNotes, setSettleNotes] = useState('')
	const [showPendingOnly, setShowPendingOnly] = useState(false)

	// Fetch customers
	const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
		queryKey: ['customers', venueId, pagination.pageIndex, pagination.pageSize, sortBy, sortOrder, selectedGroupId, showPendingOnly],
		queryFn: () =>
			customerService.getCustomers(venueId, {
				page: pagination.pageIndex + 1,
				pageSize: pagination.pageSize,
				sortBy,
				sortOrder,
				// 'none' means filter customers without a group, otherwise filter by group ID
				customerGroupId: selectedGroupId && selectedGroupId !== 'none' ? selectedGroupId : undefined,
				noGroup: selectedGroupId === 'none' ? true : undefined,
				hasPendingBalance: showPendingOnly || undefined,
			}),
		refetchOnWindowFocus: true,
	})

	// Fetch customer groups for filter
	const { data: groupsData } = useQuery({
		queryKey: ['customer-groups', venueId],
		queryFn: () => customerService.getCustomerGroups(venueId, { pageSize: 100 }),
	})

	// Fetch count of customers with pending balance (for badge)
	const { data: pendingBalanceData } = useQuery({
		queryKey: ['customers-pending-balance-count', venueId],
		queryFn: () =>
			customerService.getCustomers(venueId, {
				page: 1,
				pageSize: 1, // We only need the count, not the data
				hasPendingBalance: true,
			}),
		refetchOnWindowFocus: true,
	})

	// Delete customer mutation
	const deleteCustomerMutation = useMutation({
		mutationFn: (customerId: string) => customerService.deleteCustomer(venueId, customerId),
		onSuccess: () => {
			toast({
				title: t('toasts.deleteSuccess'),
			})
			queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
			setDeletingCustomer(null)
		},
		onError: (error: any) => {
			toast({
				title: tCommon('error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Settle balance mutation
	const settleBalanceMutation = useMutation({
		mutationFn: ({ customerId, notes }: { customerId: string; notes?: string }) =>
			customerService.settleBalance(venueId, customerId, notes),
		onSuccess: (data) => {
			toast({
				title: t('settleBalance.successTitle'),
				description: t('settleBalance.successDescription', {
					count: data.settledOrderCount,
					amount: formatCurrency(data.settledAmount),
				}),
			})
			queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
			setSettlingCustomer(null)
			setSettleNotes('')
		},
		onError: (error: any) => {
			toast({
				title: tCommon('error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Customers list (no client-side filtering needed - backend handles it)
	const customers = customersData?.data || []

	// Count customers with pending balance for the badge (from server)
	const pendingCustomersCount = pendingBalanceData?.meta.totalCount || 0

	// Client-side search
	const handleSearch = useCallback((search: string, rows: Customer[]) => {
		if (!search) return rows
		const q = search.toLowerCase()
		return rows.filter(c => {
			const name = `${c.firstName} ${c.lastName}`.toLowerCase()
			const email = (c.email || '').toLowerCase()
			const phone = (c.phone || '').toLowerCase()
			return name.includes(q) || email.includes(q) || phone.includes(q)
		})
	}, [])

	// Format currency
	const formatCurrency = useCallback(
		(amount: number) => {
			return new Intl.NumberFormat(getIntlLocale(i18n.language), {
				style: 'currency',
				currency: 'MXN',
			}).format(amount)
		},
		[i18n.language]
	)

	// Format relative date
	const formatRelativeDate = useCallback(
		(dateStr: string | null) => {
			if (!dateStr) return t('detail.noLastVisit')
			const date = new Date(dateStr)
			const now = new Date()
			const diffMs = now.getTime() - date.getTime()
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

			if (diffDays === 0) return t('list.columns.lastVisit') + ': ' + tCommon('today')
			if (diffDays === 1) return t('list.columns.lastVisit') + ': ' + tCommon('yesterday')
			if (diffDays < 7) return `${diffDays} ${tCommon('daysAgo')}`
			if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${tCommon('weeksAgo')}`
			return formatDate(dateStr)
		},
		[formatDate, t, tCommon]
	)

	// Column definitions
	const columns: ColumnDef<Customer>[] = useMemo(
		() => [
			{
				accessorKey: 'firstName',
				header: ({ column }) => (
					<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
						{t('list.columns.name')}
						<ArrowUpDown className="w-4 h-4 ml-2" />
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center space-x-2">
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
							<Users className="w-4 h-4 text-muted-foreground" />
						</div>
						<div>
							<div className="font-medium">
								{row.original.firstName} {row.original.lastName}
							</div>
							<div className="text-sm text-muted-foreground">{row.original.email}</div>
						</div>
					</div>
				),
			},
			{
				accessorKey: 'phone',
				header: t('list.columns.phone'),
				cell: ({ row }) => <span className="text-muted-foreground">{row.original.phone}</span>,
			},
			{
				accessorKey: 'customerGroup',
				header: t('list.columns.group'),
				cell: ({ row }) =>
					row.original.customerGroup ? (
						<Badge
							variant="outline"
							style={{
								borderColor: row.original.customerGroup.color,
								color: row.original.customerGroup.color,
							}}
						>
							{row.original.customerGroup.name}
						</Badge>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				accessorKey: 'totalSpent',
				header: ({ column }) => (
					<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
						{t('list.columns.totalSpent')}
						<ArrowUpDown className="w-4 h-4 ml-2" />
					</Button>
				),
				cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.totalSpent)}</div>,
			},
			{
				accessorKey: 'visitCount',
				header: ({ column }) => (
					<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
						{t('list.columns.visits')}
						<ArrowUpDown className="w-4 h-4 ml-2" />
					</Button>
				),
				cell: ({ row }) => <div className="text-center">{row.original.visitCount}</div>,
			},
			{
				accessorKey: 'loyaltyPoints',
				header: t('list.columns.points'),
				cell: ({ row }) => (
					<div className="text-center">
						<Badge variant="secondary">{row.original.loyaltyPoints.toLocaleString()}</Badge>
					</div>
				),
			},
			{
				accessorKey: 'lastVisit',
				header: t('list.columns.lastVisit'),
				cell: ({ row }) => <span className="text-sm text-muted-foreground whitespace-nowrap">{formatRelativeDate(row.original.lastVisit)}</span>,
			},
			{
				accessorKey: 'pendingOrderCount',
				header: t('list.columns.pendingOrders'),
				cell: ({ row }) => {
					const count = row.original.pendingOrderCount || 0
					return count > 0 ? (
						<div className="text-center">
							<Badge variant="destructive">{count}</Badge>
						</div>
					) : (
						<span className="text-center text-muted-foreground">—</span>
					)
				},
			},
			{
				accessorKey: 'pendingBalance',
				header: t('list.columns.pendingBalance'),
				cell: ({ row }) => {
					const balance = row.original.pendingBalance || 0
					return balance > 0 ? (
						<div className="text-right">
							<span className="font-semibold text-orange-600">{formatCurrency(balance)}</span>
						</div>
					) : (
						<span className="text-right text-muted-foreground">$0.00</span>
					)
				},
			},
			{
				id: 'actions',
				header: tCommon('actions'),
				cell: ({ row }) => (
					<div onClick={(e) => e.stopPropagation()}>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={5} className="w-48">
								<PermissionGate permission="customers:update">
									<DropdownMenuItem onClick={() => setEditingCustomer(row.original)}>
										<Pencil className="h-4 w-4 mr-2" />
										{t('actions.edit')}
									</DropdownMenuItem>
								</PermissionGate>
								{/* Settle Balance - only show if customer has pending balance */}
								{(row.original.pendingBalance || 0) > 0 && (
									<PermissionGate permission="customers:settle-balance">
										<DropdownMenuItem
											onClick={() => setSettlingCustomer(row.original)}
											className="text-green-600"
										>
											<Banknote className="h-4 w-4 mr-2" />
											{t('actions.settleBalance')}
										</DropdownMenuItem>
									</PermissionGate>
								)}
								<DropdownMenuSeparator />
								<PermissionGate permission="customers:delete">
									<DropdownMenuItem onClick={() => setDeletingCustomer(row.original)} className="text-red-600">
										<Trash2 className="h-4 w-4 mr-2" />
										{t('actions.delete')}
									</DropdownMenuItem>
								</PermissionGate>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[t, tCommon, formatCurrency, formatRelativeDate]
	)

	return (
		<div className="p-4 bg-background text-foreground">
			<div className="flex items-center justify-between mb-6">
				<div>
					<PageTitleWithInfo
						title={t('title')}
						className="text-2xl font-bold"
						tooltip={t('info.list', {
							defaultValue: 'Listado de clientes con filtros, saldo pendiente y acceso al detalle de cada cliente.',
						})}
					/>
					<p className="text-muted-foreground">{t('subtitle')}</p>
				</div>

				<PermissionGate permission="customers:create">
					<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
						<DialogTrigger asChild>
							<Button id="create-customer-button">
								<Plus className="h-4 w-4 mr-2" />
								{t('actions.newCustomer')}
							</Button>
						</DialogTrigger>
						{showCreateDialog && (
							<DialogContent className="max-w-md">
								<DialogHeader>
									<DialogTitle>{t('form.createTitle')}</DialogTitle>
									<DialogDescription>{t('subtitle')}</DialogDescription>
								</DialogHeader>
								<CustomerForm
									venueId={venueId}
									groups={groupsData?.data || []}
									onSuccess={() => {
										setShowCreateDialog(false)
										queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
									}}
								/>
							</DialogContent>
						)}
					</Dialog>
				</PermissionGate>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4 mb-4">
				{/* Pending balance filter */}
				<Button
					variant={showPendingOnly ? 'default' : 'outline'}
					size="sm"
					className="gap-2"
					onClick={() => setShowPendingOnly(!showPendingOnly)}
				>
					<Clock className="h-4 w-4" />
					{t('list.filters.pendingBalance', { defaultValue: 'Con Saldo Pendiente' })}
					{pendingCustomersCount > 0 && (
						<Badge variant={showPendingOnly ? 'secondary' : 'destructive'} className="ml-1">
							{pendingCustomersCount}
						</Badge>
					)}
				</Button>

				<Select value={selectedGroupId || 'all'} onValueChange={(value) => setSelectedGroupId(value === 'all' ? '' : value)}>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder={t('list.filters.allGroups')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('list.filters.allGroups')}</SelectItem>
						<SelectItem value="none">{t('list.filters.noGroup')}</SelectItem>
						{groupsData?.data.map((group: CustomerGroup) => (
							<SelectItem key={group.id} value={group.id}>
								<div className="flex items-center gap-2">
									<div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
									{group.name}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder={t('list.sort.label')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="createdAt">{t('list.sort.createdAt')}</SelectItem>
						<SelectItem value="totalSpent">{t('list.sort.totalSpent')}</SelectItem>
						<SelectItem value="visitCount">{t('list.sort.visitCount')}</SelectItem>
						<SelectItem value="lastVisit">{t('list.sort.lastVisit')}</SelectItem>
					</SelectContent>
				</Select>

				<Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
					<SelectTrigger className="w-[140px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="desc">{tCommon('descending')}</SelectItem>
						<SelectItem value="asc">{tCommon('ascending')}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Data Table */}
			<DataTable
				data={customers}
				columns={columns}
				isLoading={isLoadingCustomers}
				pagination={pagination}
				setPagination={setPagination}
				tableId="customers:list"
				rowCount={customersData?.meta.totalCount || 0}
				enableSearch={true}
				searchPlaceholder={t('list.searchPlaceholder')}
				onSearch={handleSearch}
				clickableRow={row => ({ to: row.id })}
				stickyFirstColumn={true}
			/>

			{/* Edit Customer Dialog */}
			{editingCustomer && (
				<Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>{t('form.editTitle')}</DialogTitle>
							<DialogDescription>
								{editingCustomer.firstName} {editingCustomer.lastName}
							</DialogDescription>
						</DialogHeader>
						<CustomerForm
							venueId={venueId}
							customer={editingCustomer}
							groups={groupsData?.data || []}
							onSuccess={() => {
								setEditingCustomer(null)
								queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
							}}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Delete Customer Alert */}
			{deletingCustomer && (
				<AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
							<AlertDialogDescription>
								{t('delete.description', {
									name: `${deletingCustomer.firstName} ${deletingCustomer.lastName}`,
								})}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => deleteCustomerMutation.mutate(deletingCustomer.id)}
								disabled={deleteCustomerMutation.isPending}
								className="bg-red-600 hover:bg-red-700"
							>
								{deleteCustomerMutation.isPending ? tCommon('deleting') : t('delete.confirm')}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{/* Settle Balance Dialog */}
			{settlingCustomer && (
				<Dialog
					open={!!settlingCustomer}
					onOpenChange={(open) => {
						if (!open) {
							setSettlingCustomer(null)
							setSettleNotes('')
						}
					}}
				>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>{t('settleBalance.title')}</DialogTitle>
							<DialogDescription>
								{t('settleBalance.description', {
									name: `${settlingCustomer.firstName} ${settlingCustomer.lastName}`,
								})}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							{/* Balance Summary */}
							<div className="rounded-lg border border-border bg-muted/50 p-4">
								<div className="flex items-center justify-between mb-2">
									<span className="text-sm text-muted-foreground">{t('settleBalance.pendingOrders')}</span>
									<span className="font-medium">{settlingCustomer.pendingOrderCount || 0}</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">{t('settleBalance.totalBalance')}</span>
									<span className="text-lg font-bold text-orange-600">
										{formatCurrency(settlingCustomer.pendingBalance || 0)}
									</span>
								</div>
							</div>

							{/* Notes Input */}
							<div className="space-y-2">
								<Label htmlFor="settle-notes">{t('settleBalance.notesLabel')}</Label>
								<Input
									id="settle-notes"
									placeholder={t('settleBalance.notesPlaceholder')}
									value={settleNotes}
									onChange={(e) => setSettleNotes(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">{t('settleBalance.notesHelp')}</p>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setSettlingCustomer(null)
									setSettleNotes('')
								}}
							>
								{tCommon('cancel')}
							</Button>
							<Button
								onClick={() =>
									settleBalanceMutation.mutate({
										customerId: settlingCustomer.id,
										notes: settleNotes || undefined,
									})
								}
								disabled={settleBalanceMutation.isPending}
								className="bg-green-600 hover:bg-green-700"
							>
								{settleBalanceMutation.isPending ? tCommon('loading') : t('settleBalance.confirm')}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
