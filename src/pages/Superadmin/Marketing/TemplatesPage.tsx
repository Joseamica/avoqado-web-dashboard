/**
 * Templates Page
 *
 * Manage reusable email templates for marketing campaigns.
 * Uses FullScreenModal for create/edit (Rule 15).
 * Design: Modern Dashboard Design System.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import * as marketingService from '@/services/superadmin-marketing.service'
import type { EmailTemplate } from '@/services/superadmin-marketing.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { ArrowLeft, FileText, Loader2, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RichTextEditor } from './components/RichTextEditor'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

// ============================================================================
// DESIGN SYSTEM COMPONENTS
// ============================================================================

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

// Convert HTML to plain text
function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function TemplatesPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')

  // Fetch templates
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['marketing-templates', searchQuery],
    queryFn: () => marketingService.listTemplates({ search: searchQuery || undefined }),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: marketingService.createTemplate,
    onSuccess: () => {
      toast({ title: 'Template creado', description: 'El template se ha guardado correctamente.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] })
      closeDialog()
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear el template', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof marketingService.updateTemplate>[1] }) =>
      marketingService.updateTemplate(id, data),
    onSuccess: () => {
      toast({ title: 'Template actualizado', description: 'Los cambios han sido guardados.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] })
      closeDialog()
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar el template', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: marketingService.deleteTemplate,
    onSuccess: () => {
      toast({ title: 'Template eliminado', description: 'El template ha sido eliminado correctamente.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] })
      setTemplateToDelete(null)
      setDeleteDialogOpen(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar el template', variant: 'destructive' })
    },
  })

  const openCreateDialog = () => {
    setEditingTemplate(null)
    setName('')
    setSubject('')
    setBodyHtml('')
    setDialogOpen(true)
  }

  const openEditDialog = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setName(template.name)
    setSubject(template.subject)
    setBodyHtml(template.bodyHtml)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingTemplate(null)
    setName('')
    setSubject('')
    setBodyHtml('')
  }

  const handleSave = () => {
    const bodyText = htmlToPlainText(bodyHtml)
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: { name, subject, bodyHtml, bodyText },
      })
    } else {
      createMutation.mutate({ name, subject, bodyHtml, bodyText })
    }
  }

  const handleDelete = (id: string) => {
    setTemplateToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete)
    }
  }

  const isValid = name.trim() && subject.trim() && bodyHtml.trim()
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full cursor-pointer"
            onClick={() => navigate('/superadmin/marketing')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Plantillas reutilizables para campañas de email</p>
          </div>
        </div>
        <Button className="rounded-full cursor-pointer" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Template
        </Button>
      </div>

      {/* Templates Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Templates guardados</h3>
                <p className="text-xs text-muted-foreground">Total: {data?.total || 0} template(s)</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-full cursor-pointer" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                placeholder="Buscar por nombre..."
                className="pl-10 rounded-full"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.templates.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">No hay templates</p>
              <Button className="mt-4 rounded-full cursor-pointer" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer template
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider">Nombre</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Asunto</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-center">Campañas</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Creado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.templates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium text-sm">{template.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {template.subject}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-full">
                          {template._count?.campaigns || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {DateTime.fromISO(template.createdAt).toRelative({ locale: 'es' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(template)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(template.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Create/Edit Template - FullScreenModal */}
      <FullScreenModal
        open={dialogOpen}
        onClose={closeDialog}
        title={editingTemplate ? 'Editar Template' : 'Nuevo Template'}
        contentClassName="bg-muted/30"
        actions={
          <Button
            size="sm"
            className="rounded-full cursor-pointer"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingTemplate ? 'Guardar cambios' : 'Crear template'}
          </Button>
        }
      >
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Info Card */}
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Información del template</h3>
                <p className="text-sm text-muted-foreground">Nombre y asunto del email</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nombre del template *</Label>
                <Input
                  id="template-name"
                  placeholder="Ej: Newsletter mensual"
                  className="h-12 text-base"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-subject">Asunto del email *</Label>
                <Input
                  id="template-subject"
                  placeholder="Ej: ¡Novedades de este mes!"
                  className="h-12 text-base"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Content Card */}
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold">Contenido *</h3>
                <p className="text-sm text-muted-foreground">Usa el editor para dar formato</p>
              </div>
            </div>

            <RichTextEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Escribe el contenido del template..." />
          </div>
        </div>
      </FullScreenModal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las campañas que usaron este template no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full cursor-pointer"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default TemplatesPage
