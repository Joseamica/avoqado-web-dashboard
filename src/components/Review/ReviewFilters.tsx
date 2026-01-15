import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ChevronDown, ChevronUp, FilterX, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface ReviewFiltersState {
  sources: string[]
  ratings: number[]
  sentiment: string | null
  responseStatus: 'all' | 'responded' | 'unresponded'
  searchQuery: string
}

interface ReviewFiltersProps {
  filters: ReviewFiltersState
  onFiltersChange: (filters: ReviewFiltersState) => void
  totalCount: number
  filteredCount: number
}

// TODO: Habilitar fuentes externas cuando tengamos verificado el negocio (Google, TripAdvisor, Facebook, Yelp)
const _sources = ['AVOQADO' /*, 'GOOGLE', 'TRIPADVISOR', 'FACEBOOK', 'YELP'*/]
const sentiments = ['positive', 'neutral', 'negative']

export function ReviewFilters({ filters, onFiltersChange, totalCount, filteredCount }: ReviewFiltersProps) {
  const { t } = useTranslation('reviews')
  const [isExpanded, setIsExpanded] = useState(true)

  const _handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source) ? filters.sources.filter(s => s !== source) : [...filters.sources, source]
    onFiltersChange({ ...filters, sources: newSources })
  }

  const handleRatingToggle = (rating: number) => {
    const newRatings = filters.ratings.includes(rating) ? filters.ratings.filter(r => r !== rating) : [...filters.ratings, rating]
    onFiltersChange({ ...filters, ratings: newRatings })
  }

  const handleSentimentChange = (value: string) => {
    const sentiment = value === 'all' ? null : value
    onFiltersChange({ ...filters, sentiment })
  }

  const _handleResponseStatusChange = (value: 'all' | 'responded' | 'unresponded') => {
    onFiltersChange({ ...filters, responseStatus: value })
  }

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchQuery: value })
  }

  const handleReset = () => {
    onFiltersChange({
      sources: [],
      ratings: [],
      sentiment: null,
      responseStatus: 'all',
      searchQuery: '',
    })
  }

  const hasActiveFilters =
    filters.sources.length > 0 ||
    filters.ratings.length > 0 ||
    filters.sentiment !== null ||
    filters.responseStatus !== 'all' ||
    filters.searchQuery !== ''

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{t('filters.title')}</CardTitle>
            {hasActiveFilters && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {filteredCount} / {totalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 px-2">
                <FilterX className="h-4 w-4 mr-1" />
                {t('filters.reset')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.search.label')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('filters.search.placeholder')}
                value={filters.searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Separator />

          {/* Source Filters - TODO: Pending implementation of external sources */}
          {/* <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.sources.label')}</Label>
            <div className="space-y-2">
              {sources.map(source => (
                <div key={source} className="flex items-center space-x-2">
                  <Checkbox id={`source-${source}`} checked={filters.sources.includes(source)} onCheckedChange={() => handleSourceToggle(source)} />
                  <Label htmlFor={`source-${source}`} className="text-sm font-normal cursor-pointer">
                    {t(`sources.${source.toLowerCase()}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator /> */}

          {/* Rating Filter (Multi-select) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('filters.rating.label')}</Label>

            <div className="flex flex-col gap-2">
              <Button
                variant={filters.ratings.length === 0 ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onFiltersChange({ ...filters, ratings: [] })}
                className="w-full justify-center"
              >
                {t('filters.rating.all')}
              </Button>

              <div className="grid grid-cols-5 gap-2">
                {[5, 4, 3, 2, 1].map(star => (
                  <Button
                    key={star}
                    variant={filters.ratings.includes(star) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRatingToggle(star)}
                    className="h-9 p-0 flex items-center justify-center gap-1"
                    title={t('filters.rating.exact', { rating: star, defaultValue: `${star} estrellas` })}
                  >
                    <span className="font-medium">{star}</span>
                    <Star
                      className={`h-3.5 w-3.5 ${
                        filters.ratings.includes(star)
                          ? 'fill-primary-foreground text-primary-foreground'
                          : 'fill-yellow-400 text-yellow-400'
                      }`}
                    />
                  </Button>
                ))}
              </div>
            </div>

            {filters.ratings.length > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                {t('filters.rating.multiSelectHint', { defaultValue: 'Filtrando por: ' }) +
                  filters.ratings.sort((a, b) => b - a).join(', ') +
                  ' ★'}
              </p>
            )}
          </div>

          <Separator />

          {/* Sentiment Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.sentiment.label')}</Label>
            <RadioGroup value={filters.sentiment || 'all'} onValueChange={handleSentimentChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="sentiment-all" />
                <Label htmlFor="sentiment-all" className="text-sm font-normal cursor-pointer">
                  {t('filters.sentiment.all')}
                </Label>
              </div>
              {sentiments.map(sentiment => (
                <div key={sentiment} className="flex items-center space-x-2">
                  <RadioGroupItem value={sentiment} id={`sentiment-${sentiment}`} />
                  <Label htmlFor={`sentiment-${sentiment}`} className="text-sm font-normal cursor-pointer">
                    {t(`sentiment.${sentiment}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Response Status - TODO: Pending Google Business verification and response feature */}
          {/* <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.responseStatus.label')}</Label>
            <RadioGroup value={filters.responseStatus} onValueChange={handleResponseStatusChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="response-all" />
                <Label htmlFor="response-all" className="text-sm font-normal cursor-pointer">
                  {t('filters.responseStatus.all')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="responded" id="response-responded" />
                <Label htmlFor="response-responded" className="text-sm font-normal cursor-pointer">
                  {t('filters.responseStatus.responded')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unresponded" id="response-unresponded" />
                <Label htmlFor="response-unresponded" className="text-sm font-normal cursor-pointer">
                  {t('filters.responseStatus.unresponded')}
                </Label>
              </div>
            </RadioGroup>
          </div> */}
        </CardContent>
      )}
    </Card>
  )
}
