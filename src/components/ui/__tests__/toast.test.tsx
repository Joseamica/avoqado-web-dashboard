import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toast, ToastProvider, ToastTitle, ToastViewport } from '../toast'

// C2-pulido (G5): «No hubo respuesta clara del PAC» es una ESPERA, no un error: se pinta ámbar con los tokens semánticos, nunca rojo.
describe('Toast warning variant', () => {
  it('applies the warning (amber) semantic classes, not the destructive ones', () => {
    render(
      <ToastProvider>
        <Toast variant="warning" open>
          <ToastTitle>En espera</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const toast = screen.getByText('En espera').closest('li')!
    expect(toast.className).toContain('bg-warning-muted')
    expect(toast.className).toContain('text-warning-foreground')
    expect(toast.className).not.toContain('bg-destructive')
  })
})
