import type { PaymentLink } from '@/services/paymentLink.service'

/**
 * Una liga de un solo uso ya cobrada sigue ACTIVE en la base (el checkout la rechaza por `!isReusable && paymentCount > 0`).
 * Para quien la ve es «Pagada» (antes «Usada»; founder, 28-oct). La llave de traducción sigue siendo `status.used`.
 */
export const estaPagada = (link: Pick<PaymentLink, 'status' | 'isReusable' | 'paymentCount'>) =>
  link.status === 'ACTIVE' && !link.isReusable && (link.paymentCount || 0) > 0

const ETIQUETAS: Record<PaymentLink['status'], string> = {
  ACTIVE: 'status.active',
  PAUSED: 'status.paused',
  EXPIRED: 'status.expired',
  ARCHIVED: 'status.archived',
}

export const etiquetaDelEstado = (link: Pick<PaymentLink, 'status' | 'isReusable' | 'paymentCount'>) =>
  estaPagada(link) ? 'status.used' : ETIQUETAS[link.status] || link.status

export const varianteDelEstado = (link: Pick<PaymentLink, 'status' | 'isReusable' | 'paymentCount'>) =>
  estaPagada(link)
    ? ('outline' as const)
    : link.status === 'ACTIVE'
      ? ('default' as const)
      : link.status === 'PAUSED'
        ? ('secondary' as const)
        : ('outline' as const)
