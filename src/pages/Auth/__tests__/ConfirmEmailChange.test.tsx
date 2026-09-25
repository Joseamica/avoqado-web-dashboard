import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Función normal y no `vi.fn` para lo que devuelve: vitest 4 registra la promesa de un `vi.fn` y
// reporta su rechazo como fallo de la prueba aunque la página lo maneje.
const llamadas: string[] = []
let respuesta: () => Promise<unknown> = () => Promise.resolve({})
vi.mock('@/services/auth.service', () => ({
  confirmEmailChange: (token: string) => {
    llamadas.push(token)
    return respuesta()
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.email ? `${k}:${o.email}` : k),
  }),
}))

import ConfirmEmailChange from '../ConfirmEmailChange'

function pintar(url: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/confirm-email-change" element={<ConfirmEmailChange />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

beforeEach(() => {
  llamadas.length = 0
})

describe('ConfirmEmailChange', () => {
  it('canjea el enlace UNA vez (aunque StrictMode monte dos) y dice el correo nuevo', async () => {
    respuesta = () => Promise.resolve({ success: true, email: 'nuevo@test.mx' })
    pintar('/auth/confirm-email-change?token=abc123')
    expect(await screen.findByText('confirmEmailChange.successTitle')).toBeInTheDocument()
    expect(screen.getByText('confirmEmailChange.successDesc:nuevo@test.mx')).toBeInTheDocument()
    expect(llamadas).toEqual(['abc123'])
  })

  it('si el enlace no sirve, muestra el motivo del servidor', async () => {
    respuesta = () => Promise.reject(Object.assign(new Error('400'), { response: { data: { message: 'Este enlace ya no es válido.' } } }))
    pintar('/auth/confirm-email-change?token=viejo')
    expect(await screen.findByText('Este enlace ya no es válido.')).toBeInTheDocument()
    expect(screen.getByText('confirmEmailChange.errorTitle')).toBeInTheDocument()
  })

  it('sin token no llama al servidor y lo dice', async () => {
    pintar('/auth/confirm-email-change')
    await waitFor(() => expect(screen.getByText('confirmEmailChange.errorTitle')).toBeInTheDocument())
    expect(llamadas).toEqual([])
  })
})
