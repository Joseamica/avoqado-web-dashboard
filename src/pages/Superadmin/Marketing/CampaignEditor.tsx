/**
 * Campaign Editor
 *
 * Create/edit marketing campaigns using FullScreenModal pattern.
 * - Template selection (optional)
 * - Subject and body editor (TipTap)
 * - Recipient targeting
 * - Send or save as draft
 *
 * Design: FullScreenModal Form Pattern (Rule 15)
 */

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import * as marketingService from '@/services/superadmin-marketing.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Mail, Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RecipientSelector } from './components/RecipientSelector'
import { RichTextEditor } from './components/RichTextEditor'
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

// Convert HTML to plain text for bodyText
function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function CampaignEditor() {
  const navigate = useNavigate()
  const { campaignId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEditing = !!campaignId

  // Form state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [targetAllVenues, setTargetAllVenues] = useState(true)
  const [targetVenueIds, setTargetVenueIds] = useState<string[]>([])
  const [includeStaff, setIncludeStaff] = useState(false)
  const [targetStaffRoles, setTargetStaffRoles] = useState<string[]>([])
  const [recipientCount, setRecipientCount] = useState(0)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['marketing-templates'],
    queryFn: () => marketingService.listTemplates(),
  })

  // Fetch existing campaign if editing
  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['marketing-campaign', campaignId],
    queryFn: () => marketingService.getCampaign(campaignId!),
    enabled: isEditing,
  })

  // Load campaign data when editing
  useEffect(() => {
    if (campaignData) {
      setName(campaignData.name)
      setSubject(campaignData.subject)
      setBodyHtml(campaignData.bodyHtml)
      setSelectedTemplateId(campaignData.templateId)
      setTargetAllVenues(campaignData.targetAllVenues)
      setTargetVenueIds(campaignData.targetVenueIds)
      setIncludeStaff(campaignData.includeStaff)
      setTargetStaffRoles(campaignData.targetStaffRoles)
    }
  }, [campaignData])

  // Create campaign mutation
  const createMutation = useMutation({
    mutationFn: marketingService.createCampaign,
    onSuccess: campaign => {
      toast({ title: 'Campaña creada', description: 'La campaña se ha guardado como borrador.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      navigate(`/superadmin/marketing/${campaign.id}`)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la campaña', variant: 'destructive' })
    },
  })

  // Update campaign mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof marketingService.updateCampaign>[1] }) =>
      marketingService.updateCampaign(id, data),
    onSuccess: () => {
      toast({ title: 'Campaña actualizada', description: 'Los cambios han sido guardados.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la campaña', variant: 'destructive' })
    },
  })

  // Send campaign mutation
  const sendMutation = useMutation({
    mutationFn: marketingService.sendCampaign,
    onSuccess: data => {
      toast({
        title: 'Campaña iniciada',
        description: `Se enviarán ${data.totalRecipients} emails. El proceso puede tomar varios minutos.`,
      })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      navigate(`/superadmin/marketing/${data.campaignId}`)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo iniciar la campaña', variant: 'destructive' })
    },
  })

  // Apply template
  const handleTemplateChange = (templateId: string) => {
    if (templateId === 'none') {
      setSelectedTemplateId(null)
      return
    }

    const template = templatesData?.templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplateId(templateId)
      setSubject(template.subject)
      setBodyHtml(template.bodyHtml)
    }
  }

  // Save as draft
  const handleSave = () => {
    const bodyText = htmlToPlainText(bodyHtml)
    const data = {
      name,
      subject,
      bodyHtml,
      bodyText,
      templateId: selectedTemplateId || undefined,
      targetAllVenues,
      targetVenueIds,
      includeStaff,
      targetStaffRoles,
    }

    if (isEditing && campaignId) {
      updateMutation.mutate({ id: campaignId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  // Send campaign
  const handleSend = async () => {
    const bodyText = htmlToPlainText(bodyHtml)
    const data = {
      name,
      subject,
      bodyHtml,
      bodyText,
      templateId: selectedTemplateId || undefined,
      targetAllVenues,
      targetVenueIds,
      includeStaff,
      targetStaffRoles,
    }

    try {
      let id = campaignId
      if (!isEditing) {
        const campaign = await createMutation.mutateAsync(data)
        id = campaign.id
      } else {
        await updateMutation.mutateAsync({ id: campaignId!, data })
      }
      if (id) {
        sendMutation.mutate(id)
      }
    } catch {
      // Error handled by mutation
    }
    setSendDialogOpen(false)
  }

  const isValid = name.trim() && subject.trim() && bodyHtml.trim() && recipientCount > 0
  const isSaving = createMutation.isPending || updateMutation.isPending
  const isSending = sendMutation.isPending

  if (isEditing && campaignLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <FullScreenModal
        open={true}
        onClose={() => navigate('/superadmin/marketing')}
        title={isEditing ? 'Editar Campaña' : 'Nueva Campaña'}
        contentClassName="bg-muted/30"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full cursor-pointer"
              onClick={handleSave}
              disabled={!isValid || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar borrador
            </Button>
            <Button
              size="sm"
              className="rounded-full cursor-pointer"
              onClick={() => setSendDialogOpen(true)}
              disabled={!isValid || isSaving || isSending}
            >
              {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar ahora
            </Button>
          </div>
        }
      >
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Info Card */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Información de la campaña</h3>
                    <p className="text-sm text-muted-foreground">Nombre, asunto y template</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Template selector */}
                  <div className="space-y-2">
                    <Label>Template (opcional)</Label>
                    <Select value={selectedTemplateId || 'none'} onValueChange={handleTemplateChange}>
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Seleccionar template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Empezar desde cero
                          </span>
                        </SelectItem>
                        {templatesData?.templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campaign name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre de la campaña *</Label>
                    <Input
                      id="name"
                      placeholder="Ej: Promoción Navidad 2024"
                      className="h-12 text-base"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Solo visible internamente</p>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="subject">Asunto del email *</Label>
                    <Input
                      id="subject"
                      placeholder="Ej: ¡Nuevas funciones disponibles!"
                      className="h-12 text-base"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Email Content Card */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Contenido del email</h3>
                    <p className="text-sm text-muted-foreground">Usa el editor para dar formato al contenido</p>
                  </div>
                </div>

                <RichTextEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Escribe el contenido del email..." />
              </div>
            </div>

            {/* Sidebar - Recipients */}
            <div className="space-y-6">
              <RecipientSelector
                targetAllVenues={targetAllVenues}
                targetVenueIds={targetVenueIds}
                includeStaff={includeStaff}
                targetStaffRoles={targetStaffRoles}
                onChange={data => {
                  setTargetAllVenues(data.targetAllVenues)
                  setTargetVenueIds(data.targetVenueIds)
                  setIncludeStaff(data.includeStaff)
                  setTargetStaffRoles(data.targetStaffRoles)
                }}
                onPreviewUpdate={preview => setRecipientCount(preview.total)}
              />
            </div>
          </div>
        </div>
      </FullScreenModal>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción enviará <strong>{recipientCount}</strong> email(s). El proceso de envío se ejecutará en segundo plano y puede
              tomar varios minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} className="rounded-full cursor-pointer">
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default CampaignEditor
