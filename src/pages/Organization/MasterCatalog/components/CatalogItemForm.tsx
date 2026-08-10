import { useEffect, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CatalogItemCommand, CatalogItemDetail, CatalogReference } from '@/features/master-catalog/types'

const money = z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/)
const schema = z.object({
  sku: z.string().trim().min(1).max(4096),
  name: z.string().trim().min(1).max(4096),
  description: z.string().trim().min(1).max(4096),
  imageUrl: z.string().url().max(4096),
  presentationLabel: z.string().trim().min(1).max(4096),
  brandId: z.string().min(1),
  manufacturerId: z.string().min(1),
  familyId: z.string().min(1),
  kind: z.enum(['RETAIL_PRODUCT', 'PREPARED_DISH']),
  unit: z.string().min(1),
  productType: z.string().min(1),
  businessType: z.string().min(1),
  taxRate: z.string().regex(/^\d(?:\.\d{1,4})?$/),
  satProductKey: z.string().trim().min(1),
  satUnitKey: z.string().trim().min(1),
  objetoImp: z.string().trim().min(1),
  salePrice: money,
  purchaseCost: money,
})

type FormValues = z.infer<typeof schema>
type ReferenceOption = Pick<CatalogReference, 'id' | 'name'>

interface CatalogItemFormProps {
  references: { brands: ReferenceOption[]; manufacturers: ReferenceOption[]; families: ReferenceOption[] }
  initialItem?: CatalogItemDetail
  onSubmit: (input: CatalogItemCommand) => void | Promise<void>
  isSubmitting: boolean
  showSubmit?: boolean
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}

