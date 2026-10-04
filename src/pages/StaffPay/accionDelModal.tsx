import type { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

/**
 * El botón de confirmar de un FullScreenModal: arriba a la derecha en pantallas grandes (el patrón del repo); en el celular
 * se encimaba con el título centrado («Cerrar julio de 2026» sobre «Cerrar julio de 2026»), así que ahí va abajo, a todo
 * lo ancho y pegado al borde inferior mientras se desplaza el contenido. `abajo` va como último hijo del modal.
 */
export function useAccionDelModal(boton: ReactNode) {
  const enCelular = useIsMobile()
  return {
    enCelular,
    actions: enCelular ? undefined : boton,
    abajo: enCelular ? <div className="sticky bottom-0 border-t border-border/50 bg-card p-4 [&>button]:h-12 [&>button]:w-full">{boton}</div> : null,
  }
}
