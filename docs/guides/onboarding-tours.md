# Onboarding Tours (`driver.js`)

> Interactive, flow-aware tours that overlay the live UI and guide admins through real workflows — not PDFs, not videos, not tooltips.

## Why this matters

- Admins are non-technical. A tour IN the product teaches 100× better than a separate manual.
- Flow-aware automation (each "Siguiente →" can open modals / click buttons / enable toggles) means the admin learns by watching their own dashboard transform, then takes over whenever they want.
- Same code works for English and Spanish via `i18next`.

## Library

[`driver.js`](https://driverjs.com/) — 7KB, vanilla JS, already installed (`package.json` dep). No React-specific wrapper needed.

## Location

```
src/hooks/
  useProductCreationTour.ts   // Tour: simple product (QUANTITY)
  useRecipeCreationTour.ts    // Tour: recipe product (RECIPE)
  useXxxTour.ts               // Add new tours here, one file per flow
src/locales/es/menu.json      // tour.* and tourRecipe.* keys
src/locales/en/menu.json      // mirror of above
docs/guides/onboarding-tours.md  // this file
```

## The `data-tour` contract

Every element a tour targets MUST have a stable `data-tour` attribute:

```tsx
// ✅ Stable, scoped, self-documenting
<Button data-tour="product-new-btn">Nuevo producto</Button>
<Input data-tour="product-wizard-name" {...register('name')} />
<div data-tour="product-wizard-ingredients">...</div>

// ❌ Never target these — they change / are generated / collide
<Button className="bg-primary">Nuevo producto</Button>
<Input id="name" />   // `#name` can collide across dialogs
```

### Naming convention

`kebab-case-with-scope`:

| Pattern | Example |
|---|---|
| `<feature>-<element>` | `product-new-btn`, `order-list-filter` |
| `<feature>-wizard-<field>` | `product-wizard-name`, `product-wizard-price` |
| `<feature>-<dialog>-<element>` | `product-type-regular`, `add-ingredient-qty` |

### Rule for new UI

**Any new primary CTA, wizard field, form section, or element the user is guided toward MUST have `data-tour`.** No exceptions. If the design team adds a new step to a wizard, the dev adds `data-tour` in the same PR.

## Anatomy of a tour hook

```ts
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function useMyFeatureTour() {
  const { t } = useTranslation('namespace')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const d: Driver = driver({
      showProgress: true,
      allowClose: true,
      animate: true,
      overlayOpacity: 0.65,
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      progressText: t('tour.progress'),  // uses {{current}} / {{total}}
      steps: [
        // Step 1 (welcome, no element)
        { popover: { title: t('tour.welcome.title'), description: t('tour.welcome.description') } },

        // Step 2 (target an element, auto-advance to next state)
        {
          element: '[data-tour="my-cta"]',
          popover: {
            title: t('tour.step1.title'),
            description: t('tour.step1.description'),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="my-modal-field"]')) {
                document.querySelector<HTMLButtonElement>('[data-tour="my-cta"]')?.click()
                try { await waitForElement('[data-tour="my-modal-field"]') } catch {}
              }
              d.moveNext()
            },
          },
        },

        // ...more steps
      ],
    })
    return d
  }, [t])

  const start = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  useEffect(() => () => { driverRef.current?.destroy() }, [])

  return { start }
}
```

### Helpers (copy into every new hook file)

```ts
function waitForElement(selector: string, timeout = 4000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector)
    if (existing) { resolve(existing); return }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) { observer.disconnect(); resolve(el) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); reject(new Error('timeout')) }, timeout)
  })
}

