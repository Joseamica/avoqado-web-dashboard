import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Megaphone, BarChart3, MousePointerClick, Plus, Send, Trash2 } from 'lucide-react'
import { DateTime } from 'luxon'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createTpvMessage, type CreateTpvMessageRequest } from '@/services/tpv-messages.service'
import { getTpvs } from '@/services/tpv.service'

interface CreateMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
}

type MessageType = 'ANNOUNCEMENT' | 'SURVEY' | 'ACTION'
type MessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

const TYPE_OPTIONS: { value: MessageType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'ANNOUNCEMENT', label: 'Anuncio', description: 'Mensaje informativo para el staff', icon: Megaphone },
  { value: 'SURVEY', label: 'Encuesta', description: 'Pregunta con opciones de respuesta', icon: BarChart3 },
  { value: 'ACTION', label: 'Accion', description: 'Mensaje con un boton de accion', icon: MousePointerClick },
]

export function CreateMessageDialog({ open, onOpenChange, venueId }: CreateMessageDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Form state
  const [type, setType] = useState<MessageType>('ANNOUNCEMENT')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<MessagePriority>('NORMAL')
  const [requiresAck, setRequiresAck] = useState(false)
  const [targetType, setTargetType] = useState<'ALL_TERMINALS' | 'SPECIFIC_TERMINALS'>('ALL_TERMINALS')
  const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>([])
  const [expiresIn, setExpiresIn] = useState<string>('')

  // Survey-specific
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', ''])
  const [surveyMultiSelect, setSurveyMultiSelect] = useState(false)

  // Action-specific
  const [actionLabel, setActionLabel] = useState('')

  // Fetch terminals for target selection
  const { data: terminalsData } = useQuery({
    queryKey: ['tpvs-for-messages', venueId],
    queryFn: () => getTpvs(venueId, { pageIndex: 0, pageSize: 100 }),
    enabled: open && targetType === 'SPECIFIC_TERMINALS',
  })

  const terminals = terminalsData?.data || terminalsData?.terminals || []

  const createMutation = useMutation({
    mutationFn: (data: CreateTpvMessageRequest) => createTpvMessage(venueId, data),
    onSuccess: () => {
      toast({ title: 'Mensaje creado', description: 'El mensaje se ha enviado a las terminales' })
      queryClient.invalidateQueries({ queryKey: ['tpv-messages', venueId] })
      resetForm()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el mensaje',
      })
    },
  })

  const resetForm = () => {
    setType('ANNOUNCEMENT')
    setTitle('')
    setBody('')
    setPriority('NORMAL')
    setRequiresAck(false)
    setTargetType('ALL_TERMINALS')
    setSelectedTerminalIds([])
    setExpiresIn('')
    setSurveyOptions(['', ''])
    setSurveyMultiSelect(false)
    setActionLabel('')
  }

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return

    const data: CreateTpvMessageRequest = {
      type,
      title: title.trim(),
      body: body.trim(),
      priority,
      requiresAck,
      targetType,
      targetTerminalIds: targetType === 'SPECIFIC_TERMINALS' ? selectedTerminalIds : undefined,
    }

    if (expiresIn) {
      const hours = parseInt(expiresIn)
      if (hours > 0) {
        data.expiresAt = DateTime.now().plus({ hours }).toISO()!
      }
    }

    if (type === 'SURVEY') {
      const validOptions = surveyOptions.filter((o) => o.trim())
      if (validOptions.length < 2) {
        toast({ variant: 'destructive', title: 'Error', description: 'Una encuesta necesita al menos 2 opciones' })
        return
      }
      data.surveyOptions = validOptions
      data.surveyMultiSelect = surveyMultiSelect
    }

    if (type === 'ACTION') {
      if (!actionLabel.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'El boton de accion necesita un texto' })
        return
      }
      data.actionLabel = actionLabel.trim()
    }

    createMutation.mutate(data)
  }

  const addSurveyOption = () => {
    if (surveyOptions.length < 6) {
      setSurveyOptions([...surveyOptions, ''])
    }
  }

  const removeSurveyOption = (index: number) => {
    if (surveyOptions.length > 2) {
      setSurveyOptions(surveyOptions.filter((_, i) => i !== index))
    }
  }

  const updateSurveyOption = (index: number, value: string) => {
    const updated = [...surveyOptions]
    updated[index] = value
    setSurveyOptions(updated)
  }

  const toggleTerminal = (terminalId: string) => {
    setSelectedTerminalIds((prev) =>
      prev.includes(terminalId) ? prev.filter((id) => id !== terminalId) : [...prev, terminalId],
    )
  }

  const isValid =
    title.trim() &&
    body.trim() &&
    (targetType === 'ALL_TERMINALS' || selectedTerminalIds.length > 0) &&
    (type !== 'SURVEY' || surveyOptions.filter((o) => o.trim()).length >= 2) &&
    (type !== 'ACTION' || actionLabel.trim())

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title="Nuevo mensaje"
      contentClassName="bg-muted/30"
      actions={
        <Button
          onClick={handleSubmit}
          disabled={!isValid || createMutation.isPending}
          className="rounded-full px-6"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar mensaje
            </>
          )}
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
        {/* Section: Message Type */}
        <section className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-base font-semibold">Tipo de mensaje</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-border hover:bg-muted/30'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>{option.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Section: Content */}
        <section className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-base font-semibold">Contenido</h3>
          </div>

          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Titulo</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Nuevo procedimiento de cierre"
                maxLength={100}
                className="h-12 text-base"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mensaje</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribe el contenido del mensaje..."
                rows={4}
                maxLength={1000}
                className="text-base min-h-[120px]"
              />
            </div>

            {/* Survey Options */}
            {type === 'SURVEY' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Opciones de encuesta</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSurveyOption}
                    disabled={surveyOptions.length >= 6}
                    className="rounded-full"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar
                  </Button>
                </div>
                {surveyOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateSurveyOption(index, e.target.value)}
                      placeholder={`Opcion ${index + 1}`}
                      maxLength={100}
                      className="h-12 text-base"
                    />
                    {surveyOptions.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSurveyOption(index)}
                        className="shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Seleccion multiple</p>
                    <p className="text-xs text-muted-foreground">Permitir seleccionar mas de una opcion</p>
                  </div>
                  <Switch checked={surveyMultiSelect} onCheckedChange={setSurveyMultiSelect} />
                </div>
              </div>
            )}

            {/* Action Label */}
            {type === 'ACTION' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Texto del boton de accion</Label>
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Ej: Abrir instrucciones"
                  maxLength={50}
                  className="h-12 text-base"
                />
              </div>
            )}
          </div>
        </section>

        {/* Section: Settings */}
        <section className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-base font-semibold">Configuracion</h3>
          </div>

          <div className="space-y-5">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MessagePriority)}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Requires Acknowledgment */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div>
                <p className="text-sm font-medium">Requiere confirmacion</p>
                <p className="text-xs text-muted-foreground">El staff no podra cerrar el mensaje sin confirmar</p>
              </div>
              <Switch checked={requiresAck} onCheckedChange={setRequiresAck} />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expiracion (opcional)</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Sin expiracion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="8">8 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="72">3 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Section: Target */}
        <section className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <MousePointerClick className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-base font-semibold">Destino</h3>
          </div>

          <div className="space-y-4">
            <Select value={targetType} onValueChange={(v) => setTargetType(v as 'ALL_TERMINALS' | 'SPECIFIC_TERMINALS')}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_TERMINALS">Todas las terminales</SelectItem>
                <SelectItem value="SPECIFIC_TERMINALS">Terminales especificas</SelectItem>
              </SelectContent>
            </Select>

            {targetType === 'SPECIFIC_TERMINALS' && (
              <div className="space-y-1 max-h-60 overflow-y-auto rounded-xl border border-border/50 p-2">
                {terminals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay terminales disponibles</p>
                ) : (
                  terminals.map((terminal: any) => (
                    <label
                      key={terminal.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedTerminalIds.includes(terminal.id)}
                        onCheckedChange={() => toggleTerminal(terminal.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{terminal.name}</p>
                        <p className="text-xs text-muted-foreground">{terminal.serialNumber || terminal.id.slice(-8)}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </FullScreenModal>
  )
}
