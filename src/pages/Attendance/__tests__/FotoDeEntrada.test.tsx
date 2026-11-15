/**
 * FotoDeEntrada — la selfie de la checada en Asistencia (encargo b0c1a1, 15-nov).
 * Con foto: miniatura que se abre en grande. Pedida y sin foto: se marca. Vencida: pide la lista otra vez.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FotoDeEntrada } from '@/pages/Attendance/FotoDeEntrada'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.name ? `${k}:${o.name}` : k) }),
}))

describe('FotoDeEntrada', () => {
  it('con foto: miniatura que al tocarla se abre en grande', async () => {
    render(<FotoDeEntrada url="https://firmada/a.jpg" pedida nombre="Ana López" hora="9:00" />)
    const miniatura = screen.getByRole('button', { name: 'photo.open:Ana López' })
    expect(miniatura.querySelector('img')).toHaveAttribute('src', 'https://firmada/a.jpg')

    fireEvent.click(miniatura)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ana López')
    expect(screen.getAllByAltText('photoAlt:Ana López')).toHaveLength(2)
  })

  it('pedida y sin foto: cámara tachada que dice «Sin foto»', () => {
    render(<FotoDeEntrada url={null} pedida nombre="Ana" hora="9:00" />)
    expect(screen.getByLabelText('photo.missing')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('regresión: interruptor apagado y sin foto, el ícono de siempre (nada de «Sin foto»)', () => {
    render(<FotoDeEntrada url={undefined} pedida={false} nombre="Ana" hora="9:00" />)
    expect(screen.queryByLabelText('photo.missing')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('si la URL firmada ya venció, avisa para recargar la lista y no deja una imagen rota', () => {
    const onVencida = vi.fn()
    render(<FotoDeEntrada url="https://firmada/vieja.jpg" pedida nombre="Ana" hora="9:00" onVencida={onVencida} />)
    fireEvent.error(screen.getByAltText('photoAlt:Ana'))
    expect(onVencida).toHaveBeenCalledTimes(1)
    expect(screen.queryByAltText('photoAlt:Ana')).toBeNull()
  })
})
