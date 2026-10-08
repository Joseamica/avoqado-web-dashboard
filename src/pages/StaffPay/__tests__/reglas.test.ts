import { describe, expect, it } from 'vitest'
import { erroresDeReglas, reglasDesdeVersion, reglasPayload } from '../reglas'

const apagadas = reglasDesdeVersion(null)

describe('reglas de clase (spec §6.6, §7.3): la misma validación que el server', () => {
  it('apagadas de fábrica: viajan como null y no tienen errores', () => {
    expect(erroresDeReglas(apagadas)).toEqual([])
    expect(reglasPayload(apagadas)).toEqual({ coverBonusHours: null, coverBonusAmount: null, lateCancelHours: null })
  })

  it('horas enteras de 1 a 168', () => {
    for (const h of ['0', '169', '1.5', '', '-1'])
      expect(erroresDeReglas({ ...apagadas, cancelacion: true, lateCancelHours: h })).toEqual(['lateHours'])
    for (const h of ['1', '168']) expect(erroresDeReglas({ ...apagadas, cancelacion: true, lateCancelHours: h })).toEqual([])
  })

  it('suplencia: si hay horas hay monto, y el monto va de $0.01 a $100,000 con dos decimales', () => {
    const sup = (h: string, a: string) => erroresDeReglas({ ...apagadas, suplencia: true, coverBonusHours: h, coverBonusAmount: a })
    expect(sup('3', '')).toEqual(['coverAmount'])
    expect(sup('', '100')).toEqual(['coverHours'])
    expect(sup('3', '0')).toEqual(['coverAmount'])
    expect(sup('3', '100000.01')).toEqual(['coverAmount'])
    expect(sup('3', '1.234')).toEqual(['coverAmount'])
    expect(sup('3', '100000')).toEqual([])
    expect(reglasPayload({ ...apagadas, suplencia: true, coverBonusHours: '3', coverBonusAmount: '100.5' })).toEqual({
      coverBonusHours: 3,
      coverBonusAmount: 100.5,
      lateCancelHours: null,
    })
  })

  it('apagada, una regla no valida lo que quedó escrito y viaja en null', () => {
    const escrita = { ...apagadas, coverBonusHours: '0', coverBonusAmount: 'x', lateCancelHours: '999' }
    expect(erroresDeReglas(escrita)).toEqual([])
    expect(reglasPayload(escrita)).toEqual({ coverBonusHours: null, coverBonusAmount: null, lateCancelHours: null })
  })

  it('la versión vigente se lee de vuelta tal cual', () => {
    const r = reglasDesdeVersion({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: 2 })
    expect(r).toEqual({ suplencia: true, coverBonusHours: '3', coverBonusAmount: '100', cancelacion: true, lateCancelHours: '2' })
    expect(reglasPayload(r)).toEqual({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: 2 })
  })

  it('un server previo sin reglas (undefined) se lee como apagadas', () => {
    expect(reglasDesdeVersion(undefined)).toEqual(apagadas)
    expect(apagadas).toEqual({ suplencia: false, coverBonusHours: '', coverBonusAmount: '', cancelacion: false, lateCancelHours: '' })
  })
})
