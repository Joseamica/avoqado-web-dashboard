import { describe, expect, it } from 'vitest'

import enNotifications from '@/locales/en/notifications.json'
import esNotifications from '@/locales/es/notifications.json'
import { NotificationChannel, NotificationType } from '@/services/notification.service'

import { getCategoryForType, getNotificationMetadata, notificationCategories } from '../categories'

// D4: los dos avisos nuevos del «No Show» se pueden apagar por persona desde DASHBOARD → Notificaciones. Las etiquetas viven
// en es y en (el francés ya no tiene soporte); sin ellas la pantalla de preferencias enseñaría la llave cruda.
const TIPOS_NUEVOS = [NotificationType.RESERVATION_NO_SHOW_SUMMARY, NotificationType.RESERVATION_NEEDS_REVIEW] as const

describe('preferencias de notificación — avisos de «No Show» (D4)', () => {
  it('los valores del enum son los mismos nombres que usa el servidor', () => {
    expect(NotificationType.RESERVATION_NO_SHOW_SUMMARY).toBe('RESERVATION_NO_SHOW_SUMMARY')
    expect(NotificationType.RESERVATION_NEEDS_REVIEW).toBe('RESERVATION_NEEDS_REVIEW')
  })

  it.each(TIPOS_NUEVOS)('%s vive en la categoría «reservations», prendido y por campanita + correo (el default del servidor)', tipo => {
    expect(getCategoryForType(tipo)?.id).toBe('reservations')
    const meta = getNotificationMetadata(tipo)
    expect(meta).toMatchObject({ defaultEnabled: true })
    expect(meta?.defaultChannels).toEqual([NotificationChannel.IN_APP, NotificationChannel.EMAIL])
  })

  // La campanita es la marca de «ya se avisó» del servidor: no se puede apagar. Sólo el correo se elige.
  it.each(TIPOS_NUEVOS)('%s sólo deja elegir el correo y no se puede apagar entero', tipo => {
    const meta = getNotificationMetadata(tipo)
    expect(meta?.availableChannels).toEqual([NotificationChannel.EMAIL])
    expect(meta?.canDisable).toBe(false)
  })

  it('el resto de los tipos no cambia: ninguno restringe canales y todos se pueden apagar', () => {
    for (const categoria of notificationCategories) {
      for (const meta of categoria.types) {
        if ((TIPOS_NUEVOS as readonly NotificationType[]).includes(meta.type)) continue
        expect(meta.availableChannels).toBeUndefined()
        expect(meta.canDisable).toBe(true)
      }
    }
  })

  it.each([
    ['es', esNotifications],
    ['en', enNotifications],
  ])('%s: la categoría y los dos tipos tienen nombre y descripción', (_lang, locale) => {
    expect(locale.categories).toHaveProperty('reservations')
    expect(locale.categoryDescriptions).toHaveProperty('reservations')
    for (const tipo of TIPOS_NUEVOS) {
      expect(locale.types).toHaveProperty(tipo)
      expect(locale.typeDescriptions).toHaveProperty(tipo)
    }
  })

  it('la descripción de cada tipo sólo promete lo que es cierto: apagarlo detiene el CORREO (la campanita es la marca de «enviado»)', () => {
    for (const tipo of TIPOS_NUEVOS) {
      for (const locale of [esNotifications, enNotifications]) {
        const descripcion = (locale.typeDescriptions as Record<string, string>)[tipo]
        expect(descripcion).toMatch(/correo|email/i)
        expect(descripcion).not.toMatch(/sin campanita|without the bell/i)
      }
    }
  })
})
