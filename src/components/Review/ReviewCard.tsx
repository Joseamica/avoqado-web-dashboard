import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PermissionGate } from '@/components/PermissionGate'
import { Calendar, MessageSquare, Star, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SentimentBadge, getSentimentFromRating } from './SentimentBadge'
import { SourceBadge } from './SourceBadge'
import { format } from 'date-fns'
import { enUS, es, fr } from 'date-fns/locale'

interface Review {
  id: string
  venueId: string
  overallRating: number
  foodRating?: number
  serviceRating?: number
  ambienceRating?: number
  comment?: string
  customerName?: string
  customerEmail?: string
  source: 'AVOQADO' | 'GOOGLE' | 'TRIPADVISOR' | 'FACEBOOK' | 'YELP'
  externalId?: string
  createdAt: string
  updatedAt: string
  responseText?: string
  respondedAt?: string
  responseAutomated?: boolean
}

interface ReviewCardProps {
  review: Review
  onRespond?: (review: Review) => void
}

const dateLocales = {
  en: enUS,
  es: es,
  fr: fr,
}

export function ReviewCard({ review, onRespond }: ReviewCardProps) {
  const { t, i18n } = useTranslation('reviews')
  const sentiment = getSentimentFromRating(review.overallRating)

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const locale = dateLocales[i18n.language as keyof typeof dateLocales] || enUS
    return format(date, 'PPp', { locale })
  }

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`${index < rating ? 'fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400' : 'text-muted-foreground/30'}`}
            size={size}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(review.customerName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">{review.customerName || t('card.anonymousCustomer')}</h3>
                <SourceBadge source={review.source} />
                <SentimentBadge sentiment={sentiment} />
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(review.createdAt)}</span>
                </div>
                {review.customerEmail && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{review.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {renderStars(review.overallRating, 18)}
            <span className="text-2xl font-bold text-foreground">{review.overallRating.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Detailed Ratings */}
        {(review.foodRating || review.serviceRating || review.ambienceRating) && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
            {review.foodRating && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t('card.ratings.food')}</span>
                {renderStars(review.foodRating, 14)}
                <span className="text-sm font-semibold">{review.foodRating.toFixed(1)}</span>
              </div>
            )}
            {review.serviceRating && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t('card.ratings.service')}</span>
                {renderStars(review.serviceRating, 14)}
                <span className="text-sm font-semibold">{review.serviceRating.toFixed(1)}</span>
              </div>
            )}
            {review.ambienceRating && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t('card.ratings.ambience')}</span>
                {renderStars(review.ambienceRating, 14)}
                <span className="text-sm font-semibold">{review.ambienceRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* Comment */}
        {review.comment && (
          <div className="space-y-2">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{review.comment}</p>
          </div>
        )}

        {/* Response */}
        {review.responseText && (
          <>
            <Separator />
            <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">{t('card.response.title')}</span>
                {review.responseAutomated && (
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t('card.response.aiGenerated')}</span>
                )}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{review.responseText}</p>
              {review.respondedAt && (
                <p className="text-xs text-muted-foreground">{formatDate(review.respondedAt)}</p>
              )}
            </div>
          </>
        )}
      </CardContent>

      {!review.responseText && (
        <CardFooter className="pt-0">
          <PermissionGate permission="reviews:respond">
            <Button variant="outline" size="sm" className="w-full" onClick={() => onRespond?.(review)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('card.actions.respond')}
            </Button>
          </PermissionGate>
        </CardFooter>
      )}
    </Card>
  )
}
