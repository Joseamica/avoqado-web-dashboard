import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingScreen, Spinner } from './spinner'

describe('Avoqado loading components', () => {
  it('renders the branded tail-first loader with its loading message', () => {
    const { container } = render(<LoadingScreen message="Cargando dashboard" />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando dashboard')
    expect(container.querySelector('svg.avoqado-loader')).toBeInTheDocument()
    expect(container.querySelector('.avoqado-loader__growth-path')).toHaveAttribute(
      'd',
      expect.stringContaining('M 595 641'),
    )
  })

  it('generates a unique SVG mask for every loader instance', () => {
    const { container } = render(
      <>
        <Spinner>Uno</Spinner>
        <Spinner>Dos</Spinner>
      </>,
    )

    const maskIds = [...container.querySelectorAll('mask')].map((mask) => mask.id)

    expect(maskIds).toHaveLength(2)
    expect(new Set(maskIds).size).toBe(2)
  })
})
