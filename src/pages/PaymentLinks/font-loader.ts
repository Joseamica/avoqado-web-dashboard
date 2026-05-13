/**
 * Lazy-loader for the payment-link branding font catalog (dashboard side).
 *
 * Mirrors `avoqado-checkout/src/lib/font-loader.ts` — same families, same
 * dynamic-import pattern. The dashboard uses it to render previews inside
 * the Branding page (the font dropdown shows each option rendered in its
 * own face). Without lazy loading the bundled CSS would be ~1.5 MB; with
 * it, each font's .woff2 only fetches when the admin scrolls/hovers it.
 *
 * Keep this file in sync with the checkout-side loader. If you add a font
 * to one repo, add it to the other in the same commit.
 */

type FontLoader = () => Promise<unknown>

const LOADERS: Record<string, FontLoader> = {
  // Sans-serif
  Inter: () => import('@fontsource/inter/400.css').then(() => import('@fontsource/inter/600.css')),
  'DM Sans': () => import('@fontsource/dm-sans/400.css').then(() => import('@fontsource/dm-sans/600.css')),
  Poppins: () => import('@fontsource/poppins/400.css').then(() => import('@fontsource/poppins/600.css')),
  Manrope: () => import('@fontsource/manrope/400.css').then(() => import('@fontsource/manrope/600.css')),
  'Plus Jakarta Sans': () =>
    import('@fontsource/plus-jakarta-sans/400.css').then(() => import('@fontsource/plus-jakarta-sans/600.css')),
  Roboto: () => import('@fontsource/roboto/400.css').then(() => import('@fontsource/roboto/500.css')),
  'Open Sans': () => import('@fontsource/open-sans/400.css').then(() => import('@fontsource/open-sans/600.css')),
  Lato: () => import('@fontsource/lato/400.css').then(() => import('@fontsource/lato/700.css')),
  Montserrat: () => import('@fontsource/montserrat/400.css').then(() => import('@fontsource/montserrat/600.css')),
  'Work Sans': () => import('@fontsource/work-sans/400.css').then(() => import('@fontsource/work-sans/600.css')),
  Nunito: () => import('@fontsource/nunito/400.css').then(() => import('@fontsource/nunito/700.css')),
  Outfit: () => import('@fontsource/outfit/400.css').then(() => import('@fontsource/outfit/600.css')),
  Karla: () => import('@fontsource/karla/400.css').then(() => import('@fontsource/karla/600.css')),
  Mulish: () => import('@fontsource/mulish/400.css').then(() => import('@fontsource/mulish/600.css')),
  Figtree: () => import('@fontsource/figtree/400.css').then(() => import('@fontsource/figtree/600.css')),

  // Serif
  'Playfair Display': () =>
    import('@fontsource/playfair-display/400.css').then(() => import('@fontsource/playfair-display/700.css')),
  Lora: () => import('@fontsource/lora/400.css').then(() => import('@fontsource/lora/600.css')),
  Merriweather: () => import('@fontsource/merriweather/400.css').then(() => import('@fontsource/merriweather/700.css')),
  'EB Garamond': () => import('@fontsource/eb-garamond/400.css').then(() => import('@fontsource/eb-garamond/600.css')),
  'Crimson Pro': () => import('@fontsource/crimson-pro/400.css').then(() => import('@fontsource/crimson-pro/600.css')),
  'Source Serif 4': () =>
    import('@fontsource/source-serif-4/400.css').then(() => import('@fontsource/source-serif-4/600.css')),
  'Libre Baskerville': () =>
    import('@fontsource/libre-baskerville/400.css').then(() => import('@fontsource/libre-baskerville/700.css')),
  'Cormorant Garamond': () =>
    import('@fontsource/cormorant-garamond/400.css').then(() => import('@fontsource/cormorant-garamond/600.css')),

  // Display
  'Bebas Neue': () => import('@fontsource/bebas-neue/400.css'),
  Oswald: () => import('@fontsource/oswald/400.css').then(() => import('@fontsource/oswald/600.css')),
  Anton: () => import('@fontsource/anton/400.css'),
  'Archivo Black': () => import('@fontsource/archivo-black/400.css'),
  'Abril Fatface': () => import('@fontsource/abril-fatface/400.css'),
  Righteous: () => import('@fontsource/righteous/400.css'),
  Staatliches: () => import('@fontsource/staatliches/400.css'),
  'Alfa Slab One': () => import('@fontsource/alfa-slab-one/400.css'),
  'Fjalla One': () => import('@fontsource/fjalla-one/400.css'),
  'Russo One': () => import('@fontsource/russo-one/400.css'),

  // Handwriting
  Caveat: () => import('@fontsource/caveat/400.css').then(() => import('@fontsource/caveat/600.css')),
  Pacifico: () => import('@fontsource/pacifico/400.css'),
  'Dancing Script': () =>
    import('@fontsource/dancing-script/400.css').then(() => import('@fontsource/dancing-script/600.css')),
  Sacramento: () => import('@fontsource/sacramento/400.css'),

  // Mono
  'Fira Code': () => import('@fontsource/fira-code/400.css').then(() => import('@fontsource/fira-code/600.css')),
  'JetBrains Mono': () =>
    import('@fontsource/jetbrains-mono/400.css').then(() => import('@fontsource/jetbrains-mono/600.css')),
  'Roboto Mono': () => import('@fontsource/roboto-mono/400.css').then(() => import('@fontsource/roboto-mono/500.css')),
}

const inFlight = new Map<string, Promise<unknown>>()

export function loadFontPreview(fontFamily: string | undefined | null): Promise<unknown> {
  if (!fontFamily) return Promise.resolve()
  const load = LOADERS[fontFamily]
  if (!load) return Promise.resolve()
  let p = inFlight.get(fontFamily)
  if (!p) {
    p = load().catch(err => {
      // eslint-disable-next-line no-console
      console.warn(`[font-loader] failed to load "${fontFamily}":`, err)
    })
    inFlight.set(fontFamily, p)
  }
  return p
}

export function fontFamilyValue(fontFamily: string | undefined | null): string | undefined {
  if (!fontFamily) return undefined
  const quoted = fontFamily.includes(' ') ? `'${fontFamily}'` : fontFamily
  return `${quoted}, system-ui, sans-serif`
}
