/**
 * OrgMessagesSection - Broadcast messages to ALL terminals across the organization
 * Used within TpvConfiguration page's Organizacional tab (OWNER+ only)
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Info,
  Loader2,
  Megaphone,
  BarChart3,
  MousePointerClick,
  Plus,
  Send,
  Trash2,
  MessageSquarePlus,
} from 'lucide-react'
import { DateTime } from 'luxon'

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { broadcastOrgMessage } from '@/services/tpv-messages.service'

type MessageType = 'ANNOUNCEMENT' | 'SURVEY' | 'ACTION'
type MessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

const TYPE_OPTIONS: { value: MessageType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'ANNOUNCEMENT', label: 'Anuncio', description: 'Mensaje informativo para el staff', icon: Megaphone },
  { value: 'SURVEY', label: 'Encuesta', description: 'Pregunta con opciones de respuesta', icon: BarChart3 },
  { value: 'ACTION', label: 'Accion', description: 'Mensaje con un boton de accion', icon: MousePointerClick },
]

export function OrgMessagesSection() {
  const { orgId } = useCurrentOrganization()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Form state
  const [type, setType] = useState<MessageType>('ANNOUNCEMENT')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<MessagePriority>('NORMAL')
  const [requiresAck, setRequiresAck] = useState(false)
  const [expiresIn, setExpiresIn] = useState<string>('')

  // Survey-specific
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', ''])
  const [surveyMultiSelect, setSurveyMultiSelect] = useState(false)

  // Action-specific
  const [actionLabel, setActionLabel] = useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error('No organization ID')

      const data: Parameters<typeof broadcastOrgMessage>[1] = {
        type,
        title: title.trim(),
        body: body.trim(),
        priority,
        requiresAck,
      }

      if (expiresIn) {
        const hours = parseInt(expiresIn)
        if (hours > 0) {
          data.expiresAt = DateTime.now().plus({ hours }).toISO()!
        }
      }

      if (type === 'SURVEY') {
        const validOptions = surveyOptions.filter((o) => o.trim())
        data.surveyOptions = validOptions
        data.surveyMultiSelect = surveyMultiSelect
      }

      if (type === 'ACTION') {
        data.actionLabel = actionLabel.trim()
      }

      return broadcastOrgMessage(orgId, data)
    },
    onSuccess: () => {
      toast({ title: 'Mensaje organizacional enviado', description: 'El mensaje se ha enviado a todas las terminales de la organizacion' })
      queryClient.invalidateQueries({ queryKey: ['tpv-messages'] })
      resetForm()
      setShowCreateDialog(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo enviar el mensaje organizacional',
      })
    },
  })

  const resetForm = () => {
    setType('ANNOUNCEMENT')
    setTitle('')
    setBody('')
    setPriority('NORMAL')
    setRequiresAck(false)
    setExpiresIn('')
    setSurveyOptions(['', ''])
    setSurveyMultiSelect(false)
    setActionLabel('')
  }

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return

    if (type === 'SURVEY') {
      const validOptions = surveyOptions.filter((o) => o.trim())
      if (validOptions.length < 2) {
        toast({ variant: 'destructive', title: 'Error', description: 'Una encuesta necesita al menos 2 opciones' })
        return
      }
    }

    if (type === 'ACTION' && !actionLabel.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El boton de accion necesita un texto' })
      return
    }

    createMutation.mutate()
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

  const isValid =
    title.trim() &&
    body.trim() &&
    (type !== 'SURVEY' || surveyOptions.filter((o) => o.trim()).length >= 2) &&
    (type !== 'ACTION' || actionLabel.trim())

  const handleClose = () => {
    resetForm()
    setShowCreateDialog(false)
  }

  if (!orgId) return null

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
              <Megaphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mensajes Organizacionales</h3>
              <p className="text-xs text-muted-foreground">
                Envia mensajes a TODAS las terminales de la organizacion
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Nuevo mensaje
          </Button>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
          <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Los mensajes organizacionales se envian a todas las terminales de todas las sucursales.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Usa esta herramienta para comunicados importantes que apliquen a toda la organizacion.
          </p>
        </div>
      </GlassCard>

      <FullScreenModal
        open={showCreateDialog}
        onClose={handleClose}
        title="Mensaje organizacional"
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
                Enviar a toda la organizacion
              </>
            )}
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <Info className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Mensaje organizacional
              </p>
              <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">
                Este mensaje se enviara a todas las terminales de todas las sucursales de la organizacion.
              </p>
            </div>
          </div>

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
        </div>
      </FullScreenModal>
    </>
  )
}
