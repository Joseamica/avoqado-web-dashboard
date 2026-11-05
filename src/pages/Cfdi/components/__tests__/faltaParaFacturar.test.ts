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

  // D11 opción A (founder, 5-nov, «el RFC basta»): un solo RFC con CSD y SIN comercios ligados factura sus ventas sin terminal.
  it('A: un solo RFC con CSD activo y sin ningún comercio ⇒ no falta nada (el RFC basta)', () => {
    expect(queFaltaParaFacturar(config([emisor('e1', 'ACTIVE')]))).toBeNull()
  })

  it('con su comercio apagado ⇒ falta el comercio (la regla de siempre)', () => {
    expect(queFaltaParaFacturar(config([emisor('e1', 'ACTIVE')], [comercio('e1', false)]))).toBe('comercio')
  })

  it('A: dos RFC y ningún comercio ⇒ sigue faltando el comercio (con varios RFC el servidor no elige)', () => {
    expect(queFaltaParaFacturar(config([emisor('a', 'ACTIVE'), emisor('b', 'ACTIVE')]))).toBe('comercio')
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
