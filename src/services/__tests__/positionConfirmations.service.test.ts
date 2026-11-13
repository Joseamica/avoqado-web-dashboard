/**
 * Candado de posiciones (tarifa al comercio, paso 1): cada servicio que puede cambiar la cuenta de una posición manda
 * `positionConfirmations` en el cuerpo — también los DELETE, que en axios van en `{ data }`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({ llamadas: [] as Array<[string, string, unknown?]> }))

vi.mock('@/api', () => {
  const anota = (metodo: string) => async (url: string, cuerpoOConfig?: unknown) => {
    red.llamadas.push([metodo, url, cuerpoOConfig])
    return { data: { data: {} } }
  }
  return { default: { get: anota('get'), post: anota('post'), put: anota('put'), patch: anota('patch'), delete: anota('delete') } }
})

import {
  createVenuePaymentConfig,
  createVenuePaymentConfigByVenueId,
  deleteVenuePaymentConfig,
  deleteVenuePaymentConfigByVenueId,
  fullSetupAngelPayMerchant,
  fullSetupBlumonMerchant,
  updateVenuePaymentConfig,
  updateVenuePaymentConfigByVenueId,
  type FullSetupAngelPayPayload,
  type FullSetupRequest,
} from '@/services/paymentProvider.service'
import { approveDiscoveredAngelPayMerchant, reserveAngelPaySlot } from '@/services/superadmin-angelpay-user-account.service'
import { deleteOrganizationPaymentConfig, setOrganizationPaymentConfig } from '@/services/superadmin-organizations.service'
import { transferVenue } from '@/services/superadmin.service'

const pc = { PRIMARY: { previousAccountId: 'acc-a', rate: { mode: 'KEEP' as const, fingerprint: 'huella' }, inheritingTerminals: 2 } }

describe('servicios que cambian una posición mandan positionConfirmations', () => {
  beforeEach(() => {
    red.llamadas.length = 0
  })

  it('los DELETE la mandan en el cuerpo (`data`)', async () => {
    await deleteVenuePaymentConfig('v1', pc)
    await deleteVenuePaymentConfigByVenueId('v1', 'cfg1', pc)
    await deleteOrganizationPaymentConfig('org1', pc)
    expect(red.llamadas).toEqual([
      ['delete', '/api/v1/dashboard/superadmin/venue-pricing/config/v1', { data: { positionConfirmations: pc } }],
      ['delete', '/api/v1/dashboard/venues/v1/payment-config/cfg1', { data: { positionConfirmations: pc } }],
      ['delete', '/api/v1/dashboard/superadmin/organizations/org1/payment-config', { data: { positionConfirmations: pc } }],
    ])
  })

  it('crear, editar, asistentes, aprobar, reservar y trasladar la llevan en el cuerpo', async () => {
    await createVenuePaymentConfig({ venueId: 'v1', primaryAccountId: 'acc-b', positionConfirmations: pc })
    await updateVenuePaymentConfig('v1', { primaryAccountId: 'acc-b', positionConfirmations: pc })
    await createVenuePaymentConfigByVenueId('v1', { primaryAccountId: 'acc-b', positionConfirmations: pc })
    await updateVenuePaymentConfigByVenueId('v1', 'cfg1', { primaryAccountId: 'acc-b', positionConfirmations: pc })
    await setOrganizationPaymentConfig('org1', { primaryAccountId: 'acc-b', positionConfirmations: pc })
    await fullSetupBlumonMerchant({ serialNumber: 's1', positionConfirmations: pc } as FullSetupRequest)
    await fullSetupAngelPayMerchant({ venueId: 'v1', positionConfirmations: pc } as FullSetupAngelPayPayload)
    await approveDiscoveredAngelPayMerchant({ venueId: 'v1', merchantAccountId: 'acc-b', slot: 'SECONDARY', positionConfirmations: pc })
    await reserveAngelPaySlot({ venueId: 'v1', slot: 'TERTIARY', positionConfirmations: pc })
    await transferVenue('v1', 'org2', pc)

    expect(red.llamadas.map(([metodo, url]) => `${metodo} ${url}`)).toEqual([
      'post /api/v1/dashboard/superadmin/venue-pricing/config',
      'put /api/v1/dashboard/superadmin/venue-pricing/config/v1',
      'post /api/v1/dashboard/venues/v1/payment-config',
      'put /api/v1/dashboard/venues/v1/payment-config/cfg1',
      'put /api/v1/dashboard/superadmin/organizations/org1/payment-config',
      'post /api/v1/superadmin/merchant-accounts/blumon/full-setup',
      'post /api/v1/superadmin/merchant-accounts/full-setup-angelpay',
      'post /api/v1/superadmin/venues/v1/angelpay-merchants/acc-b/approve',
      'post /api/v1/superadmin/venues/v1/angelpay-reserve-slot',
      'patch /api/v1/dashboard/superadmin/venues/v1/transfer',
    ])
    for (const [, url, cuerpo] of red.llamadas) {
      expect({ url, positionConfirmations: (cuerpo as { positionConfirmations?: unknown }).positionConfirmations }).toEqual({
        url,
        positionConfirmations: pc,
      })
    }
    expect(red.llamadas[7][2]).toEqual({ slot: 'SECONDARY', positionConfirmations: pc })
    expect(red.llamadas[9][2]).toEqual({ targetOrganizationId: 'org2', positionConfirmations: pc })
  })

  it('sin confirmaciones, aprobar y reservar no mandan el campo (cuerpo de siempre)', async () => {
    await approveDiscoveredAngelPayMerchant({ venueId: 'v1', merchantAccountId: 'acc-b' })
    await reserveAngelPaySlot({ venueId: 'v1' })
    expect(red.llamadas.map(([, , cuerpo]) => cuerpo)).toEqual([{ slot: 'PRIMARY' }, {}])
  })
})
