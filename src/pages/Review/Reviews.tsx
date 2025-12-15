import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { BadReviewSettingsDialog } from '@/components/Review/BadReviewSettingsCard'
import { ReviewCard } from '@/components/Review/ReviewCard'
import { ReviewFilters, ReviewFiltersState } from '@/components/Review/ReviewFilters'
import { ReviewResponseDialog } from '@/components/Review/ReviewResponseDialog'
import { ReviewStats } from '@/components/Review/ReviewStats'
import { getSentimentFromRating } from '@/components/Review/SentimentBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { StaffRole, Review } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'

type SortOption = 'newest' | 'oldest' | 'highestRated' | 'lowestRated' | 'unresponded'

const REVIEWS_PER_PAGE = 20

export default function ReviewSummary() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { t, i18n } = useTranslation('reviews')
  const { t: tCommon } = useTranslation('common')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN

  // Initialize with a default date range (last 365 days)
  const getDefaultRange = () => {
    const to = new Date()
    const from = new Date()
    from.setFullYear(from.getFullYear() - 1)
    return { from, to }
  }

  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>(getDefaultRange())
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [responseDialogOpen, setResponseDialogOpen] = useState(false)

  const [filters, setFilters] = useState<ReviewFiltersState>({
    sources: [],
    minRating: null,
    sentiment: null,
    responseStatus: 'all',
    searchQuery: '',
  })
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null)

  // Delete mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      await api.delete(`/api/v1/dashboard/venues/${venueId}/reviews/${reviewId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', venueId] })
      toast({ title: tCommon('superadmin.delete.success') })
      setDeleteDialogOpen(false)
      setReviewToDelete(null)
    },
    onError: () => {
      toast({ title: tCommon('superadmin.delete.error'), variant: 'destructive' })
    },
  })

  const handleDeleteClick = (review: Review) => {
    setReviewToDelete(review)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (reviewToDelete) {
      deleteReviewMutation.mutate(reviewToDelete.id)
    }
  }

  // Fetch reviews from API
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

  // Memoize reviews to prevent dependency issues in subsequent useMemo
  const reviews: Review[] = useMemo(() => reviewsData?.reviews || [], [reviewsData])

  // Apply all filters and sorting
  const { filteredAndSortedReviews, totalCount } = useMemo(() => {
    let result = [...reviews]

    // Date range filter
    if (selectedRange) {
      result = result.filter(review => {
        const reviewDate = new Date(review.createdAt)
        const toDateEndOfDay = new Date(selectedRange.to)
        toDateEndOfDay.setHours(23, 59, 59, 999)
        return reviewDate >= selectedRange.from && reviewDate <= toDateEndOfDay
      })
    }

    // Source filter
    if (filters.sources.length > 0) {
      result = result.filter(review => filters.sources.includes(review.source))
    }

    // Rating filter
    if (filters.minRating !== null) {
      result = result.filter(review => review.overallRating >= filters.minRating!)
    }

    // Sentiment filter
    if (filters.sentiment) {
      result = result.filter(review => {
        const sentiment = getSentimentFromRating(review.overallRating)
        return sentiment === filters.sentiment
      })
    }

    // Response status filter
    if (filters.responseStatus === 'responded') {
      result = result.filter(review => review.responseText)
    } else if (filters.responseStatus === 'unresponded') {
      result = result.filter(review => !review.responseText)
    }

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter(
        review => review.comment?.toLowerCase().includes(query) || review.customerName?.toLowerCase().includes(query),
      )
    }

    const totalCount = result.length

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'highestRated':
          return b.overallRating - a.overallRating
        case 'lowestRated':
          return a.overallRating - b.overallRating
        case 'unresponded':
          if (!a.responseText && b.responseText) return -1
          if (a.responseText && !b.responseText) return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return 0
      }
    })

    return { filteredAndSortedReviews: result, totalCount }
  }, [reviews, selectedRange, filters, sortBy])

  // Pagination
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE
    const endIndex = startIndex + REVIEWS_PER_PAGE
    return filteredAndSortedReviews.slice(startIndex, endIndex)
  }, [filteredAndSortedReviews, currentPage])

  const totalPages = Math.ceil(filteredAndSortedReviews.length / REVIEWS_PER_PAGE)

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: ReviewFiltersState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handleSortChange = (value: SortOption) => {
    setSortBy(value)
    setCurrentPage(1)
  }

  const handleRespond = (review: Review) => {
    setSelectedReview(review)
    setResponseDialogOpen(true)
  }

  const defaultRange = getDefaultRange()

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-foreground">{t('loading')}</span>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="text-center py-12 text-destructive">
          <p className="text-lg font-semibold">{t('error')}</p>
          <p className="text-sm text-muted-foreground mt-2">{error instanceof Error ? error.message : t('unknownError')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            {t('settings.button')}
          </Button>
          <DateRangePicker
            showCompare={false}
            onUpdate={({ range }) => {
              if (range.from && range.to) {
                setSelectedRange(range)
                setCurrentPage(1)
              }
            }}
            initialDateFrom={defaultRange.from.toISOString().split('T')[0]}
            initialDateTo={defaultRange.to.toISOString().split('T')[0]}
            align="end"
            locale={getIntlLocale(i18n.language)}
          />
        </div>
      </div>

      {/* Stats */}
      <ReviewStats reviews={filteredAndSortedReviews} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ReviewFilters filters={filters} onFiltersChange={handleFiltersChange} totalCount={reviews.length} filteredCount={totalCount} />
        </div>

        {/* Reviews List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Sort Controls */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('averageDescription', { count: totalCount })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('sorting.label')}</span>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('sorting.newest')}</SelectItem>
                  <SelectItem value="oldest">{t('sorting.oldest')}</SelectItem>
                  <SelectItem value="highestRated">{t('sorting.highestRated')}</SelectItem>
                  <SelectItem value="lowestRated">{t('sorting.lowestRated')}</SelectItem>
                  <SelectItem value="unresponded">{t('sorting.unresponded')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reviews Grid */}
          {paginatedReviews.length === 0 ? (
            <div className="text-center py-12 px-4 bg-muted/30 rounded-lg border border-dashed">
              <p className="text-lg font-semibold text-muted-foreground">{reviews.length === 0 ? t('emptyState.title') : t('emptyState.noResults')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {reviews.length === 0 ? t('emptyState.description') : t('emptyState.adjustFilters')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedReviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onRespond={handleRespond}
                  onDelete={handleDeleteClick}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {t('pagination.pageOf', { current: currentPage, total: totalPages })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('pagination.next')}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Response Dialog */}
      <ReviewResponseDialog review={selectedReview} open={responseDialogOpen} onOpenChange={setResponseDialogOpen} />

      {/* Bad Review Settings Dialog */}
      <BadReviewSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('superadmin.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('superadmin.delete.description', {
                item: reviewToDelete?.customerName || t('card.anonymousCustomer'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteReviewMutation.isPending}
            >
              {deleteReviewMutation.isPending ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
