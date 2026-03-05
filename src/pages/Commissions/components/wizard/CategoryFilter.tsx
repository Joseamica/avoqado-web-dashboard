import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getMenuCategories } from '@/services/menu.service'

interface CategoryFilterProps {
	categoryIds: string[]
	onChange: (ids: string[]) => void
}

export default function CategoryFilter({ categoryIds, onChange }: CategoryFilterProps) {
	const { t } = useTranslation('commissions')
	const { venueId } = useCurrentVenue()

	const { data: categories = [] } = useQuery({
		queryKey: ['categories', venueId],
		queryFn: () => getMenuCategories(venueId!),
		enabled: !!venueId,
	})

	const activeCategories = categories.filter((c: any) => c.active !== false)

	const toggleCategory = (categoryId: string) => {
		if (categoryIds.includes(categoryId)) {
			onChange(categoryIds.filter(id => id !== categoryId))
		} else {
			onChange([...categoryIds, categoryId])
		}
	}

	const removeCategory = (categoryId: string) => {
		onChange(categoryIds.filter(id => id !== categoryId))
	}

	const selectedNames = activeCategories
		.filter((c: any) => categoryIds.includes(c.id))
		.map((c: any) => ({ id: c.id, name: c.name }))

	return (
		<div className="space-y-2">
			{/* Selected categories as pills */}
			{selectedNames.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{selectedNames.map((cat) => (
						<Badge key={cat.id} variant="secondary" className="gap-1 pr-1">
							{cat.name}
							<button
								type="button"
								onClick={() => removeCategory(cat.id)}
								className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					))}
				</div>
			)}

			{/* Category picker */}
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground">
						{selectedNames.length === 0
							? t('wizard.step2.selectCategories')
							: t('wizard.step2.addMoreCategories')}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-2 max-h-60 overflow-y-auto" align="start">
					{activeCategories.length === 0 ? (
						<p className="text-sm text-muted-foreground p-2">
							{t('wizard.step2.noCategories')}
						</p>
					) : (
						<div className="space-y-1">
							{activeCategories.map((category: any) => (
								<label
									key={category.id}
									className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
								>
									<Checkbox
										checked={categoryIds.includes(category.id)}
										onCheckedChange={() => toggleCategory(category.id)}
									/>
									<span className="text-sm">{category.name}</span>
								</label>
							))}
						</div>
					)}
				</PopoverContent>
			</Popover>
		</div>
	)
}
