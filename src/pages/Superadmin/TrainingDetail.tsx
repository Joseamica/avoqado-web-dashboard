import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getOrganizationsList,
  getOrganizationById,
  type OrganizationSimple,
} from '@/services/superadmin-organizations.service'
import { moduleAPI } from '@/services/superadmin-modules.service'
import {
  trainingAPI,
  type TrainingModule,
  type TrainingStep,
  type TrainingQuizQuestion,
  type TrainingCategory,
  type UpdateTrainingData,
  type CreateStepData,
  type CreateQuizData,
} from '@/services/superadmin-training.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  Globe,
  GraduationCap,
  HelpCircle,
  Image,
  Lightbulb,
  MapPin,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
  Upload,
  Video,
  X,
  Eye,
  EyeOff,
  Maximize2,
  Play,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// ===== HELPERS =====

const categoryLabels: Record<TrainingCategory, string> = {
  VENTAS: 'Ventas',
  INVENTARIO: 'Inventario',
  PAGOS: 'Pagos',
  ATENCION_CLIENTE: 'Atención al Cliente',
  GENERAL: 'General',
}

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm',
      className,
    )}
  >
    {children}
  </div>
)

// ===== MAIN COMPONENT =====

const TrainingDetail: React.FC = () => {
  const { trainingId } = useParams<{ trainingId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch training
  const { data: training, isLoading } = useQuery({
    queryKey: ['superadmin-training', trainingId],
    queryFn: () => trainingAPI.getOne(trainingId!),
    enabled: !!trainingId,
  })

  // Fetch organizations and modules for edit form
  const { data: organizations = [] } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: getOrganizationsList,
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['superadmin-modules'],
    queryFn: moduleAPI.getAllModules,
  })

  // State
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editForm, setEditForm] = useState<UpdateTrainingData>({})
  const [venueScope, setVenueScope] = useState<'all' | 'specific'>('all')
  const [orgVenues, setOrgVenues] = useState<Array<{ id: string; name: string }>>([])
  const [isLoadingVenues, setIsLoadingVenues] = useState(false)
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<TrainingStep | null>(null)
  const [stepForm, setStepForm] = useState<CreateStepData>({
    stepNumber: 1,
    title: '',
    instruction: '',
    mediaType: 'IMAGE',
  })
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<TrainingQuizQuestion | null>(null)
  const [quizForm, setQuizForm] = useState<CreateQuizData>({
    question: '',
    options: ['', ''],
    correctIndex: 0,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'IMAGE' | 'VIDEO'; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch venues when org changes in edit form
  useEffect(() => {
    if (!isEditingInfo) return

    const orgId = editForm.organizationId
    if (!orgId) {
      setOrgVenues([])
      setVenueScope('all')
      return
    }

    setIsLoadingVenues(true)
    getOrganizationById(orgId)
      .then(org => {
        setOrgVenues(org.venues.map(v => ({ id: v.id, name: v.name })))
      })
      .catch(() => setOrgVenues([]))
      .finally(() => setIsLoadingVenues(false))
  }, [editForm.organizationId, isEditingInfo])

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: UpdateTrainingData) => trainingAPI.update(trainingId!, data),
    onSuccess: () => {
      toast({ title: 'Guardado' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-trainings'] })
      setIsEditingInfo(false)
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const togglePublish = useCallback(() => {
    if (!training) return
    const newStatus = training.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    updateMutation.mutate({ status: newStatus })
  }, [training, updateMutation])

  // Step mutations
  const addStepMutation = useMutation({
    mutationFn: (data: CreateStepData) => trainingAPI.addStep(trainingId!, data),
    onSuccess: () => {
      toast({ title: 'Paso agregado' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
      setIsStepDialogOpen(false)
      resetStepForm()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: Partial<CreateStepData> }) =>
      trainingAPI.updateStep(trainingId!, stepId, data),
    onSuccess: () => {
      toast({ title: 'Paso actualizado' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
      setIsStepDialogOpen(false)
      setEditingStep(null)
      resetStepForm()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => trainingAPI.deleteStep(trainingId!, stepId),
    onSuccess: () => {
      toast({ title: 'Paso eliminado' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  // Quiz mutations
  const addQuizMutation = useMutation({
    mutationFn: (data: CreateQuizData) => trainingAPI.addQuestion(trainingId!, data),
    onSuccess: () => {
      toast({ title: 'Pregunta agregada' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
      setIsQuizDialogOpen(false)
      resetQuizForm()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const updateQuizMutation = useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: Partial<CreateQuizData> }) =>
      trainingAPI.updateQuestion(trainingId!, questionId, data),
    onSuccess: () => {
      toast({ title: 'Pregunta actualizada' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
      setIsQuizDialogOpen(false)
      setEditingQuestion(null)
      resetQuizForm()
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const deleteQuizMutation = useMutation({
    mutationFn: (questionId: string) => trainingAPI.deleteQuestion(trainingId!, questionId),
    onSuccess: () => {
      toast({ title: 'Pregunta eliminada' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-training', trainingId] })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.error || error.message, variant: 'destructive' })
    },
  })

  const resetStepForm = () => {
    setStepForm({
      stepNumber: (training?.steps?.length || 0) + 1,
      title: '',
      instruction: '',
      mediaType: 'IMAGE',
    })
  }

  const resetQuizForm = () => {
    setQuizForm({ question: '', options: ['', ''], correctIndex: 0 })
  }

  const handleStartEdit = () => {
    if (!training) return
    setEditForm({
      title: training.title,
      description: training.description,
      category: training.category,
      difficulty: training.difficulty,
      estimatedMinutes: training.estimatedMinutes,
      isRequired: training.isRequired,
      featureTags: training.featureTags || [],
      organizationId: training.organizationId,
      venueIds: training.venueIds || [],
    })
    setVenueScope((training.venueIds || []).length > 0 ? 'specific' : 'all')
    setIsEditingInfo(true)
  }

  const handleToggleFeatureTag = (tag: string) => {
    setEditForm(prev => {
      const current = prev.featureTags || []
      const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
      return { ...prev, featureTags: updated }
    })
  }

  const handleToggleVenue = (venueId: string) => {
    setEditForm(prev => {
      const current = prev.venueIds || []
      const updated = current.includes(venueId) ? current.filter(v => v !== venueId) : [...current, venueId]
      return { ...prev, venueIds: updated }
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await trainingAPI.uploadMedia(file, trainingId)
      const isVideo = file.type.startsWith('video/')
      setStepForm(prev => ({
        ...prev,
        mediaUrl: result.url,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
      }))
      toast({ title: 'Archivo subido' })
    } catch (error: any) {
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await trainingAPI.uploadMedia(file, trainingId)
      updateMutation.mutate({ coverImageUrl: result.url })
    } catch (error: any) {
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!training) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Entrenamiento no encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/superadmin/trainings')} className="mt-4 cursor-pointer">
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin/trainings')} className="cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{training.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={training.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                {training.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
              </Badge>
              {training.isRequired && <Badge variant="destructive">Obligatorio</Badge>}
              <span className="text-sm text-muted-foreground">
                Por {training.createdByName}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={togglePublish} disabled={updateMutation.isPending} className="cursor-pointer">
            {training.status === 'PUBLISHED' ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Despublicar
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Publicar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Module info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Module Info Card */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Información del Módulo</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isEditingInfo) {
                    // When saving, if venueScope is 'all', clear venueIds
                    const finalData = { ...editForm }
                    if (venueScope === 'all') {
                      finalData.venueIds = []
                    }
                    updateMutation.mutate(finalData)
                  } else {
                    handleStartEdit()
                  }
                }}
                className="cursor-pointer"
              >
                {isEditingInfo ? (
                  <>
                    <Save className="w-4 h-4 mr-1" /> Guardar
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </>
                )}
              </Button>
            </div>

            {isEditingInfo ? (
              <div className="space-y-6">
                {/* Basic info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={editForm.title || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={editForm.description || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={editForm.category}
                        onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value as TrainingCategory }))}
                      >
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dificultad</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={editForm.difficulty}
                        onChange={e =>
                          setEditForm(prev => ({ ...prev, difficulty: e.target.value as 'BASIC' | 'INTERMEDIATE' }))
                        }
                      >
                        <option value="BASIC">Básico</option>
                        <option value="INTERMEDIATE">Intermedio</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duración (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editForm.estimatedMinutes || 5}
                        onChange={e =>
                          setEditForm(prev => ({ ...prev, estimatedMinutes: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-required" className="cursor-pointer">
                      Obligatorio
                    </Label>
                    <Switch
                      id="edit-required"
                      checked={editForm.isRequired || false}
                      onCheckedChange={checked => setEditForm(prev => ({ ...prev, isRequired: checked }))}
                    />
                  </div>
                </div>

                {/* Organization & Venue assignment */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold">Asignación</h3>
                  <div className="space-y-2">
                    <Label>Organización</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={editForm.organizationId ?? ''}
                      onChange={e => {
                        const newOrgId = e.target.value === '' ? null : e.target.value
                        setEditForm(prev => ({
                          ...prev,
                          organizationId: newOrgId,
                          venueIds: [],
                        }))
                        setVenueScope('all')
                      }}
                    >
                      <option value="">Global (todas las organizaciones)</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.venueCount} sucursales)
                        </option>
                      ))}
                    </select>
                  </div>

                  {editForm.organizationId && (
                    <div className="space-y-3">
                      <Label>Sucursales</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={venueScope === 'all' ? 'default' : 'outline'}
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => {
                            setVenueScope('all')
                            setEditForm(prev => ({ ...prev, venueIds: [] }))
                          }}
                        >
                          Todas las sucursales
                        </Button>
                        <Button
                          type="button"
                          variant={venueScope === 'specific' ? 'default' : 'outline'}
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setVenueScope('specific')}
                        >
                          Sucursales específicas
                        </Button>
                      </div>

                      {venueScope === 'specific' && (
                        <div className="space-y-2">
                          {isLoadingVenues ? (
                            <p className="text-sm text-muted-foreground">Cargando sucursales...</p>
                          ) : orgVenues.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {orgVenues.map(venue => {
                                const isSelected = (editForm.venueIds || []).includes(venue.id)
                                return (
                                  <button
                                    key={venue.id}
                                    type="button"
                                    onClick={() => handleToggleVenue(venue.id)}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer',
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30',
                                    )}
                                  >
                                    <MapPin className="w-3 h-3" />
                                    {venue.name}
                                    {isSelected && <X className="w-3 h-3" />}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No hay sucursales en esta organización.</p>
                          )}
                          {(editForm.venueIds || []).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {editForm.venueIds!.length} sucursal(es) seleccionada(s)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Feature tags */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div>
                    <h3 className="text-sm font-semibold">Tags de módulos</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Solo organizaciones con estos módulos activos verán el entrenamiento. Sin tags = visible para todos.
                    </p>
                  </div>
                  {modules.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {modules.map(mod => {
                        const isSelected = (editForm.featureTags || []).includes(mod.code)
                        return (
                          <button
                            key={mod.code}
                            type="button"
                            onClick={() => handleToggleFeatureTag(mod.code)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30',
                            )}
                          >
                            <Tag className="w-3 h-3" />
                            {mod.code}
                            {isSelected && <X className="w-3 h-3" />}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay módulos disponibles.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">{training.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{categoryLabels[training.category]}</Badge>
                  <Badge variant="outline">{training.difficulty === 'BASIC' ? 'Básico' : 'Intermedio'}</Badge>
                  <Badge variant="outline">{training.estimatedMinutes} min</Badge>
                </div>
                {/* Organization / Venue display */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {training.organization ? (
                    <Badge variant="secondary" className="text-xs">
                      <Building2 className="w-3 h-3 mr-1" />
                      {training.organization.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Globe className="w-3 h-3 mr-1" />
                      Global
                    </Badge>
                  )}
                  {(training.venueIds || []).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      {training.venueIds.length} sucursal(es)
                    </Badge>
                  )}
                </div>
                {/* Feature tags display */}
                {(training.featureTags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {training.featureTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* Steps Section */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Pasos ({training.steps?.length || 0})
              </h2>
              <Button
                size="sm"
                onClick={() => {
                  resetStepForm()
                  setStepForm(prev => ({ ...prev, stepNumber: (training.steps?.length || 0) + 1 }))
                  setEditingStep(null)
                  setIsStepDialogOpen(true)
                }}
                className="cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1" /> Agregar paso
              </Button>
            </div>

            {training.steps && training.steps.length > 0 ? (
              <div className="space-y-3">
                {training.steps.map(step => (
                  <div
                    key={step.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.title}</span>
                        {step.mediaType === 'VIDEO' ? (
                          <Video className="w-4 h-4 text-muted-foreground" />
                        ) : step.mediaUrl ? (
                          <Image className="w-4 h-4 text-muted-foreground" />
                        ) : null}
                        {step.tipText && <Lightbulb className="w-4 h-4 text-yellow-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{step.instruction}</p>
                      {step.mediaUrl && (
                        <div
                          className="mt-3 relative group cursor-pointer rounded-xl overflow-hidden border border-border/30"
                          onClick={() => setPreviewMedia({ url: step.mediaUrl!, type: step.mediaType as 'IMAGE' | 'VIDEO', title: step.title })}
                        >
                          {step.mediaType === 'VIDEO' ? (
                            <div className="relative">
                              <video src={step.mediaUrl} className="w-full max-h-48 object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                  <Play className="w-5 h-5 text-gray-900 ml-0.5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img src={step.mediaUrl} alt={step.title} className="w-full max-h-48 object-cover" />
                          )}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/60 backdrop-blur-sm text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1">
                              <Maximize2 className="w-3 h-3" />
                              Ver
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => {
                          setEditingStep(step)
                          setStepForm({
                            stepNumber: step.stepNumber,
                            title: step.title,
                            instruction: step.instruction,
                            mediaType: step.mediaType as 'IMAGE' | 'VIDEO',
                            mediaUrl: step.mediaUrl || undefined,
                            thumbnailUrl: step.thumbnailUrl || undefined,
                            tipText: step.tipText || undefined,
                          })
                          setIsStepDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive cursor-pointer"
                        onClick={() => deleteStepMutation.mutate(step.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay pasos aún. Agrega el primer paso.</p>
              </div>
            )}
          </GlassCard>

          {/* Quiz Section */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Quiz ({training.quizQuestions?.length || 0})
              </h2>
              <Button
                size="sm"
                onClick={() => {
                  resetQuizForm()
                  setEditingQuestion(null)
                  setIsQuizDialogOpen(true)
                }}
                className="cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1" /> Agregar pregunta
              </Button>
            </div>

            {training.quizQuestions && training.quizQuestions.length > 0 ? (
              <div className="space-y-3">
                {training.quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {idx + 1}. {q.question}
                        </p>
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={cn(
                                'text-sm px-3 py-1 rounded',
                                oi === q.correctIndex
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-medium'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {String.fromCharCode(65 + oi)}) {opt}
                              {oi === q.correctIndex && ' \u2713'}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                          onClick={() => {
                            setEditingQuestion(q)
                            setQuizForm({
                              question: q.question,
                              options: [...q.options],
                              correctIndex: q.correctIndex,
                              position: q.position,
                            })
                            setIsQuizDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive cursor-pointer"
                          onClick={() => deleteQuizMutation.mutate(q.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay preguntas de quiz. Agrega preguntas opcionales.</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Preview + Cover */}
        <div className="space-y-6">
          {/* Cover Image */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-semibold mb-3">Imagen de portada</h3>
            {training.coverImageUrl ? (
              <div className="relative">
                <img
                  src={training.coverImageUrl}
                  alt="Cover"
                  className="w-full h-40 rounded-xl object-cover"
                />
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <div className="bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-background">
                    <Upload className="w-3 h-3" /> Cambiar
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </label>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="w-full h-40 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Subir portada</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
            )}
          </GlassCard>

          {/* Preview mockup */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-semibold mb-3">Vista previa TPV</h3>
            <div className="bg-black rounded-xl p-3 aspect-[3/4] max-h-[400px] overflow-hidden">
              <div className="bg-gray-900 rounded-lg h-full flex flex-col p-3 text-white">
                <div className="text-center mb-3">
                  <p className="text-xs font-bold truncate">{training.title}</p>
                  <p className="text-[10px] text-gray-400">Paso 1 de {training.steps?.length || 0}</p>
                </div>
                {training.steps?.[0]?.mediaUrl ? (
                  <div className="flex-1 bg-gray-800 rounded-lg mb-2 overflow-hidden">
                    <img
                      src={training.steps[0].mediaUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex-1 bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <p className="text-[10px] font-medium mb-1 truncate">
                  {training.steps?.[0]?.title || 'Título del paso'}
                </p>
                <p className="text-[8px] text-gray-400 line-clamp-2">
                  {training.steps?.[0]?.instruction || 'Instrucciones del paso...'}
                </p>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 bg-gray-700 rounded text-center py-1 text-[8px]">Anterior</div>
                  <div className="flex-1 bg-indigo-600 rounded text-center py-1 text-[8px]">Siguiente</div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Stats */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-semibold mb-3">Estadísticas</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progreso registrado</span>
                <span className="font-medium">{training._count?.progress || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pasos</span>
                <span className="font-medium">{training.steps?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preguntas quiz</span>
                <span className="font-medium">{training.quizQuestions?.length || 0}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Step Dialog */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Editar Paso' : 'Nuevo Paso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de paso</Label>
                <Input
                  type="number"
                  min={1}
                  value={stepForm.stepNumber}
                  onChange={e => setStepForm(prev => ({ ...prev, stepNumber: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de media</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={stepForm.mediaType}
                  onChange={e => setStepForm(prev => ({ ...prev, mediaType: e.target.value as 'IMAGE' | 'VIDEO' }))}
                >
                  <option value="IMAGE">Imagen</option>
                  <option value="VIDEO">Video</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={stepForm.title}
                onChange={e => setStepForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Abre el menú de pagos"
              />
            </div>
            <div className="space-y-2">
              <Label>Instrucción</Label>
              <Textarea
                value={stepForm.instruction}
                onChange={e => setStepForm(prev => ({ ...prev, instruction: e.target.value }))}
                placeholder="Describe paso a paso qué debe hacer el usuario..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Media</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={stepForm.mediaUrl || ''}
                  onChange={e => setStepForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                  placeholder="URL del archivo o sube uno..."
                  className="flex-1"
                />
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={isUploading} className="cursor-pointer">
                    <span>
                      <Upload className="w-4 h-4 mr-1" />
                      {isUploading ? 'Subiendo...' : 'Subir'}
                    </span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/quicktime"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              {stepForm.mediaUrl && (
                <div
                  className="mt-2 relative group cursor-pointer rounded-xl overflow-hidden border border-border/30"
                  onClick={() => setPreviewMedia({ url: stepForm.mediaUrl!, type: stepForm.mediaType || 'IMAGE', title: stepForm.title || 'Vista previa' })}
                >
                  {stepForm.mediaType === 'VIDEO' ? (
                    <div className="relative">
                      <video src={stepForm.mediaUrl} className="w-full max-h-48 object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img src={stepForm.mediaUrl} alt="" className="w-full max-h-48 object-cover" />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 backdrop-blur-sm text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1">
                      <Maximize2 className="w-3 h-3" />
                      Previsualizar
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tip (opcional)</Label>
              <Input
                value={stepForm.tipText || ''}
                onChange={e => setStepForm(prev => ({ ...prev, tipText: e.target.value }))}
                placeholder="Un consejo útil para este paso..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStepDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingStep) {
                  updateStepMutation.mutate({ stepId: editingStep.id, data: stepForm })
                } else {
                  addStepMutation.mutate(stepForm)
                }
              }}
              disabled={addStepMutation.isPending || updateStepMutation.isPending || !stepForm.title || !stepForm.instruction}
              className="cursor-pointer"
            >
              {editingStep ? 'Actualizar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Dialog */}
      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pregunta</Label>
              <Input
                value={quizForm.question}
                onChange={e => setQuizForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="¿Cuál es el botón correcto para...?"
              />
            </div>
            <div className="space-y-2">
              <Label>Opciones</Label>
              {quizForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={quizForm.correctIndex === idx}
                    onChange={() => setQuizForm(prev => ({ ...prev, correctIndex: idx }))}
                    className="cursor-pointer"
                  />
                  <Input
                    value={opt}
                    onChange={e => {
                      const newOptions = [...quizForm.options]
                      newOptions[idx] = e.target.value
                      setQuizForm(prev => ({ ...prev, options: newOptions }))
                    }}
                    placeholder={`Opción ${String.fromCharCode(65 + idx)}`}
                    className="flex-1"
                  />
                  {quizForm.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive cursor-pointer"
                      onClick={() => {
                        const newOptions = quizForm.options.filter((_, i) => i !== idx)
                        const newCorrectIndex = quizForm.correctIndex >= idx ? Math.max(0, quizForm.correctIndex - 1) : quizForm.correctIndex
                        setQuizForm(prev => ({ ...prev, options: newOptions, correctIndex: newCorrectIndex }))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {quizForm.options.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuizForm(prev => ({ ...prev, options: [...prev.options, ''] }))}
                  className="cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" /> Agregar opción
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Selecciona el radio button de la respuesta correcta.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuizDialogOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const validOptions = quizForm.options.filter(o => o.trim())
                if (validOptions.length < 2) {
                  toast({ title: 'Error', description: 'Necesitas al menos 2 opciones válidas.', variant: 'destructive' })
                  return
                }
                const finalForm = { ...quizForm, options: validOptions }
                if (editingQuestion) {
                  updateQuizMutation.mutate({ questionId: editingQuestion.id, data: finalForm })
                } else {
                  addQuizMutation.mutate(finalForm)
                }
              }}
              disabled={addQuizMutation.isPending || updateQuizMutation.isPending || !quizForm.question}
              className="cursor-pointer"
            >
              {editingQuestion ? 'Actualizar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Media Preview Dialog */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative flex flex-col items-center justify-center min-h-[50vh] max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10 text-white hover:bg-white/20 cursor-pointer"
              onClick={() => setPreviewMedia(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            {previewMedia?.title && (
              <div className="absolute top-3 left-4 z-10">
                <p className="text-white/80 text-sm font-medium">{previewMedia.title}</p>
              </div>
            )}
            <div className="w-full flex items-center justify-center p-4">
              {previewMedia?.type === 'VIDEO' ? (
                <video
                  src={previewMedia.url}
                  className="max-w-full max-h-[80vh] rounded-lg"
                  controls
                  autoPlay
                />
              ) : previewMedia?.url ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title || ''}
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TrainingDetail
