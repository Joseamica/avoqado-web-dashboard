import { z } from 'zod'

/**
 * Validación del alta y edición de un cliente.
 *
 * 🔴 Correo O teléfono, no los dos. Es lo que el servidor valida de verdad
 * (`customer.schema.ts`: `email` opcional + `.refine(data => data.email || data.phone)`).
 * Exigir ambos dejaba fuera al caso más común del ICP: la estética o el gym que tiene el
 * TELÉFONO de su clienta y no su correo — no la podía dar de alta aunque el backend sí.
 */
export const createCustomerSchema = (t: (key: string) => string) =>
  z
    .object({
      firstName: z.string().min(1, t('form.validation.firstNameRequired')),
      lastName: z.string().min(1, t('form.validation.lastNameRequired')),
      email: z.union([z.literal(''), z.string().email(t('form.validation.emailInvalid'))]),
      phone: z.union([z.literal(''), z.string().min(10, t('form.validation.phoneInvalid'))]),
      customerGroupId: z.string().optional(),
    })
    .refine(data => Boolean(data.email) || Boolean(data.phone), {
      message: t('form.validation.emailOrPhoneRequired'),
      path: ['email'],
    })
