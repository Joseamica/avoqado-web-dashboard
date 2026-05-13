/**
 * Catalog of fonts available for payment-link branding.
 *
 * Source of truth — server validates against this same list (id → matches
 * the Zod whitelist) and the customer checkout app (avoqado-checkout)
 * mirrors this catalog with the actual `.woff2` files bundled via the
 * @fontsource packages. The id MUST equal the CSS `font-family` name
 * Fontsource uses so a runtime `style.fontFamily = id` resolves correctly.
 *
 * Adding a new font:
 *   1. Add an entry here (kebab-case slug as the npm hint, exact name as id).
 *   2. Add the matching item to the avoqado-checkout `font-loader.ts`
 *      whitelist + dynamic import switch.
 *   3. Add the id to the backend Zod enum in
 *      `avoqado-server/src/schemas/dashboard/paymentLink.schema.ts`.
 */

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono'

export interface PaymentLinkFont {
  /** CSS font-family name. Used as the persisted value + as the inline
   *  style. Must match what @fontsource declares in its @font-face block. */
  id: string
  /** Human label in the dropdown — same as id for these. */
  label: string
  category: FontCategory
  /** Fallback stack appended after the chosen family. Always ends with a
   *  generic so the page never goes invisible while the font loads. */
  fallback: string
}

const sans = (id: string): PaymentLinkFont => ({ id, label: id, category: 'sans', fallback: 'system-ui, sans-serif' })
const serif = (id: string): PaymentLinkFont => ({ id, label: id, category: 'serif', fallback: 'Georgia, serif' })
const display = (id: string): PaymentLinkFont => ({ id, label: id, category: 'display', fallback: 'system-ui, sans-serif' })
const handwriting = (id: string): PaymentLinkFont => ({ id, label: id, category: 'handwriting', fallback: 'cursive' })
const mono = (id: string): PaymentLinkFont => ({ id, label: id, category: 'mono', fallback: 'ui-monospace, monospace' })

/** 40 curated, self-hosted fonts. Order within each category roughly tracks
 *  popularity / general usefulness so the dropdown defaults to a friendly
 *  surface. */
export const PAYMENT_LINK_FONTS: PaymentLinkFont[] = [
  // Sans-serif (15)
  sans('Inter'),
  sans('DM Sans'),
  sans('Poppins'),
  sans('Manrope'),
  sans('Plus Jakarta Sans'),
  sans('Roboto'),
  sans('Open Sans'),
  sans('Lato'),
  sans('Montserrat'),
  sans('Work Sans'),
  sans('Nunito'),
  sans('Outfit'),
  sans('Karla'),
  sans('Mulish'),
  sans('Figtree'),

  // Serif (8)
  serif('Playfair Display'),
  serif('Lora'),
  serif('Merriweather'),
  serif('EB Garamond'),
  serif('Crimson Pro'),
  serif('Source Serif 4'),
  serif('Libre Baskerville'),
  serif('Cormorant Garamond'),

  // Display (10)
  display('Bebas Neue'),
  display('Oswald'),
  display('Anton'),
  display('Archivo Black'),
  display('Abril Fatface'),
  display('Righteous'),
  display('Staatliches'),
  display('Alfa Slab One'),
  display('Fjalla One'),
  display('Russo One'),

  // Handwriting / Script (4)
  handwriting('Caveat'),
  handwriting('Pacifico'),
  handwriting('Dancing Script'),
  handwriting('Sacramento'),

  // Monospace (3)
  mono('Fira Code'),
  mono('JetBrains Mono'),
  mono('Roboto Mono'),
]

export const PAYMENT_LINK_FONT_IDS = PAYMENT_LINK_FONTS.map(f => f.id) as readonly string[]

export const DEFAULT_PAYMENT_LINK_FONT = 'DM Sans'

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: 'Sans-serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Manuscritas',
  mono: 'Monoespaciadas',
}

export function fontFamilyWithFallback(font: PaymentLinkFont): string {
  // Quote the family name when it contains a space — required by CSS spec.
  const quoted = font.id.includes(' ') ? `'${font.id}'` : font.id
  return `${quoted}, ${font.fallback}`
}
