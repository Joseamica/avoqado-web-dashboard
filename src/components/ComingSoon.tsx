import { useTranslation } from 'react-i18next'

export const ComingSoon = ({ feature }: { feature: string }) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">{feature}</h2>
        <p className="text-muted-foreground">{t('common.comingSoon')}</p>
      </div>
    </div>
  )
}
