import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { resumenDeSincronizacion } from '../resumenDeSincronizacion'

describe('resumenDeSincronizacion (spec pantalla del cliente §13)', () => {
  it('un servidor viejo (sin conteos) no se interpreta como «ninguna»', () => {
    expect(resumenDeSincronizacion({})).toEqual({ tipo: 'desconocido' })
    expect(resumenDeSincronizacion(null)).toEqual({ tipo: 'desconocido' })
    expect(resumenDeSincronizacion({ terminalsUpdated: '3', terminalsOmitted: 0 })).toEqual({ tipo: 'desconocido' })
  })
  it('todas las terminales recibieron el cambio', () => {
    expect(resumenDeSincronizacion({ terminalsUpdated: 4, terminalsOmitted: 0 })).toEqual({ tipo: 'todas', actualizadas: 4 })
  })
  it('algunas se mudaron a media operación', () => {
    expect(resumenDeSincronizacion({ terminalsUpdated: 3, terminalsOmitted: 1 })).toEqual({ tipo: 'parcial', actualizadas: 3, omitidas: 1 })
  })
  it('🔴 NINGUNA recibió el cambio: no puede decir «guardado» a secas', () => {
    expect(resumenDeSincronizacion({ terminalsUpdated: 0, terminalsOmitted: 2 })).toEqual({ tipo: 'ninguna', omitidas: 2 })
  })
  it('sólo se guardó lo del negocio (ningún ajuste de terminal en el cambio)', () => {
    expect(resumenDeSincronizacion({ terminalsUpdated: 0, terminalsOmitted: 0 })).toEqual({ tipo: 'soloNegocio' })
  })
  it('los textos existen en es y en', () => {
    for (const lng of ['es', 'en']) {
      const pt = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../../locales/${lng}/playtelecom.json`), 'utf-8'))
      const r = pt.tpvConfig.saveResult
      for (const k of ['title', 'all_one', 'all_other', 'partial', 'noneTitle', 'none_one', 'none_other', 'legacy'])
        expect(r?.[k], `${lng}:${k}`).toEqual(expect.any(String))
    }
  })
})
