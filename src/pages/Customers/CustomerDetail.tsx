import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
	ArrowLeft,
	Mail,
	Phone,
	Calendar,
	DollarSign,
	ShoppingCart,
	Award,
	Edit3,
	Trash2,
	Plus,
	Minus,
	TrendingUp,
	Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import customerService from '@/services/customer.service'
import loyaltyService from '@/services/loyalty.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { LoyaltyTransaction, CustomerGroup } from '@/types/customer'

import CustomerForm from './components/CustomerForm'

export default function CustomerDetail() {
	const { venueId } = useCurrentVenue()
	const { customerId } = useParams<{ customerId: string }>()
	const navigate = useNavigate()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { t, i18n } = useTranslation('customers')
	const { t: tCommon } = useTranslation()

	const [showEditDialog, setShowEditDialog] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [showAdjustPointsDialog, setShowAdjustPointsDialog] = useState(false)
	const [loyaltyTypeFilter, setLoyaltyTypeFilter] = useState<string>('')

	// Fetch customer details
	const { data: customer, isLoading } = useQuery({
		queryKey: ['customer', venueId, customerId],
		queryFn: () => customerService.getCustomer(venueId, customerId!),
		enabled: !!customerId,
	})

	// Fetch customer groups for edit form
	const { data: groupsData } = useQuery({
		queryKey: ['customer-groups', venueId],
		queryFn: () => customerService.getCustomerGroups(venueId, { pageSize: 100 }),
	})

	// Fetch loyalty transactions
	const { data: loyaltyData } = useQuery({
		queryKey: ['customer-loyalty', venueId, customerId, loyaltyTypeFilter],
		queryFn: () =>
			loyaltyService.getCustomerTransactions(venueId, customerId!, {
				pageSize: 50,
				type: loyaltyTypeFilter || undefined,
			}),
		enabled: !!customerId,
	})

	// Fetch loyalty config for point value calculation
	const { data: loyaltyConfig } = useQuery({
		queryKey: ['loyalty-config', venueId],
		queryFn: () => loyaltyService.getConfig(venueId),
	})

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: () => customerService.deleteCustomer(venueId, customerId!),
		onSuccess: () => {
			toast({ title: t('toasts.deleteSuccess') })
			navigate(-1)
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Adjust points mutation
	const adjustPointsMutation = useMutation({
		mutationFn: (data: { points: number; reason: string }) => loyaltyService.adjustPoints(venueId, customerId!, data),
		onSuccess: () => {
			toast({ title: t('toasts.adjustPointsSuccess') })
			setShowAdjustPointsDialog(false)
			queryClient.invalidateQueries({ queryKey: ['customer', venueId, customerId] })
			queryClient.invalidateQueries({ queryKey: ['customer-loyalty', venueId, customerId] })
		},
		onError: (error: any) => {
			toast({
				title: tCommon('common.error'),
				description: error.response?.data?.message || t('toasts.error'),
				variant: 'destructive',
			})
		},
	})

	// Format currency
	const formatCurrency = useMemo(
		() => (amount: number) => {
			return new Intl.NumberFormat(getIntlLocale(i18n.language), {
				style: 'currency',
				currency: 'MXN',
			}).format(amount)
		},
		[i18n.language]
	)

	// Format date
	const formatDate = useMemo(
		() => (dateStr: string) => {
			return new Date(dateStr).toLocaleDateString(getIntlLocale(i18n.language), {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			})
		},
		[i18n.language]
	)

	const handleGoBack = () => {
		navigate(-1)
	}

	const handleEditSuccess = () => {
		setShowEditDialog(false)
		queryClient.invalidateQueries({ queryKey: ['customer', venueId, customerId] })
		queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
	}

	// Calculate point value
	const pointValue = useMemo(() => {
		if (!customer || !loyaltyConfig) return 0
		return customer.loyaltyPoints * loyaltyConfig.redemptionRate
	}, [customer, loyaltyConfig])

	// Adjust points form schema
	const adjustPointsSchema = z.object({
		points: z.number().refine((val) => val !== 0, {
			message: t('adjustPoints.validation.pointsRequired'),
		}),
		reason: z
			.string()
			.min(5, t('adjustPoints.validation.reasonMin'))
			.max(500, t('adjustPoints.validation.reasonMax')),
	})

	type AdjustPointsFormData = z.infer<typeof adjustPointsSchema>

	const {
		register: registerAdjust,
		handleSubmit: handleAdjustSubmit,
		watch: watchAdjust,
		reset: resetAdjust,
		formState: { errors: adjustErrors },
	} = useForm<AdjustPointsFormData>({
		resolver: zodResolver(adjustPointsSchema),
		defaultValues: { points: 0, reason: '' },
	})

	const watchedPoints = watchAdjust('points') || 0
	const newBalance = (customer?.loyaltyPoints || 0) + watchedPoints

	const onAdjustSubmit = (data: AdjustPointsFormData) => {
		if (newBalance < 0) {
			toast({
				title: tCommon('common.error'),
				description: t('adjustPoints.validation.insufficientPoints'),
				variant: 'destructive',
			})
			return
		}
		adjustPointsMutation.mutate(data)
	}

	const handleOpenAdjustDialog = () => {
		resetAdjust({ points: 0, reason: '' })
		setShowAdjustPointsDialog(true)
	}

	// Transaction type badge colors
	const getTransactionBadge = (type: LoyaltyTransaction['type']) => {
		const colors: Record<string, string> = {
			EARN: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
			REDEEM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
			EXPIRE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
			ADJUST: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
		}
		return colors[type] || 'bg-muted text-muted-foreground'
	}

	if (isLoading) {
		return (
			<div className="p-6 bg-background text-foreground">
				<div className="animate-pulse">
					<div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
					<div className="space-y-4">
						<div className="h-32 bg-muted rounded"></div>
						<div className="h-48 bg-muted rounded"></div>
					</div>
				</div>
			</div>
		)
	}

	if (!customer) {
		return (
			<div className="p-6 bg-background text-foreground">
				<div className="text-center py-12">
					<h1 className="text-xl font-semibold text-foreground">{tCommon('common.notFound')}</h1>
					<Button onClick={handleGoBack} className="mt-4">
						{t('detail.backToList')}
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="p-6 bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center space-x-4">
					<Button variant="ghost" onClick={handleGoBack} className="p-2">
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div>
						<h1 className="text-2xl font-bold">
							{customer.firstName} {customer.lastName}
						</h1>
						<p className="text-muted-foreground">
							{t('detail.memberSince', { date: formatDate(customer.createdAt) })}
						</p>
					</div>
				</div>

				<div className="flex items-center space-x-2">
					<PermissionGate permission="loyalty:adjust">
						<Button variant="outline" onClick={handleOpenAdjustDialog}>
							<Award className="h-4 w-4 mr-2" />
							{t('actions.adjustPoints')}
						</Button>
					</PermissionGate>
					<PermissionGate permission="customers:update">
						<Button id="customer-edit-button" variant="outline" onClick={() => setShowEditDialog(true)}>
							<Edit3 className="h-4 w-4 mr-2" />
							{t('actions.edit')}
						</Button>
					</PermissionGate>
					<PermissionGate permission="customers:delete">
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(true)}
							className="text-destructive hover:text-destructive/80"
						>
							<Trash2 className="h-4 w-4 mr-2" />
							{t('actions.delete')}
						</Button>
					</PermissionGate>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Customer Profile Card */}
				<div className="lg:col-span-1">
					<Card>
						<CardHeader>
							<div className="flex items-center space-x-3">
								<div className="w-12 h-12 bg-linear-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
									{customer.firstName[0]}
									{customer.lastName[0]}
								</div>
								<div className="flex-1">
									<CardTitle className="text-lg">
										{customer.firstName} {customer.lastName}
									</CardTitle>
									{customer.customerGroup && (
										<Badge
											variant="outline"
											style={{
												borderColor: customer.customerGroup.color,
												color: customer.customerGroup.color,
											}}
										>
											{customer.customerGroup.name}
										</Badge>
									)}
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center space-x-3">
								<Mail className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm">{customer.email}</span>
							</div>

							<div className="flex items-center space-x-3">
								<Phone className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm">{customer.phone}</span>
							</div>

							<div className="flex items-center space-x-3">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm">{t('list.columns.lastVisit')}</div>
									<div className="text-xs text-muted-foreground">
										{customer.lastVisit ? formatDate(customer.lastVisit) : t('detail.noLastVisit')}
									</div>
								</div>
							</div>

							{customer.customerGroup && (
								<div className="flex items-center space-x-3">
									<Users className="h-4 w-4 text-muted-foreground" />
									<div>
										<div className="text-sm">{t('list.columns.group')}</div>
										<div className="text-xs text-muted-foreground">{customer.customerGroup.name}</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Stats and Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs font-medium text-muted-foreground">{t('detail.stats.totalSpent')}</p>
										<p className="text-xl font-bold text-green-600 dark:text-green-400">
											{formatCurrency(customer.totalSpent)}
										</p>
									</div>
									<DollarSign className="h-6 w-6 text-green-500 dark:text-green-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs font-medium text-muted-foreground">{t('detail.stats.visits')}</p>
										<p className="text-xl font-bold text-blue-600 dark:text-blue-400">{customer.visitCount ?? 0}</p>
									</div>
									<ShoppingCart className="h-6 w-6 text-blue-500 dark:text-blue-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs font-medium text-muted-foreground">{t('detail.stats.avgOrder')}</p>
										<p className="text-xl font-bold text-purple-600 dark:text-purple-400">
											{formatCurrency(customer.averageOrderValue)}
										</p>
									</div>
									<TrendingUp className="h-6 w-6 text-purple-500 dark:text-purple-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs font-medium text-muted-foreground">{t('detail.stats.points')}</p>
										<p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
											{customer.loyaltyPoints.toLocaleString()}
										</p>
									</div>
									<Award className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Tabs */}
					<Tabs defaultValue="orders" className="space-y-4">
						<TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
							<TabsTrigger
								value="orders"
								className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
							>
								<span>{t('detail.tabs.orders')}</span>
								<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
									{customer.orders?.length || 0}
								</span>
							</TabsTrigger>
							<TabsTrigger
								value="loyalty"
								className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
							>
								<span>{t('detail.tabs.loyalty')}</span>
								<span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
									{loyaltyData?.data?.length || 0}
								</span>
							</TabsTrigger>
						</TabsList>

						<TabsContent value="orders">
							<Card>
								<CardHeader>
									<CardTitle>{t('detail.orders.title')}</CardTitle>
								</CardHeader>
								<CardContent>
									{customer.orders && customer.orders.length > 0 ? (
										<div className="space-y-3">
											{customer.orders.map((order) => (
												<div
													key={order.id}
													className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
												>
													<div>
														<div className="font-medium">
															{t('detail.orders.orderNumber', { number: order.orderNumber })}
														</div>
														<div className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</div>
													</div>
													<div className="flex items-center gap-3">
														<Badge variant="outline">{order.status}</Badge>
														<span className="font-medium">{formatCurrency(order.total)}</span>
													</div>
												</div>
											))}
										</div>
									) : (
										<p className="text-center text-muted-foreground py-8">{t('detail.orders.emptyState')}</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="loyalty">
							<Card>
								<CardHeader>
									<div className="flex items-center justify-between">
										<div>
											<CardTitle>{t('detail.loyalty.title')}</CardTitle>
											<CardDescription>
												{t('detail.loyalty.currentBalance')}: {customer.loyaltyPoints.toLocaleString()}{' '}
												{pointValue > 0 && `(${t('detail.loyalty.pointsValue', { value: formatCurrency(pointValue) })})`}
											</CardDescription>
										</div>
										<select
											value={loyaltyTypeFilter}
											onChange={(e) => setLoyaltyTypeFilter(e.target.value)}
											className="border rounded-md px-3 py-1.5 text-sm bg-background"
										>
											<option value="">{t('detail.loyalty.allTypes')}</option>
											<option value="EARN">{t('detail.loyalty.types.EARN')}</option>
											<option value="REDEEM">{t('detail.loyalty.types.REDEEM')}</option>
											<option value="EXPIRE">{t('detail.loyalty.types.EXPIRE')}</option>
											<option value="ADJUST">{t('detail.loyalty.types.ADJUST')}</option>
										</select>
									</div>
								</CardHeader>
								<CardContent>
									{loyaltyData?.data && loyaltyData.data.length > 0 ? (
										<div className="space-y-3">
											{loyaltyData.data.map((transaction) => (
												<div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
													<div className="flex items-center gap-3">
														{transaction.points > 0 ? (
															<Plus className="h-4 w-4 text-green-500" />
														) : (
															<Minus className="h-4 w-4 text-red-500" />
														)}
														<div>
															<div className="font-medium">
																{transaction.points > 0 ? '+' : ''}
																{transaction.points} {t('list.columns.points').toLowerCase()}
															</div>
															<div className="text-sm text-muted-foreground">
																{transaction.reason || transaction.order?.orderNumber || '—'}
															</div>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<Badge className={getTransactionBadge(transaction.type)}>
															{t(`detail.loyalty.types.${transaction.type}`)}
														</Badge>
														<span className="text-sm text-muted-foreground">{formatDate(transaction.createdAt)}</span>
													</div>
												</div>
											))}
										</div>
									) : (
										<p className="text-center text-muted-foreground py-8">{t('detail.loyalty.emptyState')}</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			</div>

			{/* Edit Dialog */}
			{showEditDialog && (
				<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>{t('form.editTitle')}</DialogTitle>
							<DialogDescription>
								{customer.firstName} {customer.lastName}
							</DialogDescription>
						</DialogHeader>
						<CustomerForm
							venueId={venueId}
							customer={customer}
							groups={(groupsData?.data as CustomerGroup[]) || []}
							onSuccess={handleEditSuccess}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Delete Confirmation Dialog */}
			{showDeleteDialog && (
				<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
							<AlertDialogDescription>
								{t('delete.description', { name: `${customer.firstName} ${customer.lastName}` })}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => deleteMutation.mutate()}
								disabled={deleteMutation.isPending}
								className="bg-destructive hover:bg-destructive/90"
							>
								{deleteMutation.isPending ? tCommon('common.deleting') : t('delete.confirm')}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}

			{/* Adjust Points Dialog */}
			{showAdjustPointsDialog && (
				<Dialog open={showAdjustPointsDialog} onOpenChange={setShowAdjustPointsDialog}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>{t('adjustPoints.title')}</DialogTitle>
							<DialogDescription>
								{t('adjustPoints.description', { name: `${customer.firstName} ${customer.lastName}` })}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleAdjustSubmit(onAdjustSubmit)} className="space-y-4">
							<div className="p-3 bg-muted rounded-lg text-center">
								<div className="text-sm text-muted-foreground">{t('adjustPoints.currentBalance')}</div>
								<div className="text-2xl font-bold">{customer.loyaltyPoints.toLocaleString()}</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="points">{t('adjustPoints.fields.points')}</Label>
								<Input
									id="points"
									type="number"
									placeholder={t('adjustPoints.placeholders.points')}
									{...registerAdjust('points', { valueAsNumber: true })}
								/>
								{adjustErrors.points && <p className="text-sm text-destructive">{adjustErrors.points.message}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="reason">{t('adjustPoints.fields.reason')}</Label>
								<Textarea
									id="reason"
									placeholder={t('adjustPoints.placeholders.reason')}
									{...registerAdjust('reason')}
									rows={3}
								/>
								{adjustErrors.reason && <p className="text-sm text-destructive">{adjustErrors.reason.message}</p>}
							</div>

							<div className="p-3 bg-muted rounded-lg text-center">
								<div className="text-sm text-muted-foreground">{t('adjustPoints.newBalance')}</div>
								<div className={`text-2xl font-bold ${newBalance < 0 ? 'text-destructive' : ''}`}>
									{newBalance.toLocaleString()}
								</div>
							</div>

							<div className="flex justify-end gap-3 pt-4">
								<Button type="button" variant="outline" onClick={() => setShowAdjustPointsDialog(false)}>
									{t('adjustPoints.cancel')}
								</Button>
								<Button type="submit" disabled={adjustPointsMutation.isPending || newBalance < 0}>
									{adjustPointsMutation.isPending ? tCommon('saving') : t('adjustPoints.submit')}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
