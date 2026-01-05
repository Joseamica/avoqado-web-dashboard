// src/components/menu/MenuImportDialog.tsx

import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  parseCSV,
  validateCSV,
  transformCSVData,
  importMenu,
  downloadTemplate,
  exportCurrentMenu,
  type ParsedCategory,
} from '@/services/menuImport.service'
import { Upload, Download, FileText, AlertCircle, CheckCircle2, XCircle, Loader2, AlertTriangle, FileDown } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import * as menuService from '@/services/menu.service'

interface MenuImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ImportStep = 'select' | 'upload' | 'preview' | 'import'

export function MenuImportDialog({ open, onOpenChange }: MenuImportDialogProps) {
  const { t } = useTranslation('menuImport')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch current menu data for export
  const { data: categories } = useQuery({
    queryKey: ['menuCategories', venueId],
    queryFn: () => menuService.getMenuCategories(venueId!),
    enabled: !!venueId && open,
  })

  const { data: products } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => menuService.getProducts(venueId!),
    enabled: !!venueId && open,
  })

  const { data: modifierGroups } = useQuery({
    queryKey: ['modifierGroups', venueId],
    queryFn: () => menuService.getModifierGroups(venueId!),
    enabled: !!venueId && open,
  })

  // State
  const [step, setStep] = useState<ImportStep>('select')
  const [templateType, setTemplateType] = useState<'basic' | 'advanced'>('basic')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCategory[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('select')
        setTemplateType('basic')
        setImportMode('merge')
        setFile(null)
        setParsedData([])
        setValidationErrors([])
        setIsValidating(false)
        setIsImporting(false)
      }, 300) // Wait for dialog close animation
    }
  }, [open])

  // Handle template download
  const handleDownloadTemplate = useCallback((type: 'basic' | 'advanced') => {
    downloadTemplate(type)
    toast({
      title: t(`download.${type}`),
    })
  }, [t, toast])

  // Handle export current menu
  const handleExportCurrentMenu = useCallback(
    async (type: 'basic' | 'advanced') => {
      if (!categories || !products || !modifierGroups) {
        toast({
          title: t('export.noData'),
          variant: 'destructive',
        })
        return
      }

      setIsExporting(true)
      try {
        await exportCurrentMenu(venueId, categories, products, modifierGroups, type)
        toast({
          title: t(`export.success`),
          description: t(`export.${type}Desc`),
        })
      } catch {
        toast({
          title: t('export.error'),
          variant: 'destructive',
        })
      } finally {
        setIsExporting(false)
      }
    },
    [venueId, categories, products, modifierGroups, t, toast],
  )

  // Handle file selection
  const handleFileChange = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return

    // Check if it's a CSV file
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: t('errors.invalidFormat'),
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setIsValidating(true)
    setValidationErrors([])

    try {
      // Parse CSV
      const { data, isAdvanced: isAdvancedTemplate } = await parseCSV(selectedFile)

      // Validate CSV structure
      const validation = validateCSV(data)
      setValidationErrors(validation.errors)

      if (validation.valid) {
        // Transform data for preview
        const categories = transformCSVData(data, isAdvancedTemplate)
        setParsedData(categories)
        setStep('preview')
      }
    } catch (error: any) {
      toast({
        title: t('errors.parseError'),
        description: error.message,
        variant: 'destructive',
      })
      setFile(null)
    } finally {
      setIsValidating(false)
    }
  }, [t, toast])

  // Handle drag and drop
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

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange(droppedFile)
    }
  }, [handleFileChange])

  // Handle import
  const handleImport = useCallback(async () => {
    setIsImporting(true)

    try {
      const result = await importMenu(venueId, parsedData, importMode)

      if (result.success) {
        toast({
          title: t('success.title'),
          description: t('success.message', {
            categories: result.stats?.categories || 0,
            products: result.stats?.products || 0,
            modifierGroups: result.stats?.modifierGroups || 0,
          }),
        })

        // Invalidate ALL menu-related queries to refresh data across all pages
        queryClient.invalidateQueries({ queryKey: ['categories', venueId] }) // Categories page
        queryClient.invalidateQueries({ queryKey: ['menu-categories', venueId] }) // Product creation, menu pages
        queryClient.invalidateQueries({ queryKey: ['menuCategories', venueId] }) // Legacy
        queryClient.invalidateQueries({ queryKey: ['products', venueId] }) // Products page
        queryClient.invalidateQueries({ queryKey: ['modifierGroups', venueId] }) // Modifier groups
        queryClient.invalidateQueries({ queryKey: ['menus', venueId] }) // Menus page

        onOpenChange(false)
      } else {
        toast({
          title: t('errors.uploadError'),
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: t('errors.uploadError'),
        description: t('errors.serverError', { message: error.message }),
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }, [venueId, parsedData, importMode, toast, t, onOpenChange, queryClient])

  // Calculate stats
  const totalProducts = parsedData.reduce((sum, cat) => sum + cat.products.length, 0)
  const totalModifierGroups = parsedData.reduce(
    (sum, cat) => sum + cat.products.reduce((pSum, prod) => pSum + (prod.modifierGroups?.length || 0), 0),
    0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Select Template Type */}
          {step === 'select' && (
            <>
              {/* Export Current Menu Section */}
              {categories && products && categories.length > 0 && products.length > 0 && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4 text-primary" />
                      <Label className="text-base font-semibold">{t('export.title')}</Label>
                      <Badge variant="secondary" className="ml-auto">
                        {t('export.yourData')}
                      </Badge>
                    </div>
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-300">
                        {t('export.description')}
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="gap-2 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                        onClick={() => handleExportCurrentMenu('basic')}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        {t('export.basicButton')}
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                        onClick={() => handleExportCurrentMenu('advanced')}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        {t('export.advancedButton')}
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <Separator />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2">
                      <span className="text-xs text-muted-foreground uppercase">{t('export.or')}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Download Template Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">{t('templates.title')}</Label>
                  <Badge variant="outline" className="ml-auto">
                    {t('templates.empty')}
                  </Badge>
                </div>
                <RadioGroup value={templateType} onValueChange={(value: any) => setTemplateType(value)}>
                  <div
                    className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setTemplateType('basic')}
                  >
                    <RadioGroupItem value="basic" id="basic" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="basic" className="cursor-pointer font-semibold">
                        {t('templates.basic')}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{t('templates.basicDesc')}</p>
                    </div>
                  </div>

                  <div
                    className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setTemplateType('advanced')}
                  >
                    <RadioGroupItem value="advanced" id="advanced" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="advanced" className="cursor-pointer font-semibold">
                        {t('templates.advanced')}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{t('templates.advancedDesc')}</p>
                    </div>
                  </div>
                </RadioGroup>

                <Button variant="outline" className="w-full gap-2" onClick={() => handleDownloadTemplate(templateType)}>
                  <Download className="h-4 w-4" />
                  {t('download.button')}
                </Button>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">{t('upload.dropzone')}</p>
                  {isValidating && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">{t('validation.checking')}</span>
                    </div>
                  )}
                </label>
              </div>
            </>
          )}

          {/* Step 2: Preview & Validation */}
          {step === 'preview' && file && (
            <>
              {/* File info */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('upload.fileSize', { size: (file.size / 1024).toFixed(1) })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null)
                    setStep('select')
                  }}
                >
                  {t('upload.changeFile')}
                </Button>
              </div>

              {/* Validation results */}
              {validationErrors.length > 0 ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">{t('validation.invalid')}</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validationErrors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {validationErrors.length > 5 && (
                        <li className="text-muted-foreground">
                          {t('validation.errors', { count: validationErrors.length - 5 })}...
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 font-medium">{t('validation.valid')}</AlertDescription>
                </Alert>
              )}

              {/* Preview stats */}
              {validationErrors.length === 0 && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{parsedData.length}</p>
                      <p className="text-sm text-muted-foreground">{t('preview.categories', { count: parsedData.length })}</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{totalProducts}</p>
                      <p className="text-sm text-muted-foreground">{t('preview.products', { count: totalProducts })}</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{totalModifierGroups}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('preview.modifiers', { count: totalModifierGroups })}
                      </p>
                    </div>
                  </div>

                  {/* Import mode selection */}
                  <div className="space-y-4">
                    <Label>{t('mode.title')}</Label>
                    <RadioGroup value={importMode} onValueChange={(value: any) => setImportMode(value)}>
                      <div
                        className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setImportMode('merge')}
                      >
                        <RadioGroupItem value="merge" id="merge" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="merge" className="cursor-pointer font-semibold">
                            {t('mode.merge')}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">{t('mode.mergeDesc')}</p>
                        </div>
                      </div>

                      <div
                        className="flex items-start space-x-3 rounded-lg border border-orange-200 p-4 hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer"
                        onClick={() => setImportMode('replace')}
                      >
                        <RadioGroupItem value="replace" id="replace" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="replace" className="cursor-pointer font-semibold text-orange-700 dark:text-orange-400">
                            {t('mode.replace')}
                          </Label>
                          <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{t('mode.replaceDesc')}</p>
                        </div>
                      </div>
                    </RadioGroup>

                    {importMode === 'replace' && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{t('mode.warning')}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            {t('actions.cancel')}
          </Button>

          {step === 'preview' && validationErrors.length === 0 && (
            <Button onClick={handleImport} disabled={isImporting} className="gap-2">
              {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isImporting ? t('actions.importing') : t('actions.import')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
