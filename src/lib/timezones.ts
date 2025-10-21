/**
 * Comprehensive IANA timezone list for venue configuration
 *
 * Organized alphabetically by country with user-friendly labels and UTC offsets.
 * Prioritizes Mexico and Latin America timezones for Avoqado's primary market.
 *
 * Source: IANA Time Zone Database
 * https://www.iana.org/time-zones
 */

export interface TimezoneOption {
  /** IANA timezone identifier (e.g., "America/Mexico_City") */
  value: string
  /** User-friendly label (e.g., "Ciudad de México (CST/CDT, UTC-6)") */
  label: string
  /** Country name for grouping */
  country: string
  /** UTC offset in hours (standard time) */
  utcOffset: number
}

/**
 * All available timezones, organized alphabetically by country
 */
export const TIMEZONES: TimezoneOption[] = [
  // ====================================================================
  // ARGENTINA
  // ====================================================================
  {
    value: 'America/Buenos_Aires',
    label: 'Buenos Aires (ART, UTC-3)',
    country: 'Argentina',
    utcOffset: -3,
  },

  // ====================================================================
  // AUSTRALIA
  // ====================================================================
  {
    value: 'Australia/Sydney',
    label: 'Sydney (AEDT/AEST, UTC+10/+11)',
    country: 'Australia',
    utcOffset: 10,
  },

  // ====================================================================
  // BOLIVIA
  // ====================================================================
  {
    value: 'America/La_Paz',
    label: 'La Paz (BOT, UTC-4)',
    country: 'Bolivia',
    utcOffset: -4,
  },

  // ====================================================================
  // BRASIL
  // ====================================================================
  {
    value: 'America/Sao_Paulo',
    label: 'São Paulo (BRT/BRST, UTC-3)',
    country: 'Brasil',
    utcOffset: -3,
  },

  // ====================================================================
  // CANADÁ
  // ====================================================================
  {
    value: 'America/Halifax',
    label: 'Halifax / Atlantic (AST/ADT, UTC-4)',
    country: 'Canadá',
    utcOffset: -4,
  },
  {
    value: 'America/St_Johns',
    label: 'St. Johns / Newfoundland (NST/NDT, UTC-3:30)',
    country: 'Canadá',
    utcOffset: -3.5,
  },
  {
    value: 'America/Toronto',
    label: 'Toronto / Eastern (EST/EDT, UTC-5)',
    country: 'Canadá',
    utcOffset: -5,
  },
  {
    value: 'America/Winnipeg',
    label: 'Winnipeg / Central (CST/CDT, UTC-6)',
    country: 'Canadá',
    utcOffset: -6,
  },
  {
    value: 'America/Edmonton',
    label: 'Edmonton / Mountain (MST/MDT, UTC-7)',
    country: 'Canadá',
    utcOffset: -7,
  },
  {
    value: 'America/Vancouver',
    label: 'Vancouver / Pacific (PST/PDT, UTC-8)',
    country: 'Canadá',
    utcOffset: -8,
  },

  // ====================================================================
  // CHILE
  // ====================================================================
  {
    value: 'America/Santiago',
    label: 'Santiago (CLT/CLST, UTC-4/-3)',
    country: 'Chile',
    utcOffset: -4,
  },

  // ====================================================================
  // CHINA
  // ====================================================================
  {
    value: 'Asia/Shanghai',
    label: 'Shanghai / Beijing (CST, UTC+8)',
    country: 'China',
    utcOffset: 8,
  },

  // ====================================================================
  // COLOMBIA
  // ====================================================================
  {
    value: 'America/Bogota',
    label: 'Bogotá (COT, UTC-5)',
    country: 'Colombia',
    utcOffset: -5,
  },

  // ====================================================================
  // COREA DEL SUR
  // ====================================================================
  {
    value: 'Asia/Seoul',
    label: 'Seúl (KST, UTC+9)',
    country: 'Corea del Sur',
    utcOffset: 9,
  },

  // ====================================================================
  // COSTA RICA
  // ====================================================================
  {
    value: 'America/Costa_Rica',
    label: 'San José (CST, UTC-6)',
    country: 'Costa Rica',
    utcOffset: -6,
  },

  // ====================================================================
  // CUBA
  // ====================================================================
  {
    value: 'America/Havana',
    label: 'La Habana (CST/CDT, UTC-5)',
    country: 'Cuba',
    utcOffset: -5,
  },

  // ====================================================================
  // ECUADOR
  // ====================================================================
  {
    value: 'America/Guayaquil',
    label: 'Guayaquil (ECT, UTC-5)',
    country: 'Ecuador',
    utcOffset: -5,
  },

  // ====================================================================
  // EL SALVADOR
  // ====================================================================
  {
    value: 'America/El_Salvador',
    label: 'San Salvador (CST, UTC-6)',
    country: 'El Salvador',
    utcOffset: -6,
  },

  // ====================================================================
  // EMIRATOS ÁRABES UNIDOS
  // ====================================================================
  {
    value: 'Asia/Dubai',
    label: 'Dubai (GST, UTC+4)',
    country: 'Emiratos Árabes Unidos',
    utcOffset: 4,
  },

  // ====================================================================
  // ESPAÑA
  // ====================================================================
  {
    value: 'Europe/Madrid',
    label: 'Madrid (CET/CEST, UTC+1)',
    country: 'España',
    utcOffset: 1,
  },

  // ====================================================================
  // ESTADOS UNIDOS
  // ====================================================================
  {
    value: 'America/New_York',
    label: 'New York / Eastern (EST/EDT, UTC-5)',
    country: 'Estados Unidos',
    utcOffset: -5,
  },
  {
    value: 'America/Chicago',
    label: 'Chicago / Central (CST/CDT, UTC-6)',
    country: 'Estados Unidos',
    utcOffset: -6,
  },
  {
    value: 'America/Denver',
    label: 'Denver / Mountain (MST/MDT, UTC-7)',
    country: 'Estados Unidos',
    utcOffset: -7,
  },
  {
    value: 'America/Phoenix',
    label: 'Phoenix / Arizona (MST, UTC-7, sin horario de verano)',
    country: 'Estados Unidos',
    utcOffset: -7,
  },
  {
    value: 'America/Los_Angeles',
    label: 'Los Angeles / Pacific (PST/PDT, UTC-8)',
    country: 'Estados Unidos',
    utcOffset: -8,
  },
  {
    value: 'America/Anchorage',
    label: 'Anchorage / Alaska (AKST/AKDT, UTC-9)',
    country: 'Estados Unidos',
    utcOffset: -9,
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Honolulu / Hawaii (HST, UTC-10)',
    country: 'Estados Unidos',
    utcOffset: -10,
  },

  // ====================================================================
  // FRANCIA
  // ====================================================================
  {
    value: 'Europe/Paris',
    label: 'París (CET/CEST, UTC+1)',
    country: 'Francia',
    utcOffset: 1,
  },

  // ====================================================================
  // GRECIA
  // ====================================================================
  {
    value: 'Europe/Athens',
    label: 'Atenas (EET/EEST, UTC+2)',
    country: 'Grecia',
    utcOffset: 2,
  },

  // ====================================================================
  // GUATEMALA
  // ====================================================================
  {
    value: 'America/Guatemala',
    label: 'Ciudad de Guatemala (CST, UTC-6)',
    country: 'Guatemala',
    utcOffset: -6,
  },

  // ====================================================================
  // HONDURAS
  // ====================================================================
  {
    value: 'America/Tegucigalpa',
    label: 'Tegucigalpa (CST, UTC-6)',
    country: 'Honduras',
    utcOffset: -6,
  },

  // ====================================================================
  // HONG KONG
  // ====================================================================
  {
    value: 'Asia/Hong_Kong',
    label: 'Hong Kong (HKT, UTC+8)',
    country: 'Hong Kong',
    utcOffset: 8,
  },

  // ====================================================================
  // INDIA
  // ====================================================================
  {
    value: 'Asia/Kolkata',
    label: 'Kolkata (IST, UTC+5:30)',
    country: 'India',
    utcOffset: 5.5,
  },

  // ====================================================================
  // ITALIA
  // ====================================================================
  {
    value: 'Europe/Rome',
    label: 'Roma (CET/CEST, UTC+1)',
    country: 'Italia',
    utcOffset: 1,
  },

  // ====================================================================
  // JAPÓN
  // ====================================================================
  {
    value: 'Asia/Tokyo',
    label: 'Tokio (JST, UTC+9)',
    country: 'Japón',
    utcOffset: 9,
  },

  // ====================================================================
  // MÉXICO
  // ====================================================================
  {
    value: 'America/Mexico_City',
    label: 'Ciudad de México (CST/CDT, UTC-6)',
    country: 'México',
    utcOffset: -6,
  },
  {
    value: 'America/Cancun',
    label: 'Cancún / Quintana Roo (EST, UTC-5)',
    country: 'México',
    utcOffset: -5,
  },
  {
    value: 'America/Tijuana',
    label: 'Tijuana / Baja California (PST/PDT, UTC-8)',
    country: 'México',
    utcOffset: -8,
  },
  {
    value: 'America/Monterrey',
    label: 'Monterrey (CST/CDT, UTC-6)',
    country: 'México',
    utcOffset: -6,
  },
  {
    value: 'America/Mazatlan',
    label: 'Mazatlán / Sinaloa (MST/MDT, UTC-7)',
    country: 'México',
    utcOffset: -7,
  },
  {
    value: 'America/Hermosillo',
    label: 'Hermosillo / Sonora (MST, UTC-7, sin horario de verano)',
    country: 'México',
    utcOffset: -7,
  },
  {
    value: 'America/Chihuahua',
    label: 'Chihuahua (MST/MDT, UTC-7)',
    country: 'México',
    utcOffset: -7,
  },
  {
    value: 'America/Merida',
    label: 'Mérida / Yucatán (CST/CDT, UTC-6)',
    country: 'México',
    utcOffset: -6,
  },

  // ====================================================================
  // NICARAGUA
  // ====================================================================
  {
    value: 'America/Managua',
    label: 'Managua (CST, UTC-6)',
    country: 'Nicaragua',
    utcOffset: -6,
  },

  // ====================================================================
  // NUEVA ZELANDA
  // ====================================================================
  {
    value: 'Pacific/Auckland',
    label: 'Auckland (NZDT/NZST, UTC+12/+13)',
    country: 'Nueva Zelanda',
    utcOffset: 12,
  },

  // ====================================================================
  // PANAMÁ
  // ====================================================================
  {
    value: 'America/Panama',
    label: 'Ciudad de Panamá (EST, UTC-5)',
    country: 'Panamá',
    utcOffset: -5,
  },

  // ====================================================================
  // PARAGUAY
  // ====================================================================
  {
    value: 'America/Asuncion',
    label: 'Asunción (PYT/PYST, UTC-4/-3)',
    country: 'Paraguay',
    utcOffset: -4,
  },

  // ====================================================================
  // PERÚ
  // ====================================================================
  {
    value: 'America/Lima',
    label: 'Lima (PET, UTC-5)',
    country: 'Perú',
    utcOffset: -5,
  },

  // ====================================================================
  // PORTUGAL
  // ====================================================================
  {
    value: 'Europe/Lisbon',
    label: 'Lisboa (WET/WEST, UTC+0)',
    country: 'Portugal',
    utcOffset: 0,
  },

  // ====================================================================
  // REINO UNIDO
  // ====================================================================
  {
    value: 'Europe/London',
    label: 'Londres (GMT/BST, UTC+0)',
    country: 'Reino Unido',
    utcOffset: 0,
  },

  // ====================================================================
  // REPÚBLICA DOMINICANA
  // ====================================================================
  {
    value: 'America/Santo_Domingo',
    label: 'Santo Domingo (AST, UTC-4)',
    country: 'República Dominicana',
    utcOffset: -4,
  },

  // ====================================================================
  // RUSIA
  // ====================================================================
  {
    value: 'Europe/Moscow',
    label: 'Moscú (MSK, UTC+3)',
    country: 'Rusia',
    utcOffset: 3,
  },

  // ====================================================================
  // SINGAPUR
  // ====================================================================
  {
    value: 'Asia/Singapore',
    label: 'Singapur (SGT, UTC+8)',
    country: 'Singapur',
    utcOffset: 8,
  },

  // ====================================================================
  // TAILANDIA
  // ====================================================================
  {
    value: 'Asia/Bangkok',
    label: 'Bangkok (ICT, UTC+7)',
    country: 'Tailandia',
    utcOffset: 7,
  },

  // ====================================================================
  // URUGUAY
  // ====================================================================
  {
    value: 'America/Montevideo',
    label: 'Montevideo (UYT, UTC-3)',
    country: 'Uruguay',
    utcOffset: -3,
  },

  // ====================================================================
  // UTC (para casos especiales)
  // ====================================================================
  {
    value: 'UTC',
    label: 'UTC (Tiempo Universal Coordinado, UTC+0)',
    country: 'UTC',
    utcOffset: 0,
  },

  // ====================================================================
  // VENEZUELA
  // ====================================================================
  {
    value: 'America/Caracas',
    label: 'Caracas (VET, UTC-4)',
    country: 'Venezuela',
    utcOffset: -4,
  },

  // ====================================================================
  // ALEMANIA
  // ====================================================================
  {
    value: 'Europe/Berlin',
    label: 'Berlín (CET/CEST, UTC+1)',
    country: 'Alemania',
    utcOffset: 1,
  },
]

