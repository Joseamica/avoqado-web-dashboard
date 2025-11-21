import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Upload, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { OnboardingStepProps } from '../OnboardingWizard'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface MenuCategory {
  name: string
  slug: string
}

export interface MenuProduct {
  name: string
  sku: string
  price: number
  categorySlug: string
}

export interface MenuDataStepData {
  method: 'manual' | 'csv'
  categories?: MenuCategory[]
  products?: MenuProduct[]
  csvFile?: File
}

interface MenuDataStepProps extends OnboardingStepProps {
  onSave: (data: MenuDataStepData) => void
  initialValue?: MenuDataStepData
}

export function MenuDataStep({ onNext, onPrevious, onSkip, isFirstStep, onSave, initialValue }: MenuDataStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  const [method, setMethod] = useState<'manual' | 'csv'>(initialValue?.method || 'manual')
  const [categories, setCategories] = useState<MenuCategory[]>(initialValue?.categories || [])
  const [products, setProducts] = useState<MenuProduct[]>(initialValue?.products || [])
  const [csvFile, setCsvFile] = useState<File | undefined>(initialValue?.csvFile)

  // Category form state
  const [newCategory, setNewCategory] = useState({ name: '', slug: '' })

  // Product form state
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', price: '', categorySlug: '' })

  // CSV processing state
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [csvSuccess, setCsvSuccess] = useState(false)
  const [csvError, setCsvError] = useState('')

  // Auto-generate slug from category name
  const handleCategoryNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setNewCategory({ name, slug })
  }

  const handleAddCategory = () => {
    if (!newCategory.name.trim() || !newCategory.slug.trim()) return

    setCategories(prev => [...prev, { name: newCategory.name, slug: newCategory.slug }])
    setNewCategory({ name: '', slug: '' })
  }

  const handleRemoveCategory = (index: number) => {
    setCategories(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddProduct = () => {
    if (
      !newProduct.name.trim() ||
      !newProduct.sku.trim() ||
      !newProduct.price ||
      parseFloat(newProduct.price) <= 0 ||
      !newProduct.categorySlug
    )
      return

    setProducts(prev => [
      ...prev,
      {
        name: newProduct.name,
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        categorySlug: newProduct.categorySlug,
      },
    ])
    setNewProduct({ name: '', sku: '', price: '', categorySlug: '' })
  }

  const handleRemoveProduct = (index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index))
  }

  const parseCsvFile = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setCsvError('')
    setCsvSuccess(false)
    setCsvFile(undefined)

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('El archivo debe ser un CSV (.csv)')
      return
    }

    setCsvProcessing(true)

    try {
      // Parse CSV content
      const content = await parseCsvFile(file)
      const lines = content.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        throw new Error('El archivo CSV está vacío o solo tiene encabezados')
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredColumns = ['name', 'sku', 'price', 'category']
      const missingColumns = requiredColumns.filter(col => !header.includes(col))

      if (missingColumns.length > 0) {
        throw new Error(`Faltan columnas requeridas: ${missingColumns.join(', ')}`)
      }

      // Get column indices
      const nameIndex = header.indexOf('name')
      const skuIndex = header.indexOf('sku')
      const priceIndex = header.indexOf('price')
      const categoryIndex = header.indexOf('category')

      // Parse data rows
      const parsedCategories = new Map<string, MenuCategory>()
      const parsedProducts: MenuProduct[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim())

        if (values.length < requiredColumns.length) {
          throw new Error(`Fila ${i + 1}: Faltan valores (se esperaban ${requiredColumns.length} columnas)`)
        }

        const name = values[nameIndex]
        const sku = values[skuIndex]
        const priceStr = values[priceIndex]
        const categoryName = values[categoryIndex]

        // Validate required fields
        if (!name || !sku || !priceStr || !categoryName) {
          throw new Error(`Fila ${i + 1}: Todos los campos son requeridos (name, sku, price, category)`)
        }

        // Validate price
        const price = parseFloat(priceStr)
        if (isNaN(price) || price <= 0) {
          throw new Error(`Fila ${i + 1}: El precio debe ser un número positivo (recibido: "${priceStr}")`)
        }

        // Generate category slug
        const categorySlug = categoryName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Add category if not exists
        if (!parsedCategories.has(categorySlug)) {
          parsedCategories.set(categorySlug, { name: categoryName, slug: categorySlug })
        }

        // Add product
        parsedProducts.push({
          name,
          sku,
          price,
          categorySlug,
        })
      }

      // Update state with parsed data
      const categoriesArray = Array.from(parsedCategories.values())
      console.log('✅ CSV parseado exitosamente:')
      console.log('  📁 Categorías:', categoriesArray)
      console.log('  🍔 Productos:', parsedProducts)

      setCategories(categoriesArray)
      setProducts(parsedProducts)
      setCsvFile(file)
      setCsvSuccess(true)
      setCsvError('')
    } catch (error: any) {
      console.error('CSV parsing error:', error)
      setCsvError(error.message || 'Error al procesar el archivo CSV')
      setCsvSuccess(false)
    } finally {
      setCsvProcessing(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = 'name,sku,price,category\nCheeseburger,BURGER-001,12.99,Main Dishes\nFrench Fries,FRIES-001,4.99,Sides\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'menu-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleContinue = () => {
    const data: MenuDataStepData = {
      method,
      categories,
      products,
    }
    console.log('📤 Enviando datos del menú al backend:', {
      method: data.method,
      categoriesCount: data.categories?.length || 0,
      productsCount: data.products?.length || 0,
      categories: data.categories,
      products: data.products,
    })
    onSave(data)
    onNext()
  }

  const handleSkip = () => {
    onSave({ method: 'manual', categories: [], products: [] })
    if (onSkip) {
      onSkip()
    } else {
      onNext()
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{t('menuData.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('menuData.subtitle')}</p>
      </div>

      {/* Method Selection */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">{t('menuData.method.title')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Manual Method */}
            <button
              onClick={() => setMethod('manual')}
              className={`flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                method === 'manual'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="flex w-full items-start justify-between">
                <h4 className="text-base font-semibold text-foreground">{t('menuData.method.manual.title')}</h4>
                <Badge variant="secondary">{t('menuData.method.manual.badge')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('menuData.method.manual.description')}</p>
            </button>

            {/* CSV Method */}
            <button
              onClick={() => setMethod('csv')}
              className={`flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                method === 'csv'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="flex w-full items-start justify-between">
                <h4 className="text-base font-semibold text-foreground">{t('menuData.method.csv.title')}</h4>
                <Badge variant="outline">{t('menuData.method.csv.badge')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('menuData.method.csv.description')}</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry */}
      {method === 'manual' && (
        <div className="space-y-6">
          {/* Categories */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{t('menuData.manual.categories.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('menuData.manual.categories.description')}</p>
              </div>

              {/* Add Category Form */}
              <div className="mb-4 flex gap-2">
                <div className="flex-1">
                  <Input
                    id="categoryName"
                    placeholder={t('menuData.manual.categories.namePlaceholder')}
                    value={newCategory.name}
                    onChange={e => handleCategoryNameChange(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <Button type="button" onClick={handleAddCategory} disabled={!newCategory.name.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('menuData.manual.categories.add')}
                </Button>
              </div>

              {/* Categories List */}
              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1.5">
                      {category.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(index)}
                        className="ml-2 rounded-full hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">{t('menuData.manual.categories.empty')}</p>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{t('menuData.manual.products.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('menuData.manual.products.description')}</p>
              </div>

              {categories.length === 0 && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('menuData.manual.products.categoryRequired')}</AlertDescription>
                </Alert>
              )}

              {/* Add Product Form */}
              <div className="mb-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Input
                      id="productName"
                      placeholder={t('menuData.manual.products.namePlaceholder')}
                      value={newProduct.name}
                      onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                      disabled={categories.length === 0}
                    />
                  </div>
                  <div>
                    <Input
                      id="productSku"
                      placeholder={t('menuData.manual.products.skuPlaceholder')}
                      value={newProduct.sku}
                      onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                      disabled={categories.length === 0}
                    />
                  </div>
                  <div>
                    <Input
                      id="productPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('menuData.manual.products.pricePlaceholder')}
                      value={newProduct.price}
                      onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                      disabled={categories.length === 0}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={newProduct.categorySlug}
                      onValueChange={value => setNewProduct({ ...newProduct, categorySlug: value })}
                      disabled={categories.length === 0}
                    >
                      <SelectTrigger id="productCategory">
                        <SelectValue placeholder={t('menuData.manual.products.categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.slug} value={category.slug}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={handleAddProduct} disabled={categories.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('menuData.manual.products.add')}
                  </Button>
                </div>
              </div>

              {/* Products List */}
              {products.length > 0 ? (
                <div className="space-y-2">
                  {products.map((product, index) => (
                    <div key={index} className="flex items-center justify-between rounded-md border border-border bg-background p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku} • ${product.price.toFixed(2)} • {categories.find(c => c.slug === product.categorySlug)?.name}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveProduct(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">{t('menuData.manual.products.empty')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Upload */}
      {method === 'csv' && (
        <div className="space-y-6">
          {/* CSV Format Info */}
          <Card className="border-muted bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">{t('menuData.csv.format.title')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('menuData.csv.format.description')}</p>
              <ul className="mb-3 ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                <li>{t('menuData.csv.format.columns.name')}</li>
                <li>{t('menuData.csv.format.columns.sku')}</li>
                <li>{t('menuData.csv.format.columns.price')}</li>
                <li>{t('menuData.csv.format.columns.category')}</li>
              </ul>
              <p className="mb-3 text-sm font-medium text-foreground">{t('menuData.csv.format.example')}</p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                {t('menuData.csv.download')}
              </Button>
            </CardContent>
          </Card>

          {/* CSV Upload */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">{t('menuData.csv.title')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t('menuData.csv.description')}</p>

              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8">
                {csvProcessing ? (
                  <>
                    <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                    <p className="text-center text-sm text-muted-foreground">{t('shared.processingCsv')}</p>
                  </>
                ) : csvSuccess ? (
                  <>
                    <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
                    <p className="mb-2 text-center text-sm font-medium text-foreground">{t('menuData.csv.uploaded', { filename: csvFile?.name })}</p>
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      {t('shared.categories', { count: categories.length })} • {t('shared.products', { count: products.length })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCsvFile(undefined)
                        setCsvSuccess(false)
                        setCategories([])
                        setProducts([])
                        const input = document.getElementById('csv-upload') as HTMLInputElement
                        if (input) input.value = ''
                      }}
                    >
                      {t('shared.changeFile')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="mb-4 text-center text-sm text-muted-foreground">{t('menuData.csv.dragDrop')}</p>
                    <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} className="hidden" id="csv-upload" />
                    <Button asChild variant="outline">
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        {t('menuData.csv.upload')}
                      </label>
                    </Button>
                  </>
                )}
              </div>

              {csvError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{csvError}</AlertDescription>
                </Alert>
              )}

              {csvSuccess && (
                <Alert className="mt-4 border-green-600 bg-green-50 dark:bg-green-950/50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {t('shared.csvProcessedSuccess', {
                      categories: t('shared.categories', { count: categories.length }),
                      products: t('shared.products', { count: products.length })
                    })}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skip Info */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{t('menuData.actions.skip')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('menuData.actions.skipDescription')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        {!isFirstStep && (
          <Button type="button" variant="outline" onClick={onPrevious}>
            {tCommon('previous')}
          </Button>
        )}
        <div className={`flex gap-2 ${isFirstStep ? 'ml-auto' : ''}`}>
          <Button type="button" variant="outline" onClick={handleSkip}>
            {tCommon('skip')}
          </Button>
          <Button type="button" onClick={handleContinue}>
            {tCommon('continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
