import { useEffect } from 'react'
import type { EditorAction } from '../model/editorReducer'

/** Campos donde las teclas son del texto: ni los atajos ni Esc del editor actúan ahí. */
export const TYPING = 'input, textarea, select, [contenteditable="true"]'
/** Además, controles que ya usan flechas, Supr o letras (menús, listas, selects) y los avisos de confirmación. */
const OWN_KEYS = `${TYPING}, [role="menu"], [role="listbox"], [role="combobox"], [aria-haspopup="menu"], [role="alertdialog"]`
/** En Mac el atajo es ⌘; en Windows y Linux, Ctrl (lo que se enseña en los globos y en la lista de atajos). */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
export const within = (target: EventTarget | null, selector: string) => !!(target as HTMLElement | null)?.closest?.(selector)

export interface EditorShortcutsInput {
  /** `false` con un diálogo abierto, en la vista del mesero o mientras se guarda. */
  enabled: boolean
  selection: string[]
  edit: (action: EditorAction) => boolean
  duplicate: (keys: string[]) => void
  remove: (keys: string[]) => void
}

/**
 * Atajos del editor (spec §6.2): ⌘/Ctrl+Z y Shift+Z o Y, ⌘/Ctrl+D, Supr/Retroceso, R, flechas (Shift = 5 cuadros).
 * Una flecha SOSTENIDA es una sola ráfaga: sus repeticiones se juntan en un paso de deshacer (`burst`).
 */
export function useEditorShortcuts({ enabled, selection, edit, duplicate, remove }: EditorShortcutsInput) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (within(e.target, OWN_KEYS)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        edit({ type: e.shiftKey ? 'REDO' : 'UNDO' })
      } else if (mod && key === 'y') {
        e.preventDefault()
        edit({ type: 'REDO' })
      } else if (mod && key === 'd') {
        e.preventDefault()
        if (selection.length) duplicate(selection)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        e.preventDefault()
        remove(selection)
      } else if (key === 'r' && !mod && !e.altKey && selection.length) {
        if (!e.repeat) edit({ type: 'ROTATE', keys: selection })
      } else if (e.key.startsWith('Arrow') && selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 5 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        edit({ type: 'MOVE', keys: selection, dx, dy, burst: e.repeat })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, selection, edit, duplicate, remove])
}
