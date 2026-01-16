/**
 * BulkUploadSection - CSV drag & drop for bulk stock upload
 */

import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadResult {
  total: number
  success: number
  errors: number
  errorDetails?: { row: number; error: string }[]
}

interface BulkUploadSectionProps {
  onUpload?: (file: File) => Promise<UploadResult>
  onDownloadTemplate?: () => void
  className?: string
}

export const BulkUploadSection: React.FC<BulkUploadSectionProps> = ({
  onUpload,
  onDownloadTemplate,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
    if (files.length > 0 && files[0].type === 'text/csv') {
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

  const handleUpload = async () => {
    if (!selectedFile || !onUpload) return

    setIsUploading(true)
    try {
      // Simulate upload for demo
      await new Promise(resolve => setTimeout(resolve, 2000))
      const result: UploadResult = {
        total: 150,
        success: 145,
        errors: 5,
        errorDetails: [
          { row: 23, error: 'Serial duplicado' },
          { row: 45, error: 'Formato inválido' },
          { row: 67, error: 'Categoría no existe' },
          { row: 89, error: 'Serial duplicado' },
          { row: 112, error: 'Falta número de serie' },
        ]
      }
      setUploadResult(result)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = () => {
    // Create sample CSV content
    const csvContent = `serial,category,batch_id,notes
8952140063000001234,Chip Telcel Negra,BATCH-001,
8952140063000001235,Chip Telcel Negra,BATCH-001,
8952140063000005678,Chip Telcel Blanca,BATCH-002,Nueva entrada
8952140063000005679,Chip Telcel Blanca,BATCH-002,`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_stock.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setUploadResult(null)
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {t('playtelecom:stock.upload.title', { defaultValue: 'Carga Masiva' })}
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
        >
          <Download className="w-4 h-4 mr-1" />
          {t('playtelecom:stock.upload.template', { defaultValue: 'Plantilla' })}
        </Button>
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div className={cn(
          'mb-4 p-4 rounded-xl border',
          uploadResult.errors === 0
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {uploadResult.errors === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              )}
              <span className="font-semibold">
                {uploadResult.errors === 0
                  ? t('playtelecom:stock.upload.success', { defaultValue: 'Carga completada' })
                  : t('playtelecom:stock.upload.partial', { defaultValue: 'Carga parcial' })}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={resetUpload}>
              Nueva carga
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Total: <strong>{uploadResult.total}</strong>
            </span>
            <span className="text-green-600 dark:text-green-400">
              Exitosos: <strong>{uploadResult.success}</strong>
            </span>
            {uploadResult.errors > 0 && (
              <span className="text-red-600 dark:text-red-400">
                Errores: <strong>{uploadResult.errors}</strong>
              </span>
            )}
          </div>
          {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-medium mb-2">Errores:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {uploadResult.errorDetails.map((err, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                    <span>Fila {err.row}: {err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!uploadResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border/50 hover:border-border'
          )}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetUpload}
                  disabled={isUploading}
                >
                  {t('common:cancel', { defaultValue: 'Cancelar' })}
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      {t('playtelecom:stock.upload.uploading', { defaultValue: 'Cargando...' })}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />
                      {t('playtelecom:stock.upload.upload', { defaultValue: 'Cargar' })}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-1">
                {t('playtelecom:stock.upload.dragDrop', { defaultValue: 'Arrastra un archivo CSV aquí' })}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('playtelecom:stock.upload.orClick', { defaultValue: 'o haz clic para seleccionar' })}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    {t('playtelecom:stock.upload.selectFile', { defaultValue: 'Seleccionar archivo' })}
                  </span>
                </Button>
              </label>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 rounded-lg bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">
            {t('playtelecom:stock.upload.format', { defaultValue: 'Formato requerido' })}:
          </strong>{' '}
          CSV con columnas: serial, category, batch_id, notes (opcional)
        </p>
      </div>
    </GlassCard>
  )
}

export default BulkUploadSection