// Sort timezones: first by country, then by UTC offset within each country
TIMEZONES.sort((a, b) => {
  // México always first
  if (a.country === 'México' && b.country !== 'México') return -1
  if (a.country !== 'México' && b.country === 'México') return 1

  // UTC always last
  if (a.country === 'UTC') return 1
  if (b.country === 'UTC') return -1

  // Sort by country alphabetically
  const countryCompare = a.country.localeCompare(b.country, 'es')
  if (countryCompare !== 0) return countryCompare

  // Within the same country, sort by UTC offset (most negative to most positive)
  return a.utcOffset - b.utcOffset
})

/**
 * Get timezones grouped by country
 * @returns Object with countries as keys and timezone arrays as values
 */
export function getTimezonesByCountry(): Record<string, TimezoneOption[]> {
  const grouped: Record<string, TimezoneOption[]> = {}

  for (const timezone of TIMEZONES) {
    if (!grouped[timezone.country]) {
      grouped[timezone.country] = []
    }
    grouped[timezone.country].push(timezone)
  }

  return grouped
}

/**
 * Get list of countries in order (México first, then alphabetically, UTC last)
 */
export function getCountryOrder(): string[] {
  const countries = Array.from(new Set(TIMEZONES.map(tz => tz.country)))

  return countries.sort((a, b) => {
    // México always first
    if (a === 'México' && b !== 'México') return -1
    if (a !== 'México' && b === 'México') return 1

    // UTC always last
    if (a === 'UTC') return 1
    if (b === 'UTC') return -1

    // Otherwise alphabetically
    return a.localeCompare(b, 'es')
  })
}

/**
 * Find a timezone by its IANA identifier
 * @param value - IANA timezone identifier (e.g., "America/Mexico_City")
 * @returns TimezoneOption or undefined if not found
 */
export function findTimezone(value: string): TimezoneOption | undefined {
  return TIMEZONES.find(tz => tz.value === value)
}

/**
 * Get the label for a timezone value
 * @param value - IANA timezone identifier
 * @returns User-friendly label or the value itself if not found
 */
export function getTimezoneLabel(value: string): string {
  const timezone = findTimezone(value)
  return timezone?.label || value
}

/**
 * Search timezones by query string (label, value, or country)
 * @param query - Search query
 * @returns Matching timezones
 */
export function searchTimezones(query: string): TimezoneOption[] {
  const lowerQuery = query.toLowerCase()
  return TIMEZONES.filter(
    tz =>
      tz.label.toLowerCase().includes(lowerQuery) ||
      tz.value.toLowerCase().includes(lowerQuery) ||
      tz.country.toLowerCase().includes(lowerQuery),
  )
}

/**
 * Default timezone for new venues (Mexico City)
 */
export const DEFAULT_TIMEZONE = 'America/Mexico_City'
