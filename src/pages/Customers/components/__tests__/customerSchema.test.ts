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

/**
 * Cumpleaños (fase 0 de campañas de correo) y consentimiento de marketing.
 *
 * 🔴 `birthDate` es la fecha CIVIL que manda `<input type="date">`: 'YYYY-MM-DD' tal cual,
 * sin pasar por `Date` en el cliente — evita la trampa de TZ del navegador
 * (`new Date('1990-05-10')` cae en medianoche UTC, que en México ya es el día 9).
 */
describe('cumpleaños y consentimiento de marketing', () => {
  it('acepta birthDate vacío o YYYY-MM-DD; rechaza otros formatos', () => {
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '', birthDate: '', marketingConsent: false }).success).toBe(true)
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '', birthDate: '1990-05-10', marketingConsent: true }).success).toBe(true)
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '', birthDate: '10/05/1990', marketingConsent: false }).success).toBe(false)
  })

  it('omitir birthDate/marketingConsent no rompe el alta — quedan en sus valores por defecto', () => {
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '' }).success).toBe(true)
  })

  it('un formato con hora u otro separador tampoco pasa', () => {
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '', birthDate: '1990-05-10T00:00:00.000Z', marketingConsent: false }).success).toBe(false)
    expect(schema.safeParse({ ...base, email: 'a@b.mx', phone: '', birthDate: '1990/05/10', marketingConsent: false }).success).toBe(false)
  })
})
