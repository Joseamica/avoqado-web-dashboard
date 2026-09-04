import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { Mail, Plus } from 'lucide-react'

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import marketingService, { type CampaignListItem, type CampaignStatus } from '@/services/marketing.service'

import { BirthdayAutomationCard } from './components/BirthdayAutomationCard'
import { CampaignEditorModal } from './components/CampaignEditorModal'

/**
 * Campañas de correo a clientes — la lista.
 *
 * 🔴 Paginada por el SERVIDOR (`page`/`pageSize`), nunca trayendo todo: es lo que exige
 * `bounded-data-and-query-load.md`, y el endpoint acota su `select` para no arrastrar el
 * cuerpo del correo de cada campaña.
 *
 * Envuelta en `<FeatureGate>` porque es PRO. El gate falla ABIERTO a propósito (si la
 * señal del plan no se puede determinar, deja pasar): un fallo de red nunca debe verse
 * como un paywall — ése fue un bug real de producción.
 */

/** El color dice el estado sin leer: lo enviado en verde, lo que no salió en rojo. */
const VARIANTE_POR_ESTADO: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
	DRAFT: 'outline',
	SCHEDULED: 'secondary',
	ENQUEUED: 'secondary',
	SENDING: 'secondary',
	SENT: 'default',
	CANCELLED: 'outline',
	BLOCKED: 'destructive',
	EXPIRED: 'destructive',
}

export default function Campaigns() {
	const { venueId } = useCurrentVenue()
	const { t } = useTranslation('customers')
	const { formatDate } = useVenueDateTime()

	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
	const [editando, setEditando] = useState<{ id: string | null } | null>(null)

	const { data, isLoading } = useQuery({
		queryKey: ['campaigns', venueId, pagination.pageIndex, pagination.pageSize],
		queryFn: () =>
			marketingService.listCampaigns(venueId, {
				page: pagination.pageIndex + 1,
				pageSize: pagination.pageSize,
			}),
		enabled: Boolean(venueId),
	})

	const columns = useMemo<ColumnDef<CampaignListItem>[]>(
		() => [
			{
				accessorKey: 'name',
				header: t('campaigns.columns.name'),
				cell: ({ row }) => (
					<div className="min-w-0">
						<div className="font-medium truncate">{row.original.name}</div>
						<div className="text-muted-foreground text-xs truncate">{row.original.subject}</div>
					</div>
				),
			},
			{
				accessorKey: 'status',
				header: t('campaigns.columns.status'),
				cell: ({ row }) => (
					<Badge variant={VARIANTE_POR_ESTADO[row.original.status] ?? 'outline'}>
						{t(`campaigns.status.${row.original.status}`, { defaultValue: row.original.status })}
					</Badge>
				),
			},
			{
				accessorKey: 'audience',
				header: t('campaigns.columns.audience'),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{t(`campaigns.audience.${row.original.audience}`, { defaultValue: row.original.audience })}
					</span>
				),
			},
			{
				id: 'entrega',
				header: t('campaigns.columns.delivery'),
				cell: ({ row }) => {
					const c = row.original
					// Antes de mandar no hay nada que contar: un "0 de 0" se lee como fracaso.
					if (c.status === 'DRAFT' || c.status === 'SCHEDULED') {
						return <span className="text-muted-foreground">—</span>
					}
					return (
						<div className="text-sm">
							<span className="font-medium">{c.sentCount}</span>
							<span className="text-muted-foreground"> / {c.totalRecipients}</span>
							{c.failedCount > 0 && (
								<span className="text-destructive ml-2">{t('campaigns.failedCount', { count: c.failedCount })}</span>
							)}
						</div>
					)
				},
			},
			{
				accessorKey: 'createdAt',
				header: t('campaigns.columns.createdAt'),
				cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
			},
		],
		[t, formatDate],
	)

	return (
		<FeatureGate feature="CUSTOMER_CAMPAIGNS">
			<div className="p-4 bg-background text-foreground">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold">{t('campaigns.title')}</h1>
						<p className="text-muted-foreground">{t('campaigns.subtitle')}</p>
					</div>

					{/* 🔴 Crear pide `marketing:manage`. MANDAR pide `marketing:send`, que NO se
					    hereda de éste — ese candado vive en el diálogo de envío. */}
					<PermissionGate permission="marketing:manage">
						<Button onClick={() => setEditando({ id: null })} data-tour="create-campaign">
							<Plus className="h-4 w-4 mr-2" />
							{t('campaigns.new')}
						</Button>
					</PermissionGate>
				</div>

				{/* La felicitación automática va ARRIBA de la lista: es la campaña que corre sola,
				    y el dueño la busca aquí, no en otra pantalla. */}
				<BirthdayAutomationCard venueId={venueId} />

				{/* 🔴 O la tabla, o el mensaje de vacío — nunca los dos. Con la tabla vacía se
				    veían DOS avisos encimados: su «Sin resultados» y el nuestro. */}
				{!isLoading && (data?.total ?? 0) === 0 ? null : (
				<DataTable
					data={data?.items ?? []}
					columns={columns}
					isLoading={isLoading}
					pagination={pagination}
					setPagination={setPagination}
					tableId="campaigns:list"
					rowCount={data?.total ?? 0}
					onRowClick={(row: CampaignListItem) => setEditando({ id: row.id })}
				/>
				)}

				{!isLoading && (data?.total ?? 0) === 0 && (
					<div className="mt-8 flex flex-col items-center text-center text-muted-foreground">
						<Mail className="h-8 w-8 mb-3 opacity-60" aria-hidden="true" />
						{/* Un vacío se explica; no se deja una tabla en blanco. */}
						<p className="font-medium text-foreground">{t('campaigns.empty.title')}</p>
						<p className="text-sm max-w-md mt-1">{t('campaigns.empty.body')}</p>
					</div>
				)}

				{editando && (
					<CampaignEditorModal
						venueId={venueId}
						campaignId={editando.id}
						open
						onClose={() => setEditando(null)}
					/>
				)}
			</div>
		</FeatureGate>
	)
}
