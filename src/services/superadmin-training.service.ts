import api from '@/api'

// ===== TYPES =====

export interface TrainingModule {
  id: string
  organizationId: string | null
  organization: { id: string; name: string } | null
  title: string
  description: string
  coverImageUrl: string | null
  category: TrainingCategory
  difficulty: TrainingDifficulty
  estimatedMinutes: number
  isRequired: boolean
  position: number
  status: TrainingStatus
  featureTags: string[]
  venueIds: string[]
  createdBy: string
  createdByName: string
  steps?: TrainingStep[]
  quizQuestions?: TrainingQuizQuestion[]
  _count: {
    steps: number
    quizQuestions: number
    progress: number
  }
  createdAt: string
  updatedAt: string
}

export interface TrainingStep {
  id: string
  trainingModuleId: string
  stepNumber: number
  title: string
  instruction: string
  mediaType: 'IMAGE' | 'VIDEO'
  mediaUrl: string | null
  thumbnailUrl: string | null
  tipText: string | null
  createdAt: string
  updatedAt: string
}

export interface TrainingQuizQuestion {
  id: string
  trainingModuleId: string
  question: string
  options: string[]
  correctIndex: number
  position: number
  createdAt: string
}

export interface TrainingProgress {
  id: string
  trainingModuleId: string
  staffId: string
  venueId: string
  lastStepViewed: number
  isCompleted: boolean
  quizScore: number | null
  quizTotal: number | null
  quizPassed: boolean | null
  startedAt: string
  completedAt: string | null
}

export interface TrainingProgressStats {
  trainingId: string
  stats: {
    totalStarted: number
    totalCompleted: number
    totalPassed: number
    completionRate: number
    averageScore: number
  }
  progress: TrainingProgress[]
}

export type TrainingCategory = 'VENTAS' | 'INVENTARIO' | 'PAGOS' | 'ATENCION_CLIENTE' | 'GENERAL'
export type TrainingDifficulty = 'BASIC' | 'INTERMEDIATE'
export type TrainingStatus = 'DRAFT' | 'PUBLISHED'

export interface CreateTrainingData {
  title: string
  description: string
  coverImageUrl?: string
  category?: TrainingCategory
  difficulty?: TrainingDifficulty
  estimatedMinutes?: number
  isRequired?: boolean
  position?: number
  status?: TrainingStatus
  featureTags?: string[]
  venueIds?: string[]
  organizationId?: string | null
}

export type UpdateTrainingData = Partial<CreateTrainingData>

export interface CreateStepData {
  stepNumber: number
  title: string
  instruction: string
  mediaType?: 'IMAGE' | 'VIDEO'
  mediaUrl?: string
  thumbnailUrl?: string
  tipText?: string
}

export type UpdateStepData = Partial<CreateStepData>

export interface CreateQuizData {
  question: string
  options: string[]
  correctIndex: number
  position?: number
}

export type UpdateQuizData = Partial<CreateQuizData>

// ===== API FUNCTIONS =====

const BASE = '/api/v1/dashboard/superadmin/trainings'

export async function getAll(params?: {
  status?: TrainingStatus
  category?: TrainingCategory
  organizationId?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ data: TrainingModule[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const response = await api.get(BASE, { params })
  return response.data
}

export async function getOne(trainingId: string): Promise<TrainingModule> {
  const response = await api.get(`${BASE}/${trainingId}`)
  return response.data.data
}

export async function create(data: CreateTrainingData): Promise<TrainingModule> {
  const response = await api.post(BASE, data)
  return response.data.data
}

export async function update(trainingId: string, data: UpdateTrainingData): Promise<TrainingModule> {
  const response = await api.patch(`${BASE}/${trainingId}`, data)
  return response.data.data
}

export async function remove(trainingId: string): Promise<void> {
  await api.delete(`${BASE}/${trainingId}`)
}

// Steps
export async function addStep(trainingId: string, data: CreateStepData): Promise<TrainingStep> {
  const response = await api.post(`${BASE}/${trainingId}/steps`, data)
  return response.data.data
}

export async function updateStep(trainingId: string, stepId: string, data: UpdateStepData): Promise<TrainingStep> {
  const response = await api.patch(`${BASE}/${trainingId}/steps/${stepId}`, data)
  return response.data.data
}

export async function deleteStep(trainingId: string, stepId: string): Promise<void> {
  await api.delete(`${BASE}/${trainingId}/steps/${stepId}`)
}

// Quiz
export async function addQuestion(trainingId: string, data: CreateQuizData): Promise<TrainingQuizQuestion> {
  const response = await api.post(`${BASE}/${trainingId}/quiz`, data)
  return response.data.data
}

export async function updateQuestion(
  trainingId: string,
  questionId: string,
  data: UpdateQuizData,
): Promise<TrainingQuizQuestion> {
  const response = await api.patch(`${BASE}/${trainingId}/quiz/${questionId}`, data)
  return response.data.data
}

export async function deleteQuestion(trainingId: string, questionId: string): Promise<void> {
  await api.delete(`${BASE}/${trainingId}/quiz/${questionId}`)
}

// Media upload
export async function uploadMedia(
  file: File,
  trainingId?: string,
): Promise<{ url: string; fileName: string; mimetype: string; size: number }> {
  const formData = new FormData()
  formData.append('file', file)
  if (trainingId) formData.append('trainingId', trainingId)

  const response = await api.post(`${BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data.data
}

// Progress
export async function getProgress(trainingId: string): Promise<TrainingProgressStats> {
  const response = await api.get(`${BASE}/${trainingId}/progress`)
  return response.data.data
}

// Convenience export
export const trainingAPI = {
  getAll,
  getOne,
  create,
  update,
  remove,
  addStep,
  updateStep,
  deleteStep,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  uploadMedia,
  getProgress,
}
