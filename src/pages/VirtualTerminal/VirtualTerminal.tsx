import { Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

export default function VirtualTerminal() {
  const { t } = useTranslation('virtualTerminal')

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Badge variant="outline" className="text-[10px] h-5 px-2">
          {t('comingSoon')}
        </Badge>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-2">{t('emptyState.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('emptyState.description')}
        </p>
      </div>
    </div>
  )
}
