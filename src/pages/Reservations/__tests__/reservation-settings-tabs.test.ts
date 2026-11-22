import { describe, expect, it } from 'vitest'
import es from '@/locales/es/reservations.json'
import en from '@/locales/en/reservations.json'
import {
  FIELD_TAB,
  TOUR_TARGET_TAB,
  firstTabWithError,
  hashForTab,
  tabFromHash,
  tabOfField,
  tabsWithChanges,
} from '../reservation-settings-tabs'

describe('tabFromHash', () => {
  it('lee la pestaña de la dirección sin distinguir mayúsculas', () => {
    expect(tabFromHash('#clases')).toBe('clases')
    expect(tabFromHash('CITAS')).toBe('citas')
    expect(tabFromHash('#General')).toBe('general')
  })

  it('cualquier otra cosa o vacío es General', () => {
    expect(tabFromHash('#foo')).toBe('general')
    expect(tabFromHash('')).toBe('general')
    expect(tabFromHash('#')).toBe('general')
  })
})

describe('hashForTab', () => {
  it('escribe la pestaña como fragmento', () => {
    expect(hashForTab('citas')).toBe('#citas')
    expect(tabFromHash(hashForTab('clases'))).toBe('clases')
  })
})

describe('tabOfField — lo que el SERVIDOR aplica a los dos tipos va a General', () => {
  it('anticipación, confirmación automática, cupo en línea y créditos al cancelar son de General', () => {
    expect(tabOfField('minNoticeMin')).toBe('general')
    expect(tabOfField('maxAdvanceDays')).toBe('general')
    expect(tabOfField('autoConfirm')).toBe('general')
    expect(tabOfField('onlineCapacityPercent')).toBe('general')
    expect(tabOfField('creditRefundMode')).toBe('general')
    expect(tabOfField('creditNoShowRefund')).toBe('general')
    expect(tabOfField('depositMode')).toBe('general')
  })

  it('lo que sólo usan las citas va a Citas', () => {
    expect(tabOfField('capacityMode')).toBe('citas')
    expect(tabOfField('showStaffPicker')).toBe('citas')
    expect(tabOfField('appointmentUpfrontDefault')).toBe('citas')
  })

  it('intervalo, duración y máximo por horario van a General: el motor de horarios los aplica a todo producto sin sesión', () => {
    expect(tabOfField('slotIntervalMin')).toBe('general')
    expect(tabOfField('defaultDurationMin')).toBe('general')
    expect(tabOfField('pacingMaxPerSlot')).toBe('general')
  })

  it('el cobro de las clases va a Clases', () => {
    expect(tabOfField('classUpfrontDefault')).toBe('clases')
  })

  it('un campo desconocido o anidado se resuelve por su raíz, y si no existe es General', () => {
    expect(tabOfField('reminderMinBefore.0')).toBe('general')
    expect(tabOfField('capacityMode.algo')).toBe('citas')
    expect(tabOfField('noExiste')).toBe('general')
    expect(tabOfField('toString')).toBe('general')
  })

  it('sólo Clases y Citas guardan excepciones; todo lo demás del formulario es General', () => {
    const fueraDeGeneral = Object.entries(FIELD_TAB)
      .filter(([, tab]) => tab !== 'general')
      .map(([campo]) => campo)
      .sort()
    expect(fueraDeGeneral).toEqual(['appointmentUpfrontDefault', 'capacityMode', 'classUpfrontDefault', 'showStaffPicker'].sort())
  })
})

describe('firstTabWithError', () => {
  it('elige en orden General → Clases → Citas', () => {
    expect(firstTabWithError(['appointmentUpfrontDefault', 'classUpfrontDefault'])).toBe('clases')
    expect(firstTabWithError(['appointmentUpfrontDefault', 'waitlistMaxSize'])).toBe('general')
    expect(firstTabWithError(['appointmentUpfrontDefault'])).toBe('citas')
  })

  it('sin errores no hay pestaña', () => {
    expect(firstTabWithError([])).toBeNull()
  })
})

describe('tabsWithChanges', () => {
  it('marca las pestañas con algún campo cambiado, también listas', () => {
    const tabs = tabsWithChanges({ classUpfrontDefault: true, reminderChannels: [false, true] })
    expect([...tabs].sort()).toEqual(['clases', 'general'])
  })

  it('ignora campos que RHF reporta sin cambio', () => {
    expect(tabsWithChanges({ capacityMode: false, reminderChannels: [false, false] }).size).toBe(0)
  })
})

describe('TOUR_TARGET_TAB', () => {
  it('cada cobro tiene su destino en su pestaña y el destino viejo ya no existe', () => {
    expect(TOUR_TARGET_TAB['reservation-settings-payments-classes']).toBe('clases')
    expect(TOUR_TARGET_TAB['reservation-settings-payments-appointments']).toBe('citas')
    expect(TOUR_TARGET_TAB).not.toHaveProperty('reservation-settings-payments')
  })

  it('las secciones compartidas viven en General', () => {
    expect(TOUR_TARGET_TAB['reservation-settings-scheduling']).toBe('general')
    expect(TOUR_TARGET_TAB['reservation-settings-credit-refund']).toBe('general')
  })
})

describe('ayudas de General que no aplican a los dos tipos', () => {
  it('el % de cupo en línea dice que no cambia los horarios de las citas, sin prometer nada del personal', () => {
    expect(es.settings.pacing.onlineCapacityHelp).toMatch(/No cambia los horarios de las citas\./)
    expect(en.settings.pacing.onlineCapacityHelp).toMatch(/does not change appointment time slots\./i)
    expect(es.settings.pacing.onlineCapacityHelp).not.toMatch(/personal/i)
    expect(en.settings.pacing.onlineCapacityHelp).not.toMatch(/staff/i)
  })

  it('el modo de capacidad (pestaña Citas) avisa que también cambia la reserva manual del panel', () => {
    expect(es.settings.scheduling.capacityModeHelp).toMatch(/reserva manual del panel/)
    expect(en.settings.scheduling.capacityModeHelp).toMatch(/manual booking in the dashboard/i)
  })

  it('el tour de Programación no promete que todo aplica a clases y citas', () => {
    expect(es.settings.settingsTour.scheduling.description).not.toMatch(/Aplica a clases y citas\./)
    expect(en.settings.settingsTour.scheduling.description).not.toMatch(/Applies to classes and appointments\./)
  })
})
