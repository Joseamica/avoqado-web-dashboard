import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { CreateModifierGroupWizard } from './components/CreateModifierGroupWizard'

export default function CreateModifierGroup() {
  const { t } = useTranslation('menu')
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-row items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="../">
            <ChevronLeft className="w-4 h-4" />
            <span>{t('forms.buttons.goBack')}</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t('modifiers.createGroup.title')}</h1>
      </div>

      <CreateModifierGroupWizard onCancel={() => navigate('../')} onSuccess={() => navigate('../')} />
    </div>
  )
}
