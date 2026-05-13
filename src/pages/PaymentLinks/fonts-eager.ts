/**
 * Eager-imports the 40 @fontsource CSS files for the payment-link branding
 * picker. Loaded once at module init (i.e. when the Branding page chunk is
 * parsed) so every `@font-face` declaration is in the document BEFORE the
 * dropdown renders. The browser then fetches each `.woff2` in parallel as
 * soon as items hit the screen.
 *
 * Why not lazy-load with `import()` from a useEffect:
 *   - useEffect runs AFTER the first paint, so the dropdown briefly shows
 *     every option in system-ui before each font swaps in one by one
 *     (the FOUT the user is complaining about).
 *   - Each font's CSS is ~1-2 KB (just one @font-face + a URL string).
 *     40 × ~1.5 KB = ~60 KB of CSS added to the route chunk — trivial.
 *   - The actual `.woff2` files (~30-50 KB each) are NOT bundled. Browser
 *     fetches them on demand the first time the family is rendered, so
 *     loading this module costs ~60 KB up-front, not ~2 MB.
 *
 * If you add or remove a font, update:
 *   1. payment-link-fonts.ts (catalog)
 *   2. font-loader.ts (lazy fallback for code paths outside the picker)
 *   3. THIS file (eager preload)
 *   4. avoqado-server/.../paymentLink.schema.ts (Zod whitelist)
 */

// Sans-serif
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/work-sans/400.css'
import '@fontsource/work-sans/600.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/600.css'
import '@fontsource/karla/400.css'
import '@fontsource/karla/600.css'
import '@fontsource/mulish/400.css'
import '@fontsource/mulish/600.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/600.css'

// Serif
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/600.css'
import '@fontsource/merriweather/400.css'
import '@fontsource/merriweather/700.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/crimson-pro/400.css'
import '@fontsource/crimson-pro/600.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/libre-baskerville/400.css'
import '@fontsource/libre-baskerville/700.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/600.css'

// Display
import '@fontsource/bebas-neue/400.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/600.css'
import '@fontsource/anton/400.css'
import '@fontsource/archivo-black/400.css'
import '@fontsource/abril-fatface/400.css'
import '@fontsource/righteous/400.css'
import '@fontsource/staatliches/400.css'
import '@fontsource/alfa-slab-one/400.css'
import '@fontsource/fjalla-one/400.css'
import '@fontsource/russo-one/400.css'

// Handwriting
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/600.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/dancing-script/400.css'
import '@fontsource/dancing-script/600.css'
import '@fontsource/sacramento/400.css'

// Mono
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
