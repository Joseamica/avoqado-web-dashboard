import { useState } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

interface ReviewStatus {
  canSubmit: boolean
  reason?: string
  reviewsEnabled: boolean
  googleReviewUrl: string | null
}

const API_BASE = import.meta.env.VITE_API_URL

export function ReceiptReviewWidget({ accessKey }: { accessKey: string }) {
  const { t } = useTranslation('payment')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: status } = useQuery({
    queryKey: ['public-review-status', accessKey],
    queryFn: async () =>
      (await axios.get<{ success: boolean; data: ReviewStatus }>(
        `${API_BASE}/api/v1/public/receipt/${accessKey}/review/status`,
      )).data.data,
    enabled: !!accessKey,
    retry: 1,
  })

  // Hide entirely unless the venue's plan enables reviews.
  if (!status?.reviewsEnabled) return null

  const alreadyRated = status.canSubmit === false && status.reason === 'Review already submitted'
  const showGoogleCta = submitted && rating === 5 && !!status.googleReviewUrl

  const handleSubmit = async () => {
    if (rating === 0) {
      setError(t('receipt.review.ratingRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // ALWAYS save internally first (source=AVOQADO server-side), regardless of rating.
      await axios.post(`${API_BASE}/api/v1/public/receipt/${accessKey}/review`, {
        overallRating: rating,
        comment: comment.trim() || null,
        customerName: name.trim() || null,
      })
      setSubmitted(true)
    } catch {
      setError(t('receipt.review.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
      {alreadyRated ? (
        <p className="text-sm font-medium text-muted-foreground">✅ {t('receipt.review.alreadyRated')}</p>
      ) : submitted ? (
        showGoogleCta ? (
          <div className="space-y-3 text-center">
            <h3 className="text-lg font-semibold">{t('receipt.review.googleTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('receipt.review.googleBody')}</p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => window.open(status.googleReviewUrl!, '_blank', 'noopener,noreferrer')}
            >
              <Star className="w-5 h-5 mr-2" />
              {t('receipt.review.googleCta')}
            </Button>
          </div>
        ) : (
          <div className="space-y-1 text-center">
            <h3 className="text-lg font-semibold">{t('receipt.review.thanksTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('receipt.review.thanksBody')}</p>
          </div>
        )
      ) : (
        <>
          <h3 className="text-lg font-semibold text-center">{t('receipt.review.title')}</h3>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                type="button"
                aria-label={`${v}`}
                onMouseEnter={() => setHover(v)}
                onMouseLeave={() => setHover(0)}
                onClick={() => {
                  setRating(v)
                  setError(null)
                }}
                className="p-1 cursor-pointer"
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    v <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t('receipt.review.commentPlaceholder')}
            rows={3}
          />
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('receipt.review.namePlaceholder')} />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {submitting ? t('receipt.review.submitting') : t('receipt.review.submit')}
          </Button>
        </>
      )}
    </div>
  )
}
