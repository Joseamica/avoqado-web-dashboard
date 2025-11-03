import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { generateReviewResponse, submitReviewResponse } from '@/services/reviewResponse.service'

interface Review {
  id: string
  venueId: string
  overallRating: number
  foodRating?: number
  serviceRating?: number
  ambienceRating?: number
  comment?: string
  customerName?: string
  source: string
}

interface ReviewResponseDialogProps {
  review: Review | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReviewResponseDialog({ review, open, onOpenChange }: ReviewResponseDialogProps) {
  const { t } = useTranslation('reviews')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [responseText, setResponseText] = useState('')
  const [aiDraft, setAiDraft] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null)

  // Generate AI response mutation
  const generateMutation = useMutation({
    mutationFn: (reviewId: string) => generateReviewResponse(reviewId),
    onSuccess: data => {
      setResponseText(data.response)
      setAiDraft(data.response)
      setFeedbackGiven(null)
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: t('responseDialog.errors.generateFailed'),
        description: error.message,
      })
    },
  })

  // Submit response mutation
  const submitMutation = useMutation({
    mutationFn: ({ reviewId, responseText }: { reviewId: string; responseText: string }) => submitReviewResponse(reviewId, responseText),
    onSuccess: () => {
      toast({
        title: t('responseDialog.success.title'),
        description: t('responseDialog.success.description'),
      })
      onOpenChange(false)
      // Invalidate reviews query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: t('responseDialog.errors.submitFailed'),
        description: error.message,
      })
    },
  })

  // Auto-generate response when dialog opens
  useEffect(() => {
    if (open && review) {
      setResponseText('')
      setAiDraft('')
      setFeedbackGiven(null)
      generateMutation.mutate(review.id)
    }
  }, [open, review])

  const handleRegenerate = () => {
    if (review) {
      setFeedbackGiven(null)
      generateMutation.mutate(review.id)
    }
  }

  const handleSubmit = () => {
    if (!review || !responseText.trim()) {
      toast({
        variant: 'destructive',
        title: t('responseDialog.errors.emptyResponse'),
        description: t('responseDialog.errors.emptyResponseDescription'),
      })
      return
    }

    submitMutation.mutate({
      reviewId: review.id,
      responseText: responseText.trim(),
    })
  }

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedbackGiven(type)
    // TODO: Send feedback to backend for AI improvement
    toast({
      title: t('responseDialog.feedback.thanksTitle'),
      description: t('responseDialog.feedback.thanksDescription'),
    })
  }

  const hasEdited = responseText !== aiDraft && aiDraft !== ''
  const isLoading = generateMutation.isPending
  const isSubmitting = submitMutation.isPending

  if (!review) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('responseDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('responseDialog.description', { customerName: review.customerName || t('card.anonymousCustomer') })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Review Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{review.customerName || t('card.anonymousCustomer')}</span>
              <span className="text-sm font-bold">{review.overallRating.toFixed(1)} ⭐</span>
            </div>
            {review.comment && <p className="text-sm text-muted-foreground italic line-clamp-3">"{review.comment}"</p>}
          </div>

          {/* AI Response Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('responseDialog.responseLabel')}
                {hasEdited && <span className="ml-2 text-xs text-muted-foreground">({t('responseDialog.edited')})</span>}
              </label>
              {!isLoading && aiDraft && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleFeedback('positive')} disabled={feedbackGiven !== null} className="h-7 px-2">
                    <ThumbsUp className={`h-3 w-3 ${feedbackGiven === 'positive' ? 'fill-green-500 text-green-500' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleFeedback('negative')} disabled={feedbackGiven !== null} className="h-7 px-2">
                    <ThumbsDown className={`h-3 w-3 ${feedbackGiven === 'negative' ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
              )}
            </div>

            <Textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder={isLoading ? t('responseDialog.generating') : t('responseDialog.responsePlaceholder')}
              className="min-h-[200px] resize-none"
              disabled={isLoading}
            />

            {isLoading && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('responseDialog.generating')}
              </div>
            )}
          </div>

          {/* Character count */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('responseDialog.aiPowered')}</span>
            <span>
              {responseText.length} {t('responseDialog.characters')}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('responseDialog.cancel')}
          </Button>
          <Button variant="outline" onClick={handleRegenerate} disabled={isLoading || isSubmitting}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('responseDialog.regenerate')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isSubmitting || !responseText.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('responseDialog.sending')}
              </>
            ) : (
              t('responseDialog.send')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
