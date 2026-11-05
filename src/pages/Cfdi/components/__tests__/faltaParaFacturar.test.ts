/**
 * «Nueva factura» sin nada listo: la misma regla que el SERVIDOR (`loadOrderForCfdiFromDb` + `validateBeforeStamp`). Una venta sólo se
 * factura con un emisor con CSD activo y un comercio de ESE emisor con la facturación encendida; basta UNA pareja lista para dejar pasar:
 * con varios emisores o comercios, qué venta se puede facturar lo decide el servidor.
 */
import { describe, expect, it } from 'vitest'
import type { Emisor, FiscalConfig, MerchantConfig } from '@/services/cfdi.service'
import { queFaltaParaFacturar } from '../faltaParaFacturar'

const emisor = (id: string, csdStatus: Emisor['csdStatus']) => ({ id, csdStatus }) as Emisor
const comercio = (fiscalEmisorId: string, facturacionEnabled: boolean) => ({ fiscalEmisorId, facturacionEnabled }) as MerchantConfig
const config = (emisores: Emisor[], merchantConfigs: MerchantConfig[] = []): FiscalConfig => ({ emisores, merchantConfigs })

describe('queFaltaParaFacturar', () => {
  it('sin emisor ⇒ falta el emisor', () => {
    expect(queFaltaParaFacturar(config([]))).toBe('emisor')
  })

  it.each(['NONE', 'EXPIRED'] as const)('emisor con CSD %s, aunque su comercio esté encendido ⇒ falta el CSD', estado => {
    expect(queFaltaParaFacturar(config([emisor('e1', estado)], [comercio('e1', true)]))).toBe('csd')
  })

  it('CSD activo sin comercio, o con su comercio apagado ⇒ falta el comercio', () => {
    expect(queFaltaParaFacturar(config([emisor('e1', 'ACTIVE')]))).toBe('comercio')
    expect(queFaltaParaFacturar(config([emisor('e1', 'ACTIVE')], [comercio('e1', false)]))).toBe('comercio')
  })

  it('🔴 el comercio encendido es de OTRO emisor, sin CSD ⇒ no alcanza: el emisor listo no factura con ningún comercio', () => {
    expect(queFaltaParaFacturar(config([emisor('listo', 'ACTIVE'), emisor('sin', 'NONE')], [comercio('sin', true)]))).toBe('comercio')
  })

  it('todo listo ⇒ no falta nada', () => {
    expect(queFaltaParaFacturar(config([emisor('e1', 'ACTIVE')], [comercio('e1', true)]))).toBeNull()
  })

  it('🔴 una parte lista basta: otro emisor sin CSD u otro comercio apagado no bloquean a quien sí puede facturar', () => {
    const parcial = config([emisor('a', 'ACTIVE'), emisor('b', 'NONE')], [comercio('a', true), comercio('a', false), comercio('b', true)])
    expect(queFaltaParaFacturar(parcial)).toBeNull()
  })
})
