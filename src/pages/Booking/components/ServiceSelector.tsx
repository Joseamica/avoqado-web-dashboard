import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
	id: string
	name: string
	price: number | null
	duration: number | null
	eventCapacity: number | null
}

interface ServiceSelectorProps {
	products: Product[]
	selectedProductId: string | null
	onSelect: (product: Product) => void
}

export function ServiceSelector({ products, selectedProductId, onSelect }: ServiceSelectorProps) {
	const { t } = useTranslation('reservations')

	if (products.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground">
				{t('publicBooking.service.noProducts')}
			</p>
		)
	}

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">{t('publicBooking.service.title')}</h2>
			<div className="space-y-3">
				{products.map(product => {
					const isSelected = product.id === selectedProductId
					return (
						<button
							key={product.id}
							type="button"
							onClick={() => onSelect(product)}
							className={cn(
								'flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-all',
								isSelected
									? 'border-primary bg-primary/5'
									: 'border-border hover:border-primary/50',
							)}
						>
							<div className="space-y-1">
								<p className="font-medium">{product.name}</p>
								{product.duration && (
									<p className="flex items-center gap-1 text-sm text-muted-foreground">
										<Clock className="h-3.5 w-3.5" />
										{t('publicBooking.service.duration', { min: product.duration })}
									</p>
								)}
							</div>
							{product.price != null && (
								<span className="text-lg font-semibold">
									${product.price.toFixed(0)}
								</span>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}
