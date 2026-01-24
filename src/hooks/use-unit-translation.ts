import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getUnitLabel, UNIT_ENUM_TO_DISPLAY } from '@/lib/inventory-constants'

/**
 * Hook to translate unit values
 * Returns a function that formats units with their translated names
 *
 * @example
 * const formatUnit = useUnitTranslation()
 * formatUnit('KILOGRAM') // Returns "kg (Kilogramo)" in Spanish or "kg (Kilogram)" in English
 */
export function useUnitTranslation() {
  const { t } = useTranslation('inventory')

  /**
   * Format a unit enum value with its label and translated name
   * @param unitEnum - The unit enum value (e.g., 'KILOGRAM', 'LITER')
   * @returns Formatted string like "kg (Kilogramo)" or just the unit if translation not found
   */
  const formatUnit = useCallback(
    (unitEnum: string): string => {
      if (!unitEnum) return ''

      // Get the short label (kg, L, etc.)
      const label = getUnitLabel(unitEnum)

      // Get the translated full name
      const translatedName = t(`units.${unitEnum}`, unitEnum) // Fallback to enum if translation missing

      // If label and enum are the same, just return translated name
      if (label === unitEnum || label === UNIT_ENUM_TO_DISPLAY[unitEnum]) {
        return translatedName
      }

      // Return formatted: "kg (Kilogramo)"
      return `${label} (${translatedName})`
    },
    [t],
  )

  /**
   * Get just the short label (kg, lt, ml, etc.) using translations
   */
  const getShortLabel = useCallback(
    (unitEnum: string): string => {
      if (!unitEnum) return ''
      // Try to get translated abbreviation, fallback to static label
      const translatedAbbr = t(`units.${unitEnum}_abbr`, { defaultValue: '' })
      if (translatedAbbr) return translatedAbbr
      return getUnitLabel(unitEnum)
    },
    [t],
  )

  /**
   * Get just the translated full name (Kilogramo, Litro, etc.)
   */
  const getFullName = useCallback(
    (unitEnum: string): string => {
      return t(`units.${unitEnum}`, unitEnum)
    },
    [t],
  )

  /**
   * Format a unit with quantity, handling pluralization
   * @param quantity - The quantity value
   * @param unitEnum - The unit enum value (e.g., 'KILOGRAM', 'LITER')
   * @param abbreviated - Whether to use abbreviated form (e.g., "kg" instead of "kilogramo"). Defaults to true for compact display.
   * @returns Formatted string like "kgs" (abbreviated, default) or "kilogramos" (full name)
   */
  const formatUnitWithQuantity = useCallback(
    (quantity: number, unitEnum: string, abbreviated: boolean = true): string => {
      if (!unitEnum) return ''

      const isPlural = quantity !== 1
      const suffix = abbreviated ? '_abbr' : ''
      const pluralSuffix = isPlural ? '_plural' : ''
      const translationKey = `units.${unitEnum}${suffix}${pluralSuffix}`

      // Try to get translation, fallback to singular with 's' added
      const translatedName = isPlural
        ? t(translationKey, t(`units.${unitEnum}${suffix}`) + 's') // Fallback: add 's' to singular
        : t(`units.${unitEnum}${suffix}`, unitEnum)

      return translatedName
    },
    [t],
  )

  return {
    formatUnit,
    getShortLabel,
    getFullName,
    formatUnitWithQuantity,
  }
}
