/**
 * Human-readable Spanish labels for Stripe Connect `requirements.currently_due`
 * codes. Stripe sends dot-notation field paths like `business_profile.mcc` or
 * `owners.0.dob.day` and the raw codes are unreadable for non-technical users.
 *
 * This mapping covers Mexico-centric Custom/Express Connect onboarding. Codes
 * not in the map fall back to compositional translation (translate each
 * segment), and only the leaf segment fallback shows the raw code.
 *
 * If we ever need EN/FR, lift these into the i18n files. For now hardcoded
 * because Stripe Connect is MX-only and labels are venue-OWNER-facing.
 */

// Top-level entity prefixes
const ENTITY: Record<string, string> = {
  business_profile: 'Perfil del negocio',
  business_type: 'Tipo de negocio',
  company: 'Empresa',
  individual: 'Persona física',
  owners: 'Propietario',
  representative: 'Representante legal',
  directors: 'Directores',
  executives: 'Ejecutivos',
  relationship: 'Relación',
  tos_acceptance: 'Aceptación de términos',
  external_account: 'Cuenta bancaria',
  settings: 'Configuración',
  capabilities: 'Capacidades',
}

// Sub-segments (under a parent like company / owners / representative)
const FIELD: Record<string, string> = {
  // Common fields
  name: 'Nombre',
  first_name: 'Nombre',
  last_name: 'Apellido',
  email: 'Email',
  phone: 'Teléfono',
  url: 'Sitio web',
  mcc: 'Categoría del negocio (MCC)',
  product_description: 'Descripción del producto o servicio',
  support_email: 'Email de soporte',
  support_phone: 'Teléfono de soporte',
  support_url: 'URL de soporte',
  support_address: 'Dirección de soporte',
  tax_id: 'RFC',
  tax_id_provided: 'RFC proporcionado',
  registration_number: 'Número de registro',
  vat_id: 'IVA / Tax ID',
  ssn_last_4: 'Identificación (últimos 4 dígitos)',
  id_number: 'Número de identificación',
  id_number_provided: 'Número de identificación proporcionado',
  // Relationships
  owners_provided: 'Lista de propietarios completa',
  directors_provided: 'Lista de directores completa',
  executives_provided: 'Lista de ejecutivos completa',
  owner: 'Propietario',
  director: 'Director',
  executive: 'Ejecutivo',
  representative: 'Representante legal',
  percent_ownership: '% de propiedad',
  title: 'Cargo',
  // Verification
  verification: 'Verificación de identidad',
  document: 'Documento de identidad',
  additional_document: 'Documento adicional',
  // DOB
  dob: 'Fecha de nacimiento',
  day: 'Día',
  month: 'Mes',
  year: 'Año',
  // Address parts
  address: 'Dirección',
  line1: 'Calle y número',
  line2: 'Apartamento / interior',
  line3: 'Referencias adicionales',
  city: 'Ciudad',
  town: 'Localidad',
  state: 'Estado',
  postal_code: 'Código postal',
  country: 'País',
  // ToS
  date: 'Fecha de aceptación',
  ip: 'IP de aceptación',
  user_agent: 'Navegador',
  // Capabilities
  card_payments: 'Pagos con tarjeta',
  transfers: 'Transferencias',
}

// Special-case full paths that have a more specific phrasing than compositional.
const EXACT: Record<string, string> = {
  external_account: 'Cuenta bancaria para depósitos',
  'business_profile.mcc': 'Categoría del negocio (MCC)',
  'business_profile.url': 'Sitio web del negocio',
  'business_profile.product_description': 'Descripción del producto o servicio',
  'business_profile.support_email': 'Email de soporte al cliente',
  'business_profile.support_phone': 'Teléfono de soporte al cliente',
  'company.name': 'Razón social',
  'company.tax_id': 'RFC de la empresa',
  'company.phone': 'Teléfono de la empresa',
  'company.directors_provided': 'Lista completa de directores',
  'company.executives_provided': 'Lista completa de ejecutivos',
  'company.owners_provided': 'Lista completa de propietarios',
  'company.verification.document': 'Documento de verificación de la empresa',
  'individual.first_name': 'Nombre',
  'individual.last_name': 'Apellido',
  'individual.email': 'Email',
  'individual.phone': 'Teléfono',
  'individual.dob.day': 'Día de nacimiento',
  'individual.dob.month': 'Mes de nacimiento',
  'individual.dob.year': 'Año de nacimiento',
  'individual.id_number': 'CURP / Número de identificación',
  'individual.verification.document': 'Identificación oficial (INE / Pasaporte)',
  'tos_acceptance.date': 'Fecha de aceptación de términos',
  'tos_acceptance.ip': 'IP de aceptación de términos',
}

/**
 * Translate a single Stripe requirement code to a human label.
 * Returns the label string, or the raw code if no match.
 */
export function formatStripeRequirement(code: string): string {
  if (!code) return ''

  // 1. Exact match (highest priority)
  if (EXACT[code]) return EXACT[code]

  // 2. Strip array indexes (owners.0.dob.day → owners.dob.day) and retry exact
  const normalized = code.replace(/\.\d+/g, '')
  if (normalized !== code && EXACT[normalized]) return EXACT[normalized]

  // 3. Compositional: translate each segment, drop unknowns.
  const segments = normalized.split('.')
  const parts: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (i === 0 && ENTITY[seg]) {
      parts.push(ENTITY[seg])
    } else if (FIELD[seg]) {
      parts.push(FIELD[seg])
    } else {
      // Unknown segment — keep as-is so user can at least see the field name
      parts.push(seg)
    }
  }
  return parts.join(' · ')
}
