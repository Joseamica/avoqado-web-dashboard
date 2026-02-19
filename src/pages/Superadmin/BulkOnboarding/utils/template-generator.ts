// Template generators for bulk onboarding import

export function generateJsonTemplate(): string {
  const template = {
    organizationSlug: 'mi-organizacion',
    defaults: {
      venueType: 'RESTAURANT',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      country: 'MX',
      entityType: 'PERSONA_MORAL',
    },
    pricing: {
      debitRate: 2.5,
      creditRate: 3.5,
      amexRate: 4.0,
      internationalRate: 4.5,
    },
    settlement: {
      debitDays: 1,
      creditDays: 3,
      amexDays: 5,
      internationalDays: 7,
      otherDays: 3,
      dayType: 'BUSINESS_DAYS',
    },
    venues: [
      {
        name: 'Venue Ejemplo',
        address: 'Av. Reforma 123',
        city: 'CDMX',
        state: 'CDMX',
        country: 'MX',
        zipCode: '06600',
        phone: '+525512345678',
        email: 'contacto@ejemplo.com',
        type: 'RESTAURANT',
        rfc: 'ABC123456XYZ',
        legalName: 'Empresa Legal SA de CV',
        terminals: [
          { serialNumber: 'SN001', name: 'Terminal 1', type: 'TPV_ANDROID' },
        ],
        pricing: null,
        settlement: null,
      },
    ],
  }
  return JSON.stringify(template, null, 2)
}

export function generateCsvTemplate(): string {
  const headers = [
    'name',
    'address',
    'city',
    'state',
    'country',
    'zipCode',
    'phone',
    'email',
    'type',
    'rfc',
    'legalName',
    'terminal_serial_1',
    'terminal_name_1',
    'terminal_type_1',
  ]
  const exampleRow = [
    'Venue Ejemplo',
    'Av. Reforma 123',
    'CDMX',
    'CDMX',
    'MX',
    '06600',
    '+525512345678',
    'contacto@ejemplo.com',
    'RESTAURANT',
    'ABC123456XYZ',
    'Empresa Legal SA de CV',
    'SN001',
    'Terminal 1',
    'TPV_ANDROID',
  ]
  return headers.join(',') + '\n' + exampleRow.join(',') + '\n'
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
