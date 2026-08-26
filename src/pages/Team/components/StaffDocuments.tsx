import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { staffDocumentService, type StaffDocument, type StaffDocumentType } from '@/services/staffDocument.service'

/**
 * Expediente de una persona.
 *
 * 🔴 Datos personales sensibles. La sección entera vive tras `staff-documents:read`, que por
 * defecto sólo tienen OWNER y ADMIN — un gerente NO ve esto, aunque sí vea al equipo.
 */

const TYPES: StaffDocumentType[] = ['ID', 'CURP', 'SOCIAL_SECURITY', 'RFC', 'CONTRACT', 'CERTIFICATION', 'MEDICAL', 'OTHER']

const MAX_BYTES = 20 * 1024 * 1024

interface Props {
  venueId: string
  staffId: string
}

export function StaffDocuments({ venueId, staffId }: Props) {
  const { t } = useTranslation(['team', 'common'])
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<StaffDocumentType>('ID')
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<StaffDocument | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  // La URL se pide AL ABRIR y caduca en minutos: no se guarda en ningún lado.
  async function openDocument(documentId: string) {
    setOpeningId(documentId)
    try {
      const { url } = await staffDocumentService.getUrl(venueId, documentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      toast({
        title: t('documents.toasts.errorTitle'),
        description: error?.response?.data?.message || t('documents.toasts.openFailed'),
        variant: 'destructive',
      })
    } finally {
      setOpeningId(null)
    }
  }

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['staff-documents', venueId, staffId],
    queryFn: () => staffDocumentService.list(venueId, staffId),
    enabled: !!venueId && !!staffId,
  })

  const addMutation = useMutation({
    mutationFn: ({ input, file }: { input: Parameters<typeof staffDocumentService.add>[2]; file: File }) =>
      staffDocumentService.add(venueId, staffId, input, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', venueId, staffId] })
      setLabel('')
      setExpiresAt('')
      toast({ title: t('documents.toasts.addedTitle'), description: t('documents.toasts.addedDesc') })
    },
    onError: (error: any) => {
      toast({
        title: t('documents.toasts.errorTitle'),
        description: error?.response?.data?.message || t('documents.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (documentId: string) => staffDocumentService.remove(venueId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', venueId, staffId] })
      toast({ title: t('documents.toasts.removedTitle'), description: t('documents.toasts.removedDesc') })
    },
  })

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Se limpia siempre: sin esto, elegir el MISMO archivo otra vez no dispara change.
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      toast({ title: t('documents.toasts.tooBigTitle'), description: t('documents.toasts.tooBigDesc'), variant: 'destructive' })
      return
    }
    if (type === 'OTHER' && !label.trim()) {
      toast({ title: t('documents.toasts.needLabelTitle'), description: t('documents.toasts.needLabelDesc'), variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      // 🔴 El navegador NO toca Storage. El archivo va al servidor, que lo guarda en un
      // prefijo privado. Antes se subía directo al mismo árbol público que los logos y las
      // fotos de la PAX (auditoría Codex 26-ago, P1).
      await addMutation.mutateAsync({
        input: { type, label: label.trim() || null, expiresAt: expiresAt || null },
        file,
      })
    } catch {
      // onError de la mutación ya avisó con el mensaje del servidor.
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || addMutation.isPending

  return (
    <Card className="border-input">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t('documents.title')}</h3>
          {documents.length > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {documents.length}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('documents.privacyNote')}</p>

        <PermissionGate permission="staff-documents:write">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('documents.fields.type')}</Label>
              <Select value={type} onValueChange={v => setType(v as StaffDocumentType)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(option => (
                    <SelectItem key={option} value={option}>
                      {t(`documents.types.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {type === 'OTHER' ? t('documents.fields.labelRequired') : t('documents.fields.label')}
              </Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('documents.fields.labelPlaceholder')} className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('documents.fields.expiresAt')}</Label>
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="h-10" />
            </div>
          </div>

          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.webp" />
          <Button variant="outline" size="sm" className="cursor-pointer" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? t('documents.uploading') : t('documents.upload')}
          </Button>
        </PermissionGate>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('documents.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {documents.map(doc => {
              // Se compara por DÍA (YYYY-MM-DD), no por instante: un vencimiento "hoy" no debe
              // aparecer vencido durante el propio día (auditoría Codex, P2).
              const expired = !!doc.expiresAt && doc.expiresAt.slice(0, 10) < new Date().toISOString().slice(0, 10)
              return (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.label || t(`documents.types.${doc.type}`)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.fileName} · {formatDate(doc.createdAt)}
                      {doc.uploadedBy && ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
                    </p>
                    {doc.expiresAt && (
                      <p className={`text-xs inline-flex items-center gap-1 ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {expired && <AlertTriangle className="h-3 w-3" />}
                        {t(expired ? 'documents.expired' : 'documents.expires', { date: formatDate(doc.expiresAt) })}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={openingId === doc.id}
                      onClick={() => openDocument(doc.id)}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {openingId === doc.id ? t('documents.opening') : t('documents.open')}
                    </Button>
                    <PermissionGate permission="staff-documents:write">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setRemoving(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!removing} onOpenChange={open => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documents.removeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing ? t('documents.removeDialog.description', { name: removing.label || removing.fileName }) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('documents.removeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (removing) removeMutation.mutate(removing.id)
                setRemoving(null)
              }}
            >
              {t('documents.removeDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
