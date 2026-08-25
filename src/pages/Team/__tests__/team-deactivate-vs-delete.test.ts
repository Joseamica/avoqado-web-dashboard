import { describe, expect, it } from 'vitest'

import en from '@/locales/en/team.json'
import es from '@/locales/es/team.json'
import fr from '@/locales/fr/team.json'
import { canDeactivateTeamMember } from '@/lib/permissions/roleHierarchy'
import { StaffRole } from '@/types'

/**
 * La lista de equipo ofrecia "Eliminar" con un bote de basura rojo, pero la accion
 * solo desactiva: la persona sigue en pantalla marcada como inactiva y conserva su
 * historial. Es el comportamiento correcto — Square tampoco borra miembros — asi que
 * lo que estaba mal era el texto, no la operacion.
 */
describe('desactivar no es borrar: la lista de equipo debe decir lo que hace', () => {
  const locales = { es, en, fr } as Record<string, { actions: Record<string, string>; dialogs: Record<string, string> }>

  it.each(['es', 'en', 'fr'])('%s tiene el texto de desactivar que usa la lista', locale => {
    const t = locales[locale]
    expect(t.actions.deactivate, `${locale}: falta actions.deactivate`).toBeTruthy()
    expect(t.dialogs.deactivateConfirm, `${locale}: falta dialogs.deactivateConfirm`).toBeTruthy()
    expect(t.dialogs.deactivating, `${locale}: falta dialogs.deactivating`).toBeTruthy()
  })

  it.each([
    ['es', 'se conservan'],
    ['en', 'are kept'],
  ])('%s: el aviso de borrado permanente dice que las ventas se conservan', (locale, promise) => {
    // El borrado permanente quita el acceso y los datos de comision. Las ordenes y
    // los pagos siguen apuntando a esa persona, asi que el aviso tiene que decirlo:
    // antes enumeraba las ventas entre lo que se elimina, y eso era falso.
    expect(locales[locale].dialogs.hardDeleteDesc.toLowerCase()).toContain(promise)
  })
})

describe('canDeactivateTeamMember', () => {
  it('nunca ofrece desactivar a un OWNER, ni siquiera a otro OWNER', () => {
    expect(canDeactivateTeamMember(StaffRole.OWNER, StaffRole.OWNER)).toBe(false)
    expect(canDeactivateTeamMember(StaffRole.SUPERADMIN, StaffRole.OWNER)).toBe(false)
  })

  it('nunca ofrece desactivar a un SUPERADMIN', () => {
    expect(canDeactivateTeamMember(StaffRole.OWNER, StaffRole.SUPERADMIN)).toBe(false)
    expect(canDeactivateTeamMember(StaffRole.SUPERADMIN, StaffRole.SUPERADMIN)).toBe(false)
  })

  it('deja a un OWNER desactivar al personal por debajo de el', () => {
    expect(canDeactivateTeamMember(StaffRole.OWNER, StaffRole.MANAGER)).toBe(true)
    expect(canDeactivateTeamMember(StaffRole.OWNER, StaffRole.WAITER)).toBe(true)
  })

  it('no deja a un ADMIN tocar a alguien por encima de el', () => {
    expect(canDeactivateTeamMember(StaffRole.ADMIN, StaffRole.ADMIN)).toBe(true)
    expect(canDeactivateTeamMember(StaffRole.ADMIN, StaffRole.OWNER)).toBe(false)
  })

  it('no ofrece nada a un rol operativo', () => {
    expect(canDeactivateTeamMember(StaffRole.MANAGER, StaffRole.WAITER)).toBe(false)
    expect(canDeactivateTeamMember(StaffRole.WAITER, StaffRole.WAITER)).toBe(false)
  })

  it('no ofrece nada si todavia no se sabe quien es el usuario', () => {
    expect(canDeactivateTeamMember(undefined, StaffRole.WAITER)).toBe(false)
    expect(canDeactivateTeamMember(null, StaffRole.WAITER)).toBe(false)
  })
})
