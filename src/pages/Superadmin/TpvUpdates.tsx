/**
 * TPV Updates Page
 *
 * Manage APK versions for TPV distribution via Avoqado Updates.
 * Design: Modern Dashboard Design System (GlassCard, MetricCard, Pill Tabs)
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  Smartphone,
  Package,
  AlertTriangle,
  Check,
  X,
  Download,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  Shield,
  Clock,
  FileText,
  HardDrive,
  Loader2,
} from 'lucide-react'
import { superadminAPI, type AppUpdate, type AppEnvironment, type AppUpdateUpdateInput } from '@/services/superadmin.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FullScreenModal } from '@/components/ui/full-screen-modal'

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

type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'yellow'

const ACCENT_COLORS: Record<AccentColor, string> = {
  green: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
  blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
  purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
  orange: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
  red: 'from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400',
  yellow: 'from-yellow-500/20 to-yellow-500/5 text-yellow-600 dark:text-yellow-400',
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: string | number): string {
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (numBytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(numBytes) / Math.log(k))
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================================
// UPLOAD DIALOG
// ============================================================================

interface UploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function UploadDialog({ isOpen, onClose, onSuccess }: UploadDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [apkBase64Cache, setApkBase64Cache] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    versionName: '',
    versionCode: '',
    environment: 'SANDBOX' as AppEnvironment,
    releaseNotes: '',
    updateMode: 'NONE' as 'NONE' | 'BANNER' | 'FORCE',
    minAndroidSdk: '',
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.apk')) {
        toast({ title: 'Archivo invalido', description: 'Solo se permiten archivos APK', variant: 'destructive' })
        return
      }
      setSelectedFile(file)
      setIsPreviewing(true)

      try {
        const base64 = await fileToBase64(file)
        setApkBase64Cache(base64)
        const preview = await superadminAPI.previewApkMetadata(base64)

        setFormData(prev => ({
          ...prev,
          versionName: preview.versionName,
          versionCode: preview.versionCode.toString(),
          minAndroidSdk: preview.minSdkVersion.toString(),
          environment: preview.detectedEnvironment || prev.environment,
        }))

        toast({
          title: 'APK analizado',
          description: `Detectado: ${preview.packageName} v${preview.versionName} (${preview.versionCode})`,
        })
      } catch (error: any) {
        toast({
          title: 'Error al analizar APK',
          description: error.response?.data?.error || error.message || 'No se pudo leer el APK',
          variant: 'destructive',
        })
        setSelectedFile(null)
        setApkBase64Cache(null)
      } finally {
        setIsPreviewing(false)
      }
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = error => reject(error)
    })
  }

  const handleSubmit = async () => {
    if (!selectedFile || !apkBase64Cache) {
      toast({ title: 'Error', description: 'Selecciona un archivo APK', variant: 'destructive' })
      return
    }

    setIsUploading(true)

    try {
      const apkBase64 = apkBase64Cache
      const result = await superadminAPI.createAppUpdate({
        ...(formData.versionName && { versionName: formData.versionName }),
        ...(formData.versionCode && { versionCode: parseInt(formData.versionCode, 10) }),
        environment: formData.environment,
        releaseNotes: formData.releaseNotes || undefined,
        updateMode: formData.updateMode,
        ...(formData.minAndroidSdk && { minAndroidSdk: parseInt(formData.minAndroidSdk, 10) }),
        apkBase64,
      })

      const { autoDetected } = result
      const detectedInfo = autoDetected?.apkMetadata
      const wasAutoDetected = autoDetected?.versionCode || autoDetected?.versionName

      toast({
        title: 'APK subido exitosamente',
        description: wasAutoDetected
          ? `Version ${detectedInfo?.versionName} (${detectedInfo?.versionCode}) auto-detectada del APK para ${formData.environment}`
          : `Version ${result.data.versionName} (${result.data.versionCode}) disponible para ${formData.environment}`,
      })

      if (result.warnings?.length) {
        result.warnings.forEach(warning => {
          toast({ title: 'Advertencia', description: warning, variant: 'default' })
        })
      }

      onSuccess()
      handleClose()
    } catch (error: any) {
      toast({
        title: 'Error al subir APK',
        description: error.response?.data?.message || error.response?.data?.error || error.message || 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setApkBase64Cache(null)
    setFormData({ versionName: '', versionCode: '', environment: 'SANDBOX', releaseNotes: '', updateMode: 'NONE', minAndroidSdk: '' })
    onClose()
  }

  return (
    <FullScreenModal
      open={isOpen}
      onClose={handleClose}
      title="Subir Nueva Version APK"
      contentClassName="bg-muted/30"
      actions={
        <Button
          size="sm"
          className="rounded-full cursor-pointer"
          onClick={handleSubmit}
          disabled={isUploading || isPreviewing || !selectedFile}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Subir APK
            </>
          )}
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* File Upload Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Archivo APK</h3>
              <p className="text-sm text-muted-foreground">Selecciona el archivo APK para distribucion</p>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isPreviewing ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Analizando APK...</p>
                  <p className="text-xs text-muted-foreground">Extrayendo metadata del AndroidManifest</p>
                </div>
              </div>
            ) : selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                  <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click para seleccionar o arrastra un archivo APK</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".apk" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Version Info Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">Informacion de Version</h3>
              <p className="text-sm text-muted-foreground">Los campos se auto-detectan del APK</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="versionName">
                  Version Name
                  <span className="text-muted-foreground text-xs ml-1">(auto)</span>
                </Label>
                <Input
                  id="versionName"
                  className="h-12 text-base"
                  placeholder="Auto-detectado"
                  value={formData.versionName}
                  onChange={e => setFormData(prev => ({ ...prev, versionName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="versionCode">
                  Version Code
                  <span className="text-muted-foreground text-xs ml-1">(auto)</span>
                </Label>
                <Input
                  id="versionCode"
                  className="h-12 text-base"
                  type="number"
                  placeholder="Auto-detectado"
                  value={formData.versionCode}
                  onChange={e => setFormData(prev => ({ ...prev, versionCode: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={formData.environment}
                onValueChange={(value: AppEnvironment) => setFormData(prev => ({ ...prev, environment: value }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SANDBOX">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 rounded-full">
                        SANDBOX
                      </Badge>
                      <span className="text-muted-foreground">- Desarrollo/Testing</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="PRODUCTION">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 rounded-full">
                        PRODUCTION
                      </Badge>
                      <span className="text-muted-foreground">- Terminales de produccion</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAndroidSdk">
                Min Android SDK
                <span className="text-muted-foreground text-xs ml-1">(auto)</span>
              </Label>
              <Input
                id="minAndroidSdk"
                className="h-12 text-base"
                type="number"
                placeholder="Auto-detectado"
                value={formData.minAndroidSdk}
                onChange={e => setFormData(prev => ({ ...prev, minAndroidSdk: e.target.value }))}
              />
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 mt-0.5">
                <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs text-muted-foreground">
                Los campos de version se auto-detectan del APK. Solo ingresalos manualmente si deseas sobrescribir los valores del
                AndroidManifest.
              </p>
            </div>
          </div>
        </div>

        {/* Distribution Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Smartphone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold">Distribucion</h3>
              <p className="text-sm text-muted-foreground">Modo de notificacion y notas de version</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="updateMode">Modo de Notificacion</Label>
              <Select
                value={formData.updateMode}
                onValueChange={(value: 'NONE' | 'BANNER' | 'FORCE') => setFormData(prev => ({ ...prev, updateMode: value }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    <Badge variant="outline" className="bg-muted text-muted-foreground rounded-full">
                      Silencioso
                    </Badge>
                  </SelectItem>
                  <SelectItem value="BANNER">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 rounded-full">
                        Banner
                      </Badge>
                      <span className="text-xs text-muted-foreground">Recomendada</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="FORCE">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 rounded-full">
                        Forzar
                      </Badge>
                      <span className="text-xs text-muted-foreground">Bloquea app</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.updateMode === 'NONE' && 'Sin notificacion, usuario debe buscar manualmente'}
                {formData.updateMode === 'BANNER' && 'Banner persistente, usuario puede ignorar'}
                {formData.updateMode === 'FORCE' && 'Bloquea la app hasta actualizar (critico)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="releaseNotes">Notas de Version</Label>
              <Textarea
                id="releaseNotes"
                className="text-base"
                placeholder="- Correcion de errores&#10;- Nueva funcionalidad..."
                value={formData.releaseNotes}
                onChange={e => setFormData(prev => ({ ...prev, releaseNotes: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}

// ============================================================================
// EDIT DIALOG
// ============================================================================

interface EditDialogProps {
  update: AppUpdate | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function EditDialog({ update, isOpen, onClose, onSuccess }: EditDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<AppUpdateUpdateInput>({
    releaseNotes: update?.releaseNotes || '',
    updateMode: update?.updateMode || 'NONE',
    isActive: update?.isActive ?? true,
    minAndroidSdk: update?.minAndroidSdk || 27,
  })

  const handleSubmit = async () => {
    if (!update) return
    setIsSubmitting(true)
    try {
      await superadminAPI.updateAppUpdate(update.id, formData)
      toast({ title: 'Actualizacion guardada', description: `Version ${update.versionName} actualizada correctamente` })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({ title: 'Error al actualizar', description: error.response?.data?.message || error.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (update) {
      setFormData({
        releaseNotes: update.releaseNotes || '',
        updateMode: update.updateMode || 'NONE',
        isActive: update.isActive,
        minAndroidSdk: update.minAndroidSdk,
      })
    }
  }, [update])

  if (!update) return null

  return (
    <FullScreenModal
      open={isOpen}
      onClose={onClose}
      title={`Editar Version ${update.versionName}`}
      contentClassName="bg-muted/30"
      actions={
        <Button size="sm" className="rounded-full cursor-pointer" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar Cambios'
          )}
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Settings Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Edit className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">Configuracion</h3>
              <p className="text-sm text-muted-foreground">Modo de actualizacion y SDK minimo</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editUpdateMode">Modo de Notificacion</Label>
              <Select
                value={formData.updateMode}
                onValueChange={(value: 'NONE' | 'BANNER' | 'FORCE') => setFormData(prev => ({ ...prev, updateMode: value }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">
                    <Badge variant="outline" className="bg-muted text-muted-foreground rounded-full">
                      Silencioso
                    </Badge>
                  </SelectItem>
                  <SelectItem value="BANNER">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 rounded-full">
                      Banner
                    </Badge>
                  </SelectItem>
                  <SelectItem value="FORCE">
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 rounded-full">
                      Forzar
                    </Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-border/50 p-4 cursor-pointer hover:bg-muted/50"
              onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
            >
              <div>
                <Label htmlFor="editIsActive" className="cursor-pointer text-sm font-medium">
                  Activa
                </Label>
                <p className="text-xs text-muted-foreground">Disponible para descarga en terminales</p>
              </div>
              <Switch id="editIsActive" checked={formData.isActive} onClick={e => e.stopPropagation()} className="cursor-pointer" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editMinAndroidSdk">Min Android SDK</Label>
              <Input
                id="editMinAndroidSdk"
                className="h-12 text-base"
                type="number"
                value={formData.minAndroidSdk}
                onChange={e => setFormData(prev => ({ ...prev, minAndroidSdk: parseInt(e.target.value, 10) }))}
              />
            </div>
          </div>
        </div>

        {/* Release Notes Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Notas de Version</h3>
              <p className="text-sm text-muted-foreground">Cambios incluidos en esta version</p>
            </div>
          </div>

          <Textarea
            id="editReleaseNotes"
            className="text-base"
            value={formData.releaseNotes || ''}
            onChange={e => setFormData(prev => ({ ...prev, releaseNotes: e.target.value }))}
            rows={5}
          />
        </div>
      </div>
    </FullScreenModal>
  )
}

// ============================================================================
// DELETE DIALOG
// ============================================================================

interface DeleteDialogProps {
  update: AppUpdate | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function DeleteDialog({ update, isOpen, onClose, onSuccess }: DeleteDialogProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!update) return
    setIsDeleting(true)
    try {
      await superadminAPI.deleteAppUpdate(update.id)
      toast({ title: 'Version eliminada', description: `Version ${update.versionName} eliminada correctamente` })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({ title: 'Error al eliminar', description: error.response?.data?.message || error.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!update) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Eliminar Version
          </DialogTitle>
          <DialogDescription>
            Estas seguro de que deseas eliminar la version <strong>{update.versionName}</strong> ({update.versionCode})?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5 mt-0.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Accion irreversible</p>
            <p className="text-xs text-muted-foreground">Esta accion eliminara el APK de Firebase Storage y no se puede deshacer.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="rounded-full cursor-pointer">
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="rounded-full cursor-pointer">
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// UPDATES TABLE
// ============================================================================

function UpdatesTable({
  updates,
  isLoading,
  onEdit,
  onDelete,
}: {
  updates: AppUpdate[]
  isLoading: boolean
  onEdit: (update: AppUpdate) => void
  onDelete: (update: AppUpdate) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (updates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">No hay versiones disponibles</p>
        <p className="text-xs mt-1">Sube un APK para comenzar</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Version</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Tamano</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Subido por</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {updates.map(update => (
            <TableRow key={update.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      v{update.versionName} <span className="text-muted-foreground">({update.versionCode})</span>
                    </p>
                    {update.releaseNotes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{update.releaseNotes}</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {update.isActive ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 w-fit rounded-full">
                      <Check className="h-3 w-3 mr-1" />
                      Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground w-fit rounded-full">
                      <X className="h-3 w-3 mr-1" />
                      Inactiva
                    </Badge>
                  )}
                  {update.updateMode === 'BANNER' && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 w-fit rounded-full">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Banner
                    </Badge>
                  )}
                  {update.updateMode === 'FORCE' && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 w-fit rounded-full">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Forzar
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(update.fileSize)}
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm">
                  {update.uploadedBy.firstName} {update.uploadedBy.lastName}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(update.createdAt)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full cursor-pointer"
                    onClick={() => window.open(update.downloadUrl, '_blank')}
                    title="Descargar APK"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full cursor-pointer"
                    onClick={() => onEdit(update)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => onDelete(update)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TpvUpdates() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AppEnvironment>('PRODUCTION')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<AppUpdate | null>(null)
  const [deletingUpdate, setDeletingUpdate] = useState<AppUpdate | null>(null)

  const { data: updates = [], isLoading, isFetching } = useQuery({
    queryKey: ['superadmin', 'app-updates', activeTab],
    queryFn: () => superadminAPI.getAppUpdates({ environment: activeTab }),
  })

  const { data: latestSandbox } = useQuery({
    queryKey: ['superadmin', 'app-updates', 'latest', 'SANDBOX'],
    queryFn: () => superadminAPI.getLatestAppUpdate('SANDBOX'),
  })

  const { data: latestProduction } = useQuery({
    queryKey: ['superadmin', 'app-updates', 'latest', 'PRODUCTION'],
    queryFn: () => superadminAPI.getLatestAppUpdate('PRODUCTION'),
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['superadmin', 'app-updates'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TPV Updates</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona las versiones del APK TPV distribuidas via Avoqado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} title="Actualizar" className="rounded-full cursor-pointer">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setIsUploadOpen(true)} className="rounded-full cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Subir APK
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <GlassCard className="p-4 border-blue-500/20 bg-blue-500/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Sistema Dual de Actualizaciones</p>
            <p className="text-xs text-muted-foreground mt-1">
              Las terminales TPV tienen dos fuentes de actualizacion: <strong>Blumon (Proveedor)</strong> para actualizaciones oficiales
              firmadas por PAX, y <strong>Avoqado (Interno)</strong> para distribucion rapida de versiones.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Latest Versions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Production</h3>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 rounded-full text-xs">
                  PROD
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Ultima version</p>
            </div>
          </div>
          {latestProduction ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight">v{latestProduction.versionName}</p>
                <p className="text-xs text-muted-foreground">Code: {latestProduction.versionCode}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{formatDate(latestProduction.createdAt)}</p>
                <p>{formatFileSize(latestProduction.fileSize)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin versiones disponibles</p>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5">
              <Package className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Sandbox</h3>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 rounded-full text-xs">
                  SAND
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Ultima version</p>
            </div>
          </div>
          {latestSandbox ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight">v{latestSandbox.versionName}</p>
                <p className="text-xs text-muted-foreground">Code: {latestSandbox.versionCode}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{formatDate(latestSandbox.createdAt)}</p>
                <p>{formatFileSize(latestSandbox.fileSize)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin versiones disponibles</p>
          )}
        </GlassCard>
      </div>

      {/* Updates List */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Historial de Versiones</h3>
              <p className="text-xs text-muted-foreground">Todas las versiones del APK subidas para distribucion</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as AppEnvironment)}>
            <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border mb-4">
              <TabsTrigger
                value="PRODUCTION"
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
              >
                Produccion
              </TabsTrigger>
              <TabsTrigger
                value="SANDBOX"
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
              >
                Sandbox
              </TabsTrigger>
            </TabsList>

            <TabsContent value="PRODUCTION">
              <UpdatesTable updates={updates} isLoading={isLoading} onEdit={setEditingUpdate} onDelete={setDeletingUpdate} />
            </TabsContent>

            <TabsContent value="SANDBOX">
              <UpdatesTable updates={updates} isLoading={isLoading} onEdit={setEditingUpdate} onDelete={setDeletingUpdate} />
            </TabsContent>
          </Tabs>
        </div>
      </GlassCard>

      {/* Dialogs */}
      <UploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onSuccess={handleRefresh} />
      <EditDialog update={editingUpdate} isOpen={!!editingUpdate} onClose={() => setEditingUpdate(null)} onSuccess={handleRefresh} />
      <DeleteDialog update={deletingUpdate} isOpen={!!deletingUpdate} onClose={() => setDeletingUpdate(null)} onSuccess={handleRefresh} />
    </div>
  )
}