export default function CatalogItemForm({ references, initialItem, onSubmit, isSubmitting, showSubmit = true }: CatalogItemFormProps) {
  const { t } = useTranslation('organization')
  const form = useForm<FormValues>({
    defaultValues: {
      sku: initialItem?.sku ?? '',
      name: initialItem?.name ?? '',
      description: initialItem?.description ?? '',
      imageUrl: initialItem?.imageUrl ?? '',
      presentationLabel: initialItem?.presentationLabel ?? '',
      brandId: initialItem?.brand.id ?? references.brands[0]?.id ?? '',
      manufacturerId: initialItem?.manufacturer.id ?? references.manufacturers[0]?.id ?? '',
      familyId: initialItem?.family.id ?? references.families[0]?.id ?? '',
      kind: initialItem?.kind ?? 'RETAIL_PRODUCT',
      unit: initialItem?.unit ?? 'UNIT',
      productType: initialItem?.productType ?? 'REGULAR',
      businessType: initialItem?.businessTypes[0] ?? 'RESTAURANT',
      taxRate: initialItem?.taxRate ?? '0.1600',
      satProductKey: initialItem?.satProductKey ?? '01010101',
      satUnitKey: initialItem?.satUnitKey ?? 'H87',
      objetoImp: initialItem?.objetoImp ?? '02',
      salePrice: initialItem?.organizationValues.find(value => value.kind === 'SALE_PRICE' && value.active)?.amount ?? '',
      purchaseCost: initialItem?.organizationValues.find(value => value.kind === 'PURCHASE_COST' && value.active)?.amount ?? '',
    },
  })
  const kind = form.watch('kind')

  useEffect(() => {
    const requiredProductType = kind === 'PREPARED_DISH' ? 'FOOD_AND_BEV' : 'REGULAR'
    if (form.getValues('productType') !== requiredProductType) form.setValue('productType', requiredProductType)
  }, [form, kind])

  const commandFor = (values: FormValues): CatalogItemCommand => ({
    sku: values.sku,
    kind: values.kind,
    name: values.name,
    description: values.description,
    imageUrl: values.imageUrl,
    brandId: values.brandId,
    manufacturerId: values.manufacturerId,
    familyId: values.familyId,
    presentationLabel: values.presentationLabel,
    unit: values.unit,
    taxRate: values.taxRate,
    satProductKey: values.satProductKey,
    satUnitKey: values.satUnitKey,
    objetoImp: values.objetoImp,
    productType: values.productType,
    iepsMode: 'NONE',
    iepsRate: null,
    iepsQuota: null,
    iepsQuotaUnit: null,
    businessTypes: [values.businessType],
    organizationValues: [
      { kind: 'SALE_PRICE', amount: values.salePrice, currency: 'MXN' },
      { kind: 'PURCHASE_COST', amount: values.purchaseCost, currency: 'MXN' },
    ],
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = schema.safeParse(form.getValues())
    if (!parsed.success) {
      form.clearErrors()
      parsed.error.issues.forEach(issue => {
        const field = issue.path[0]
        if (typeof field === 'string') form.setError(field as keyof FormValues, { type: 'manual', message: issue.message })
      })
      return
    }
    void onSubmit(commandFor(parsed.data))
  }

  const fields = form.formState.errors
  const fieldAccessibility = (name: keyof FormValues) => ({
    'aria-invalid': Boolean(fields[name]),
    'aria-describedby': fields[name] ? `catalog-${name}-error` : undefined,
  })

  return (
    <form onSubmit={submit} className="space-y-8" data-tour="master-catalog-item-form" noValidate>
      <section className="grid gap-4 md:grid-cols-2" aria-labelledby="catalog-basic-fields">
        <h2 id="catalog-basic-fields" className="col-span-full text-lg font-semibold">
          {t('masterCatalog.itemForm.basic', { defaultValue: 'Información corporativa' })}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="catalog-sku">{t('masterCatalog.itemForm.sku', { defaultValue: 'SKU corporativo' })}</Label>
          <Input id="catalog-sku" {...form.register('sku')} {...fieldAccessibility('sku')} />
          <FieldError id="catalog-sku-error" message={fields.sku?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-name">{t('masterCatalog.itemForm.name', { defaultValue: 'Nombre' })}</Label>
          <Input id="catalog-name" {...form.register('name')} {...fieldAccessibility('name')} />
          <FieldError id="catalog-name-error" message={fields.name?.message} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="catalog-description">{t('masterCatalog.itemForm.description', { defaultValue: 'Descripción' })}</Label>
          <Textarea id="catalog-description" {...form.register('description')} {...fieldAccessibility('description')} />
          <FieldError id="catalog-description-error" message={fields.description?.message} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="catalog-image">{t('masterCatalog.itemForm.imageUrl', { defaultValue: 'URL de imagen' })}</Label>
          <Input id="catalog-image" type="url" {...form.register('imageUrl')} {...fieldAccessibility('imageUrl')} />
          <FieldError id="catalog-imageUrl-error" message={fields.imageUrl?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-presentation">{t('masterCatalog.itemForm.presentation', { defaultValue: 'Presentación' })}</Label>
          <Input id="catalog-presentation" {...form.register('presentationLabel')} {...fieldAccessibility('presentationLabel')} />
          <FieldError id="catalog-presentationLabel-error" message={fields.presentationLabel?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-kind">{t('masterCatalog.itemForm.kind', { defaultValue: 'Tipo de artículo' })}</Label>
          <select
            id="catalog-kind"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register('kind')}
          >
            <option value="RETAIL_PRODUCT">{t('masterCatalog.itemForm.retail', { defaultValue: 'Producto de reventa' })}</option>
            <option value="PREPARED_DISH">{t('masterCatalog.itemForm.prepared', { defaultValue: 'Platillo preparado' })}</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-labelledby="catalog-classification-fields">
        <h2 id="catalog-classification-fields" className="col-span-full text-lg font-semibold">
          {t('masterCatalog.itemForm.classification', { defaultValue: 'Clasificación' })}
        </h2>
        {(
          [
            ['brandId', 'Marca', references.brands],
            ['manufacturerId', 'Fabricante', references.manufacturers],
            ['familyId', 'Subfamilia', references.families],
          ] as const
        ).map(([name, label, options]) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={`catalog-${name}`}>{t(`masterCatalog.itemForm.${name}`, { defaultValue: label })}</Label>
            <select
              id={`catalog-${name}`}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register(name)}
            >
              {options.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="catalog-unit">{t('masterCatalog.itemForm.unit', { defaultValue: 'Unidad' })}</Label>
          <select
            id="catalog-unit"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register('unit')}
          >
            <option value="UNIT">{t('masterCatalog.itemForm.units.unit', { defaultValue: 'Unidad' })}</option>
            <option value="PIECE">{t('masterCatalog.itemForm.units.piece', { defaultValue: 'Pieza' })}</option>
            <option value="KILOGRAM">{t('masterCatalog.itemForm.units.kilogram', { defaultValue: 'Kilogramo' })}</option>
            <option value="LITER">{t('masterCatalog.itemForm.units.liter', { defaultValue: 'Litro' })}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-product-type">{t('masterCatalog.itemForm.productType', { defaultValue: 'Tipo de producto' })}</Label>
          <select
            id="catalog-product-type"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register('productType')}
          >
            {kind === 'PREPARED_DISH' ? (
              <option value="FOOD_AND_BEV">{t('masterCatalog.itemForm.foodAndBeverage', { defaultValue: 'Alimentos y bebidas' })}</option>
            ) : (
              <option value="REGULAR">{t('masterCatalog.itemForm.regularProduct', { defaultValue: 'Producto regular' })}</option>
            )}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-business">{t('masterCatalog.itemForm.businessType', { defaultValue: 'Giro aplicable' })}</Label>
          <select
            id="catalog-business"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register('businessType')}
          >
            <option value="RESTAURANT">{t('masterCatalog.itemForm.businessTypes.restaurant', { defaultValue: 'Restaurante' })}</option>
            <option value="BAR">{t('masterCatalog.itemForm.businessTypes.bar', { defaultValue: 'Bar' })}</option>
            <option value="CAFE">{t('masterCatalog.itemForm.businessTypes.cafe', { defaultValue: 'Cafetería' })}</option>
            <option value="RETAIL_STORE">
              {t('masterCatalog.itemForm.businessTypes.retailStore', { defaultValue: 'Tienda minorista' })}
            </option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-labelledby="catalog-financial-fields">
        <h2 id="catalog-financial-fields" className="col-span-full text-lg font-semibold">
          {t('masterCatalog.itemForm.financial', { defaultValue: 'Precios e información fiscal' })}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="catalog-sale">{t('masterCatalog.itemForm.salePrice', { defaultValue: 'Precio de venta' })}</Label>
          <Input id="catalog-sale" inputMode="decimal" {...form.register('salePrice')} {...fieldAccessibility('salePrice')} />
          <FieldError id="catalog-salePrice-error" message={fields.salePrice?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-cost">{t('masterCatalog.itemForm.purchaseCost', { defaultValue: 'Costo de compra' })}</Label>
          <Input id="catalog-cost" inputMode="decimal" {...form.register('purchaseCost')} {...fieldAccessibility('purchaseCost')} />
          <FieldError id="catalog-purchaseCost-error" message={fields.purchaseCost?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-tax">{t('masterCatalog.itemForm.taxRate', { defaultValue: 'IVA' })}</Label>
          <Input id="catalog-tax" {...form.register('taxRate')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-product-key">{t('masterCatalog.itemForm.satProductKey', { defaultValue: 'Clave SAT' })}</Label>
          <Input id="catalog-product-key" {...form.register('satProductKey')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-unit-key">{t('masterCatalog.itemForm.satUnitKey', { defaultValue: 'Unidad SAT' })}</Label>
          <Input id="catalog-unit-key" {...form.register('satUnitKey')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-tax-object">{t('masterCatalog.itemForm.objetoImp', { defaultValue: 'Objeto de impuesto' })}</Label>
          <Input id="catalog-tax-object" {...form.register('objetoImp')} />
        </div>
      </section>

      {showSubmit && (
        <Button type="submit" disabled={isSubmitting} data-tour="master-catalog-item-save">
          {isSubmitting
            ? t('masterCatalog.itemForm.saving', { defaultValue: 'Guardando…' })
            : t('masterCatalog.itemForm.save', { defaultValue: 'Guardar artículo' })}
        </Button>
      )}
    </form>
  )
}
