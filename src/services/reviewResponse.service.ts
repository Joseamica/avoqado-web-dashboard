import api from '@/api'

export interface GenerateResponseResult {
  response: string
  sentiment: 'positive' | 'neutral' | 'negative'
  trainingDataId?: string
}

export interface SubmitResponseResult {
  success: boolean
  reviewId: string
  responseText: string
  respondedAt: string
  responseAutomated: boolean
}

/**
 * Generate an AI-powered response draft for a review
 */
export async function generateReviewResponse(reviewId: string): Promise<GenerateResponseResult> {
  try {
    const response = await api.post(`/api/v1/dashboard/reviews/${reviewId}/generate-response`)
    return response.data
  } catch (error: any) {
    console.error('Error generating review response:', error)
    throw new Error(error.response?.data?.message || 'Failed to generate AI response. Please try again.')
  }
}

/**
 * Submit an approved review response
 */
export async function submitReviewResponse(reviewId: string, responseText: string): Promise<SubmitResponseResult> {
  try {
    const response = await api.post(`/api/v1/dashboard/reviews/${reviewId}/submit-response`, {
      responseText,
    })
    return response.data
  } catch (error: any) {
    console.error('Error submitting review response:', error)
    throw new Error(error.response?.data?.message || 'Failed to submit response. Please try again.')
  }
}

/**
 * Submit feedback on an AI-generated response (for continuous improvement)
 */
export async function submitResponseFeedback(
  reviewId: string,
  trainingDataId: string,
  feedback: 'positive' | 'negative',
  correctionText?: string,
): Promise<{ success: boolean }> {
  try {
    const response = await api.post(`/api/v1/dashboard/reviews/${reviewId}/response-feedback`, {
      trainingDataId,
      feedback,
      correctionText,
    })
    return response.data
  } catch (error: any) {
    console.error('Error submitting response feedback:', error)
    throw new Error(error.response?.data?.message || 'Failed to submit feedback.')
  }
}
