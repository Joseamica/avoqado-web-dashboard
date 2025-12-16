import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Minus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface Step1Data {
  quantity: number
  namePrefix: string
  autoGenerate?: boolean
  serialNumbers?: string[]
}

interface Step1ConfigurationProps {
  form: UseFormReturn<Step1Data>
}

const PRODUCT = {
  id: 'pax-a910s',
  name: 'PAX A910S',
  brand: 'PAX',
  model: 'A910S',
  price: 349,
  imageUrl: 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_9000,w_1200,f_auto,q_auto/1402119/570292_470056.png',
}

export function Step1Configuration({ form }: Step1ConfigurationProps) {
  const { t } = useTranslation('tpv')

  const quantity = form.watch('quantity')
  const namePrefix = form.watch('namePrefix')

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, Math.min(10, quantity + delta))
    form.setValue('quantity', newQuantity)
  }

  // Generate terminal name preview
  const terminalNames = Array.from({ length: Math.min(quantity, 3) }, (_, i) => `${namePrefix} ${i + 1}`)
  const preview = terminalNames.join(', ') + (quantity > 3 ? `, ...` : '')

  return (
    <div className="space-y-6">
      {/* Product Display */}
      <Card className="border-primary bg-accent/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 flex items-center justify-center bg-background rounded-lg overflow-hidden border border-border">
              <img
                src={PRODUCT.imageUrl}
                alt={PRODUCT.name}
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{t('purchaseWizard.step1.product.name')}</h3>
              <p className="text-muted-foreground">{t('purchaseWizard.step1.product.description')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('purchaseWizard.step1.product.features')}</p>
              <p className="text-3xl font-bold text-primary mt-2">${PRODUCT.price}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity Selector */}
      <FormField
        control={form.control}
        name="quantity"
        rules={{
          required: { value: true, message: t('purchaseWizard.step1.validation.quantityRequired') },
          min: { value: 1, message: t('purchaseWizard.step1.validation.quantityMin') },
          max: { value: 10, message: t('purchaseWizard.step1.validation.quantityMax') },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('purchaseWizard.step1.quantity')}</FormLabel>
            <FormDescription>{t('purchaseWizard.step1.quantityDesc')}</FormDescription>
            <FormControl>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1 max-w-[100px]">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...field}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1
                      handleQuantityChange(val - quantity)
                    }}
                    className="text-center"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Name Prefix */}
      <FormField
        control={form.control}
        name="namePrefix"
        rules={{
          required: { value: true, message: t('purchaseWizard.step1.validation.namePrefixRequired') },
          minLength: { value: 3, message: t('purchaseWizard.step1.validation.namePrefixMin') },
          maxLength: { value: 50, message: t('purchaseWizard.step1.validation.namePrefixMax') },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('purchaseWizard.step1.namePrefix')}</FormLabel>
            <FormDescription>
              {t('purchaseWizard.step1.namePrefixDesc', { prefix: namePrefix || t('purchaseWizard.step1.namePrefixPlaceholder') })}
            </FormDescription>
            <FormControl>
              <Input placeholder={t('purchaseWizard.step1.namePrefixPlaceholder')} {...field} />
            </FormControl>
            {namePrefix && <p className="text-sm text-muted-foreground mt-1">{preview}</p>}
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Note about serial numbers */}
      <div className="bg-muted/50 p-4 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground">
          {t('purchaseWizard.step1.serialNote')}
        </p>
      </div>
    </div>
  )
}
