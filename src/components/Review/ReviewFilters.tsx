import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ChevronDown, ChevronUp, FilterX, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface ReviewFiltersState {
  sources: string[]
  minRating: number | null
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

const sources = ['AVOQADO', 'GOOGLE', 'TRIPADVISOR', 'FACEBOOK', 'YELP']
const sentiments = ['positive', 'neutral', 'negative']

export function ReviewFilters({ filters, onFiltersChange, totalCount, filteredCount }: ReviewFiltersProps) {
  const { t } = useTranslation('reviews')
  const [isExpanded, setIsExpanded] = useState(true)

  const handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source) ? filters.sources.filter(s => s !== source) : [...filters.sources, source]
    onFiltersChange({ ...filters, sources: newSources })
  }

  const handleRatingChange = (value: string) => {
    const rating = value === 'all' ? null : parseInt(value)
    onFiltersChange({ ...filters, minRating: rating })
  }

  const handleSentimentChange = (value: string) => {
    const sentiment = value === 'all' ? null : value
    onFiltersChange({ ...filters, sentiment })
  }

  const handleResponseStatusChange = (value: 'all' | 'responded' | 'unresponded') => {
    onFiltersChange({ ...filters, responseStatus: value })
  }

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchQuery: value })
  }

  const handleReset = () => {
    onFiltersChange({
      sources: [],
      minRating: null,
      sentiment: null,
      responseStatus: 'all',
      searchQuery: '',
    })
  }

  const hasActiveFilters =
    filters.sources.length > 0 || filters.minRating !== null || filters.sentiment !== null || filters.responseStatus !== 'all' || filters.searchQuery !== ''

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

          {/* Source Filters */}
          <div className="space-y-2">
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

          <Separator />

          {/* Rating Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.rating.label')}</Label>
            <RadioGroup value={filters.minRating === null ? 'all' : filters.minRating.toString()} onValueChange={handleRatingChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="rating-all" />
                <Label htmlFor="rating-all" className="text-sm font-normal cursor-pointer">
                  {t('filters.rating.all')}
                </Label>
              </div>
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} className="flex items-center space-x-2">
                  <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                  <Label htmlFor={`rating-${rating}`} className="text-sm font-normal cursor-pointer">
                    {rating === 5 ? t('filters.rating.exactly', { rating }) : t('filters.rating.andUp', { rating })}
                  </Label>
                </div>
              ))}
            </RadioGroup>
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

          {/* Response Status */}
          <div className="space-y-2">
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
          </div>
        </CardContent>
      )}
    </Card>
  )
}
