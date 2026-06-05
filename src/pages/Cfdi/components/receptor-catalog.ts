import { z } from 'zod'

/**
 * SAT catalogs + the receptor zod schema for CFDI issuance.
 *
 * Kept in a plain `.ts` module (no React) so it can be imported by both the
 * staff-issued flow (Flow B — IssueCfdiDialog) and the public autofactura page
 * (Flow A) without coupling to any component.
 *
 * The catalog `description`s are the SAT-canonical Spanish labels — official
 * terms, not UI copy — so they stay as-is across locales (the `code` is what the
 * PAC stamps). Surrounding UI labels/messages ARE i18n'd in the components.
 */

/** Common SAT régimen fiscal codes (catálogo c_RegimenFiscal). */
export const REGIMEN_FISCAL_OPTIONS: ReadonlyArray<{ code: string; description: string }> = [
  { code: '601', description: 'General de Ley Personas Morales' },
  { code: '603', description: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', description: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', description: 'Arrendamiento' },
  { code: '607', description: 'Régimen de Enajenación o Adquisición de Bienes' },
  { code: '608', description: 'Demás ingresos' },
  { code: '610', description: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { code: '611', description: 'Ingresos por Dividendos (socios y accionistas)' },
  { code: '612', description: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '614', description: 'Ingresos por intereses' },
  { code: '615', description: 'Régimen de los ingresos por obtención de premios' },
  { code: '616', description: 'Sin obligaciones fiscales' },
  { code: '620', description: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { code: '621', description: 'Incorporación Fiscal' },
  { code: '622', description: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { code: '623', description: 'Opcional para Grupos de Sociedades' },
  { code: '624', description: 'Coordinados' },
  { code: '625', description: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', description: 'Régimen Simplificado de Confianza (RESICO)' },
]

/** Common SAT uso de CFDI codes (catálogo c_UsoCFDI). */
export const USO_CFDI_OPTIONS: ReadonlyArray<{ code: string; description: string }> = [
  { code: 'G01', description: 'Adquisición de mercancías' },
  { code: 'G02', description: 'Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', description: 'Gastos en general' },
  { code: 'I01', description: 'Construcciones' },
  { code: 'I02', description: 'Mobiliario y equipo de oficina por inversiones' },
  { code: 'I03', description: 'Equipo de transporte' },
  { code: 'I04', description: 'Equipo de cómputo y accesorios' },
  { code: 'D01', description: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { code: 'D04', description: 'Donativos' },
  { code: 'D10', description: 'Pagos por servicios educativos (colegiaturas)' },
  { code: 'S01', description: 'Sin efectos fiscales' },
  { code: 'CP01', description: 'Pagos' },
  { code: 'P01', description: 'Por definir' },
]

// RFC: 3-4 letters + 6 digits + 3 homoclave chars (12 for morales, 13 for físicas).
const RFC_REGEX = /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/

/**
 * Shape-only receptor schema (Spanish validation messages). Business validity
 * (RFC exists at SAT, régimen/CP match, etc.) is enforced by the backend, which
 * returns a 422 with the specific reasons.
 */
export const receptorSchema = z.object({
  rfc: z
    .string()
    .trim()
    .min(1, 'El RFC es obligatorio.')
    .transform(v => v.toUpperCase())
    .refine(v => RFC_REGEX.test(v), 'RFC con formato inválido.'),
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria.'),
  regimenFiscal: z.string().trim().min(1, 'Selecciona un régimen fiscal.'),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal debe tener 5 dígitos.'),
  usoCfdi: z.string().trim().min(1, 'Selecciona el uso del CFDI.'),
  email: z.union([z.string().trim().email('Correo electrónico inválido.'), z.literal('')]).optional(),
})

export type ReceptorFormValues = z.infer<typeof receptorSchema>

export const EMPTY_RECEPTOR: ReceptorFormValues = {
  rfc: '',
  razonSocial: '',
  regimenFiscal: '',
  codigoPostal: '',
  usoCfdi: '',
  email: '',
}

/**
 * Autofactura (Flow A) schema — identical to the staff schema EXCEPT the email is
 * REQUIRED. The customer self-invoices from a public link, so we need an address
 * to deliver the stamped CFDI (the merchant isn't in the loop to forward it).
 *
 * Staff issuance (Flow B) keeps email optional; this override is scoped to the
 * public page and never touches `receptorSchema`.
 */
export const autofacturaReceptorSchema = receptorSchema.extend({
  email: z.string().trim().min(1, 'El correo electrónico es obligatorio.').email('Correo electrónico inválido.'),
})

export type AutofacturaReceptorFormValues = z.infer<typeof autofacturaReceptorSchema>

export const EMPTY_AUTOFACTURA_RECEPTOR: AutofacturaReceptorFormValues = {
  rfc: '',
  razonSocial: '',
  regimenFiscal: '',
  codigoPostal: '',
  usoCfdi: '',
  email: '',
}
