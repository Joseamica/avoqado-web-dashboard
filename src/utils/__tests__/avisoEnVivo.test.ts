import { describe, expect, it } from 'vitest'
import { avisoEnVivoANotificacion } from '@/utils/notification.utils'

// D2 (4-nov): el evento `notification_new` del SERVIDOR trae `timestamp` pero no `createdAt`, y la campanita formateaba
// `createdAt` undefined ⇒ «Invalid DateTime». Al recargar la lista viene de la base con `createdAt` y se veía bien.
describe('avisoEnVivoANotificacion', () => {
  const base = { notificationId: 'n1', title: 'Tu archivo está listo', message: 'Órdenes: 10 filas', priority: 'NORMAL', isRead: false }

  it('🔴 sin createdAt usa el timestamp del evento (fecha válida, no «Invalid DateTime»)', () => {
    const n = avisoEnVivoANotificacion({ ...base, timestamp: '2026-11-04T16:20:00.000Z' })
    expect(n?.id).toBe('n1')
    expect(n?.createdAt).toBe('2026-11-04T16:20:00.000Z')
  })

  it('si el evento ya trae createdAt, lo respeta', () => {
    const n = avisoEnVivoANotificacion({ ...base, createdAt: '2026-11-04T10:00:00.000Z', timestamp: '2026-11-04T16:20:00.000Z' })
    expect(n?.createdAt).toBe('2026-11-04T10:00:00.000Z')
  })

  it('sin createdAt ni timestamp, la hora de llegada (una fecha ISO válida)', () => {
    const n = avisoEnVivoANotificacion(base)
    expect(Number.isNaN(new Date(n!.createdAt).getTime())).toBe(false)
  })

  it('acepta `id` en lugar de `notificationId`; sin ninguno, null', () => {
    expect(avisoEnVivoANotificacion({ ...base, notificationId: undefined, id: 'n2' })?.id).toBe('n2')
    expect(avisoEnVivoANotificacion({ ...base, notificationId: undefined })).toBeNull()
  })
})
