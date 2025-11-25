/**
 * Color Picker Component
 * Combines a visual color picker with a hex input field
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ value = '', onChange, placeholder = '#000000', className }, ref) => {
    const { t } = useTranslation()
    const [hexValue, setHexValue] = useState(value || '')
    const [colorValue, setColorValue] = useState(value || '#000000')

    // Sync internal state with external value
    useEffect(() => {
      if (value !== undefined) {
        setHexValue(value)
        // Only update color picker if valid hex
        if (isValidHex(value)) {
          setColorValue(value)
        }
      }
    }, [value])

    const isValidHex = (hex: string): boolean => {
      if (!hex) return false
      return /^#[0-9A-F]{6}$/i.test(hex)
    }

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setHexValue(newValue)

      // Only update color picker and trigger onChange if valid hex
      if (isValidHex(newValue)) {
        setColorValue(newValue)
        onChange?.(newValue)
      } else if (newValue === '') {
        // Allow clearing the field
        onChange?.('')
      }
    }

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value
      setColorValue(newColor)
      setHexValue(newColor)
      onChange?.(newColor)
    }

    return (
      <div className="flex gap-2 items-center">
        {/* Visual Color Picker */}
        <div className="relative">
          <input
            type="color"
            value={colorValue}
            onChange={handleColorChange}
            className={cn(
              'w-12 h-10 rounded-md border border-input cursor-pointer',
              'bg-transparent',
              '[&::-webkit-color-swatch-wrapper]:p-0',
              '[&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none',
              '[&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none',
            )}
            title={t('common:chooseColor')}
          />
        </div>

        {/* Hex Input */}
        <Input
          ref={ref}
          type="text"
          value={hexValue}
          onChange={handleHexChange}
          placeholder={placeholder}
          className={cn('flex-1 font-mono uppercase', className)}
          maxLength={7}
        />

        {/* Color Preview Badge */}
        {isValidHex(hexValue) && (
          <div
            className="w-10 h-10 rounded-md border border-input"
            style={{ backgroundColor: hexValue }}
            title={hexValue}
          />
        )}
      </div>
    )
  },
)

ColorPicker.displayName = 'ColorPicker'
