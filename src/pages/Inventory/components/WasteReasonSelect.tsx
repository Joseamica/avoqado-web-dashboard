import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WASTE_CATEGORIES, WASTE_REASONS_BY_CATEGORY } from '@/lib/inventory-constants'
import type { SelectableWasteReasonCode } from '@/lib/inventoryWaste'

interface WasteReasonSelectProps {
  /** id del disparador y `name` del Select (las pruebas lo usan como nombre accesible). */
  id?: string
  value: SelectableWasteReasonCode | ''
  onChange: (code: SelectableWasteReasonCode) => void
}

/** Los 20 motivos del dashboard agrupados por categoría. `UNSPECIFIED` no se ofrece nunca. */
export function WasteReasonSelect({ id = 'wasteReason', value, onChange }: WasteReasonSelectProps) {
  const { t } = useTranslation('inventory')
  return (
    <Select name={id} value={value} onValueChange={code => onChange(code as SelectableWasteReasonCode)}>
      <SelectTrigger id={id} data-tour="waste-reason-select">
        <SelectValue placeholder={t('waste.selectReason')} />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {Object.entries(WASTE_REASONS_BY_CATEGORY).map(([categoryKey, reasons]) => {
          const categoryInfo = WASTE_CATEGORIES[categoryKey as keyof typeof WASTE_CATEGORIES]
          return (
            <SelectGroup key={categoryKey}>
              <SelectLabel className="flex items-center gap-2 py-2">
                <span>{categoryInfo.icon}</span>
                <span className="font-semibold">{t(`waste.categories.${categoryKey}`)}</span>
              </SelectLabel>
              {reasons.map(reason => (
                <SelectItem key={reason.value} value={reason.value}>
                  <div className="flex items-center gap-2">
                    <span>{reason.icon}</span>
                    <div>
                      <p className="font-medium">{t(`waste.reasons.${reason.value}.label`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`waste.reasons.${reason.value}.description`)}</p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
