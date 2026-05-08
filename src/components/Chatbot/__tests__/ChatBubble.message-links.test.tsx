import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseMessageText } from '../messageText'

describe('parseMessageText', () => {
  it('renders https URLs as clickable links', () => {
    const { container } = render(<p>{parseMessageText('Contacta soporte: https://wa.me/525640070001.', false)}</p>)

    const link = screen.getByRole('link', { name: 'https://wa.me/525640070001' })
    expect(link).toHaveAttribute('href', 'https://wa.me/525640070001')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container).toHaveTextContent('Contacta soporte: https://wa.me/525640070001.')
  })
})
