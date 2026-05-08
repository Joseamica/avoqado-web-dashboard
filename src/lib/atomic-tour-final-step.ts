import type { Config, Driver, PopoverDOM, State } from 'driver.js'
import {
  consumeAtomicTourReturnPath,
  notifyAtomicTourCompleted,
  setAtomicTourReturnPath,
  type AtomicTourName,
} from '@/hooks/useAtomicTourListener'

/**
 * Helper para el último paso de cualquier atomic tour. Reemplaza el footer
 * del popover con tres botones:
 *
 *   - Cancelar       → cierra sin marcar como completado.
 *   - Listo          → notifica completion (marca el step) y se queda en
 *                      la página actual.
 *   - Volver a inicio → notifica completion + navega de regreso a Home.
 *
 * IMPORTANTE: NO intentamos capturar la instancia `Driver` cuando se llama
 * este helper desde dentro del array `steps`, porque esa expresión se
 * evalúa DENTRO del inicializador de `const d = driver({...})` y leer `d`
 * ahí dispara TDZ (ReferenceError). Por eso usamos los `opts.driver` que
 * driver.js pasa a cada callback — ese sí está disponible al click time.
 */

const CURRENT_BASE_PATH_KEY = 'avoqado-current-venue-base-path'

interface Options {
  /** Nombre del atomic tour, para `notifyAtomicTourCompleted`. */
  tourName: AtomicTourName
  /** Label de cada botón (ya traducido). */
  cancelLabel: string
  doneLabel: string
  homeLabel: string
}

interface DriverCallbackOpts {
  config: Config
  state: State
  driver: Driver
}

interface FinalStepFooterPopoverConfig {
  showButtons: ('previous' | 'next' | 'close')[]
  prevBtnText: string
  nextBtnText: string
  onPrevClick: (
    element: Element | undefined,
    step: unknown,
    opts: DriverCallbackOpts,
  ) => void
  onNextClick: (
    element: Element | undefined,
    step: unknown,
    opts: DriverCallbackOpts,
  ) => void
  onPopoverRender: (popover: PopoverDOM, opts: DriverCallbackOpts) => void
}

export function buildFinalStepFooter(opts: Options): FinalStepFooterPopoverConfig {
  const { tourName, cancelLabel, doneLabel, homeLabel } = opts

  const cancel = (driver: Driver) => {
    consumeAtomicTourReturnPath()
    driver.destroy()
  }

  const done = (driver: Driver) => {
    consumeAtomicTourReturnPath()
    notifyAtomicTourCompleted(tourName)
    driver.destroy()
  }

  const goHome = (driver: Driver) => {
    // Si no hay return path (caso: el tour se lanzó desde una página
    // que no es Home), seteamos uno usando el fullBasePath del venue
    // actual que dashboard.tsx mantiene en sessionStorage.
    let needsPath = true
    try {
      needsPath = !sessionStorage.getItem('avoqado-atomic-tour-return-path')
    } catch {
      /* noop */
    }
    if (needsPath) {
      try {
        const base = sessionStorage.getItem(CURRENT_BASE_PATH_KEY)
        if (base) setAtomicTourReturnPath(base)
      } catch {
        /* noop */
      }
    }
    notifyAtomicTourCompleted(tourName)
    driver.destroy()
  }

  return {
    showButtons: ['previous', 'next'],
    prevBtnText: cancelLabel,
    nextBtnText: doneLabel,
    // Override del comportamiento default — prev NO regresa al penúltimo
    // step y next NO avanza (no hay siguiente); ambos cierran el popover
    // según la semántica de cada botón.
    onPrevClick: (_el, _step, callbackOpts) => cancel(callbackOpts.driver),
    onNextClick: (_el, _step, callbackOpts) => done(callbackOpts.driver),
    onPopoverRender: (popoverDom, callbackOpts) => {
      const footer = popoverDom.footer
      if (!footer) return
      // Evitar double-injection si driver.js re-renderiza el popover.
      if (footer.querySelector('[data-avoqado-tour-home-btn]')) return

      const homeBtn = document.createElement('button')
      homeBtn.type = 'button'
      // ⚠️  NO usar la clase `driver-popover-next-btn` (ni cualquier clase
      // que contenga el sub-string "driver-popover"). Driver.js instala un
      // listener delegado a nivel `document` en fase de CAPTURA que llama
      // preventDefault + stopImmediatePropagation cuando el target está
      // dentro del popover y su className contiene "driver-popover", y
      // luego despacha onNextClick / onPrevClick. Si reutilizáramos esa
      // clase, este botón ejecutaría el handler de "Listo" en lugar del
      // suyo y el evento jamás llegaría al `addEventListener` de abajo.
      // Estilo primario lo aplica `.avoqado-tour-home-btn` en src/index.css.
      homeBtn.className = 'avoqado-tour-home-btn'
      homeBtn.dataset.avoqadoTourHomeBtn = 'true'
      homeBtn.textContent = homeLabel
      homeBtn.addEventListener('click', () => goHome(callbackOpts.driver))
      footer.appendChild(homeBtn)
    },
  }
}
