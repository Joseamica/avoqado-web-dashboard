import { useState, useRef } from 'react'
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
} from 'lucide-react'
import {
  superadminAPI,
  type AppUpdate,
  type AppEnvironment,
  type AppUpdateUpdateInput,
} from '@/services/superadmin.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    versionName: '', // Optional - auto-detected from APK
    versionCode: '', // Optional - auto-detected from APK
    environment: 'SANDBOX' as AppEnvironment,
    releaseNotes: '',
    isRequired: false,
    minAndroidSdk: '', // Optional - auto-detected from APK
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.apk')) {
        toast({
          title: 'Archivo invalido',
          description: 'Solo se permiten archivos APK',
          variant: 'destructive',
        })
        return
      }
      setSelectedFile(file)
      setIsPreviewing(true)

      try {
        // Convert to base64 and cache for later upload
        const base64 = await fileToBase64(file)
        setApkBase64Cache(base64)

        // Call preview endpoint to get metadata
        const preview = await superadminAPI.previewApkMetadata(base64)

        // Auto-fill form with detected values
        setFormData((prev) => ({
          ...prev,
          versionName: preview.versionName,
          versionCode: preview.versionCode.toString(),
          minAndroidSdk: preview.minSdkVersion.toString(),
          // Auto-select environment based on package name
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
        // Clear file if preview fails
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
        // Remove data URL prefix (data:application/vnd.android.package-archive;base64,)
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSubmit = async () => {
    if (!selectedFile || !apkBase64Cache) {
      toast({
        title: 'Error',
        description: 'Selecciona un archivo APK',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      // Use cached base64 from preview
      const apkBase64 = apkBase64Cache

      const result = await superadminAPI.createAppUpdate({
        // Only include version fields if user provided them
        ...(formData.versionName && { versionName: formData.versionName }),
        ...(formData.versionCode && { versionCode: parseInt(formData.versionCode, 10) }),
        environment: formData.environment,
        releaseNotes: formData.releaseNotes || undefined,
        isRequired: formData.isRequired,
        ...(formData.minAndroidSdk && { minAndroidSdk: parseInt(formData.minAndroidSdk, 10) }),
        apkBase64,
      })

      // Show success with auto-detected info
      const { autoDetected } = result
      const detectedInfo = autoDetected?.apkMetadata
      const wasAutoDetected = autoDetected?.versionCode || autoDetected?.versionName

      toast({
        title: 'APK subido exitosamente',
        description: wasAutoDetected
          ? `Version ${detectedInfo?.versionName} (${detectedInfo?.versionCode}) auto-detectada del APK para ${formData.environment}`
          : `Version ${result.data.versionName} (${result.data.versionCode}) disponible para ${formData.environment}`,
      })

      // Show warnings if any
      if (result.warnings?.length) {
        result.warnings.forEach((warning) => {
          toast({
            title: 'Advertencia',
            description: warning,
            variant: 'default',
          })
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
    setFormData({
      versionName: '',
      versionCode: '',
      environment: 'SANDBOX',
      releaseNotes: '',
      isRequired: false,
      minAndroidSdk: '',
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Nueva Version APK
          </DialogTitle>
          <DialogDescription>
            Sube un APK de la aplicacion TPV para distribucion via Avoqado Updates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Archivo APK</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isPreviewing ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                  <div className="text-left">
                    <p className="font-medium">Analizando APK...</p>
                    <p className="text-sm text-muted-foreground">
                      Extrayendo metadata del AndroidManifest
                    </p>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <Package className="h-8 w-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click para seleccionar o arrastra un archivo APK
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Version Info - Optional, auto-detected from APK */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="versionName">
                Version Name
                <span className="text-muted-foreground text-xs ml-1">(auto-detectado)</span>
              </Label>
              <Input
                id="versionName"
                placeholder="Auto-detectado del APK"
                value={formData.versionName}
                onChange={(e) => setFormData((prev) => ({ ...prev, versionName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="versionCode">
                Version Code
                <span className="text-muted-foreground text-xs ml-1">(auto-detectado)</span>
              </Label>
              <Input
                id="versionCode"
                type="number"
                placeholder="Auto-detectado del APK"
                value={formData.versionCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, versionCode: e.target.value }))}
              />
            </div>
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select
              value={formData.environment}
              onValueChange={(value: AppEnvironment) =>
                setFormData((prev) => ({ ...prev, environment: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SANDBOX">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                      SANDBOX
                    </Badge>
                    <span className="text-muted-foreground">- Desarrollo/Testing</span>
                  </div>
                </SelectItem>
                <SelectItem value="PRODUCTION">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      PRODUCTION
                    </Badge>
                    <span className="text-muted-foreground">- Terminales de produccion</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Release Notes */}
          <div className="space-y-2">
            <Label htmlFor="releaseNotes">Notas de Version</Label>
            <Textarea
              id="releaseNotes"
              placeholder="- Correcion de errores&#10;- Nueva funcionalidad..."
              value={formData.releaseNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, releaseNotes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="isRequired" className="cursor-pointer">
                  Actualizacion Obligatoria
                </Label>
                <p className="text-xs text-muted-foreground">Forzar actualizacion</p>
              </div>
              <Switch
                id="isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isRequired: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minAndroidSdk">
                Min Android SDK
                <span className="text-muted-foreground text-xs ml-1">(auto)</span>
              </Label>
              <Input
                id="minAndroidSdk"
                type="number"
                placeholder="Auto-detectado"
                value={formData.minAndroidSdk}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, minAndroidSdk: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Info about auto-detection */}
          <Alert className="border-blue-500/20 bg-blue-500/5">
            <Package className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-xs text-muted-foreground">
              Los campos de version se auto-detectan del APK. Solo ingresalos manualmente si deseas
              sobrescribir los valores del AndroidManifest.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || isPreviewing || !selectedFile}>
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir APK
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
    isRequired: update?.isRequired || false,
    isActive: update?.isActive ?? true,
    minAndroidSdk: update?.minAndroidSdk || 27,
  })

  const handleSubmit = async () => {
    if (!update) return

    setIsSubmitting(true)
    try {
      await superadminAPI.updateAppUpdate(update.id, formData)
      toast({
        title: 'Actualizacion guardada',
        description: `Version ${update.versionName} actualizada correctamente`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update form when update prop changes
  useState(() => {
    if (update) {
      setFormData({
        releaseNotes: update.releaseNotes || '',
        isRequired: update.isRequired,
        isActive: update.isActive,
        minAndroidSdk: update.minAndroidSdk,
      })
    }
  })

  if (!update) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Version {update.versionName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editReleaseNotes">Notas de Version</Label>
            <Textarea
              id="editReleaseNotes"
              value={formData.releaseNotes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, releaseNotes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="editIsRequired" className="cursor-pointer">
                Actualizacion Obligatoria
              </Label>
              <p className="text-xs text-muted-foreground">Forzar actualizacion en TPV</p>
            </div>
            <Switch
              id="editIsRequired"
              checked={formData.isRequired}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isRequired: checked }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="editIsActive" className="cursor-pointer">
                Activa
              </Label>
              <p className="text-xs text-muted-foreground">
                Disponible para descarga en terminales
              </p>
            </div>
            <Switch
              id="editIsActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editMinAndroidSdk">Min Android SDK</Label>
            <Input
              id="editMinAndroidSdk"
              type="number"
              value={formData.minAndroidSdk}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, minAndroidSdk: parseInt(e.target.value, 10) }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
      toast({
        title: 'Version eliminada',
        description: `Version ${update.versionName} eliminada correctamente`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
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
            Estas seguro de que deseas eliminar la version <strong>{update.versionName}</strong> (
            {update.versionCode})?
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Accion irreversible</AlertTitle>
          <AlertDescription>
            Esta accion eliminara el APK de Firebase Storage y no se puede deshacer.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (updates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay versiones disponibles</p>
        <p className="text-sm">Sube un APK para comenzar</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Tamano</TableHead>
          <TableHead>Subido por</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {updates.map((update) => (
          <TableRow key={update.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    v{update.versionName}{' '}
                    <span className="text-muted-foreground">({update.versionCode})</span>
                  </p>
                  {update.releaseNotes && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {update.releaseNotes}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {update.isActive ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 w-fit">
                    <Check className="h-3 w-3 mr-1" />
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground w-fit">
                    <X className="h-3 w-3 mr-1" />
                    Inactiva
                  </Badge>
                )}
                {update.isRequired && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 w-fit">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Obligatoria
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-muted-foreground">
                <HardDrive className="h-3 w-3" />
                {formatFileSize(update.fileSize)}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {update.uploadedBy.firstName} {update.uploadedBy.lastName}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(update.createdAt)}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(update.downloadUrl, '_blank')}
                  title="Descargar APK"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(update)} title="Editar">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
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
  )
}

export default function TpvUpdates() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AppEnvironment>('PRODUCTION')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<AppUpdate | null>(null)
  const [deletingUpdate, setDeletingUpdate] = useState<AppUpdate | null>(null)

  const { data: updates = [], isLoading } = useQuery({
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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            TPV Updates (Avoqado)
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las versiones del APK TPV distribuidas via Avoqado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Subir APK
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-600">Sistema Dual de Actualizaciones</AlertTitle>
        <AlertDescription className="text-blue-600/80">
          Las terminales TPV tienen dos fuentes de actualizacion: <strong>Blumon (Proveedor)</strong>{' '}
          para actualizaciones oficiales firmadas por PAX, y <strong>Avoqado (Interno)</strong> para
          distribucion rapida de versiones. Esta pagina gestiona las actualizaciones internas de
          Avoqado.
        </AlertDescription>
      </Alert>

      {/* Latest Versions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                PRODUCTION
              </Badge>
              Ultima Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestProduction ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">v{latestProduction.versionName}</p>
                  <p className="text-sm text-muted-foreground">
                    Code: {latestProduction.versionCode}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{formatDate(latestProduction.createdAt)}</p>
                  <p>{formatFileSize(latestProduction.fileSize)}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Sin versiones disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                SANDBOX
              </Badge>
              Ultima Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestSandbox ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">v{latestSandbox.versionName}</p>
                  <p className="text-sm text-muted-foreground">Code: {latestSandbox.versionCode}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{formatDate(latestSandbox.createdAt)}</p>
                  <p>{formatFileSize(latestSandbox.fileSize)}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Sin versiones disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Updates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Versiones
          </CardTitle>
          <CardDescription>
            Todas las versiones del APK subidas para distribucion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppEnvironment)}>
            <TabsList className="mb-4">
              <TabsTrigger value="PRODUCTION" className="gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">
                  PROD
                </Badge>
                Produccion
              </TabsTrigger>
              <TabsTrigger value="SANDBOX" className="gap-2">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 text-xs">
                  SAND
                </Badge>
                Sandbox
              </TabsTrigger>
            </TabsList>

            <TabsContent value="PRODUCTION">
              <UpdatesTable
                updates={updates}
                isLoading={isLoading}
                onEdit={setEditingUpdate}
                onDelete={setDeletingUpdate}
              />
            </TabsContent>

            <TabsContent value="SANDBOX">
              <UpdatesTable
                updates={updates}
                isLoading={isLoading}
                onEdit={setEditingUpdate}
                onDelete={setDeletingUpdate}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleRefresh}
      />
      <EditDialog
        update={editingUpdate}
        isOpen={!!editingUpdate}
        onClose={() => setEditingUpdate(null)}
        onSuccess={handleRefresh}
      />
      <DeleteDialog
        update={deletingUpdate}
        isOpen={!!deletingUpdate}
        onClose={() => setDeletingUpdate(null)}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
