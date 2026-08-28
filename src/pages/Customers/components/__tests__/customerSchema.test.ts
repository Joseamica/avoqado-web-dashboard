/**
 * El alta de un cliente pide «correo O teléfono», igual que el servidor.
 *
 * 🔴 El bug (visto capturando la guía de clientes, 27-ago-2026): el formulario exigía LOS DOS
 * —`email` con `.min(1)` y `phone` con `.min(10)`— mientras el servidor declara `email`
 * opcional y valida `.refine(data => data.email || data.phone)`.
 *
 * Muerde justo al ICP: una estética o un gym normalmente tiene el TELÉFONO de su clienta y no
 * su correo. Con la regla vieja no la podía dar de alta desde el dashboard, aunque el backend
 * sí lo permitía. El formulario era más estricto que la verdad.
 */
import { describe, it, expect } from 'vitest'
import { createCustomerSchema } from '@/pages/Customers/components/customerSchema'

const schema = createCustomerSchema((k: string) => k)
const base = { firstName: 'Valeria', lastName: 'Núñez' }

describe('alta de cliente: correo o teléfono', () => {
  it('🔴 con SOLO teléfono se puede dar de alta — el caso de la estética', () => {
    expect(schema.safeParse({ ...base, email: '', phone: '5544102263' }).success).toBe(true)
  })

  it('con solo correo también', () => {
    expect(schema.safeParse({ ...base, email: 'v@ejemplo.mx', phone: '' }).success).toBe(true)
  })

  it('con los dos, claro', () => {
    expect(schema.safeParse({ ...base, email: 'v@ejemplo.mx', phone: '5544102263' }).success).toBe(true)
  })

  it('sin ninguno de los dos NO se puede: quedaría un cliente incontactable', () => {
    expect(schema.safeParse({ ...base, email: '', phone: '' }).success).toBe(false)
  })

  it('un correo mal escrito sigue siendo un error, aunque sea opcional', () => {
    expect(schema.safeParse({ ...base, email: 'esto-no-es-correo', phone: '' }).success).toBe(false)
  })

  it('un teléfono demasiado corto sigue siendo un error', () => {
    expect(schema.safeParse({ ...base, email: '', phone: '55' }).success).toBe(false)
  })

  it('el nombre y el apellido siguen siendo obligatorios', () => {
    expect(schema.safeParse({ firstName: '', lastName: 'Núñez', email: '', phone: '5544102263' }).success).toBe(false)
    expect(schema.safeParse({ firstName: 'Valeria', lastName: '', email: '', phone: '5544102263' }).success).toBe(false)
  })
})
