import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import LanguageSwitcher from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export default function PreferenceSettings() {
  const { t } = useTranslation('settings')

  return (
    <div className="p-6 max-w-2xl" data-tour="settings-preferences-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" />
          {t('preferences.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('preferences.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-input divide-y divide-border">
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <p className="text-sm font-medium">{t('preferences.language.label')}</p>
            <p className="text-sm text-muted-foreground">{t('preferences.language.help')}</p>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <p className="text-sm font-medium">{t('preferences.theme.label')}</p>
            <p className="text-sm text-muted-foreground">{t('preferences.theme.help')}</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
