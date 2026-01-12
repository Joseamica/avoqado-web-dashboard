import { useTranslation } from 'react-i18next'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { CreateCommissionWizard } from './wizard'

interface CreateConfigDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export default function CreateConfigDialog({ open, onOpenChange }: CreateConfigDialogProps) {
	const { t } = useTranslation('commissions')

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t('config.create')}</DialogTitle>
				</DialogHeader>

				<CreateCommissionWizard onSuccess={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	)
}
