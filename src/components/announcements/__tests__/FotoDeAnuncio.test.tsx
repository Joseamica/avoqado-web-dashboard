import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FotoDeAnuncio } from '../FotoDeAnuncio'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(cleanup)

describe('FotoDeAnuncio', () => {
  it('usa object-contain y nunca object-cover', () => {
    render(<FotoDeAnuncio url="https://x.test/a.jpg" alt="Foto A" />)
    const img = screen.getByAltText('Foto A')
    expect(img.className).toContain('object-contain')
    expect(img.className).not.toContain('object-cover')
  })

  it('con medidas pone width, height y aspect-ratio', () => {
    render(<FotoDeAnuncio url="https://x.test/a.jpg" alt="Foto A" width={800} height={600} />)
    const img = screen.getByAltText('Foto A')
    expect(img.getAttribute('width')).toBe('800')
    expect(img.getAttribute('height')).toBe('600')
    expect(img.style.aspectRatio).toBe('800 / 600')
  })

  it('sin medidas no pone aspect-ratio', () => {
    render(<FotoDeAnuncio url="https://x.test/a.jpg" alt="Foto A" />)
    const img = screen.getByAltText('Foto A')
    expect(img.getAttribute('width')).toBeNull()
    expect(img.style.aspectRatio).toBe('')
  })

  it('al hacer clic abre la foto en grande', async () => {
    render(<FotoDeAnuncio url="https://x.test/a.jpg" alt="Foto A" />)
    expect(screen.getAllByAltText('Foto A')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Foto A' }))
    const fotos = screen.getAllByAltText('Foto A')
    expect(fotos).toHaveLength(2)
    expect(fotos[1].className).toContain('max-h-[80vh]')
    expect(screen.getByRole('button', { name: 'common:close' })).toBeTruthy()
  })

  it('el visor deja la X legible en los dos temas y la foto no queda debajo de ella', async () => {
    render(<FotoDeAnuncio url="https://x.test/a.jpg" alt="Foto A" />)
    await userEvent.click(screen.getByRole('button', { name: 'Foto A' }))
    const cerrar = screen.getByRole('button', { name: 'common:close' })
    const contenido = cerrar.parentElement!
    // fondo oscuro fijo => X clara fija (no depende del tema) y con fondo propio
    expect(contenido.className).toContain('[&>button]:text-neutral-50')
    expect(contenido.className).toContain('[&>button]:bg-neutral-800/80')
    // la foto arranca debajo de la X (a 375 px la X no la tapa)
    expect(contenido.className).toMatch(/\bpt-14\b/)
  })
})
