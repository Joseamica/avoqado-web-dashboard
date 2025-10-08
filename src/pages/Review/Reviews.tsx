import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useThemeClasses } from '@/hooks/use-theme-classes'
import { useTranslation } from 'react-i18next'

// Review interface based on new backend structure
interface Review {
  id: string
  venueId: string
  overallRating: number // 1-5 rating
  foodRating?: number
  serviceRating?: number
  ambienceRating?: number
  comment?: string
  customerName?: string
  customerEmail?: string
  source: string
  externalId?: string
  createdAt: string
  updatedAt: string
}

export default function ReviewSummary() {
  const { venueId } = useCurrentVenue()
  const theme = useThemeClasses()
  const { t } = useTranslation()

  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date } | null>(null)

  // Se obtiene la lista de todas las reviews sin filtrar
  const {
    data: reviewsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reviews', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reviews`)
      return response.data
    },
    enabled: !!venueId,
  })

  const reviews = reviewsData?.reviews || []

  // Filtrar las reviews en el frontend según el rango seleccionado
  const filteredReviews: Review[] =
    selectedRange && reviews.length > 0
      ? reviews.filter((review: Review) => {
          const reviewDate = new Date(review.createdAt)
          return reviewDate >= selectedRange.from && reviewDate <= selectedRange.to
        })
      : reviews
  // Procesamos las reseñas y asignamos valores por defecto

  // Calculamos el promedio numérico de las estrellas (overallRating en el nuevo modelo)
  const average =
    filteredReviews?.length > 0 ? filteredReviews.reduce((sum, review) => sum + review.overallRating, 0) / filteredReviews?.length : 0

  const averageRating = filteredReviews?.length > 0 ? average.toFixed(1) : 'N/A'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-foreground">{t('reviews.title')}</h1>
      <DateRangePicker
        showCompare={false}
        onUpdate={({ range }) => {
          setSelectedRange(range)
        }}
        initialDateFrom="2020-01-01"
        initialDateTo="2030-12-31"
        align="start"
        locale="es-ES"
      />
      <Card className={`p-4 grid grid-cols-1 md:grid-cols-2 gap-6 ${theme.card}`}>
        <div>
          <CardHeader>
            <CardTitle>{t('reviews.establishments')}</CardTitle>
            <CardDescription>
              {t('reviews.averageDescription', { count: filteredReviews?.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-foreground">{t('reviews.loading')}</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>{t('reviews.error')}</p>
                <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : t('reviews.unknownError')}</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('reviews.noReviews')}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold mb-2 text-foreground">{averageRating}</div>
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(Math.round(average))].map((_, i) => (
                      <Star key={i} className="text-yellow-500 dark:text-yellow-400 fill-yellow-500 dark:fill-yellow-400" size={20} />
                    ))}
                  </div>
                </div>
                <TooltipProvider delayDuration={100}>
                  <ul className="text-muted-foreground space-y-1">
                    {[5, 4, 3, 2, 1].map(stars => {
                      const count = filteredReviews?.filter(r => r.overallRating === stars).length || 0
                      const percentage = filteredReviews?.length > 0 ? (count / filteredReviews?.length) * 100 : 0

                      return (
                        <li key={stars} className="flex items-center space-x-2 flex-row">
                          <span className="shrink-0 w-20 text-foreground">
                            {stars} {t(stars === 1 ? 'reviews.star' : 'reviews.stars')}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-3 bg-muted border border-border rounded">
                                <div className="h-full bg-yellow-500 dark:bg-yellow-400 rounded" style={{ width: `${percentage}%` }}></div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('reviews.reviewCount', { count })}</p>
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      )
                    })}
                  </ul>
                </TooltipProvider>
              </>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  )
}
