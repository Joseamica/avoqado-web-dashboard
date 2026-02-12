import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { DateTime } from 'luxon'

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo mensaje</DialogTitle>
          <DialogDescription>Envia un mensaje a las terminales TPV de este venue</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Message Type */}
          <div className="space-y-2">
            <Label>Tipo de mensaje</Label>
            <Select value={type} onValueChange={(v) => setType(v as MessageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNOUNCEMENT">Anuncio</SelectItem>
                <SelectItem value="SURVEY">Encuesta</SelectItem>
                <SelectItem value="ACTION">Accion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Nuevo procedimiento de cierre"
              maxLength={100}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Mensaje</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el contenido del mensaje..."
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as MessagePriority)}>
              <SelectTrigger>
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
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div>
              <p className="text-sm font-medium">Requiere confirmacion</p>
              <p className="text-xs text-muted-foreground">El staff no podra cerrar el mensaje sin confirmar</p>
            </div>
            <Switch checked={requiresAck} onCheckedChange={setRequiresAck} />
          </div>

          {/* Survey Options */}
          {type === 'SURVEY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Opciones de encuesta</Label>
                <Button variant="outline" size="sm" onClick={addSurveyOption} disabled={surveyOptions.length >= 6}>
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
                  />
                  {surveyOptions.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSurveyOption(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
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
              <Label>Texto del boton</Label>
              <Input
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="Ej: Abrir instrucciones"
                maxLength={50}
              />
            </div>
          )}

          {/* Target */}
          <div className="space-y-3">
            <Label>Destino</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as 'ALL_TERMINALS' | 'SPECIFIC_TERMINALS')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_TERMINALS">Todas las terminales</SelectItem>
                <SelectItem value="SPECIFIC_TERMINALS">Terminales especificas</SelectItem>
              </SelectContent>
            </Select>

            {targetType === 'SPECIFIC_TERMINALS' && (
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {terminals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No hay terminales disponibles</p>
                ) : (
                  terminals.map((terminal: any) => (
                    <label
                      key={terminal.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTerminalIds.includes(terminal.id)}
                        onChange={() => toggleTerminal(terminal.id)}
                        className="rounded border-border"
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

          {/* Expiration */}
          <div className="space-y-2">
            <Label>Expiracion (opcional)</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger>
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

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar mensaje'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
