import { Badge } from '@/components/ui/badge'
import { Globe, MapPin, Share2, Star, TabletSmartphone, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type ReviewSource = 'AVOQADO' | 'GOOGLE' | 'TRIPADVISOR' | 'FACEBOOK' | 'YELP' | 'TPV'

interface SourceBadgeProps {
  source: ReviewSource
  className?: string
}

const sourceConfig = {
  AVOQADO: {
    icon: Utensils,
    colorClass: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30',
    labelKey: 'sources.avoqado',
  },
  GOOGLE: {
    icon: MapPin,
    colorClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    labelKey: 'sources.google',
  },
  TRIPADVISOR: {
    icon: Star,
    colorClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    labelKey: 'sources.tripadvisor',
  },
  FACEBOOK: {
    icon: Share2,
    colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
    labelKey: 'sources.facebook',
  },
  YELP: {
    icon: Globe,
    colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    labelKey: 'sources.yelp',
  },
  TPV: {
    icon: TabletSmartphone,
    colorClass: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    labelKey: 'sources.tpv',
  },
}

export function SourceBadge({ source, className = '' }: SourceBadgeProps) {
  const { t } = useTranslation('reviews')
  const config = sourceConfig[source]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`flex items-center gap-1 px-2 py-0.5 ${config.colorClass} ${className}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{t(config.labelKey)}</span>
    </Badge>
  )
}
