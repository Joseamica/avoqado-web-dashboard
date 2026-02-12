import { useState, useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useGoogleMaps } from '@/hooks/use-google-maps'
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete'
import { useTranslation } from 'react-i18next'

export interface PlaceDetails {
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  latitude: number
  longitude: number
}

interface AddressAutocompleteProps {
  value?: string
  onAddressSelect: (place: PlaceDetails) => void
  placeholder?: string
  countries?: string[]
  disabled?: boolean
  /** Extra classes forwarded to the inner Input (e.g. "h-12 text-base rounded-lg") */
  className?: string
}

function extractAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShortName = false,
): string {
  const component = components.find(c => c.types.includes(type))
  return (useShortName ? component?.short_name : component?.long_name) ?? ''
}

export function AddressAutocomplete({
  value: externalValue,
  onAddressSelect,
  placeholder,
  countries = ['mx'],
  disabled,
  className,
}: AddressAutocompleteProps) {
  const { t } = useTranslation('venues')
  const { isLoaded } = useGoogleMaps()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
    init,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: countries },
    },
    debounce: 300,
    initOnMount: false,
  })

  // Initialize when Google Maps is loaded
  useEffect(() => {
    if (isLoaded) {
      init()
    }
  }, [isLoaded, init])

  // Sync external value
  useEffect(() => {
    if (externalValue !== undefined) {
      setValue(externalValue, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue])

  const handleSelect = async (placeDescription: string) => {
    setValue(placeDescription, false)
    clearSuggestions()
    setOpen(false)

    try {
      const results = await getGeocode({ address: placeDescription })
      const { lat, lng } = getLatLng(results[0])
      const components = results[0].address_components

      const place: PlaceDetails = {
        address: results[0].formatted_address,
        city:
          extractAddressComponent(components, 'locality') ||
          extractAddressComponent(components, 'sublocality_level_1') ||
          extractAddressComponent(components, 'administrative_area_level_2'),
        state: extractAddressComponent(components, 'administrative_area_level_1'),
        country: extractAddressComponent(components, 'country', true),
        zipCode: extractAddressComponent(components, 'postal_code'),
        latitude: lat,
        longitude: lng,
      }

      onAddressSelect(place)
    } catch (error) {
      console.error('Error getting geocode:', error)
    }
  }

  const handleInputChange = (inputValue: string) => {
    setValue(inputValue)
    if (inputValue.length > 0) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  // Fallback: if Google Maps not loaded, render a plain input
  if (!isLoaded || !ready) {
    return (
      <Input
        value={externalValue ?? ''}
        onChange={(e) => {
          // Can't autocomplete without Google Maps, but still allow manual input
          onAddressSelect({
            address: e.target.value,
            city: '',
            state: '',
            country: '',
            zipCode: '',
            latitude: 0,
            longitude: 0,
          })
        }}
        placeholder={placeholder ?? t('addDialog.fields.addressPlaceholder')}
        disabled={disabled}
        className={className}
      />
    )
  }

  const hasSuggestions = status === 'OK' && data.length > 0

  return (
    <Popover open={open && hasSuggestions} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (value.length > 0 && hasSuggestions) setOpen(true)
            }}
            placeholder={placeholder ?? t('addDialog.fields.addressPlaceholder')}
            disabled={disabled}
            className={cn('pl-9', className)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {status === 'OK' && data.length > 0 ? (
              <CommandGroup>
                {data.map(({ place_id, description, structured_formatting }) => (
                  <CommandItem
                    key={place_id}
                    value={description}
                    onSelect={() => handleSelect(description)}
                    className="cursor-pointer"
                  >
                    <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">{structured_formatting.main_text}</span>
                      <span className="text-xs text-muted-foreground">
                        {structured_formatting.secondary_text}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>{t('addDialog.fields.addressNoResults')}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
