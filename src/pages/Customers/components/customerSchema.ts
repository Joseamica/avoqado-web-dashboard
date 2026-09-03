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
      /**
       * 🔴 Fecha CIVIL, string sin conversión. El `<input type="date">` manda
       * 'YYYY-MM-DD' tal cual — convertirla a `Date` en el cliente cae en la trampa
       * de TZ del navegador (`new Date('1990-05-10')` es medianoche UTC, que en
       * México ya es el día 9). El servidor (Task 5) es quien la normaliza a fecha
       * civil real; aquí sólo se valida la FORMA.
       */
      birthDate: z
        .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('form.validation.birthDateInvalid'))])
        .default(''),
      /**
       * Consentimiento para campañas de correo (fase 0). Con `.default(false)` el
       * campo puede omitirse sin romper el `safeParse` — el formulario siempre lo
       * manda, pero un `parse` a mano (como el de las pruebas viejas de este
       * archivo) no tiene por qué conocerlo.
       */
      marketingConsent: z.boolean().default(false),
    })
    .refine(data => Boolean(data.email) || Boolean(data.phone), {
      message: t('form.validation.emailOrPhoneRequired'),
      path: ['email'],
    })
