import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { CreateCommissionWizard } from './wizard'
import type { WizardHandle, WizardStepInfo } from './wizard/CreateCommissionWizard'

interface CreateConfigDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export default function CreateConfigDialog({ open, onOpenChange }: CreateConfigDialogProps) {
	const { t } = useTranslation('commissions')
	const { t: tCommon } = useTranslation()
	const wizardRef = useRef<WizardHandle>(null)
	const [stepInfo, setStepInfo] = useState<WizardStepInfo>({
		currentStep: 1,
		totalSteps: 2,
		canSubmit: false,
		isSubmitting: false,
	})

	const { currentStep, totalSteps, canSubmit, isSubmitting } = stepInfo

	const headerActions = (
		<div className="flex items-center gap-2">
			{currentStep > 1 && (
				<Button variant="ghost" size="icon" onClick={() => wizardRef.current?.goPrevious()}>
					<ChevronLeft className="w-5 h-5" />
				</Button>
			)}
			{currentStep < totalSteps ? (
				<Button onClick={() => wizardRef.current?.goNext()}>
					{t('wizard.buttons.next')}
				</Button>
			) : (
				<Button
					onClick={() => wizardRef.current?.submit()}
					disabled={!canSubmit || isSubmitting}
				>
					{isSubmitting ? tCommon('loading') : t('wizard.buttons.create')}
				</Button>
			)}
		</div>
	)

	return (
		<FullScreenModal
			open={open}
			onClose={() => onOpenChange(false)}
			title={t('config.create')}
			actions={headerActions}
			contentClassName="px-4 py-6"
		>
			<div className="mx-auto max-w-2xl">
				<CreateCommissionWizard
					ref={wizardRef}
					onSuccess={() => onOpenChange(false)}
					onStepChange={setStepInfo}
					hideNavigation
				/>
			</div>
		</FullScreenModal>
	)
}
