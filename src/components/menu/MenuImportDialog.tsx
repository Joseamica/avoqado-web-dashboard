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
  validateCSV,
  transformCSVData,
  importMenu,
  downloadTemplate,
  exportCurrentMenu,
  previewCSV,
  parseRawCSV,
  remapData,
  SYSTEM_FIELDS,
  type ParsedCategory,
} from '@/services/menuImport.service'
import { Upload, Download, FileText, AlertCircle, CheckCircle2, XCircle, Loader2, AlertTriangle, FileDown } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import * as menuService from '@/services/menu.service'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MenuImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ImportStep = 'select' | 'mapping' | 'upload' | 'preview' | 'import'

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
  
  // Mapping State
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

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
        setRawHeaders([])
        setPreviewRows([])
        setColumnMapping({})
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
      // Parse CSV headers only
      const { headers, data } = await previewCSV(selectedFile)
      
      setRawHeaders(headers)
      setPreviewRows(data)

      // Auto-guess mapping
      const initialMapping: Record<string, string> = {}
      SYSTEM_FIELDS.forEach(field => {
        // Try exact match
        let match = headers.find(h => h.toLowerCase() === field.key.toLowerCase())
        // Try label match
        if (!match) match = headers.find(h => h.toLowerCase() === field.label.toLowerCase())
        // Try partial match
        if (!match) match = headers.find(h => h.toLowerCase().includes(field.key.toLowerCase()))

        if (match) {
          initialMapping[field.key] = match
        }
      })
      setColumnMapping(initialMapping)
      setStep('mapping')

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

  // Process Mapping
  const handleMappingComplete = useCallback(async () => {
    if (!file) return

    setIsValidating(true)
    try {
      // 1. Get all raw data
      const rawData = await parseRawCSV(file)

      // 2. Remap data to our system fields
      const remappedData = remapData(rawData, columnMapping)

      // 3. Detect if advanced based on mapped fields
      const isAdvanced = !!(columnMapping['modifier_groups'] || columnMapping['modifiers'] || columnMapping['cost'])

      // 4. Validate
      const validation = validateCSV(remappedData)
      setValidationErrors(validation.errors)

      // 5. Transform
      if (validation.valid) {
        const categories = transformCSVData(remappedData, isAdvanced)
        setParsedData(categories)
        setStep('preview')
      } else {
        // Even if invalid, show errors in preview step
        setParsedData([])
        setStep('preview')
      }

    } catch (error: any) {
       toast({
        title: t('errors.parseError'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }, [file, columnMapping, toast, t])


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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-8">
          <div className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {step === 'mapping' ? t('mapping.title', 'Map Columns') : t('title')}
            </DialogTitle>
            <DialogDescription>
               {step === 'mapping' 
                ? t('mapping.description', 'Confirm that the columns in your CSV match the required fields.') 
                : t('description')}
            </DialogDescription>
          </div>
          {step === 'select' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <Download className="h-4 w-4" />
                  {t('download.button')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">{t('templates.title')}</h4>
                    <p className="text-sm text-muted-foreground">{t('templates.empty')}</p>
                  </div>
                  <RadioGroup value={templateType} onValueChange={(value: any) => setTemplateType(value)}>
                    <div className="flex items-start space-x-3 space-y-0">
                      <RadioGroupItem value="basic" id="popover-basic" />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="popover-basic" className="cursor-pointer font-medium">
                          {t('templates.basic')}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t('templates.basicDesc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0">
                      <RadioGroupItem value="advanced" id="popover-advanced" />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="popover-advanced" className="cursor-pointer font-medium">
                          {t('templates.advanced')}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t('templates.advancedDesc')}</p>
                      </div>
                    </div>
                  </RadioGroup>
                  <Button size="sm" className="w-full gap-2" onClick={() => handleDownloadTemplate(templateType)}>
                    <Download className="h-4 w-4" />
                    {t('download.button')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
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

          {/* Step: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
               <Alert className="bg-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('mapping.info', 'Review the mapping below. We tried to match your columns automatically.')}
                </AlertDescription>
              </Alert>

              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_1.5fr] gap-4 bg-muted p-3 text-sm font-medium">
                   <div>{t('mapping.systemField', 'Avoqado Field')}</div>
                   <div>{t('mapping.csvColumn', 'CSV Column')}</div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {SYSTEM_FIELDS.map((field) => (
                    <div key={field.key} className="grid grid-cols-[1fr_1.5fr] gap-4 border-b p-4 last:border-0 items-start hover:bg-muted/5 transition-colors">
                      <div className="space-y-1 mt-1.5">
                        <div className="flex items-center gap-2">
                           <Label className={field.required ? 'font-bold' : 'font-normal'}>
                              {t(`mapping.fields.${field.key}.label`, field.label)}
                           </Label>
                           {field.required && <span className="text-red-500">*</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                           {t(`mapping.fields.${field.key}.description`, field.description)}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Select 
                          value={columnMapping[field.key] || 'ignore'} 
                          onValueChange={(val) => {
                            setColumnMapping(prev => {
                               const next = { ...prev }
                               if (val === 'ignore') {
                                 delete next[field.key]
                               } else {
                                 next[field.key] = val
                               }
                               return next
                            })
                          }}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder={t('mapping.select', 'Select column...')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore" className="text-muted-foreground italic">
                              {t('mapping.ignore', 'Don\'t import')}
                            </SelectItem>
                             {rawHeaders.map(header => (
                               <SelectItem key={header} value={header}>{header}</SelectItem>
                             ))}
                          </SelectContent>
                        </Select>

                        {/* Sample Values Preview */}
                        <div className="text-xs text-muted-foreground pl-1">
                           {columnMapping[field.key] ? (
                              <div className="space-y-1">
                                {previewRows.slice(0, 3).map((row, i) => (
                                   <div key={i} className="truncate text-muted-foreground/80" title={row[columnMapping[field.key]]}>
                                      {row[columnMapping[field.key]] || <span className="italic opacity-50">Empty</span>}
                                   </div>
                                ))}
                              </div>
                           ) : (
                             <span className="italic opacity-40 pl-1">{t('mapping.noMapping', 'No column selected')}</span>
                           )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep('mapping')
                    }}
                  >
                     {t('actions.backToMapping', 'Check Columns')}
                  </Button>
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
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">{t('mode.replace')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {importMode === 'replace' ? t('mode.replaceDesc') : t('mode.mergeDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={importMode === 'replace'}
                        onCheckedChange={checked => setImportMode(checked ? 'replace' : 'merge')}
                      />
                    </div>

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
          {step === 'mapping' ? (
             <>
               <Button variant="outline" onClick={() => {
                 setFile(null)
                 setStep('select')
               }}>
                 {t('actions.back', 'Back')}
               </Button>
               <Button onClick={handleMappingComplete} disabled={isValidating}>
                 {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {t('actions.next', 'Next')}
               </Button>
             </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                {t('actions.cancel')}
              </Button>

              {step === 'preview' && validationErrors.length === 0 && (
                <Button onClick={handleImport} disabled={isImporting} className="gap-2">
                  {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isImporting ? t('actions.importing') : t('actions.import')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
