import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import React, { useCallback, useMemo } from 'react'

export interface JsonBooleanTogglesProps {
  jsonString: string
  onChange: (updatedJson: string) => void
}

const JsonBooleanToggles: React.FC<JsonBooleanTogglesProps> = ({ jsonString, onChange }) => {
  const booleanEntries = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonString)
      if (typeof parsed !== 'object' || parsed === null) return []

      const entries: { section: string; key: string; value: boolean }[] = []
      for (const [section, sectionValue] of Object.entries(parsed)) {
        if (typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue)) {
          for (const [key, val] of Object.entries(sectionValue as Record<string, unknown>)) {
            if (typeof val === 'boolean') {
              entries.push({ section, key, value: val })
            }
          }
        }
      }
      return entries
    } catch {
      return []
    }
  }, [jsonString])

  const handleToggle = useCallback(
    (section: string, key: string, newValue: boolean) => {
      try {
        const parsed = JSON.parse(jsonString)
        parsed[section][key] = newValue
        onChange(JSON.stringify(parsed, null, 2))
      } catch {
        // JSON invalid, ignore
      }
    },
    [jsonString, onChange],
  )

  if (booleanEntries.length === 0) return null

  // Group by section
  const grouped = booleanEntries.reduce(
    (acc, entry) => {
      if (!acc[entry.section]) acc[entry.section] = []
      acc[entry.section].push(entry)
      return acc
    },
    {} as Record<string, typeof booleanEntries>,
  )

  // Human-readable labels for known keys
  const labelMap: Record<string, string> = {
    enablePortabilidad: 'Portabilidad',
    allowUnregisteredSale: 'Venta sin registro',
    requireCategorySelection: 'Requiere categoria',
    showStockCounts: 'Mostrar stock',
    simplifiedOrderFlow: 'Flujo simplificado',
    skipTipScreen: 'Saltar propina',
    skipReviewScreen: 'Saltar resena',
    enableShifts: 'Turnos habilitados',
    requireClockInPhoto: 'Foto al entrar',
    requireClockInGps: 'GPS al entrar',
    requireClockOutPhoto: 'Foto al salir',
    requireClockOutGps: 'GPS al salir',
  }

  const sectionLabelMap: Record<string, string> = {
    features: 'Funcionalidades',
    ui: 'Interfaz',
    attendance: 'Asistencia',
    labels: 'Etiquetas',
  }

  return (
    <div className="mt-3 space-y-3">
      {Object.entries(grouped).map(([section, entries]) => (
        <div key={section} className="rounded-lg border border-border/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sectionLabelMap[section] || section}</p>
          {entries.map(({ key, value }) => (
            <div key={`${section}-${key}`} className="flex items-center justify-between py-1">
              <Label htmlFor={`toggle-${section}-${key}`} className="text-sm cursor-pointer">
                {labelMap[key] || key}
              </Label>
              <Switch id={`toggle-${section}-${key}`} checked={value} onCheckedChange={checked => handleToggle(section, key, checked)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default JsonBooleanToggles
