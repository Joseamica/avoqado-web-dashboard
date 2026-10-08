// E6a-fix4 C-n1 (re-prueba del 8-oct): sin red, la franja global «Sin conexión» (`fixed top-0`, antes `z-[100]`) se pintaba ENCIMA
// de las ventanas de pantalla completa y tapaba su cabecera: la X para cerrar y el botón de confirmar (Cerrar periodo, Agregar
// ajuste, Asignar nivel, Publicar tabla), justo cuando el aviso del módulo dice «Si cierras esta ventana, no se…». La franja va
// DEBAJO de toda capa de diálogo (overlay y contenido de Dialog, AlertDialog, Sheet y FullScreenModal, `z-50`) y ENCIMA del
// contenido de la página (la barra lateral y las cabeceras fijas, `z-10`). jsdom no pinta: se comparan las capas (`z-*`) de las
// piezas reales montadas.
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OfflineBanner } from '../OfflineBanner'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/api', () => ({
  getConnectionStatus: () => ({ isOnline: false, isServerReachable: true, isConnected: false }),
  subscribeToConnection: () => () => undefined,
}))

/** La capa de un elemento según su clase de Tailwind (`z-50`, `z-[100]`), o null si no trae. */
const capa = (el: Element): number | null => {
  const m = /(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/.exec(el.getAttribute('class') ?? '')
  return m ? Number(m[1] ?? m[2]) : null
}
const capaDeLaFranja = () => {
  const { container } = render(<OfflineBanner />)
  const franja = container.firstElementChild as HTMLElement
  expect(franja).toHaveTextContent('errors.offline')
  expect(franja.className).toMatch(/(?:^|\s)fixed(?:\s|$)/)
  const z = capa(franja)
  expect(z).not.toBeNull()
  return z as number
}
/** Las capas `fixed` que monta un diálogo abierto (overlay y contenido), en su portal. */
const capasDelDialogo = (dialogo: React.ReactElement) => {
  const { unmount } = render(dialogo)
  const capas = Array.from(document.body.querySelectorAll('[data-state="open"]'))
    .filter(el => /(?:^|\s)fixed(?:\s|$)/.test(el.getAttribute('class') ?? ''))
    .map(capa)
    .filter((z): z is number => z !== null)
  unmount()
  return capas
}

const DIALOGOS: Array<[string, React.ReactElement]> = [
  [
    'pantalla completa (Cerrar periodo, Agregar ajuste…)',
    <FullScreenModal key="f" open onClose={() => undefined} title="Agregar ajuste">
      contenido
    </FullScreenModal>,
  ],
  [
    'diálogo',
    <Dialog key="d" open>
      <DialogContent>
        <DialogTitle>t</DialogTitle>
        <DialogDescription>d</DialogDescription>
      </DialogContent>
    </Dialog>,
  ],
  [
    'confirmación',
    <AlertDialog key="a" open>
      <AlertDialogContent>
        <AlertDialogTitle>t</AlertDialogTitle>
        <AlertDialogDescription>d</AlertDialogDescription>
      </AlertDialogContent>
    </AlertDialog>,
  ],
  [
    'panel lateral',
    <Sheet key="s" open>
      <SheetContent>
        <SheetTitle>t</SheetTitle>
        <SheetDescription>d</SheetDescription>
      </SheetContent>
    </Sheet>,
  ],
]

describe('la franja «Sin conexión» no tapa los diálogos (C-n1)', () => {
  it.each(DIALOGOS)('🔴 queda debajo de la capa más baja de: %s', (_nombre, dialogo) => {
    const franja = capaDeLaFranja()
    const capas = capasDelDialogo(dialogo)
    expect(capas.length).toBeGreaterThan(0)
    expect(franja).toBeLessThan(Math.min(...capas))
  })
  it('y sigue encima del contenido de la página (barra lateral y cabeceras fijas, z-10)', () => {
    expect(capaDeLaFranja()).toBeGreaterThan(10)
  })
})
