import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fontFamilyValue, loadFontPreview } from '../font-loader'
import { FONT_CATEGORY_LABELS, PAYMENT_LINK_FONTS, type FontCategory } from '../payment-link-fonts'

interface Props {
  value: string
  onChange: (fontFamily: string) => void
  disabled?: boolean
}

/** Searchable font picker with live previews rendered in each font.
 *
 *  - Popover opens with a search input + category-grouped options.
 *  - As the user scrolls/hovers, the matching font's .woff2 is lazy-loaded
 *    so the preview rerenders in the real face within ~100ms.
 *  - Trigger button shows the selected font rendered in itself. */
export function FontPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Preload the currently-selected font so the trigger shows it correctly
  // on mount instead of falling back to system-ui.
  useEffect(() => {
    loadFontPreview(value)
  }, [value])

  const filtered = useMemo(() => {
    const norm = search.trim().toLowerCase()
    const list = norm
      ? PAYMENT_LINK_FONTS.filter(f => f.label.toLowerCase().includes(norm))
      : PAYMENT_LINK_FONTS
    // Group by category, preserving the curated order inside each.
    const grouped: Record<FontCategory, typeof PAYMENT_LINK_FONTS> = {
      sans: [],
      serif: [],
      display: [],
      handwriting: [],
      mono: [],
    }
    for (const f of list) grouped[f.category].push(f)
    return grouped
  }, [search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-12 px-4"
          data-tour="payment-link-branding-font"
        >
          <span className="text-base" style={{ fontFamily: fontFamilyValue(value) }}>
            {value}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar fuente…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-80">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {(Object.keys(filtered) as FontCategory[]).map(cat => {
              const items = filtered[cat]
              if (items.length === 0) return null
              return (
                <CommandGroup key={cat} heading={FONT_CATEGORY_LABELS[cat]}>
                  {items.map(font => (
                    <CommandItem
                      key={font.id}
                      value={font.id}
                      onMouseEnter={() => loadFontPreview(font.id)}
                      onSelect={() => {
                        loadFontPreview(font.id)
                        onChange(font.id)
                        setOpen(false)
                      }}
                      className="cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="text-base" style={{ fontFamily: fontFamilyValue(font.id) }}>
                        {font.label}
                      </span>
                      <Check className={cn('h-4 w-4', value === font.id ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
