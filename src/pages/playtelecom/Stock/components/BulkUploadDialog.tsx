/**
 * BulkUploadDialog - Upload serialized items to a category
 *
 * Features:
 * - Category selection dropdown
 * - CSV drag & drop
 * - Manual serial number input (one per line)
 * - Upload results with errors
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  Keyboard,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { getItemCategories, bulkUploadItems } from '@/services/stockDashboard.service'
import { orgBulkUploadItems } from '@/services/orgItemCategory.service'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedCategoryId?: string
}

interface UploadResult {
  success: boolean
  created: number
  duplicates: string[]
  errors: string[]
  total: number
}

export function BulkUploadDialog({ open, onOpenChange, preselectedCategoryId }: BulkUploadDialogProps) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(preselectedCategoryId || '')
  const [uploadMode, setUploadMode] = useState<'csv' | 'manual'>('manual')
  const [manualSerials, setManualSerials] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [isOrgLevel, setIsOrgLevel] = useState(false)
  const canOrgManage = can('inventory:org-manage')

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['item-categories', venueId],
    queryFn: () => getItemCategories(venueId!, { includeStats: false }),
    enabled: !!venueId && open,
  })

  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData])

  // Update selected category when preselected changes
  useMemo(() => {
    if (preselectedCategoryId) {
      setSelectedCategoryId(preselectedCategoryId)
    }
  }, [preselectedCategoryId])

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCategoryId) {
        throw new Error('Selecciona una categoría')
      }

      let data: { csvContent?: string; serialNumbers?: string[] }

      if (uploadMode === 'csv' && selectedFile) {
        const csvContent = await selectedFile.text()
        data = { csvContent }
      } else if (uploadMode === 'manual' && manualSerials.trim()) {
        const serialNumbers = manualSerials
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        data = { serialNumbers }
      } else {
        throw new Error('Proporciona números de serie')
      }

      if (isOrgLevel) {
        return orgBulkUploadItems(venueId!, selectedCategoryId, data)
      }
      return bulkUploadItems(venueId!, selectedCategoryId, data)
    },
    onSuccess: (result) => {
      setUploadResult(result)
      queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
      queryClient.invalidateQueries({ queryKey: ['org-item-categories', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stock', venueId] })

      if (result.success && result.errors.length === 0) {
        toast({
          title: t('playtelecom:bulkUpload.success', {
            defaultValue: `${result.created} items registrados correctamente`,
            count: result.created,
          }),
        })
      } else if (result.created > 0) {
        toast({
          title: t('playtelecom:bulkUpload.partial', {
            defaultValue: `${result.created} items registrados, ${result.duplicates.length + result.errors.length} errores`,
          }),
        })
      } else {
        toast({
          title: t('playtelecom:bulkUpload.failed', {
            defaultValue: 'No se registraron items',
          }),
          variant: 'destructive',
        })
      }
    },
    onError: (error: any) => {
      toast({
        title: error.message || t('common:error'),
        variant: 'destructive',
      })
    },
  })

  // File handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0 && (files[0].type === 'text/csv' || files[0].name.endsWith('.csv'))) {
      setSelectedFile(files[0])
      setUploadResult(null)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
      setUploadResult(null)
    }
  }, [])

  const handleDownloadTemplate = () => {
    const csvContent = `serial_number
8952140063000001234
8952140063000001235
8952140063000005678`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_seriales.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setManualSerials('')
    setUploadResult(null)
  }

  const handleClose = () => {
    handleReset()
    setSelectedCategoryId(preselectedCategoryId || '')
    onOpenChange(false)
  }

  const handleUpload = () => {
    uploadMutation.mutate()
  }

  const serialCount = useMemo(() => {
    if (uploadMode === 'manual') {
      return manualSerials
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0).length
    }
    return 0
  }, [manualSerials, uploadMode])

  const canUpload =
    selectedCategoryId &&
    ((uploadMode === 'csv' && selectedFile) || (uploadMode === 'manual' && serialCount > 0))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t('playtelecom:bulkUpload.title', { defaultValue: 'Cargar Inventario' })}
          </DialogTitle>
          <DialogDescription>
            {t('playtelecom:bulkUpload.description', {
              defaultValue: 'Registra múltiples números de serie en una categoría.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="grid gap-2">
            <Label>
              {t('playtelecom:bulkUpload.selectCategory', { defaultValue: 'Categoría' })} *
            </Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t('playtelecom:bulkUpload.selectCategoryPlaceholder', {
                    defaultValue: 'Selecciona una categoría',
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(cat => isOrgLevel ? cat.source === 'organization' : true)
                  .map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color || '#888' }}
                      />
                      {category.name}
                      {category.source === 'organization' && (
                        <Badge variant="outline" className="text-[9px] ml-1 border-primary/30 text-primary">
                          ORG
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:bulkUpload.noCategoriesHint', {
                  defaultValue: 'Primero debes crear una categoría',
                })}
              </p>
            )}
          </div>

          {/* Org-Level Toggle */}
          {canOrgManage && (
            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Registrar a nivel organización</Label>
                <p className="text-xs text-muted-foreground">
                  Los items estarán disponibles en todas las tiendas
                </p>
              </div>
              <Switch
                checked={isOrgLevel}
                onCheckedChange={(checked) => {
                  setIsOrgLevel(checked)
                  setSelectedCategoryId('')
                }}
              />
            </div>
          )}

          {/* Upload Mode Tabs */}
          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'csv' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="gap-2">
                <Keyboard className="w-4 h-4" />
                {t('playtelecom:bulkUpload.manual', { defaultValue: 'Manual' })}
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                {t('playtelecom:bulkUpload.csv', { defaultValue: 'Archivo CSV' })}
              </TabsTrigger>
            </TabsList>

            {/* Manual Input */}
            <TabsContent value="manual" className="mt-4">
              <div className="grid gap-2">
                <Label>
                  {t('playtelecom:bulkUpload.serialNumbers', { defaultValue: 'Números de Serie' })}
                </Label>
                <Textarea
                  value={manualSerials}
                  onChange={(e) => {
                    setManualSerials(e.target.value)
                    setUploadResult(null)
                  }}
                  placeholder={`8952140063000001234
8952140063000001235
8952140063000005678`}
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('playtelecom:bulkUpload.onePerLine', {
                    defaultValue: 'Un número de serie por línea',
                  })}
                  {serialCount > 0 && (
                    <span className="ml-2 font-medium text-foreground">
                      ({serialCount} {serialCount === 1 ? 'item' : 'items'})
                    </span>
                  )}
                </p>
              </div>
            </TabsContent>

            {/* CSV Upload */}
            <TabsContent value="csv" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4 mr-1" />
                  {t('playtelecom:bulkUpload.template', { defaultValue: 'Descargar plantilla' })}
                </Button>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center transition-all',
                  isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border',
                )}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)}>
                      {t('playtelecom:bulkUpload.removeFile', { defaultValue: 'Quitar archivo' })}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm mb-2">
                      {t('playtelecom:bulkUpload.dragDrop', {
                        defaultValue: 'Arrastra un archivo CSV aquí',
                      })}
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="bulk-csv-upload"
                    />
                    <label htmlFor="bulk-csv-upload">
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          {t('playtelecom:bulkUpload.selectFile', {
                            defaultValue: 'Seleccionar archivo',
                          })}
                        </span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Upload Result */}
          {uploadResult && (
            <div
              className={cn(
                'p-4 rounded-xl border',
                uploadResult.errors.length === 0 && uploadResult.duplicates.length === 0
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {uploadResult.errors.length === 0 && uploadResult.duplicates.length === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <span className="font-semibold">
                  {uploadResult.created} de {uploadResult.total} registrados
                </span>
              </div>

              {uploadResult.duplicates.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">
                    Duplicados ({uploadResult.duplicates.length}):
                  </p>
                  <div className="max-h-20 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                    {uploadResult.duplicates.slice(0, 5).map((serial, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-yellow-500 shrink-0" />
                        <code>{serial}</code>
                      </div>
                    ))}
                    {uploadResult.duplicates.length > 5 && (
                      <p className="text-muted-foreground">
                        ...y {uploadResult.duplicates.length - 5} más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Errores ({uploadResult.errors.length}):</p>
                  <div className="max-h-20 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                    {uploadResult.errors.slice(0, 3).map((error, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {uploadResult ? t('common:close', { defaultValue: 'Cerrar' }) : t('common:cancel', { defaultValue: 'Cancelar' })}
          </Button>
          {!uploadResult && (
            <Button onClick={handleUpload} disabled={!canUpload || uploadMutation.isPending}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('playtelecom:bulkUpload.uploading', { defaultValue: 'Cargando...' })}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {t('playtelecom:bulkUpload.upload', { defaultValue: 'Cargar' })}
                </>
              )}
            </Button>
          )}
          {uploadResult && uploadResult.created > 0 && (
            <Button onClick={handleReset}>
              {t('playtelecom:bulkUpload.uploadMore', { defaultValue: 'Cargar más' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BulkUploadDialog