function exists(selector: string): boolean {
  return !!document.querySelector(selector)
}
```

## Flow-aware automation (the important part)

Plain tours are static pointers. Our tours ARE the UI:

- **Clicking "Siguiente →" opens the modal automatically** if not yet open.
- **Selecting a radio + clicking the inner "Siguiente"** happens under the hood.
- **Toggling a switch** so the next field becomes visible — the tour does it if the user didn't.

**Pattern:** on any step whose next state requires an action the admin may not have taken, override `onNextClick` with an idempotent handler:

```ts
onNextClick: async () => {
  if (!exists('[data-tour="next-element"]')) {
    document.querySelector('[data-tour="action-element"]')?.click()
    try { await waitForElement('[data-tour="next-element"]') } catch {}
  }
  d.moveNext()  // IMPORTANT: call this last
}
```

Idempotency matters: if the admin takes the action themselves, the tour should NOT click twice. Always check `exists(...)` first.

## Launching a tour

Import the hook inside the page and wire it to a button (usually a `DropdownMenu` if multiple tours coexist):

```tsx
const { start: startProductTour } = useProductCreationTour()
const { start: startRecipeTour } = useRecipeCreationTour()

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <HelpCircle className="h-4 w-4" />
      {t('tour.launchButton')}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>{t('tour.menuLabel')}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={startProductTour}>Producto simple</DropdownMenuItem>
    <DropdownMenuItem onClick={startRecipeTour}>Producto con receta</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## i18n keys structure

Put all tour strings under a single namespace root (keep them co-located per flow):

```json
{
  "tour": {
    "launchButton": "¿Cómo crear un producto?",
    "menuLabel": "Tours interactivos",
    "next": "Siguiente →",
    "prev": "← Anterior",
    "done": "¡Listo!",
    "progress": "Paso {{current}} de {{total}}",
    "welcome": { "title": "...", "description": "..." },
    "step1":   { "title": "...", "description": "..." },
    "stepN":   { "title": "...", "description": "..." },
    "complete":{ "title": "...", "description": "..." }
  },
  "tourRecipe": { /* same shape for the recipe flow */ }
}
```

- Every `t()` call MUST have a `defaultValue` — the tour should still read in case a translation is missing.
- Both `en/` and `es/` files must mirror each other (CI lint enforces this).

## Design guidelines for step text

- **Title**: imperative, short. "Escribe el nombre", not "Cómo escribir el nombre".
- **Description**: one idea, ≤ 2 short sentences. Use `<b>` for examples. Use `<br/>` sparingly.
- **No jargon**: "ingredientes" not "raw materials"; "existencias" not "stock levels" (unless the word exists in the UI).
- **Examples with real venue language**: "15 hoodies en bodega", "120ml de leche + 9g de café".

## Adding a tour — checklist

- [ ] New hook `src/hooks/useXxxTour.ts` with the anatomy above.
- [ ] `data-tour` attributes on every targeted element (page + wizards + dialogs).
- [ ] i18n keys added to BOTH `es/menu.json` and `en/menu.json` (or the appropriate namespace).
- [ ] Launcher wired to a button / dropdown item.
- [ ] `onNextClick` on any step whose target depends on a prior action.
- [ ] Dev test: click only "Siguiente →" from step 1 to end — it should complete with zero manual clicks.
- [ ] `npm run build` + `npm run lint` pass.

## Existing tours

| Hook | Entry point | What it teaches |
|---|---|---|
| `useProductCreationTour` | `/venues/:slug/menumaker/products` → dropdown | Create a simple QUANTITY product |
| `useRecipeCreationTour` | same dropdown | Create a RECIPE product (shakes, lattes) |

## Suggested future tours

- `useAdjustStockTour` — ajustar existencias / recibir mercancía
- `useCreateIngredientTour` — crear raw material desde cero
- `useCreatePurchaseOrderTour` — levantar orden de compra + recibirla
- `useFirstLoginTour` — auto-start on first OWNER login covering dashboard layout

## Why not Appcues/Pendo?

Paid SaaS ($249–$999/mo) wins on analytics + A/B testing. But for a first pass, `driver.js` has zero monthly cost, zero vendor dependency, and tours ship as regular code (PR reviewable, versioned with the feature they teach). Consider moving to a SaaS only after 10+ tours exist and analytics become the bottleneck.
