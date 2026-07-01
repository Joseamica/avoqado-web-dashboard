import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../button'

describe('Button warning variant', () => {
  it('applies the warning (orange) semantic classes', () => {
    render(<Button variant="warning">Reasignar SIMs</Button>)
    const btn = screen.getByRole('button', { name: 'Reasignar SIMs' })
    expect(btn.className).toContain('bg-warning')
    expect(btn.className).toContain('text-warning-foreground')
  })
})
